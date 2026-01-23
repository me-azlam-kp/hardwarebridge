namespace BridgeUI.Models;

public class DeviceInfo
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Status { get; set; } = "";
    public string ConnectionId { get; set; } = "";
    public string Manufacturer { get; set; } = "";
    public string Model { get; set; } = "";
    public string SerialNumber { get; set; } = "";
    public bool IsConnected { get; set; }
    public DateTime LastSeen { get; set; }
}

public class QueueJob
{
    public string Id { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string Operation { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int RetryCount { get; set; }
}

public class QueueStatus
{
    public int TotalJobs { get; set; }
    public int PendingJobs { get; set; }
    public int ProcessingJobs { get; set; }
    public int CompletedJobs { get; set; }
    public int FailedJobs { get; set; }
}

public class SystemHealth
{
    public int TotalDevices { get; set; }
    public int ConnectedDevices { get; set; }
    public string Status { get; set; } = "";
    public DateTime Timestamp { get; set; }
}

public class ServiceSettings
{
    public WebSocketConfig? WebSocket { get; set; }
    public DeviceConfig? Device { get; set; }
    public LoggingConfig? Logging { get; set; }
}

public class WebSocketConfig
{
    public int Port { get; set; } = 8443;
    public bool UseTls { get; set; }
    public string[] AllowedOrigins { get; set; } = Array.Empty<string>();
    public int MaxConnections { get; set; } = 100;
}

public class DeviceConfig
{
    public bool EnablePrinterDiscovery { get; set; }
    public bool EnableSerialPortDiscovery { get; set; } = true;
    public bool EnableUsbHidDiscovery { get; set; }
    public bool EnableNetworkDiscovery { get; set; } = true;
    public bool EnableBiometricDiscovery { get; set; }
    public TimeSpan DiscoveryInterval { get; set; } = TimeSpan.FromSeconds(30);
}

public class LoggingConfig
{
    public string LogLevel { get; set; } = "Information";
    public bool EnableConsole { get; set; } = true;
    public bool EnableFile { get; set; } = true;
    public bool EnableEventLog { get; set; }
    public string LogPath { get; set; } = "logs";
    public int MaxFileSize { get; set; } = 10485760;
    public int MaxRetainedFiles { get; set; } = 30;
}
