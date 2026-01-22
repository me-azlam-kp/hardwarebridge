using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HardwareBridge.Models;
using HidLibrary;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HardwareBridge.Services
{
    public interface IUsbHidManager
    {
        Task<List<DeviceInfo>> DiscoverUsbHidDevicesAsync();
        Task<bool> ConnectAsync(string deviceId);
        Task<bool> DisconnectAsync(string deviceId);
        Task<UsbHidConnectionResult> OpenAsync(string deviceId);
        Task<UsbHidConnectionResult> CloseAsync(string deviceId);
        Task<UsbHidReportResult> SendReportAsync(string deviceId, byte reportId, string data);
        Task<UsbHidReportResult> ReceiveReportAsync(string deviceId, byte reportId, int timeout);
        Task<UsbHidDeviceStatus> GetStatusAsync(string deviceId);
    }

    public class UsbHidManager : IUsbHidManager
    {
        private readonly ILogger<UsbHidManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly Dictionary<string, UsbHidConnection> _connections;

        public UsbHidManager(
            ILogger<UsbHidManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _connections = new Dictionary<string, UsbHidConnection>();
        }

        public Task<List<DeviceInfo>> DiscoverUsbHidDevicesAsync()
        {
            try
            {
                _logger.LogDebug("Discovering USB HID devices...");
                
                var devices = new List<DeviceInfo>();
                var hidDevices = HidDevices.Enumerate();
                
                foreach (var hidDevice in hidDevices)
                {
                    try
                    {
                        var device = new UsbHidDevice
                        {
                            Id = $"usbhid_{hidDevice.Attributes.VendorHexId}_{hidDevice.Attributes.ProductHexId}_{hidDevice.Attributes.Version}",
                            Name = hidDevice.GetProductName() ?? $"USB HID Device ({hidDevice.Attributes.VendorHexId}:{hidDevice.Attributes.ProductHexId})",
                            Type = "usbhid",
                            Status = "available",
                            IsConnected = false,
                            VendorId = hidDevice.Attributes.VendorId,
                            ProductId = hidDevice.Attributes.ProductId,
                            Version = hidDevice.Attributes.Version,
                            DevicePath = hidDevice.DevicePath,
                            Manufacturer = hidDevice.GetManufacturerString() ?? "Unknown",
                            Model = hidDevice.GetProductName() ?? "Unknown",
                            SerialNumber = hidDevice.GetSerialNumber() ?? "",
                            InputReportLength = hidDevice.Capabilities.InputReportByteLength,
                            OutputReportLength = hidDevice.Capabilities.OutputReportByteLength,
                            FeatureReportLength = hidDevice.Capabilities.FeatureReportByteLength,
                            Properties = new Dictionary<string, object>
                            {
                                ["VendorId"] = hidDevice.Attributes.VendorId,
                                ["ProductId"] = hidDevice.Attributes.ProductId,
                                ["Version"] = hidDevice.Attributes.Version,
                                ["DevicePath"] = hidDevice.DevicePath,
                                ["UsagePage"] = hidDevice.Capabilities.UsagePage,
                                ["Usage"] = hidDevice.Capabilities.UsageId
                            }
                        };

                        devices.Add(device);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing USB HID device {DevicePath}", hidDevice.DevicePath);
                    }
                }

                _logger.LogInformation("Discovered {Count} USB HID devices", devices.Count);
                return Task.FromResult(devices);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error discovering USB HID devices");
                return Task.FromResult(new List<DeviceInfo>());
            }
        }

        public Task<bool> ConnectAsync(string deviceId)
        {
            // For USB HID devices, connection is handled by OpenAsync
            return Task.FromResult(true);
        }

        public Task<bool> DisconnectAsync(string deviceId)
        {
            return CloseAsync(deviceId).ContinueWith(t => t.Result.Success);
        }

        public async Task<UsbHidConnectionResult> OpenAsync(string deviceId)
        {
            try
            {
                _logger.LogInformation("Opening USB HID device: {DeviceId}", deviceId);
                
                // Check if already connected
                if (_connections.ContainsKey(deviceId))
                {
                    throw new InvalidOperationException($"USB HID device already open: {deviceId}");
                }

                // Extract vendor and product IDs from device ID
                var (vendorId, productId, version) = ExtractDeviceIdsFromDeviceId(deviceId);
                if (vendorId == 0 || productId == 0)
                {
                    throw new ArgumentException($"Invalid device ID: {deviceId}");
                }

                // Find the device
                var hidDevice = HidDevices.Enumerate(vendorId, productId)
                    .FirstOrDefault(d => d.Attributes.Version == version);
                
                if (hidDevice == null)
                {
                    throw new InvalidOperationException($"USB HID device not found: {deviceId}");
                }

                // Open the device
                if (!hidDevice.OpenDevice())
                {
                    throw new InvalidOperationException($"Failed to open USB HID device: {deviceId}");
                }

                var connection = new UsbHidConnection
                {
                    DeviceId = deviceId,
                    HidDevice = hidDevice,
                    IsOpen = true,
                    OpenedAt = DateTime.UtcNow,
                    VendorId = vendorId,
                    ProductId = productId,
                    Version = version
                };

                // Set up data received event
                hidDevice.MonitorDeviceEvents = true;
                hidDevice.Inserted += () =>
                {
                    _logger.LogInformation("USB HID device inserted: {DeviceId}", deviceId);
                };
                
                hidDevice.Removed += () =>
                {
                    _logger.LogInformation("USB HID device removed: {DeviceId}", deviceId);
                    _ = CloseAsync(deviceId);
                };

                _connections[deviceId] = connection;

                _logger.LogInformation("USB HID device opened successfully: {DeviceId}", deviceId);
                
                return new UsbHidConnectionResult
                {
                    Success = true,
                    DeviceId = deviceId,
                    VendorId = vendorId,
                    ProductId = productId,
                    OpenedAt = connection.OpenedAt
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error opening USB HID device: {DeviceId}", deviceId);
                return new UsbHidConnectionResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<UsbHidConnectionResult> CloseAsync(string deviceId)
        {
            try
            {
                _logger.LogInformation("Closing USB HID device: {DeviceId}", deviceId);
                
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new UsbHidConnectionResult
                    {
                        Success = false,
                        Error = "USB HID device not open"
                    };
                }

                try
                {
                    if (connection.HidDevice.IsOpen)
                    {
                        connection.HidDevice.CloseDevice();
                    }
                    
                    connection.IsOpen = false;
                    connection.ClosedAt = DateTime.UtcNow;

                    _connections.Remove(deviceId);

                    _logger.LogInformation("USB HID device closed successfully: {DeviceId}", deviceId);
                    
                    return new UsbHidConnectionResult
                    {
                        Success = true,
                        DeviceId = deviceId,
                        ClosedAt = connection.ClosedAt
                    };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error closing USB HID device: {DeviceId}", deviceId);
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error closing USB HID device: {DeviceId}", deviceId);
                return new UsbHidConnectionResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<UsbHidReportResult> SendReportAsync(string deviceId, byte reportId, string data)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new UsbHidReportResult
                    {
                        Success = false,
                        Error = "USB HID device not open"
                    };
                }

                if (!connection.IsOpen)
                {
                    return new UsbHidReportResult
                    {
                        Success = false,
                        Error = "USB HID device is closed"
                    };
                }

                // Convert data to bytes
                byte[] reportData;
                if (IsHexString(data))
                {
                    reportData = ConvertHexStringToBytes(data);
                }
                else
                {
                    reportData = Encoding.UTF8.GetBytes(data);
                }

                // Create output report
                var outputReport = connection.HidDevice.CreateReport();
                outputReport.ReportId = reportId;
                
                // Copy data to report
                if (reportData.Length > 0)
                {
                    Array.Copy(reportData, outputReport.Data, Math.Min(reportData.Length, outputReport.Data.Length));
                }

                // Write report
                var success = connection.HidDevice.WriteReport(outputReport);
                
                if (!success)
                {
                    throw new InvalidOperationException("Failed to write HID report");
                }

                connection.LastActivity = DateTime.UtcNow;

                _logger.LogDebug("Sent HID report {ReportId} with {BytesSent} bytes to {DeviceId}", 
                    reportId, reportData.Length, deviceId);
                
                return new UsbHidReportResult
                {
                    Success = true,
                    ReportId = reportId,
                    BytesTransferred = reportData.Length,
                    Data = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending HID report to {DeviceId}", deviceId);
                return new UsbHidReportResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<UsbHidReportResult> ReceiveReportAsync(string deviceId, byte reportId, int timeout)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return new UsbHidReportResult
                    {
                        Success = false,
                        Error = "USB HID device not open"
                    };
                }

                if (!connection.IsOpen)
                {
                    return new UsbHidReportResult
                    {
                        Success = false,
                        Error = "USB HID device is closed"
                    };
                }

                // Read report with timeout
                var cts = new System.Threading.CancellationTokenSource(timeout);
                var report = await Task.Run(() =>
                {
                    HidReport result = null;
                    var startTime = DateTime.UtcNow;

                    while (result == null && !cts.Token.IsCancellationRequested)
                    {
                        result = connection.HidDevice.ReadReport(timeout);
                        
                        if (result == null)
                        {
                            // Check if we've exceeded the timeout
                            if ((DateTime.UtcNow - startTime).TotalMilliseconds > timeout)
                            {
                                break;
                            }
                            
                            System.Threading.Thread.Sleep(10); // Small delay to prevent busy waiting
                        }
                    }

                    return result;
                }, cts.Token);

                if (report == null)
                {
                    return new UsbHidReportResult
                    {
                        Success = false,
                        Error = "Timeout waiting for HID report"
                    };
                }

                connection.LastActivity = DateTime.UtcNow;

                // Convert report data to string
                var dataString = ConvertBytesToHexString(report.Data);
                
                _logger.LogDebug("Received HID report {ReportId} with {BytesReceived} bytes from {DeviceId}", 
                    report.ReportId, report.Data.Length, deviceId);
                
                return new UsbHidReportResult
                {
                    Success = true,
                    ReportId = report.ReportId,
                    BytesTransferred = report.Data.Length,
                    Data = dataString
                };
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Timeout receiving HID report from {DeviceId}", deviceId);
                return new UsbHidReportResult
                {
                    Success = false,
                    Error = "Read timeout"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error receiving HID report from {DeviceId}", deviceId);
                return new UsbHidReportResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public Task<UsbHidDeviceStatus> GetStatusAsync(string deviceId)
        {
            try
            {
                if (!_connections.TryGetValue(deviceId, out var connection))
                {
                    return Task.FromResult(new UsbHidDeviceStatus
                    {
                        IsConnected = false,
                        Status = "disconnected"
                    });
                }

                var hidDevice = connection.HidDevice;
                var status = new UsbHidDeviceStatus
                {
                    IsConnected = connection.IsOpen,
                    Status = connection.IsOpen ? "connected" : "disconnected",
                    DeviceId = deviceId,
                    VendorId = connection.VendorId,
                    ProductId = connection.ProductId,
                    Version = connection.Version,
                    IsOpen = hidDevice.IsOpen,
                    InputReportLength = hidDevice.Capabilities.InputReportByteLength,
                    OutputReportLength = hidDevice.Capabilities.OutputReportByteLength,
                    FeatureReportLength = hidDevice.Capabilities.FeatureReportByteLength,
                    ConnectedAt = connection.OpenedAt,
                    LastActivity = connection.LastActivity
                };

                return Task.FromResult(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting USB HID device status for {DeviceId}", deviceId);
                return Task.FromResult(new UsbHidDeviceStatus
                {
                    IsConnected = false,
                    Status = "error",
                    Error = ex.Message
                });
            }
        }

        #region Private Methods

        private (int vendorId, int productId, int version) ExtractDeviceIdsFromDeviceId(string deviceId)
        {
            // Device ID format: "usbhid_1234_5678_9100"
            if (deviceId.StartsWith("usbhid_"))
            {
                var parts = deviceId.Substring(7).Split('_');
                if (parts.Length >= 3)
                {
                    if (int.TryParse(parts[0], System.Globalization.NumberStyles.HexNumber, null, out var vendorId) &&
                        int.TryParse(parts[1], System.Globalization.NumberStyles.HexNumber, null, out var productId) &&
                        int.TryParse(parts[2], out var version))
                    {
                        return (vendorId, productId, version);
                    }
                }
            }
            return (0, 0, 0);
        }

        private bool IsHexString(string data)
        {
            return System.Text.RegularExpressions.Regex.IsMatch(data, "^[0-9A-Fa-f\\s]+$");
        }

        private byte[] ConvertHexStringToBytes(string hex)
        {
            hex = hex.Replace(" ", "").Replace("-", "");
            var bytes = new byte[hex.Length / 2];
            
            for (int i = 0; i < bytes.Length; i++)
            {
                bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
            }
            
            return bytes;
        }

        private string ConvertBytesToHexString(byte[] bytes)
        {
            return BitConverter.ToString(bytes).Replace("-", " ");
        }

        #endregion
    }

    public class UsbHidConnection
    {
        public string DeviceId { get; set; }
        public HidDevice HidDevice { get; set; }
        public bool IsOpen { get; set; }
        public DateTime OpenedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public int VendorId { get; set; }
        public int ProductId { get; set; }
        public int Version { get; set; }
    }

    public class UsbHidConnectionResult
    {
        public bool Success { get; set; }
        public string DeviceId { get; set; }
        public int VendorId { get; set; }
        public int ProductId { get; set; }
        public DateTime? OpenedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string Error { get; set; }
    }

    public class UsbHidReportResult
    {
        public bool Success { get; set; }
        public byte ReportId { get; set; }
        public int BytesTransferred { get; set; }
        public string Data { get; set; }
        public string Error { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class UsbHidDeviceStatus
    {
        public bool IsConnected { get; set; }
        public string Status { get; set; }
        public string DeviceId { get; set; }
        public int VendorId { get; set; }
        public int ProductId { get; set; }
        public int Version { get; set; }
        public bool IsOpen { get; set; }
        public int InputReportLength { get; set; }
        public int OutputReportLength { get; set; }
        public int FeatureReportLength { get; set; }
        public DateTime? ConnectedAt { get; set; }
        public DateTime? LastActivity { get; set; }
        public string Error { get; set; }
    }
}