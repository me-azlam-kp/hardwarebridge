using System;
using System.Collections.Generic;

namespace HardwareBridge.Models
{
    public class ServiceConfiguration
    {
        public WebSocketConfig WebSocket { get; set; } = new();
        public CertificateConfig Certificate { get; set; } = new();
        public DeviceConfig Device { get; set; } = new();
        public LoggingConfig Logging { get; set; } = new();
        public SecurityConfig Security { get; set; } = new();
        public QueueConfig Queue { get; set; } = new();
    }

    public class WebSocketConfig
    {
        public int Port { get; set; } = 9443;
        public bool UseTls { get; set; } = true;
        public string CertificatePath { get; set; } = "certificates";
        public string[] AllowedOrigins { get; set; } = new[] { "*" };
        public bool EnableMutualTls { get; set; } = false;
        public int MaxConnections { get; set; } = 100;
        public int ReceiveBufferSize { get; set; } = 8192;
        public int SendBufferSize { get; set; } = 8192;
        public TimeSpan KeepAliveInterval { get; set; } = TimeSpan.FromSeconds(30);
        public TimeSpan ConnectionTimeout { get; set; } = TimeSpan.FromMinutes(5);
    }

    public class CertificateConfig
    {
        public bool UseLetsEncrypt { get; set; } = true;
        public string Domain { get; set; } = "localhost";
        public string Email { get; set; } = "admin@localhost";
        public string AcmeServer { get; set; } = "https://acme-v02.api.letsencrypt.org/directory";
        public TimeSpan RenewalThreshold { get; set; } = TimeSpan.FromDays(30);
        public bool AcceptTermsOfService { get; set; } = true;
    }

    public class DeviceConfig
    {
        public bool EnablePrinterDiscovery { get; set; } = true;
        public bool EnableSerialPortDiscovery { get; set; } = true;
        public bool EnableUsbHidDiscovery { get; set; } = true;
        public bool EnableNetworkDiscovery { get; set; } = true;
        public bool EnableBiometricDiscovery { get; set; } = true;
        public int DiscoveryInterval { get; set; } = 5000; // milliseconds
        public int ConnectionPoolSize { get; set; } = 10;
        public TimeSpan DeviceTimeout { get; set; } = TimeSpan.FromSeconds(30);
        public PrinterConfig Printer { get; set; } = new();
        public SerialPortConfig SerialPort { get; set; } = new();
        public UsbHidConfig UsbHid { get; set; } = new();
        public NetworkConfig Network { get; set; } = new();
        public BiometricConfig Biometric { get; set; } = new();
    }

    public class PrinterConfig
    {
        public string[] SupportedProtocols { get; set; } = new[] { "ESC/POS", "ZPL", "EPL" };
        public int MaxPrintJobSize { get; set; } = 10 * 1024 * 1024; // 10MB
        public TimeSpan PrintTimeout { get; set; } = TimeSpan.FromMinutes(5);
        public bool EnableRawMode { get; set; } = true;
    }

    public class SerialPortConfig
    {
        // Per-connection settings
        public int BaudRate { get; set; } = 9600;
        public string Parity { get; set; } = "None";
        public int DataBits { get; set; } = 8;
        public string StopBits { get; set; } = "1";
        public string FlowControl { get; set; } = "None";

        // Supported values for validation/discovery
        public int[] SupportedBaudRates { get; set; } = new[] { 9600, 19200, 38400, 57600, 115200 };
        public string[] SupportedParities { get; set; } = new[] { "None", "Odd", "Even", "Mark", "Space" };
        public string[] SupportedDataBits { get; set; } = new[] { "7", "8" };
        public string[] SupportedStopBits { get; set; } = new[] { "1", "1.5", "2" };
        public string[] SupportedFlowControl { get; set; } = new[] { "None", "XOnXOff", "RequestToSend", "RequestToSendXOnXOff" };
        public TimeSpan ReadTimeout { get; set; } = TimeSpan.FromSeconds(10);
        public TimeSpan WriteTimeout { get; set; } = TimeSpan.FromSeconds(10);
    }

    public class UsbHidConfig
    {
        public int MaxReportSize { get; set; } = 64;
        public TimeSpan ReportTimeout { get; set; } = TimeSpan.FromSeconds(5);
        public bool EnableInputReports { get; set; } = true;
        public bool EnableOutputReports { get; set; } = true;
        public bool EnableFeatureReports { get; set; } = true;
    }

    public class LoggingConfig
    {
        public string LogLevel { get; set; } = "Information";
        public bool EnableConsole { get; set; } = true;
        public bool EnableFile { get; set; } = true;
        public bool EnableEventLog { get; set; } = true;
        public bool EnableETW { get; set; } = true;
        public string LogPath { get; set; } = "logs";
        public int MaxFileSize { get; set; } = 10 * 1024 * 1024; // 10MB
        public int MaxRetainedFiles { get; set; } = 30;
    }

    public class SecurityConfig
    {
        public bool EnableOriginValidation { get; set; } = true;
        public bool EnableMutualTls { get; set; } = false;
        public bool EnableCapabilityTokens { get; set; } = true;
        public string[] AdminOrigins { get; set; } = new[] { "localhost" };
        public int MaxFailedAttempts { get; set; } = 5;
        public TimeSpan BanDuration { get; set; } = TimeSpan.FromMinutes(15);
    }

    public class NetworkConfig
    {
        public int[] DiscoveryPorts { get; set; } = new[] { 9100, 631, 515, 4370 };
        public int DiscoveryTimeout { get; set; } = 3000;
        public int MaxConcurrentScans { get; set; } = 50;
        public TimeSpan ConnectionTimeout { get; set; } = TimeSpan.FromSeconds(10);
        public TimeSpan PingTimeout { get; set; } = TimeSpan.FromSeconds(5);
    }

    public class BiometricConfig
    {
        public double VerificationThreshold { get; set; } = 0.7;
        public int MaxEnrolledUsers { get; set; } = 1000;
        public int[] DiscoveryPorts { get; set; } = new[] { 4370 };
        public TimeSpan EnrollmentTimeout { get; set; } = TimeSpan.FromSeconds(30);
    }

    public class QueueConfig
    {
        public bool EnableOfflineQueue { get; set; } = true;
        public string DatabasePath { get; set; } = "data/queue.db";
        public int MaxQueueSize { get; set; } = 1000;
        public TimeSpan RetryInterval { get; set; } = TimeSpan.FromMinutes(1);
        public int MaxRetryAttempts { get; set; } = 3;
    }
}
