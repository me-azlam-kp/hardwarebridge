#if !WINDOWS
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HardwareBridge.Models;

namespace HardwareBridge.Services
{
    // These interfaces and types are defined in Windows-only files (PrinterManager.cs, UsbHidManager.cs)
    // which are excluded from compilation on non-Windows platforms.
    // They are needed here so that cross-platform code (DeviceManager, JsonRpcHandler) compiles.

    public interface IPrinterManager
    {
        Task<List<DeviceInfo>> DiscoverPrintersAsync();
        Task<bool> ConnectAsync(string deviceId);
        Task<bool> DisconnectAsync(string deviceId);
        Task<PrintResult> PrintAsync(string deviceId, string data, string format);
        Task<PrinterStatus> GetStatusAsync(string deviceId);
        Task<PrinterCapabilities> GetCapabilitiesAsync(string deviceId);
    }

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
#endif
