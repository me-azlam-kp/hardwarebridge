using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace HardwareBridge.Services
{
    public interface IDeviceManager
    {
        Task StartDiscoveryAsync();
        Task StopDiscoveryAsync();
        Task<List<DeviceInfo>> EnumerateDevicesAsync();
        Task<DeviceInfo> GetDeviceAsync(string deviceId);
        Task WatchDevicesAsync(string connectionId);
        Task UnwatchDevicesAsync(string connectionId);
        Task<SystemHealth> GetSystemHealthAsync();
        event EventHandler<DeviceEvent> DeviceEvent;
    }

    public class DeviceManager : IDeviceManager, IDisposable
    {
        private readonly ILogger<DeviceManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWebSocketServer _webSocketServer;
        
        private readonly ConcurrentDictionary<string, DeviceInfo> _devices;
        private readonly ConcurrentDictionary<string, HashSet<string>> _deviceWatchers;
        private readonly ConcurrentDictionary<string, DeviceConnection> _connections;
        
        private Timer _discoveryTimer;
        private CancellationTokenSource _cancellationTokenSource;
        private bool _isDiscovering;

        public event EventHandler<DeviceEvent> DeviceEvent;

        public DeviceManager(
            ILogger<DeviceManager> logger,
            IOptionsMonitor<ServiceConfiguration> config,
            IServiceProvider serviceProvider,
            IWebSocketServer webSocketServer)
        {
            _logger = logger;
            _config = config;
            _serviceProvider = serviceProvider;
            _webSocketServer = webSocketServer;
            
            _devices = new ConcurrentDictionary<string, DeviceInfo>();
            _deviceWatchers = new ConcurrentDictionary<string, HashSet<string>>();
            _connections = new ConcurrentDictionary<string, DeviceConnection>();
        }

        public async Task StartDiscoveryAsync()
        {
            if (_isDiscovering)
            {
                _logger.LogWarning("Device discovery is already running");
                return;
            }

            try
            {
                _logger.LogInformation("Starting device discovery...");
                
                _cancellationTokenSource = new CancellationTokenSource();
                _isDiscovering = true;
                
                // Initial discovery
                await PerformDiscoveryAsync();
                
                // Schedule periodic discovery
                var config = _config.CurrentValue.Device;
                _discoveryTimer = new Timer(async _ =>
                {
                    await PerformDiscoveryAsync();
                }, null, config.DiscoveryInterval, config.DiscoveryInterval);
                
                _logger.LogInformation("Device discovery started successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start device discovery");
                throw;
            }
        }

        public async Task StopDiscoveryAsync()
        {
            if (!_isDiscovering)
            {
                _logger.LogWarning("Device discovery is not running");
                return;
            }

            try
            {
                _logger.LogInformation("Stopping device discovery...");
                
                _isDiscovering = false;
                _cancellationTokenSource?.Cancel();
                _discoveryTimer?.Dispose();
                
                // Close all device connections
                var closeTasks = _connections.Values.Select(conn => CloseDeviceConnectionAsync(conn.DeviceId));
                await Task.WhenAll(closeTasks);
                
                _logger.LogInformation("Device discovery stopped");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error stopping device discovery");
            }
        }

        public Task<List<DeviceInfo>> EnumerateDevicesAsync()
        {
            var devices = _devices.Values.ToList();
            return Task.FromResult(devices);
        }

        public Task<DeviceInfo> GetDeviceAsync(string deviceId)
        {
            if (_devices.TryGetValue(deviceId, out var device))
            {
                return Task.FromResult(device);
            }
            
            return Task.FromResult<DeviceInfo>(null);
        }

        public Task WatchDevicesAsync(string connectionId)
        {
            _deviceWatchers.AddOrUpdate("all", 
                new HashSet<string> { connectionId }, 
                (key, existing) =>
                {
                    existing.Add(connectionId);
                    return existing;
                });
            
            _logger.LogInformation("Connection {ConnectionId} started watching devices", connectionId);
            return Task.CompletedTask;
        }

        public Task UnwatchDevicesAsync(string connectionId)
        {
            foreach (var watchers in _deviceWatchers.Values)
            {
                watchers.Remove(connectionId);
            }
            
            _logger.LogInformation("Connection {ConnectionId} stopped watching devices", connectionId);
            return Task.CompletedTask;
        }

        public async Task<SystemHealth> GetSystemHealthAsync()
        {
            var health = new SystemHealth
            {
                TotalDevices = _devices.Count,
                ConnectedDevices = _connections.Count,
                Timestamp = DateTime.UtcNow
            };

            // Calculate device health by type
            var deviceHealth = new Dictionary<string, object>();
            var deviceTypes = _devices.Values.GroupBy(d => d.Type);
            
            foreach (var typeGroup in deviceTypes)
            {
                var type = typeGroup.Key;
                var total = typeGroup.Count();
                var connected = typeGroup.Count(d => d.IsConnected);
                var available = typeGroup.Count(d => d.Status == "available");
                
                deviceHealth[type] = new
                {
                    total,
                    connected,
                    available,
                    healthPercentage = total > 0 ? (double)connected / total * 100 : 0
                };
            }
            
            health.DeviceHealth = deviceHealth;
            
            // Determine overall status
            if (health.ConnectedDevices == 0 && health.TotalDevices > 0)
            {
                health.Status = "warning";
            }
            else if (health.TotalDevices == 0)
            {
                health.Status = "no_devices";
            }
            else
            {
                health.Status = "healthy";
            }

            return health;
        }

        private async Task PerformDiscoveryAsync()
        {
            try
            {
                _logger.LogDebug("Performing device discovery...");
                
                var config = _config.CurrentValue.Device;
                var discoveredDevices = new List<DeviceInfo>();

                // Discover printers
                if (config.EnablePrinterDiscovery)
                {
                    var printerManager = _serviceProvider.GetRequiredService<IPrinterManager>();
                    var printers = await printerManager.DiscoverPrintersAsync();
                    discoveredDevices.AddRange(printers);
                }

                // Discover serial ports
                if (config.EnableSerialPortDiscovery)
                {
                    var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
                    var serialPorts = await serialPortManager.DiscoverSerialPortsAsync();
                    discoveredDevices.AddRange(serialPorts);
                }

                // Discover USB HID devices
                if (config.EnableUsbHidDiscovery)
                {
                    var usbHidManager = _serviceProvider.GetRequiredService<IUsbHidManager>();
                    var usbDevices = await usbHidManager.DiscoverUsbHidDevicesAsync();
                    discoveredDevices.AddRange(usbDevices);
                }

                // Update device cache
                await UpdateDeviceCacheAsync(discoveredDevices);
                
                _logger.LogDebug("Device discovery completed. Found {Count} devices", discoveredDevices.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during device discovery");
            }
        }

        private async Task UpdateDeviceCacheAsync(List<DeviceInfo> discoveredDevices)
        {
            var currentDeviceIds = new HashSet<string>(_devices.Keys);
            var discoveredDeviceIds = new HashSet<string>(discoveredDevices.Select(d => d.Id));

            // Add or update discovered devices
            foreach (var device in discoveredDevices)
            {
                device.LastSeen = DateTime.UtcNow;
                
                if (_devices.TryGetValue(device.Id, out var existingDevice))
                {
                    // Update existing device
                    if (existingDevice.Status != device.Status || 
                        existingDevice.IsConnected != device.IsConnected)
                    {
                        // Device status changed, notify watchers
                        await NotifyDeviceEventAsync(new DeviceEvent
                        {
                            EventType = "status_changed",
                            DeviceId = device.Id,
                            DeviceType = device.Type,
                            Data = new Dictionary<string, object>
                            {
                                ["oldStatus"] = existingDevice.Status,
                                ["newStatus"] = device.Status,
                                ["oldConnected"] = existingDevice.IsConnected,
                                ["newConnected"] = device.IsConnected
                            }
                        });
                    }
                }
                else
                {
                    // New device discovered
                    await NotifyDeviceEventAsync(new DeviceEvent
                    {
                        EventType = "discovered",
                        DeviceId = device.Id,
                        DeviceType = device.Type,
                        Data = new Dictionary<string, object>
                        {
                            ["device"] = device
                        }
                    });
                }

                _devices.AddOrUpdate(device.Id, device, (key, existing) => device);
            }

            // Remove devices that are no longer present
            var removedDeviceIds = currentDeviceIds.Except(discoveredDeviceIds);
            foreach (var deviceId in removedDeviceIds)
            {
                if (_devices.TryRemove(deviceId, out var removedDevice))
                {
                    await NotifyDeviceEventAsync(new DeviceEvent
                    {
                        EventType = "removed",
                        DeviceId = deviceId,
                        DeviceType = removedDevice.Type
                    });
                }
            }
        }

        private async Task NotifyDeviceEventAsync(DeviceEvent deviceEvent)
        {
            try
            {
                DeviceEvent?.Invoke(this, deviceEvent);
                
                // Notify WebSocket watchers
                if (_deviceWatchers.TryGetValue("all", out var watchers) && watchers.Count > 0)
                {
                    var message = JsonConvert.SerializeObject(new
                    {
                        jsonrpc = "2.0",
                        method = "device.event",
                        @params = deviceEvent
                    });

                    var tasks = watchers.Select(connectionId => 
                        _webSocketServer.SendToConnectionAsync(connectionId, message));
                    
                    await Task.WhenAll(tasks);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error notifying device event");
            }
        }

        public async Task<bool> ConnectDeviceAsync(string deviceId, string connectionId)
        {
            try
            {
                if (!_devices.TryGetValue(deviceId, out var device))
                {
                    _logger.LogWarning("Device not found: {DeviceId}", deviceId);
                    return false;
                }

                if (device.IsConnected)
                {
                    _logger.LogWarning("Device already connected: {DeviceId}", deviceId);
                    return false;
                }

                var connection = new DeviceConnection
                {
                    ConnectionId = Guid.NewGuid().ToString(),
                    DeviceId = deviceId,
                    DeviceType = device.Type,
                    ConnectedAt = DateTime.UtcNow,
                    LastActivity = DateTime.UtcNow
                };

                // Connect based on device type
                bool connected = false;
                
                switch (device.Type)
                {
                    case "printer":
                        var printerManager = _serviceProvider.GetRequiredService<IPrinterManager>();
                        connected = await printerManager.ConnectAsync(deviceId);
                        break;
                        
                    case "serial":
                        var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
                        connected = await serialPortManager.ConnectAsync(deviceId);
                        break;
                        
                    case "usbhid":
                        var usbHidManager = _serviceProvider.GetRequiredService<IUsbHidManager>();
                        connected = await usbHidManager.ConnectAsync(deviceId);
                        break;
                }

                if (connected)
                {
                    device.IsConnected = true;
                    device.ConnectionId = connection.ConnectionId;
                    device.Status = "connected";
                    
                    _connections.TryAdd(connection.ConnectionId, connection);
                    
                    await NotifyDeviceEventAsync(new DeviceEvent
                    {
                        EventType = "connected",
                        DeviceId = deviceId,
                        DeviceType = device.Type,
                        Data = new Dictionary<string, object>
                        {
                            ["connectionId"] = connection.ConnectionId
                        }
                    });
                    
                    _logger.LogInformation("Device connected: {DeviceId}", deviceId);
                }

                return connected;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error connecting device: {DeviceId}", deviceId);
                return false;
            }
        }

        public async Task<bool> DisconnectDeviceAsync(string deviceId)
        {
            try
            {
                if (!_devices.TryGetValue(deviceId, out var device))
                {
                    return false;
                }

                if (!device.IsConnected)
                {
                    return true;
                }

                var connection = _connections.Values.FirstOrDefault(c => c.DeviceId == deviceId);
                if (connection != null)
                {
                    return await CloseDeviceConnectionAsync(connection.ConnectionId);
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disconnecting device: {DeviceId}", deviceId);
                return false;
            }
        }

        private async Task<bool> CloseDeviceConnectionAsync(string connectionId)
        {
            try
            {
                if (!_connections.TryRemove(connectionId, out var connection))
                {
                    return false;
                }

                // Disconnect based on device type
                bool disconnected = false;
                
                switch (connection.DeviceType)
                {
                    case "printer":
                        var printerManager = _serviceProvider.GetRequiredService<IPrinterManager>();
                        disconnected = await printerManager.DisconnectAsync(connection.DeviceId);
                        break;
                        
                    case "serial":
                        var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
                        disconnected = await serialPortManager.DisconnectAsync(connection.DeviceId);
                        break;
                        
                    case "usbhid":
                        var usbHidManager = _serviceProvider.GetRequiredService<IUsbHidManager>();
                        disconnected = await usbHidManager.DisconnectAsync(connection.DeviceId);
                        break;
                }

                if (disconnected && _devices.TryGetValue(connection.DeviceId, out var device))
                {
                    device.IsConnected = false;
                    device.ConnectionId = null;
                    device.Status = "available";
                    
                    await NotifyDeviceEventAsync(new DeviceEvent
                    {
                        EventType = "disconnected",
                        DeviceId = connection.DeviceId,
                        DeviceType = connection.DeviceType
                    });
                    
                    _logger.LogInformation("Device disconnected: {DeviceId}", connection.DeviceId);
                }

                return disconnected;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error closing device connection: {ConnectionId}", connectionId);
                return false;
            }
        }

        public void Dispose()
        {
            _discoveryTimer?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
}