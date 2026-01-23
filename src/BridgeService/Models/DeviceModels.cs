using System;
using System.Collections.Generic;

namespace HardwareBridge.Models
{
    public class DeviceInfo
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Type { get; set; } // "printer", "serial", "usbhid", "network", "biometric"
        public string Status { get; set; } // "available", "connected", "error"
        public string Manufacturer { get; set; }
        public string Model { get; set; }
        public string SerialNumber { get; set; }
        public Dictionary<string, object> Properties { get; set; } = new();
        public DateTime LastSeen { get; set; }
        public bool IsConnected { get; set; }
        public string ConnectionId { get; set; }
    }

    public class PrinterDevice : DeviceInfo
    {
        public PrinterDevice()
        {
            Type = "printer";
        }

        public string[] SupportedProtocols { get; set; } = new[] { "ESC/POS", "ZPL", "EPL" };
        public int MaxPrintWidth { get; set; }
        public bool SupportsColor { get; set; }
        public bool SupportsDuplex { get; set; }
        public int MaxResolution { get; set; }
        public string CurrentStatus { get; set; } = "idle";
        public int JobsInQueue { get; set; }
    }

    public class SerialPortDevice : DeviceInfo
    {
        public SerialPortDevice()
        {
            Type = "serial";
        }

        public string PortName { get; set; }
        public int BaudRate { get; set; }
        public string Parity { get; set; }
        public int DataBits { get; set; }
        public string StopBits { get; set; }
        public string FlowControl { get; set; }
        public bool IsOpen { get; set; }
        public int BytesToRead { get; set; }
        public int BytesToWrite { get; set; }
    }

    public class UsbHidDevice : DeviceInfo
    {
        public UsbHidDevice()
        {
            Type = "usbhid";
        }

        public int VendorId { get; set; }
        public int ProductId { get; set; }
        public int Version { get; set; }
        public string DevicePath { get; set; }
        public int InputReportLength { get; set; }
        public int OutputReportLength { get; set; }
        public int FeatureReportLength { get; set; }
        public bool IsOpen { get; set; }
    }

    public class NetworkDevice : DeviceInfo
    {
        public NetworkDevice()
        {
            Type = "network";
        }

        public string Host { get; set; }
        public int Port { get; set; }
        public string Protocol { get; set; } = "tcp";
        public long BytesSent { get; set; }
        public long BytesReceived { get; set; }
        public long ResponseTime { get; set; }
    }

    public class BiometricDevice : DeviceInfo
    {
        public BiometricDevice()
        {
            Type = "biometric";
        }

        public string[] SupportedModes { get; set; } = new[] { "verify", "identify", "enroll" };
        public int EnrolledUsers { get; set; }
        public int MaxUsers { get; set; } = 1000;
        public string BiometricType { get; set; } = "fingerprint";
    }

    public class DeviceConnection
    {
        public string ConnectionId { get; set; }
        public string DeviceId { get; set; }
        public string DeviceType { get; set; }
        public DateTime ConnectedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public string Status { get; set; } = "connected";
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class PrintJob
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string DeviceId { get; set; }
        public string Data { get; set; }
        public string Format { get; set; } = "raw";
        public string Status { get; set; } = "pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string Error { get; set; }
        public int RetryCount { get; set; }
        public Dictionary<string, object> Options { get; set; } = new();
    }

    public class SerialData
    {
        public string DeviceId { get; set; }
        public string Data { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Direction { get; set; } // "send" or "receive"
        public int BytesTransferred { get; set; }
    }

    public class UsbHidReport
    {
        public string DeviceId { get; set; }
        public byte ReportId { get; set; }
        public byte[] Data { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string ReportType { get; set; } // "input", "output", "feature"
    }

    public class DeviceEvent
    {
        public string EventType { get; set; } // "connected", "disconnected", "error", "data"
        public string DeviceId { get; set; }
        public string DeviceType { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public Dictionary<string, object> Data { get; set; } = new();
    }

    public class SystemHealth
    {
        public string Status { get; set; } = "healthy";
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public int TotalDevices { get; set; }
        public int ConnectedDevices { get; set; }
        public int ActiveConnections { get; set; }
        public int JobsInQueue { get; set; }
        public double CpuUsage { get; set; }
        public double MemoryUsage { get; set; }
        public Dictionary<string, object> DeviceHealth { get; set; } = new();
    }

    public class QueueStatus
    {
        public int TotalJobs { get; set; }
        public int PendingJobs { get; set; }
        public int ProcessingJobs { get; set; }
        public int CompletedJobs { get; set; }
        public int FailedJobs { get; set; }
        public DateTime LastProcessed { get; set; }
        public double AverageProcessingTime { get; set; }
    }

    public class QueueJob
    {
        public string Id { get; set; }
        public string DeviceId { get; set; }
        public string DeviceType { get; set; }
        public string Operation { get; set; }
        public string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string Error { get; set; }
        public int RetryCount { get; set; }
        public Dictionary<string, object> Parameters { get; set; } = new();
    }
}