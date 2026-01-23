using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace BridgeUI.Services;

public class BridgeServiceClient : IDisposable
{
    private ClientWebSocket? _webSocket;
    private CancellationTokenSource? _cts;
    private Task? _receiveTask;
    private readonly ConcurrentDictionary<string, TaskCompletionSource<JToken>> _pendingRequests = new();
    private int _requestId;
    private bool _disposed;

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 9443;
    public bool IsConnected => _webSocket?.State == WebSocketState.Open;

    public event EventHandler<JObject>? OnNotification;
    public event EventHandler<bool>? OnConnectionChanged;

    public async Task ConnectAsync()
    {
        if (IsConnected) return;

        _cts = new CancellationTokenSource();
        _webSocket = new ClientWebSocket();

        try
        {
            var uri = new Uri($"ws://{Host}:{Port}");
            await _webSocket.ConnectAsync(uri, _cts.Token);
            _receiveTask = ReceiveLoopAsync(_cts.Token);
            OnConnectionChanged?.Invoke(this, true);
        }
        catch (Exception)
        {
            OnConnectionChanged?.Invoke(this, false);
            throw;
        }
    }

    public async Task DisconnectAsync()
    {
        if (_webSocket == null) return;

        try
        {
            _cts?.Cancel();
            if (_webSocket.State == WebSocketState.Open)
            {
                await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
            }
        }
        catch { }
        finally
        {
            _webSocket?.Dispose();
            _webSocket = null;
            OnConnectionChanged?.Invoke(this, false);
        }
    }

    public async Task<T?> SendRequestAsync<T>(string method, object? parameters = null)
    {
        var result = await SendRequestAsync(method, parameters);
        if (result == null) return default;
        return result.ToObject<T>();
    }

    public async Task<JToken?> SendRequestAsync(string method, object? parameters = null)
    {
        if (!IsConnected)
        {
            throw new InvalidOperationException("Not connected to service");
        }

        var id = Interlocked.Increment(ref _requestId).ToString();
        var request = new JObject
        {
            ["jsonrpc"] = "2.0",
            ["method"] = method,
            ["id"] = id
        };

        if (parameters != null)
        {
            request["params"] = JToken.FromObject(parameters);
        }

        var tcs = new TaskCompletionSource<JToken>();
        _pendingRequests[id] = tcs;

        try
        {
            var json = request.ToString(Formatting.None);
            var bytes = Encoding.UTF8.GetBytes(json);
            await _webSocket!.SendAsync(bytes, WebSocketMessageType.Text, true, _cts!.Token);

            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token, timeoutCts.Token);

            var completedTask = await Task.WhenAny(tcs.Task, Task.Delay(Timeout.Infinite, linkedCts.Token));
            if (completedTask != tcs.Task)
            {
                throw new TimeoutException($"Request '{method}' timed out");
            }

            return await tcs.Task;
        }
        finally
        {
            _pendingRequests.TryRemove(id, out _);
        }
    }

    private async Task ReceiveLoopAsync(CancellationToken token)
    {
        var buffer = new byte[8192];
        var messageBuffer = new StringBuilder();

        while (!token.IsCancellationRequested && _webSocket?.State == WebSocketState.Open)
        {
            try
            {
                var result = await _webSocket.ReceiveAsync(buffer, token);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    OnConnectionChanged?.Invoke(this, false);
                    break;
                }

                messageBuffer.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));

                if (result.EndOfMessage)
                {
                    var message = messageBuffer.ToString();
                    messageBuffer.Clear();
                    ProcessMessage(message);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (WebSocketException)
            {
                OnConnectionChanged?.Invoke(this, false);
                break;
            }
        }
    }

    private void ProcessMessage(string message)
    {
        try
        {
            var json = JObject.Parse(message);

            // Check if it's a response (has id)
            var id = json["id"]?.Value<string>();
            if (id != null && _pendingRequests.TryRemove(id, out var tcs))
            {
                if (json["error"] != null)
                {
                    var errorMsg = json["error"]?["message"]?.Value<string>() ?? "Unknown error";
                    tcs.SetException(new Exception(errorMsg));
                }
                else
                {
                    tcs.SetResult(json["result"] ?? new JObject());
                }
            }
            else if (json["method"] != null)
            {
                // It's a notification
                OnNotification?.Invoke(this, json);
            }
        }
        catch { }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts?.Cancel();
        _webSocket?.Dispose();
        _cts?.Dispose();
    }
}
