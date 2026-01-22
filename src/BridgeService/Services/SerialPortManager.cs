using System;
using System.Collections.Generic;
using System.IO.Ports;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HardwareBridge.Services
{
    public interface ISerialPortManager
    {
        Task<List<DeviceInfo>> DiscoverSerialPortsAsync();
        Task<bool> ConnectAsync(string deviceId);
        Task<bool> DisconnectAsync(string deviceId);
        Task<SerialPortConnectionResult> OpenAsync(string deviceId, SerialPortConfig config);
        Task<SerialPortConnectionResult> CloseAsync(string deviceId);
        Task<SerialDataResult> SendDataAsync(string deviceId, string data);
        Task<SerialDataResult> ReceiveDataAsync(string deviceId, int maxBytes, int timeout);
        Task<SerialPortStatus> GetStatusAsync(string deviceId);
    }

    public class SerialPortManager : ISerialPortManager
    {
        private readonly ILogger<SerialPortManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly Dictionary<string, SerialPortConnection> _connections;
        private readonly SemaphoreSlim _connectionSemaphore;

        public SerialPortManager(
            ILogger<SerialPortManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _connections = new Dictionary<string, SerialPortConnection>();
            _connectionSemaphore = new SemaphoreSlim(config.CurrentValue.Device.ConnectionPoolSize);
        }

        public Task<List<DeviceInfo>> DiscoverSerialPortsAsync()
        {
            try
            {
                _logger.LogDebug("Discovering serial ports...");
                
                var ports = new List<DeviceInfo>();
                var portNames = SerialPort.GetPortNames();
                
                foreach (var portName in portNames)
                {
                    try
                    {
                        var device = new SerialPortDevice
                        {
                            Id = $"serial_{portName.ToLower().Replace(" ", "_")}",
                            Name = portName,
                            PortName = portName,
                            Type = "serial",
                            Status = "available",
                            IsConnected = false,
                            BaudRate = 9600,
                            Parity = "None",
                            DataBits = 8,
                            StopBits = "1",
                            FlowControl = "None"
                        };

                        // Try to get more information about the port
                        try
                        {
                            using (var port = new SerialPort(portName))
                            {
                                device.Manufacturer = "Unknown";
                                device.Model = portName;
                                device.Properties = new Dictionary<string, object>
                                {
                                    ["PortName"] = portName,
                                    ["IsOpen"] = port.IsOpen
                                };
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to get detailed info for serial port {PortName}", portName);
                        }

                        ports.Add(device);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing serial port {PortName}", portName);
                    }
                }

                _logger.LogInformation("Discovered {Count} serial ports", ports.Count);
                return Task.FromResult(ports);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error discovering serial ports");
                return Task.FromResult(new List<DeviceInfo>());
            }
        }

        public Task<bool> ConnectAsync(string deviceId)
        {
            // For serial ports, connection is handled by OpenAsync with specific configuration
            return Task.FromResult(true);
        }

        public Task<bool> DisconnectAsync(string deviceId)
        {
            return CloseAsync(deviceId).ContinueWith(t => t.Result.Success);
        }

        public async Task<SerialPortConnectionResult> OpenAsync(string deviceId, SerialPortConfig config)
        {
            try
            {
                _logger.LogInformation("Opening serial port: {DeviceId} with config {@Config}", deviceId, config);
                
                await _connectionSemaphore.WaitAsync();
                
                try
                {
                    // Extract port name from device ID
                    var portName = ExtractPortNameFromDeviceId(deviceId);
                    if (string.IsNullOrEmpty(portName))
                    {
                        throw new ArgumentException($"Invalid device ID: {deviceId}");
                    }

                    // Check if already connected
                    if (_connections.ContainsKey(deviceId))
                    {
                        throw new InvalidOperationException($"Serial port already open: {portName}");
                    }

                    // Create and configure serial port
                    var serialPort = new SerialPort(portName)
                    {
                        BaudRate = config.BaudRate,
                        Parity = (Parity)Enum.Parse(typeof(Parity), config.Parity),
                        DataBits = config.DataBits,
                        StopBits = (StopBits)Enum.Parse(typeof(StopBits), config.StopBits),
                        Handshake = (Handshake)Enum.Parse(typeof(Handshake), config.FlowControl),
                        ReadTimeout = (int)_config.CurrentValue.Device.SerialPort.ReadTimeout.TotalMilliseconds,
                        WriteTimeout = (int)_config.CurrentValue.Device.SerialPort.WriteTimeout.TotalMilliseconds,
                        Encoding = Encoding.UTF8
                    };

                    // Set up data received event
                    var connection = new SerialPortConnection
                    {
                        DeviceId = deviceId,
                        Port = serialPort,
                        Config = config,
                        IsOpen = false,
                        ReceivedData = new List<byte>()
                    };

                    serialPort.DataReceived += (sender, e) =>
                    {
                        try
                        {
                            var bytesToRead = serialPort.BytesToRead;
                            var buffer = new byte[bytesToRead];
                            var bytesRead = serialPort.Read(buffer, 0, bytesToRead);
                            
                            lock (connection.ReceivedData)
                            {
                                connection.ReceivedData.AddRange(buffer.Take(bytesRead));
                            }
                            
                            _logger.LogDebug("Received {BytesRead} bytes on {PortName}", bytesRead, portName);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error receiving data on {PortName}", portName);
                        }
                    };

                    // Open the port
                    serialPort.Open();
                    connection.IsOpen = true;
                    connection.OpenedAt = DateTime.UtcNow;

                    _connections[deviceId] = connection;

                    _logger.LogInformation("Serial port opened successfully: {PortName}", portName);
                    
                    return new SerialPortConnectionResult
                    {
                        Success = true,
                        PortName = portName,
                        Config = config,
                        OpenedAt = connection.OpenedAt
                    };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error opening serial port: {PortName}", portName);
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error opening serial port: {DeviceId}", deviceId);
                return new SerialPortConnectionResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
            finally
            {
                _connectionSemaphore.Release();
            }
        }

        public async Task<SerialPortConnectionResult> CloseAsync(string deviceId)
        {
            try
            {
                _logger.LogInformation("Closing serial port: {DeviceId}", deviceId);
                
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new SerialPortConnectionResult
                    {
                        Success = false,
                        Error = "Serial port not open"
                    };
                }

                try
                {
                    if (connection.Port.IsOpen)
                    {
                        connection.Port.Close();
                    }
                    
                    connection.Port.Dispose();
                    connection.IsOpen = false;
                    connection.ClosedAt = DateTime.UtcNow;

                    _connections.Remove(deviceId);

                    _logger.LogInformation("Serial port closed successfully: {PortName}", connection.Port.PortName);
                    
                    return new SerialPortConnectionResult
                    {
                        Success = true,
                        PortName = connection.Port.PortName,
                        ClosedAt = connection.ClosedAt
                    };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error closing serial port: {PortName}", connection.Port.PortName);
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error closing serial port: {DeviceId}", deviceId);
                return new SerialPortConnectionResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<SerialDataResult> SendDataAsync(string deviceId, string data)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new SerialDataResult
                    {
                        Success = false,
                        Error = "Serial port not open"
                    };
                }

                if (!connection.IsOpen)
                {
                    return new SerialDataResult
                    {
                        Success = false,
                        Error = "Serial port is closed"
                    };
                }

                var bytes = Encoding.UTF8.GetBytes(data);
                
                await Task.Run(() =>
                {
                    connection.Port.Write(bytes, 0, bytes.Length);
                });

                connection.LastActivity = DateTime.UtcNow;

                _logger.LogDebug("Sent {BytesSent} bytes to {PortName}", bytes.Length, connection.Port.PortName);
                
                return new SerialDataResult
                {
                    Success = true,
                    BytesTransferred = bytes.Length,
                    Data = data
                };
            }
            catch (TimeoutException ex)
            {
                _logger.LogError(ex, "Timeout sending data to serial port: {DeviceId}", deviceId);
                return new SerialDataResult
                {
                    Success = false,
                    Error = "Write timeout"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending data to serial port: {DeviceId}", deviceId);
                return new SerialDataResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<SerialDataResult> ReceiveDataAsync(string deviceId, int maxBytes, int timeout)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new SerialDataResult
                    {
                        Success = false,
                        Error = "Serial port not open"
                    };
                }

                if (!connection.IsOpen)
                {
                    return new SerialDataResult
                    {
                        Success = false,
                        Error = "Serial port is closed"
                    };
                }

                var cts = new CancellationTokenSource(timeout);
                var result = await Task.Run(() =>
                {
                    var buffer = new byte[maxBytes];
                    var totalBytesRead = 0;
                    var startTime = DateTime.UtcNow;

                    while (totalBytesRead < maxBytes && !cts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            if (connection.Port.BytesToRead > 0)
                            {
                                var bytesToRead = Math.Min(connection.Port.BytesToRead, maxBytes - totalBytesRead);
                                var bytesRead = connection.Port.Read(buffer, totalBytesRead, bytesToRead);
                                totalBytesRead += bytesRead;
                                
                                // Reset timeout since we received data
                                startTime = DateTime.UtcNow;
                            }
                            else
                            {
                                // Check if we've exceeded the timeout
                                if ((DateTime.UtcNow - startTime).TotalMilliseconds > timeout)
                                {
                                    break;
                                }
                                
                                Thread.Sleep(10); // Small delay to prevent busy waiting
                            }
                        }
                        catch (TimeoutException)
                        {
                            // Timeout is expected, just return what we have
                            break;
                        }
                    }

                    if (totalBytesRead > 0)
                    {
                        var receivedData = new byte[totalBytesRead];
                        Array.Copy(buffer, receivedData, totalBytesRead);
                        return receivedData;
                    }

                    return new byte[0];
                }, cts.Token);

                connection.LastActivity = DateTime.UtcNow;

                var dataString = result.Length > 0 ? Encoding.UTF8.GetString(result) : "";
                
                _logger.LogDebug("Received {BytesReceived} bytes from {PortName}", result.Length, connection.Port.PortName);
                
                return new SerialDataResult
                {
                    Success = true,
                    BytesTransferred = result.Length,
                    Data = dataString
                };
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Timeout receiving data from serial port: {DeviceId}", deviceId);
                return new SerialDataResult
                {
                    Success = false,
                    Error = "Read timeout"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error receiving data from serial port: {DeviceId}", deviceId);
                return new SerialDataResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public Task<SerialPortStatus> GetStatusAsync(string deviceId)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return Task.FromResult(new SerialPortStatus
                    {
                        IsConnected = false,
                        Status = "disconnected"
                    });
                }

                var port = connection.Port;
                var status = new SerialPortStatus
                {
                    IsConnected = connection.IsOpen,
                    Status = connection.IsOpen ? "connected" : "disconnected",
                    PortName = port.PortName,
                    BaudRate = port.BaudRate,
                    Parity = port.Parity.ToString(),
                    DataBits = port.DataBits,
                    StopBits = port.StopBits.ToString(),
                    FlowControl = port.Handshake.ToString(),
                    BytesToRead = port.BytesToRead,
                    BytesToWrite = port.BytesToWrite,
                    IsOpen = port.IsOpen,
                    CDHolding = port.CDHolding,
                    CtsHolding = port.CtsHolding,
                    DsrHolding = port.DsrHolding,
                    ConnectedAt = connection.OpenedAt,
                    LastActivity = connection.LastActivity
                };

                return Task.FromResult(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting serial port status for {DeviceId}", deviceId);
                return Task.FromResult(new SerialPortStatus
                {
                    IsConnected = false,
                    Status = "error",
                    Error = ex.Message
                });
            }
        }

        #region Private Methods

        private string ExtractPortNameFromDeviceId(string deviceId)
        {
            // Device ID format: "serial_com1" or "serial_com3"
            if (deviceId.StartsWith("serial_"))
            {
                var portName = deviceId.Substring(7).Replace("_", "").ToUpper();
                if (portName.StartsWith("COM"))
                {
                    return portName;
                }
            }
            return null;
        }

        #endregion
    }

    public class SerialPortConnection
    {
        public string DeviceId { get; set; }
        public SerialPort Port { get; set; }
        public SerialPortConfig Config { get; set; }
        public bool IsOpen { get; set; }
        public DateTime OpenedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public List<byte> ReceivedData { get; set; }
    }

    public class SerialPortConnectionResult
    {
        public bool Success { get; set; }
        public string PortName { get; set; }
        public SerialPortConfig Config { get; set; }
        public DateTime? OpenedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string Error { get; set; }
    }

    public class SerialDataResult
    {
        public bool Success { get; set; }
        public int BytesTransferred { get; set; }
        public string Data { get; set; }
        public string Error { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class SerialPortStatus
    {
        public bool IsConnected { get; set; }
        public string Status { get; set; }
        public string PortName { get; set; }
        public int BaudRate { get; set; }
        public string Parity { get; set; }
        public int DataBits { get; set; }
        public string StopBits { get; set; }
        public string FlowControl { get; set; }
        public int BytesToRead { get; set; }
        public int BytesToWrite { get; set; }
        public bool IsOpen { get; set; }
        public bool CDHolding { get; set; }
        public bool CtsHolding { get; set; }
        public bool DsrHolding { get; set; }
        public DateTime? ConnectedAt { get; set; }
        public DateTime? LastActivity { get; set; }
        public string Error { get; set; }
    }
}