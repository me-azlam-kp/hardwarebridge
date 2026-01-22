using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Security;
using System.Net.WebSockets;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace HardwareBridge.Services
{
    public interface IWebSocketServer
    {
        Task StartAsync();
        Task StopAsync();
        Task RestartAsync();
        Task BroadcastAsync(string message, string[] targetOrigins = null);
        Task SendToConnectionAsync(string connectionId, string message);
    }

    public class WebSocketServer : IWebSocketServer
    {
        private readonly ILogger<WebSocketServer> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly IServiceProvider _serviceProvider;
        private readonly IJsonRpcHandler _jsonRpcHandler;
        private readonly ICertificateManager _certificateManager;
        
        private HttpListener _httpListener;
        private readonly ConcurrentDictionary<string, WebSocketConnection> _connections;
        private readonly SemaphoreSlim _connectionSemaphore;
        private CancellationTokenSource _cancellationTokenSource;
        private Task _listenerTask;
        private bool _isRunning;

        public WebSocketServer(
            ILogger<WebSocketServer> logger,
            IOptionsMonitor<ServiceConfiguration> config,
            IServiceProvider serviceProvider,
            IJsonRpcHandler jsonRpcHandler,
            ICertificateManager certificateManager)
        {
            _logger = logger;
            _config = config;
            _serviceProvider = serviceProvider;
            _jsonRpcHandler = jsonRpcHandler;
            _certificateManager = certificateManager;
            _connections = new ConcurrentDictionary<string, WebSocketConnection>();
            _connectionSemaphore = new SemaphoreSlim(config.CurrentValue.WebSocket.MaxConnections);
        }

        public async Task StartAsync()
        {
            if (_isRunning)
            {
                _logger.LogWarning("WebSocket server is already running");
                return;
            }

            try
            {
                _logger.LogInformation("Starting WebSocket server...");
                
                var config = _config.CurrentValue.WebSocket;
                _cancellationTokenSource = new CancellationTokenSource();
                
                // Initialize HTTP listener
                _httpListener = new HttpListener();
                
                if (config.UseTls)
                {
                    // Ensure certificate is available
                    var certificate = await _certificateManager.GetCertificateAsync();
                    if (certificate == null)
                    {
                        throw new InvalidOperationException("TLS is enabled but no certificate is available");
                    }
                    
                    _httpListener.Prefixes.Add($"https://+:{config.Port}/");
                }
                else
                {
                    _httpListener.Prefixes.Add($"http://+:{config.Port}/");
                }

                _httpListener.Start();
                _isRunning = true;
                
                _logger.LogInformation("WebSocket server listening on port {Port}", config.Port);
                
                // Start listener task
                _listenerTask = Task.Run(() => ListenAsync(_cancellationTokenSource.Token));
                
                _logger.LogInformation("WebSocket server started successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start WebSocket server");
                throw;
            }
        }

        public async Task StopAsync()
        {
            if (!_isRunning)
            {
                _logger.LogWarning("WebSocket server is not running");
                return;
            }

            try
            {
                _logger.LogInformation("Stopping WebSocket server...");
                
                _cancellationTokenSource?.Cancel();
                _httpListener?.Stop();
                _isRunning = false;
                
                // Close all connections
                var closeTasks = _connections.Values.Select(conn => conn.CloseAsync());
                await Task.WhenAll(closeTasks);
                _connections.Clear();
                
                if (_listenerTask != null)
                {
                    await _listenerTask;
                }
                
                _httpListener?.Close();
                _cancellationTokenSource?.Dispose();
                
                _logger.LogInformation("WebSocket server stopped");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error stopping WebSocket server");
            }
        }

        public async Task RestartAsync()
        {
            await StopAsync();
            await StartAsync();
        }

        public async Task BroadcastAsync(string message, string[] targetOrigins = null)
        {
            var tasks = _connections.Values
                .Where(conn => targetOrigins == null || targetOrigins.Contains(conn.Origin))
                .Select(conn => conn.SendAsync(message));
            
            await Task.WhenAll(tasks);
        }

        public async Task SendToConnectionAsync(string connectionId, string message)
        {
            if (_connections.TryGetValue(connectionId, out var connection))
            {
                await connection.SendAsync(message);
            }
        }

        private async Task ListenAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && _httpListener.IsListening)
            {
                try
                {
                    var context = await _httpListener.GetContextAsync();
                    _ = Task.Run(() => HandleConnectionAsync(context, cancellationToken), cancellationToken);
                }
                catch (ObjectDisposedException)
                {
                    // Listener was stopped
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error accepting connection");
                }
            }
        }

        private async Task HandleConnectionAsync(HttpListenerContext context, CancellationToken cancellationToken)
        {
            var config = _config.CurrentValue;
            var request = context.Request;
            var response = context.Response;
            
            try
            {
                // Validate origin
                if (config.Security.EnableOriginValidation && !IsOriginAllowed(request, config.WebSocket.AllowedOrigins))
                {
                    _logger.LogWarning("Connection from unauthorized origin: {Origin}", request.Headers["Origin"]);
                    response.StatusCode = 403;
                    response.Close();
                    return;
                }

                // Handle WebSocket upgrade
                if (!request.IsWebSocketRequest)
                {
                    response.StatusCode = 426;
                    response.Close();
                    return;
                }

                // Check connection limit
                if (!_connectionSemaphore.Wait(0))
                {
                    _logger.LogWarning("Connection limit reached");
                    response.StatusCode = 503;
                    response.Close();
                    return;
                }

                var webSocketContext = await context.AcceptWebSocketAsync(null);
                var webSocket = webSocketContext.WebSocket;
                var connectionId = Guid.NewGuid().ToString();
                var origin = request.Headers["Origin"] ?? "unknown";
                
                var connection = new WebSocketConnection(
                    connectionId,
                    origin,
                    webSocket,
                    _jsonRpcHandler,
                    _logger,
                    () =>
                    {
                        _connections.TryRemove(connectionId, out _);
                        _connectionSemaphore.Release();
                    });

                _connections.TryAdd(connectionId, connection);
                
                _logger.LogInformation("WebSocket connection established: {ConnectionId} from {Origin}", 
                    connectionId, origin);
                
                // Handle the connection
                await connection.HandleAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling WebSocket connection");
                response.StatusCode = 500;
                response.Close();
            }
        }

        private bool IsOriginAllowed(HttpListenerRequest request, string[] allowedOrigins)
        {
            var origin = request.Headers["Origin"];
            
            if (string.IsNullOrEmpty(origin))
                return false;
            
            if (allowedOrigins.Contains("*"))
                return true;
            
            return allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
        }
    }

    public class WebSocketConnection
    {
        private readonly string _connectionId;
        private readonly string _origin;
        private readonly WebSocket _webSocket;
        private readonly IJsonRpcHandler _jsonRpcHandler;
        private readonly ILogger _logger;
        private readonly Action _onClose;
        private readonly SemaphoreSlim _sendSemaphore;

        public string ConnectionId => _connectionId;
        public string Origin => _origin;

        public WebSocketConnection(
            string connectionId,
            string origin,
            WebSocket webSocket,
            IJsonRpcHandler jsonRpcHandler,
            ILogger logger,
            Action onClose)
        {
            _connectionId = connectionId;
            _origin = origin;
            _webSocket = webSocket;
            _jsonRpcHandler = jsonRpcHandler;
            _logger = logger;
            _onClose = onClose;
            _sendSemaphore = new SemaphoreSlim(1, 1);
        }

        public async Task HandleAsync(CancellationToken cancellationToken)
        {
            var buffer = new ArraySegment<byte>(new byte[8192]);
            
            try
            {
                while (_webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
                {
                    var result = await _webSocket.ReceiveAsync(buffer, cancellationToken);
                    
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }
                    
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer.Array, 0, result.Count);
                        await HandleMessageAsync(message);
                    }
                }
            }
            catch (WebSocketException ex)
            {
                _logger.LogError(ex, "WebSocket error for connection {ConnectionId}", _connectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling connection {ConnectionId}", _connectionId);
            }
            finally
            {
                await CloseAsync();
            }
        }

        private async Task HandleMessageAsync(string message)
        {
            try
            {
                _logger.LogDebug("Received message from {ConnectionId}: {Message}", _connectionId, message);
                
                var response = await _jsonRpcHandler.HandleMessageAsync(message, _connectionId);
                
                if (!string.IsNullOrEmpty(response))
                {
                    await SendAsync(response);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling message from {ConnectionId}", _connectionId);
                
                // Send error response
                var errorResponse = new
                {
                    jsonrpc = "2.0",
                    error = new
                    {
                        code = -32603,
                        message = "Internal error"
                    },
                    id = (string)null
                };
                
                await SendAsync(JsonConvert.SerializeObject(errorResponse));
            }
        }

        public async Task SendAsync(string message)
        {
            if (_webSocket.State != WebSocketState.Open)
            {
                return;
            }

            await _sendSemaphore.WaitAsync();
            try
            {
                var buffer = Encoding.UTF8.GetBytes(message);
                var segment = new ArraySegment<byte>(buffer);
                
                await _webSocket.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
                
                _logger.LogDebug("Sent message to {ConnectionId}: {Message}", _connectionId, message);
            }
            finally
            {
                _sendSemaphore.Release();
            }
        }

        public async Task CloseAsync()
        {
            if (_webSocket.State == WebSocketState.Open || _webSocket.State == WebSocketState.CloseReceived)
            {
                try
                {
                    await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error closing WebSocket connection {ConnectionId}", _connectionId);
                }
            }

            _webSocket?.Dispose();
            _sendSemaphore?.Dispose();
            _onClose?.Invoke();
            
            _logger.LogInformation("WebSocket connection closed: {ConnectionId}", _connectionId);
        }
    }
}