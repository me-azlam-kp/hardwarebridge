using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Printing;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HardwareBridge.Services
{
    public interface IPrinterManager
    {
        Task<List<DeviceInfo>> DiscoverPrintersAsync();
        Task<bool> ConnectAsync(string deviceId);
        Task<bool> DisconnectAsync(string deviceId);
        Task<PrintResult> PrintAsync(string deviceId, string data, string format);
        Task<PrinterStatus> GetStatusAsync(string deviceId);
        Task<PrinterCapabilities> GetCapabilitiesAsync(string deviceId);
    }

    public class PrinterManager : IPrinterManager
    {
        private readonly ILogger<PrinterManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly Dictionary<string, PrinterDevice> _connectedPrinters;

        public PrinterManager(
            ILogger<PrinterManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _connectedPrinters = new Dictionary<string, PrinterDevice>();
        }

        public Task<List<DeviceInfo>> DiscoverPrintersAsync()
        {
            try
            {
                _logger.LogDebug("Discovering printers...");
                
                var printers = new List<DeviceInfo>();
                
                // Get local printers
                var printServer = new PrintServer();
                var printQueues = printServer.GetPrintQueues(new[] { EnumeratedPrintQueueTypes.Local });
                
                foreach (var queue in printQueues)
                {
                    try
                    {
                        var printer = new PrinterDevice
                        {
                            Id = $"printer_{queue.FullName.Replace(" ", "_")}",
                            Name = queue.Name,
                            Manufacturer = queue.QueuePort?.Name ?? "Unknown",
                            Model = queue.Name,
                            Status = ConvertPrinterStatus(queue.QueueStatus),
                            IsConnected = false,
                            Properties = new Dictionary<string, object>
                            {
                                ["FullName"] = queue.FullName,
                                ["Location"] = queue.Location ?? "",
                                ["Comment"] = queue.Comment ?? "",
                                ["IsShared"] = queue.IsShared,
                                ["IsPaused"] = queue.IsPaused
                            }
                        };

                        // Get printer capabilities
                        try
                        {
                            var capabilities = queue.GetPrintCapabilities();
                            printer.MaxPrintWidth = (int)capabilities.PageMediaSizeCapability.FirstOrDefault()?.Width ?? 0;
                            printer.SupportsColor = capabilities.OutputColorCapability.Contains(OutputColor.Color);
                            printer.SupportsDuplex = capabilities.DuplexingCapability.Contains(Duplexing.TwoSidedLongEdge);
                            printer.MaxResolution = (int)capabilities.OutputQualityCapability.FirstOrDefault() ?? 0;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to get capabilities for printer {Name}", queue.Name);
                        }

                        printers.Add(printer);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing printer queue {Name}", queue.Name);
                    }
                }

                // Add network printers
                var networkQueues = printServer.GetPrintQueues(new[] { EnumeratedPrintQueueTypes.Connections });
                foreach (var queue in networkQueues)
                {
                    try
                    {
                        var printer = new PrinterDevice
                        {
                            Id = $"printer_network_{queue.FullName.Replace(" ", "_")}",
                            Name = queue.Name,
                            Manufacturer = "Network",
                            Model = queue.Name,
                            Status = ConvertPrinterStatus(queue.QueueStatus),
                            IsConnected = false,
                            Properties = new Dictionary<string, object>
                            {
                                ["FullName"] = queue.FullName,
                                ["Location"] = queue.Location ?? "",
                                ["IsNetwork"] = true
                            }
                        };

                        printers.Add(printer);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing network printer {Name}", queue.Name);
                    }
                }

                _logger.LogInformation("Discovered {Count} printers", printers.Count);
                return Task.FromResult(printers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error discovering printers");
                return Task.FromResult(new List<DeviceInfo>());
            }
        }

        public Task<bool> ConnectAsync(string deviceId)
        {
            try
            {
                _logger.LogInformation("Connecting to printer: {DeviceId}", deviceId);
                
                // For printers, connection is typically handled by the print spooler
                // We'll just mark it as connected in our cache
                
                if (!_connectedPrinters.ContainsKey(deviceId))
                {
                    var printer = new PrinterDevice
                    {
                        Id = deviceId,
                        IsConnected = true,
                        CurrentStatus = "ready"
                    };
                    
                    _connectedPrinters[deviceId] = printer;
                }
                else
                {
                    _connectedPrinters[deviceId].IsConnected = true;
                    _connectedPrinters[deviceId].CurrentStatus = "ready";
                }

                _logger.LogInformation("Printer connected: {DeviceId}", deviceId);
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error connecting to printer: {DeviceId}", deviceId);
                return Task.FromResult(false);
            }
        }

        public Task<bool> DisconnectAsync(string deviceId)
        {
            try
            {
                _logger.LogInformation("Disconnecting from printer: {DeviceId}", deviceId);
                
                if (_connectedPrinters.ContainsKey(deviceId))
                {
                    _connectedPrinters[deviceId].IsConnected = false;
                    _connectedPrinters[deviceId].CurrentStatus = "disconnected";
                    _connectedPrinters.Remove(deviceId);
                }

                _logger.LogInformation("Printer disconnected: {DeviceId}", deviceId);
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disconnecting from printer: {DeviceId}", deviceId);
                return Task.FromResult(false);
            }
        }

        public async Task<PrintResult> PrintAsync(string deviceId, string data, string format)
        {
            try
            {
                _logger.LogInformation("Printing to {DeviceId} in format {Format}", deviceId, format);
                
                if (!_connectedPrinters.ContainsKey(deviceId))
                {
                    throw new InvalidOperationException($"Printer not connected: {deviceId}");
                }

                var printer = _connectedPrinters[deviceId];
                var printData = ConvertPrintData(data, format);
                
                // Use the appropriate printing method based on format
                switch (format.ToUpper())
                {
                    case "RAW":
                    case "ESCPOS":
                        return await PrintRawAsync(deviceId, printData);
                        
                    case "ZPL":
                        return await PrintZplAsync(deviceId, printData);
                        
                    case "EPL":
                        return await PrintEplAsync(deviceId, printData);
                        
                    default:
                        throw new ArgumentException($"Unsupported print format: {format}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error printing to {DeviceId}", deviceId);
                return new PrintResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public Task<PrinterStatus> GetStatusAsync(string deviceId)
        {
            try
            {
                if (!_connectedPrinters.ContainsKey(deviceId))
                {
                    return Task.FromResult(new PrinterStatus
                    {
                        IsConnected = false,
                        Status = "disconnected"
                    });
                }

                var printer = _connectedPrinters[deviceId];
                
                // Get actual printer status from print queue
                try
                {
                    var printServer = new PrintServer();
                    var queueName = deviceId.Replace("printer_", "").Replace("_", " ");
                    var queue = printServer.GetPrintQueue(queueName);
                    
                    var status = new PrinterStatus
                    {
                        IsConnected = printer.IsConnected,
                        Status = ConvertPrinterStatus(queue.QueueStatus),
                        IsReady = queue.IsReady,
                        IsPaused = queue.IsPaused,
                        IsBusy = queue.NumberOfJobs > 0,
                        JobsInQueue = queue.NumberOfJobs
                    };

                    return Task.FromResult(status);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get printer status from queue, using cached status");
                    
                    return Task.FromResult(new PrinterStatus
                    {
                        IsConnected = printer.IsConnected,
                        Status = printer.CurrentStatus,
                        IsReady = printer.CurrentStatus == "ready",
                        IsBusy = printer.JobsInQueue > 0,
                        JobsInQueue = printer.JobsInQueue
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting printer status for {DeviceId}", deviceId);
                return Task.FromResult(new PrinterStatus
                {
                    IsConnected = false,
                    Status = "error",
                    Error = ex.Message
                });
            }
        }

        public Task<PrinterCapabilities> GetCapabilitiesAsync(string deviceId)
        {
            try
            {
                // This would typically query the actual printer capabilities
                // For now, return default capabilities
                var capabilities = new PrinterCapabilities
                {
                    SupportedProtocols = new[] { "ESC/POS", "ZPL", "EPL" },
                    MaxPrintWidth = 576, // 4 inches at 144 dpi
                    SupportsColor = false,
                    SupportsDuplex = false,
                    MaxResolution = 300,
                    MaxJobSize = _config.CurrentValue.Device.Printer.MaxPrintJobSize
                };

                return Task.FromResult(capabilities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting printer capabilities for {DeviceId}", deviceId);
                return Task.FromResult(new PrinterCapabilities
                {
                    Error = ex.Message
                });
            }
        }

        #region Private Methods

        private byte[] ConvertPrintData(string data, string format)
        {
            switch (format.ToUpper())
            {
                case "RAW":
                case "ESCPOS":
                    // Convert hex string to bytes for ESC/POS
                    if (IsHexString(data))
                    {
                        return ConvertHexStringToBytes(data);
                    }
                    return Encoding.UTF8.GetBytes(data);
                    
                case "ZPL":
                case "EPL":
                    // ZPL and EPL are typically sent as text
                    return Encoding.UTF8.GetBytes(data);
                    
                default:
                    return Encoding.UTF8.GetBytes(data);
            }
        }

        private bool IsHexString(string data)
        {
            // Simple check for hex string (contains only hex characters and optional spaces)
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

        private async Task<PrintResult> PrintRawAsync(string deviceId, byte[] data)
        {
            try
            {
                // Use Windows Raw printing
                var queueName = deviceId.Replace("printer_", "").Replace("_", " ");
                var printServer = new PrintServer();
                var queue = printServer.GetPrintQueue(queueName);
                
                using (var job = queue.AddJob($"Raw Print {DateTime.Now:yyyyMMddHHmmss}"))
                {
                    using (var stream = job.JobStream)
                    {
                        await stream.WriteAsync(data, 0, data.Length);
                    }
                }

                return new PrintResult
                {
                    Success = true,
                    JobId = Guid.NewGuid().ToString(),
                    BytesPrinted = data.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in raw printing to {DeviceId}", deviceId);
                return new PrintResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        private async Task<PrintResult> PrintZplAsync(string deviceId, byte[] data)
        {
            try
            {
                // ZPL printing - send as raw data
                return await PrintRawAsync(deviceId, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ZPL printing to {DeviceId}", deviceId);
                return new PrintResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        private async Task<PrintResult> PrintEplAsync(string deviceId, byte[] data)
        {
            try
            {
                // EPL printing - send as raw data
                return await PrintRawAsync(deviceId, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in EPL printing to {DeviceId}", deviceId);
                return new PrintResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        private string ConvertPrinterStatus(PrintQueueStatus status)
        {
            if (status.HasFlag(PrintQueueStatus.Error))
                return "error";
            if (status.HasFlag(PrintQueueStatus.Paused))
                return "paused";
            if (status.HasFlag(PrintQueueStatus.Busy))
                return "busy";
            if (status.HasFlag(PrintQueueStatus.Printing))
                return "printing";
            if (status.HasFlag(PrintQueueStatus.Ready))
                return "ready";
            
            return "unknown";
        }

        #endregion
    }

    public class PrintResult
    {
        public bool Success { get; set; }
        public string JobId { get; set; }
        public int BytesPrinted { get; set; }
        public string Error { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class PrinterStatus
    {
        public bool IsConnected { get; set; }
        public string Status { get; set; }
        public bool IsReady { get; set; }
        public bool IsBusy { get; set; }
        public bool IsPaused { get; set; }
        public int JobsInQueue { get; set; }
        public string Error { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class PrinterCapabilities
    {
        public string[] SupportedProtocols { get; set; }
        public int MaxPrintWidth { get; set; }
        public bool SupportsColor { get; set; }
        public bool SupportsDuplex { get; set; }
        public int MaxResolution { get; set; }
        public int MaxJobSize { get; set; }
        public string Error { get; set; }
    }
}