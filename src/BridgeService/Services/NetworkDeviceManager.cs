using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HardwareBridge.Services
{
    public interface INetworkDeviceManager
    {
        Task<NetworkConnectionResult> ConnectAsync(string deviceId, string host, int port, string protocol = "tcp");
        Task<NetworkConnectionResult> DisconnectAsync(string deviceId);
        Task<NetworkPingResult> PingAsync(string deviceId, string host, int port);
        Task<NetworkDeviceStatus> GetStatusAsync(string deviceId);
        Task<List<DiscoveredNetworkDevice>> DiscoverAsync(string subnet, int[] ports, int timeout = 3000, int maxConcurrent = 50);
        Task<NetworkSendResult> SendDataAsync(string deviceId, string data);
        Task<List<DeviceInfo>> GetConnectedDevicesAsync();
    }

    public class NetworkDeviceManager : INetworkDeviceManager, IDisposable
    {
        private readonly ILogger<NetworkDeviceManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly ConcurrentDictionary<string, NetworkConnection> _connections;
        private bool _disposed;

        public NetworkDeviceManager(
            ILogger<NetworkDeviceManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _connections = new ConcurrentDictionary<string, NetworkConnection>();
        }

        public async Task<NetworkConnectionResult> ConnectAsync(string deviceId, string host, int port, string protocol = "tcp")
        {
            try
            {
                if (_connections.ContainsKey(deviceId))
                {
                    return new NetworkConnectionResult
                    {
                        Success = false,
                        Error = "Device is already connected"
                    };
                }

                var socket = new TcpClient();
                var connectTask = socket.ConnectAsync(host, port);
                var timeoutTask = Task.Delay(10000);

                if (await Task.WhenAny(connectTask, timeoutTask) == timeoutTask)
                {
                    socket.Dispose();
                    return new NetworkConnectionResult
                    {
                        Success = false,
                        Error = "Connection timed out"
                    };
                }

                await connectTask;

                var connection = new NetworkConnection
                {
                    DeviceId = deviceId,
                    Host = host,
                    Port = port,
                    Protocol = protocol,
                    Client = socket,
                    ConnectedAt = DateTime.UtcNow,
                    LastActivity = DateTime.UtcNow
                };

                _connections[deviceId] = connection;

                _logger.LogInformation("Connected to network device {DeviceId} at {Host}:{Port}", deviceId, host, port);

                return new NetworkConnectionResult
                {
                    Success = true,
                    DeviceId = deviceId,
                    Host = host,
                    Port = port
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error connecting to network device {DeviceId} at {Host}:{Port}", deviceId, host, port);
                return new NetworkConnectionResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<NetworkConnectionResult> DisconnectAsync(string deviceId)
        {
            try
            {
                if (!_connections.TryRemove(deviceId, out var connection))
                {
                    return new NetworkConnectionResult
                    {
                        Success = false,
                        Error = "Device is not connected"
                    };
                }

                connection.Client?.Close();
                connection.Client?.Dispose();

                _logger.LogInformation("Disconnected network device {DeviceId}", deviceId);

                return new NetworkConnectionResult
                {
                    Success = true,
                    DeviceId = deviceId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disconnecting network device {DeviceId}", deviceId);
                return new NetworkConnectionResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<NetworkPingResult> PingAsync(string deviceId, string host, int port)
        {
            var sw = Stopwatch.StartNew();

            try
            {
                using var client = new TcpClient();
                var connectTask = client.ConnectAsync(host, port);
                var timeoutTask = Task.Delay(5000);

                if (await Task.WhenAny(connectTask, timeoutTask) == timeoutTask)
                {
                    return new NetworkPingResult
                    {
                        Success = false,
                        Host = host,
                        Port = port,
                        Error = "Ping timed out"
                    };
                }

                await connectTask;
                sw.Stop();

                return new NetworkPingResult
                {
                    Success = true,
                    Host = host,
                    Port = port,
                    ResponseTime = sw.ElapsedMilliseconds,
                    Timestamp = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new NetworkPingResult
                {
                    Success = false,
                    Host = host,
                    Port = port,
                    ResponseTime = sw.ElapsedMilliseconds,
                    Error = ex.Message
                };
            }
        }

        public Task<NetworkDeviceStatus> GetStatusAsync(string deviceId)
        {
            if (_connections.TryGetValue(deviceId, out var connection))
            {
                var isConnected = connection.Client?.Connected ?? false;

                return Task.FromResult(new NetworkDeviceStatus
                {
                    DeviceId = deviceId,
                    Connected = isConnected,
                    Host = connection.Host,
                    Port = connection.Port,
                    Protocol = connection.Protocol,
                    ConnectedAt = connection.ConnectedAt,
                    LastActivity = connection.LastActivity,
                    BytesSent = connection.BytesSent,
                    BytesReceived = connection.BytesReceived
                });
            }

            return Task.FromResult(new NetworkDeviceStatus
            {
                DeviceId = deviceId,
                Connected = false
            });
        }

        public async Task<List<DiscoveredNetworkDevice>> DiscoverAsync(string subnet, int[] ports, int timeout = 3000, int maxConcurrent = 50)
        {
            var discovered = new ConcurrentBag<DiscoveredNetworkDevice>();
            var semaphore = new SemaphoreSlim(maxConcurrent);

            if (ports == null || ports.Length == 0)
            {
                ports = new[] { 9100, 631, 515, 4370 };
            }

            if (string.IsNullOrEmpty(subnet))
            {
                subnet = GetLocalSubnet();
            }

            _logger.LogInformation("Starting network discovery on subnet {Subnet} for ports {Ports}", subnet, string.Join(",", ports));

            var tasks = new List<Task>();

            for (int i = 1; i <= 254; i++)
            {
                var host = $"{subnet}.{i}";

                foreach (var port in ports)
                {
                    var currentHost = host;
                    var currentPort = port;

                    tasks.Add(Task.Run(async () =>
                    {
                        await semaphore.WaitAsync();
                        try
                        {
                            using var client = new TcpClient();
                            var connectTask = client.ConnectAsync(currentHost, currentPort);
                            var timeoutTask = Task.Delay(timeout);

                            if (await Task.WhenAny(connectTask, timeoutTask) == connectTask && client.Connected)
                            {
                                discovered.Add(new DiscoveredNetworkDevice
                                {
                                    Host = currentHost,
                                    Port = currentPort,
                                    Protocol = "tcp",
                                    DiscoveredAt = DateTime.UtcNow,
                                    DeviceType = GuessDeviceType(currentPort)
                                });

                                _logger.LogDebug("Discovered device at {Host}:{Port}", currentHost, currentPort);
                            }
                        }
                        catch
                        {
                            // Connection failed - device not available on this port
                        }
                        finally
                        {
                            semaphore.Release();
                        }
                    }));
                }
            }

            await Task.WhenAll(tasks);

            var result = discovered.ToList();
            _logger.LogInformation("Network discovery completed. Found {Count} devices", result.Count);

            return result;
        }

        public async Task<NetworkSendResult> SendDataAsync(string deviceId, string data)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new NetworkSendResult
                    {
                        Success = false,
                        Error = "Device is not connected"
                    };
                }

                if (connection.Client == null || !connection.Client.Connected)
                {
                    _connections.TryRemove(deviceId, out _);
                    return new NetworkSendResult
                    {
                        Success = false,
                        Error = "Connection is closed"
                    };
                }

                var bytes = Encoding.UTF8.GetBytes(data);
                var stream = connection.Client.GetStream();
                await stream.WriteAsync(bytes, 0, bytes.Length);
                await stream.FlushAsync();

                connection.BytesSent += bytes.Length;
                connection.LastActivity = DateTime.UtcNow;

                return new NetworkSendResult
                {
                    Success = true,
                    BytesSent = bytes.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending data to network device {DeviceId}", deviceId);
                return new NetworkSendResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public Task<List<DeviceInfo>> GetConnectedDevicesAsync()
        {
            var devices = _connections.Values.Select(conn => new DeviceInfo
            {
                Id = conn.DeviceId,
                Name = $"Network Device ({conn.Host}:{conn.Port})",
                Type = "network",
                Status = conn.Client?.Connected == true ? "connected" : "disconnected",
                IsConnected = conn.Client?.Connected ?? false,
                LastSeen = conn.LastActivity,
                Properties = new Dictionary<string, object>
                {
                    ["host"] = conn.Host,
                    ["port"] = conn.Port,
                    ["protocol"] = conn.Protocol
                }
            }).ToList();

            return Task.FromResult(devices);
        }

        private string GetLocalSubnet()
        {
            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                var localIp = host.AddressList
                    .FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(a));

                if (localIp != null)
                {
                    var parts = localIp.ToString().Split('.');
                    return $"{parts[0]}.{parts[1]}.{parts[2]}";
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not determine local subnet");
            }

            return "192.168.1";
        }

        private string GuessDeviceType(int port)
        {
            return port switch
            {
                9100 => "printer",
                631 => "printer",
                515 => "printer",
                4370 => "biometric",
                _ => "unknown"
            };
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            foreach (var connection in _connections.Values)
            {
                try
                {
                    connection.Client?.Close();
                    connection.Client?.Dispose();
                }
                catch { }
            }

            _connections.Clear();
        }
    }

    public class NetworkConnection
    {
        public string DeviceId { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public string Protocol { get; set; }
        public TcpClient Client { get; set; }
        public DateTime ConnectedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public long BytesSent { get; set; }
        public long BytesReceived { get; set; }
    }

    public class NetworkConnectionResult
    {
        public bool Success { get; set; }
        public string DeviceId { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public string Error { get; set; }
    }

    public class NetworkPingResult
    {
        public bool Success { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public long ResponseTime { get; set; }
        public DateTime Timestamp { get; set; }
        public string Error { get; set; }
    }

    public class NetworkDeviceStatus
    {
        public string DeviceId { get; set; }
        public bool Connected { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public string Protocol { get; set; }
        public DateTime ConnectedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public long BytesSent { get; set; }
        public long BytesReceived { get; set; }
    }

    public class DiscoveredNetworkDevice
    {
        public string Host { get; set; }
        public int Port { get; set; }
        public string Protocol { get; set; }
        public string DeviceType { get; set; }
        public DateTime DiscoveredAt { get; set; }
    }

    public class NetworkSendResult
    {
        public bool Success { get; set; }
        public int BytesSent { get; set; }
        public string Error { get; set; }
    }
}
