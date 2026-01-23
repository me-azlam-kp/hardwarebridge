using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace HardwareBridge.Services
{
    public interface IJsonRpcHandler
    {
        Task<string> HandleMessageAsync(string message, string connectionId);
    }

    public class JsonRpcHandler : IJsonRpcHandler
    {
        private readonly ILogger<JsonRpcHandler> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly Dictionary<string, Func<JObject, string, Task<JToken>>> _methods;

        public JsonRpcHandler(
            ILogger<JsonRpcHandler> logger,
            IServiceProvider serviceProvider)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _methods = new Dictionary<string, Func<JObject, string, Task<JToken>>>();
            
            RegisterMethods();
        }

        public async Task<string> HandleMessageAsync(string message, string connectionId)
        {
            try
            {
                _logger.LogDebug("Handling JSON-RPC message: {Message}", message);
                
                var request = JsonConvert.DeserializeObject<JObject>(message);
                
                if (request == null)
                {
                    return CreateErrorResponse(null, -32700, "Parse error");
                }

                // Validate JSON-RPC 2.0 format
                if (!IsValidJsonRpcRequest(request))
                {
                    return CreateErrorResponse(request["id"], -32600, "Invalid Request");
                }

                var method = request["method"]?.ToString();
                var id = request["id"];
                var parameters = request["params"];

                if (string.IsNullOrEmpty(method))
                {
                    return CreateErrorResponse(id, -32600, "Method not specified");
                }

                // Check if method exists
                if (!_methods.ContainsKey(method))
                {
                    return CreateErrorResponse(id, -32601, "Method not found");
                }

                try
                {
                    // Execute method
                    var result = await _methods[method](parameters as JObject, connectionId);
                    
                    // Create success response
                    return CreateSuccessResponse(id, result);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error executing method {Method}", method);
                    return CreateErrorResponse(id, -32603, "Internal error", ex.Message);
                }
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "JSON parsing error");
                return CreateErrorResponse(null, -32700, "Parse error");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling JSON-RPC message");
                return CreateErrorResponse(null, -32603, "Internal error");
            }
        }

        private void RegisterMethods()
        {
            // Device discovery methods
            _methods["devices.enumerate"] = EnumerateDevicesAsync;
            _methods["devices.get"] = GetDeviceAsync;
            _methods["devices.watch"] = WatchDevicesAsync;
            _methods["devices.unwatch"] = UnwatchDevicesAsync;

            // Printer methods
            _methods["printer.print"] = PrintAsync;
            _methods["printer.getStatus"] = GetPrinterStatusAsync;
            _methods["printer.getCapabilities"] = GetPrinterCapabilitiesAsync;

            // Serial port methods
            _methods["serial.open"] = OpenSerialPortAsync;
            _methods["serial.close"] = CloseSerialPortAsync;
            _methods["serial.send"] = SendSerialDataAsync;
            _methods["serial.receive"] = ReceiveSerialDataAsync;
            _methods["serial.getStatus"] = GetSerialPortStatusAsync;

            // USB HID methods
            _methods["usb.open"] = OpenUsbDeviceAsync;
            _methods["usb.close"] = CloseUsbDeviceAsync;
            _methods["usb.sendReport"] = SendUsbReportAsync;
            _methods["usb.receiveReport"] = ReceiveUsbReportAsync;
            _methods["usb.getStatus"] = GetUsbDeviceStatusAsync;

            // Network methods
            _methods["network.connect"] = ConnectNetworkDeviceAsync;
            _methods["network.disconnect"] = DisconnectNetworkDeviceAsync;
            _methods["network.ping"] = PingNetworkDeviceAsync;
            _methods["network.getStatus"] = GetNetworkDeviceStatusAsync;
            _methods["network.discover"] = DiscoverNetworkDevicesAsync;
            _methods["network.send"] = SendNetworkDataAsync;

            // Biometric methods
            _methods["biometric.enroll"] = EnrollBiometricAsync;
            _methods["biometric.authenticate"] = AuthenticateBiometricAsync;
            _methods["biometric.identify"] = IdentifyBiometricAsync;
            _methods["biometric.getStatus"] = GetBiometricStatusAsync;
            _methods["biometric.getUsers"] = GetBiometricUsersAsync;
            _methods["biometric.deleteUser"] = DeleteBiometricUserAsync;

            // Settings methods
            _methods["settings.get"] = GetSettingsAsync;
            _methods["settings.save"] = SaveSettingsAsync;

            // System methods
            _methods["system.getInfo"] = GetSystemInfoAsync;
            _methods["system.getHealth"] = GetSystemHealthAsync;
            _methods["system.restart"] = RestartSystemAsync;

            // Queue methods
            _methods["queue.getStatus"] = GetQueueStatusAsync;
            _methods["queue.getJobs"] = GetQueueJobsAsync;
            _methods["queue.cancelJob"] = CancelQueueJobAsync;
        }

        private bool IsValidJsonRpcRequest(JObject request)
        {
            return request["jsonrpc"]?.ToString() == "2.0" &&
                   request["method"] != null;
        }

        private string CreateSuccessResponse(JToken id, JToken result)
        {
            var response = new JObject
            {
                ["jsonrpc"] = "2.0",
                ["result"] = result ?? new JObject(),
                ["id"] = id
            };

            return response.ToString(Formatting.None);
        }

        private string CreateErrorResponse(JToken id, int code, string message, string data = null)
        {
            var error = new JObject
            {
                ["code"] = code,
                ["message"] = message
            };

            if (!string.IsNullOrEmpty(data))
            {
                error["data"] = data;
            }

            var response = new JObject
            {
                ["jsonrpc"] = "2.0",
                ["error"] = error,
                ["id"] = id
            };

            return response.ToString(Formatting.None);
        }

        #region Device Methods

        private async Task<JToken> EnumerateDevicesAsync(JObject parameters, string connectionId)
        {
            var deviceManager = _serviceProvider.GetRequiredService<IDeviceManager>();
            var devices = await deviceManager.EnumerateDevicesAsync();
            
            return JToken.FromObject(new
            {
                devices = devices,
                timestamp = DateTime.UtcNow
            });
        }

        private async Task<JToken> GetDeviceAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var deviceManager = _serviceProvider.GetRequiredService<IDeviceManager>();
            var device = await deviceManager.GetDeviceAsync(deviceId);
            
            return JToken.FromObject(device);
        }

        private async Task<JToken> WatchDevicesAsync(JObject parameters, string connectionId)
        {
            var deviceManager = _serviceProvider.GetRequiredService<IDeviceManager>();
            await deviceManager.WatchDevicesAsync(connectionId);
            
            return JToken.FromObject(new { success = true });
        }

        private async Task<JToken> UnwatchDevicesAsync(JObject parameters, string connectionId)
        {
            var deviceManager = _serviceProvider.GetRequiredService<IDeviceManager>();
            await deviceManager.UnwatchDevicesAsync(connectionId);
            
            return JToken.FromObject(new { success = true });
        }

        #endregion

        #region Printer Methods

        private async Task<JToken> PrintAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var data = parameters?["data"]?.Value<string>();
            var format = parameters?["format"]?.Value<string>() ?? "raw";

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(data))
            {
                throw new ArgumentException("Device ID and data are required");
            }

            var printerManager = _serviceProvider.GetService<IPrinterManager>();
            if (printerManager == null)
            {
                throw new InvalidOperationException("Printer support is not available on this platform");
            }

            var result = await printerManager.PrintAsync(deviceId, data, format);
            return JToken.FromObject(result);
        }

        private async Task<JToken> GetPrinterStatusAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var printerManager = _serviceProvider.GetService<IPrinterManager>();
            if (printerManager == null)
            {
                throw new InvalidOperationException("Printer support is not available on this platform");
            }

            var status = await printerManager.GetStatusAsync(deviceId);
            return JToken.FromObject(status);
        }

        private async Task<JToken> GetPrinterCapabilitiesAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var printerManager = _serviceProvider.GetService<IPrinterManager>();
            if (printerManager == null)
            {
                throw new InvalidOperationException("Printer support is not available on this platform");
            }

            var capabilities = await printerManager.GetCapabilitiesAsync(deviceId);
            return JToken.FromObject(capabilities);
        }

        #endregion

        #region Serial Port Methods

        private async Task<JToken> OpenSerialPortAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var baudRate = parameters?["baudRate"]?.Value<int>() ?? 9600;
            var parity = parameters?["parity"]?.Value<string>() ?? "None";
            var dataBits = parameters?["dataBits"]?.Value<int>() ?? 8;
            var stopBits = parameters?["stopBits"]?.Value<string>() ?? "1";
            var flowControl = parameters?["flowControl"]?.Value<string>() ?? "None";
            
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
            var result = await serialPortManager.OpenAsync(deviceId, new SerialPortConfig
            {
                BaudRate = baudRate,
                Parity = parity,
                DataBits = dataBits,
                StopBits = stopBits,
                FlowControl = flowControl
            });
            
            return JToken.FromObject(result);
        }

        private async Task<JToken> CloseSerialPortAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
            var result = await serialPortManager.CloseAsync(deviceId);
            
            return JToken.FromObject(result);
        }

        private async Task<JToken> SendSerialDataAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var data = parameters?["data"]?.Value<string>();
            
            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(data))
            {
                throw new ArgumentException("Device ID and data are required");
            }

            var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
            var result = await serialPortManager.SendDataAsync(deviceId, data);
            
            return JToken.FromObject(result);
        }

        private async Task<JToken> ReceiveSerialDataAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var maxBytes = parameters?["maxBytes"]?.Value<int>() ?? 1024;
            var timeout = parameters?["timeout"]?.Value<int>() ?? 10000;
            
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
            var result = await serialPortManager.ReceiveDataAsync(deviceId, maxBytes, timeout);
            
            return JToken.FromObject(result);
        }

        private async Task<JToken> GetSerialPortStatusAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var serialPortManager = _serviceProvider.GetRequiredService<ISerialPortManager>();
            var status = await serialPortManager.GetStatusAsync(deviceId);
            
            return JToken.FromObject(status);
        }

        #endregion

        #region USB HID Methods

        private async Task<JToken> OpenUsbDeviceAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var usbHidManager = _serviceProvider.GetService<IUsbHidManager>();
            if (usbHidManager == null)
            {
                throw new InvalidOperationException("USB HID support is not available on this platform");
            }

            var result = await usbHidManager.OpenAsync(deviceId);
            return JToken.FromObject(result);
        }

        private async Task<JToken> CloseUsbDeviceAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var usbHidManager = _serviceProvider.GetService<IUsbHidManager>();
            if (usbHidManager == null)
            {
                throw new InvalidOperationException("USB HID support is not available on this platform");
            }

            var result = await usbHidManager.CloseAsync(deviceId);
            return JToken.FromObject(result);
        }

        private async Task<JToken> SendUsbReportAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var reportId = parameters?["reportId"]?.Value<byte>() ?? 0;
            var data = parameters?["data"]?.Value<string>();

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(data))
            {
                throw new ArgumentException("Device ID and data are required");
            }

            var usbHidManager = _serviceProvider.GetService<IUsbHidManager>();
            if (usbHidManager == null)
            {
                throw new InvalidOperationException("USB HID support is not available on this platform");
            }

            var result = await usbHidManager.SendReportAsync(deviceId, reportId, data);
            return JToken.FromObject(result);
        }

        private async Task<JToken> ReceiveUsbReportAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var reportId = parameters?["reportId"]?.Value<byte>() ?? 0;
            var timeout = parameters?["timeout"]?.Value<int>() ?? 5000;

            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var usbHidManager = _serviceProvider.GetService<IUsbHidManager>();
            if (usbHidManager == null)
            {
                throw new InvalidOperationException("USB HID support is not available on this platform");
            }

            var result = await usbHidManager.ReceiveReportAsync(deviceId, reportId, timeout);
            return JToken.FromObject(result);
        }

        private async Task<JToken> GetUsbDeviceStatusAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var usbHidManager = _serviceProvider.GetService<IUsbHidManager>();
            if (usbHidManager == null)
            {
                throw new InvalidOperationException("USB HID support is not available on this platform");
            }

            var status = await usbHidManager.GetStatusAsync(deviceId);
            return JToken.FromObject(status);
        }

        #endregion

        #region Settings Methods

        private async Task<JToken> GetSettingsAsync(JObject parameters, string connectionId)
        {
            var settingsManager = _serviceProvider.GetRequiredService<ISettingsManager>();
            var settings = await settingsManager.LoadSettingsAsync();
            return JToken.FromObject(settings);
        }

        private async Task<JToken> SaveSettingsAsync(JObject parameters, string connectionId)
        {
            var settingsManager = _serviceProvider.GetRequiredService<ISettingsManager>();
            var settings = parameters?.ToObject<ServiceConfiguration>();

            if (settings == null)
            {
                throw new ArgumentException("Settings object is required");
            }

            await settingsManager.SaveSettingsAsync(settings);

            // Restart WebSocket server to apply changes
            var webSocketServer = _serviceProvider.GetRequiredService<IWebSocketServer>();
            await webSocketServer.RestartAsync();

            return JToken.FromObject(new { success = true, message = "Settings saved and service restarted" });
        }

        #endregion

        #region System Methods

        private async Task<JToken> GetSystemInfoAsync(JObject parameters, string connectionId)
        {
            return JToken.FromObject(new
            {
                version = "1.0.0",
                platform = "Windows",
                timestamp = DateTime.UtcNow,
                uptime = Environment.TickCount
            });
        }

        private async Task<JToken> GetSystemHealthAsync(JObject parameters, string connectionId)
        {
            var deviceManager = _serviceProvider.GetRequiredService<IDeviceManager>();
            var health = await deviceManager.GetSystemHealthAsync();
            
            return JToken.FromObject(health);
        }

        private async Task<JToken> RestartSystemAsync(JObject parameters, string connectionId)
        {
            _logger.LogWarning("System restart requested by connection {ConnectionId}", connectionId);

            // Schedule a restart by stopping and restarting the hosted service
            // The process manager (PM2, systemd, Windows Service) will handle the actual restart
            _ = Task.Run(async () =>
            {
                await Task.Delay(1000);
                Environment.Exit(0);
            });

            return JToken.FromObject(new
            {
                success = true,
                message = "Service restart initiated"
            });
        }

        #endregion

        #region Network Methods

        private async Task<JToken> ConnectNetworkDeviceAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var host = parameters?["host"]?.Value<string>();
            var port = parameters?["port"]?.Value<int>() ?? 9100;
            var protocol = parameters?["protocol"]?.Value<string>() ?? "tcp";

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(host))
            {
                throw new ArgumentException("Device ID and host are required");
            }

            var networkManager = _serviceProvider.GetRequiredService<INetworkDeviceManager>();
            var result = await networkManager.ConnectAsync(deviceId, host, port, protocol);

            return JToken.FromObject(result);
        }

        private async Task<JToken> DisconnectNetworkDeviceAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var networkManager = _serviceProvider.GetRequiredService<INetworkDeviceManager>();
            var result = await networkManager.DisconnectAsync(deviceId);

            return JToken.FromObject(result);
        }

        private async Task<JToken> PingNetworkDeviceAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var host = parameters?["host"]?.Value<string>();
            var port = parameters?["port"]?.Value<int>() ?? 9100;

            if (string.IsNullOrEmpty(host))
            {
                throw new ArgumentException("Host is required");
            }

            var networkManager = _serviceProvider.GetRequiredService<INetworkDeviceManager>();
            var result = await networkManager.PingAsync(deviceId ?? "unknown", host, port);

            return JToken.FromObject(result);
        }

        private async Task<JToken> GetNetworkDeviceStatusAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var networkManager = _serviceProvider.GetRequiredService<INetworkDeviceManager>();
            var status = await networkManager.GetStatusAsync(deviceId);

            return JToken.FromObject(status);
        }

        private async Task<JToken> DiscoverNetworkDevicesAsync(JObject parameters, string connectionId)
        {
            var subnet = parameters?["subnet"]?.Value<string>();
            var portsToken = parameters?["ports"];
            var timeout = parameters?["timeout"]?.Value<int>() ?? 3000;
            var maxConcurrent = parameters?["maxConcurrent"]?.Value<int>() ?? 50;

            int[] ports = null;
            if (portsToken is JArray portsArray)
            {
                ports = portsArray.Select(p => p.Value<int>()).ToArray();
            }

            var networkManager = _serviceProvider.GetRequiredService<INetworkDeviceManager>();
            var devices = await networkManager.DiscoverAsync(subnet, ports, timeout, maxConcurrent);

            return JToken.FromObject(new { devices, count = devices.Count });
        }

        private async Task<JToken> SendNetworkDataAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var data = parameters?["data"]?.Value<string>();

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(data))
            {
                throw new ArgumentException("Device ID and data are required");
            }

            var networkManager = _serviceProvider.GetRequiredService<INetworkDeviceManager>();
            var result = await networkManager.SendDataAsync(deviceId, data);

            return JToken.FromObject(result);
        }

        #endregion

        #region Biometric Methods

        private async Task<JToken> EnrollBiometricAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var userId = parameters?["userId"]?.Value<string>();
            var userName = parameters?["userName"]?.Value<string>();
            var biometricData = parameters?["biometricData"]?.Value<string>();

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("Device ID and user ID are required");
            }

            var biometricManager = _serviceProvider.GetRequiredService<IBiometricManager>();
            var result = await biometricManager.EnrollAsync(deviceId, userId, userName, biometricData);

            return JToken.FromObject(result);
        }

        private async Task<JToken> AuthenticateBiometricAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var userId = parameters?["userId"]?.Value<string>();
            var biometricData = parameters?["biometricData"]?.Value<string>();

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("Device ID and user ID are required");
            }

            var biometricManager = _serviceProvider.GetRequiredService<IBiometricManager>();
            var result = await biometricManager.AuthenticateAsync(deviceId, userId, biometricData);

            return JToken.FromObject(result);
        }

        private async Task<JToken> IdentifyBiometricAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var biometricData = parameters?["biometricData"]?.Value<string>();

            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var biometricManager = _serviceProvider.GetRequiredService<IBiometricManager>();
            var result = await biometricManager.IdentifyAsync(deviceId, biometricData);

            return JToken.FromObject(result);
        }

        private async Task<JToken> GetBiometricStatusAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var biometricManager = _serviceProvider.GetRequiredService<IBiometricManager>();
            var status = await biometricManager.GetStatusAsync(deviceId);

            return JToken.FromObject(status);
        }

        private async Task<JToken> GetBiometricUsersAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            if (string.IsNullOrEmpty(deviceId))
            {
                throw new ArgumentException("Device ID is required");
            }

            var biometricManager = _serviceProvider.GetRequiredService<IBiometricManager>();
            var users = await biometricManager.GetUsersAsync(deviceId);

            return JToken.FromObject(new { users, count = users.Count });
        }

        private async Task<JToken> DeleteBiometricUserAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var userId = parameters?["userId"]?.Value<string>();

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("Device ID and user ID are required");
            }

            var biometricManager = _serviceProvider.GetRequiredService<IBiometricManager>();
            var result = await biometricManager.DeleteUserAsync(deviceId, userId);

            return JToken.FromObject(result);
        }

        #endregion

        #region Queue Methods

        private async Task<JToken> GetQueueStatusAsync(JObject parameters, string connectionId)
        {
            var queueManager = _serviceProvider.GetRequiredService<IOfflineQueueManager>();
            var status = await queueManager.GetStatusAsync();
            
            return JToken.FromObject(status);
        }

        private async Task<JToken> GetQueueJobsAsync(JObject parameters, string connectionId)
        {
            var deviceId = parameters?["deviceId"]?.Value<string>();
            var status = parameters?["status"]?.Value<string>();
            var limit = parameters?["limit"]?.Value<int>() ?? 100;
            
            var queueManager = _serviceProvider.GetRequiredService<IOfflineQueueManager>();
            var jobs = await queueManager.GetJobsAsync(deviceId, status, limit);
            
            return JToken.FromObject(jobs);
        }

        private async Task<JToken> CancelQueueJobAsync(JObject parameters, string connectionId)
        {
            var jobId = parameters?["jobId"]?.Value<string>();
            if (string.IsNullOrEmpty(jobId))
            {
                throw new ArgumentException("Job ID is required");
            }

            var queueManager = _serviceProvider.GetRequiredService<IOfflineQueueManager>();
            var result = await queueManager.CancelJobAsync(jobId);
            
            return JToken.FromObject(new { success = result });
        }

        #endregion
    }
}