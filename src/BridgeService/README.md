# Hardware Bridge Service

A cross-platform .NET hardware bridge service that provides WebSocket communication, device management, and printing capabilities. Runs on Windows, macOS, and Linux.

## Overview

The Hardware Bridge Service acts as middleware between web applications and hardware devices. It provides a WebSocket server using JSON-RPC 2.0 protocol for secure, real-time communication with connected hardware peripherals.

## Key Features

### Device Management

- **Serial Port Communication** — Full serial port support with configurable baud rate, parity, data bits, and stop bits
- **USB HID Device Support** — Direct USB HID device communication (Windows only)
- **Printer Management** — Printer discovery, ESC/POS, ZPL, and EPL protocol support (Windows only)
- **Network Device Support** — TCP/IP device discovery and communication (cross-platform)
- **Biometric Devices** — Fingerprint and biometric device integration (cross-platform)
- **Auto-Discovery** — Automatic detection of connected hardware devices

### Communication

- **WebSocket Server** — JSON-RPC 2.0 over WebSocket (ws:// and wss://)
- **Offline Queue** — SQLite-backed persistent queue for operations when devices are unavailable
- **TLS/SSL Support** — Certificate management with Let's Encrypt integration (Windows)

### System Integration

- **Cross-Platform** — Runs on Windows, macOS, and Linux
- **Windows Service** — Can run as a Windows service with system tray UI
- **Structured Logging** — Serilog with console, file, and EventLog sinks
- **Settings Persistence** — JSON-based configuration storage

## Platform Support

| Feature                   | Windows | macOS | Linux |
| ------------------------- | ------- | ----- | ----- |
| Serial Ports              | Yes     | Yes   | Yes   |
| Network Devices           | Yes     | Yes   | Yes   |
| Biometric Devices         | Yes     | Yes   | Yes   |
| USB HID                   | Yes     | No    | No    |
| Printers (ESC/POS, ZPL)   | Yes     | No    | No    |
| System Tray UI            | Yes     | No    | No    |
| Windows Service           | Yes     | No    | No    |
| Certificate Manager       | Yes     | No    | No    |
| WebSocket Server          | Yes     | Yes   | Yes   |
| Offline Queue             | Yes     | Yes   | Yes   |
| Settings Management       | Yes     | Yes   | Yes   |

## Prerequisites

- [.NET 10.0 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- **Windows**: Administrator rights recommended for device access
- **macOS/Linux**: May need root/sudo for serial port access

## Build & Run

```bash
# Build
dotnet build src/BridgeService/HardwareBridge.csproj

# Run
dotnet run --project src/BridgeService/HardwareBridge.csproj

# Publish self-contained
dotnet publish src/BridgeService/HardwareBridge.csproj -c Release --self-contained
```

### Install as Windows Service (Windows only)

```bash
dotnet publish src/BridgeService/HardwareBridge.csproj -c Release -r win-x64
sc create HardwareBridge binPath="<path-to-published>\HardwareBridge.exe"
sc start HardwareBridge
```

## Configuration

Settings are stored in `appsettings.json` (auto-created on first run):

```json
{
  "WebSocket": {
    "Port": 8443,
    "UseTls": false,
    "AllowedOrigins": ["*"],
    "MaxConnections": 100
  },
  "Device": {
    "EnablePrinterDiscovery": true,
    "EnableSerialPortDiscovery": true,
    "EnableUsbHidDiscovery": true,
    "EnableNetworkDiscovery": true,
    "EnableBiometricDiscovery": false,
    "DiscoveryInterval": "00:00:30"
  },
  "Logging": {
    "LogLevel": "Information",
    "EnableConsole": true,
    "EnableFile": true,
    "LogPath": "logs",
    "MaxFileSize": 10485760,
    "MaxRetainedFiles": 30
  }
}
```

## API Reference

### Connection

Connect via WebSocket at `ws://localhost:8443` (or `wss://` with TLS enabled).

### JSON-RPC Methods

#### System

| Method             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `system.getInfo`   | Get service version, platform, uptime            |
| `system.getHealth` | Get device counts and health status              |
| `settings.get`     | Retrieve current configuration                   |
| `settings.save`    | Update configuration (restarts WebSocket server) |

#### Devices

| Method               | Description                    |
| -------------------- | ------------------------------ |
| `devices.list`       | List all discovered devices    |
| `devices.connect`    | Connect to a specific device   |
| `devices.disconnect` | Disconnect from a device       |

#### Serial Ports

| Method         | Description                    |
| -------------- | ------------------------------ |
| `serial.list`  | List available serial ports    |
| `serial.open`  | Open a serial port connection  |
| `serial.close` | Close a serial port connection |
| `serial.write` | Write data to a serial port    |
| `serial.read`  | Read data from a serial port   |

#### Printers (Windows only)

| Method           | Description                              |
| ---------------- | ---------------------------------------- |
| `printer.list`   | List discovered printers                 |
| `printer.print`  | Send print job (raw, ESC/POS, ZPL, EPL)  |
| `printer.status` | Get printer status                       |

#### USB HID (Windows only)

| Method      | Description                |
| ----------- | -------------------------- |
| `usb.list`  | List USB HID devices       |
| `usb.open`  | Open a USB HID connection  |
| `usb.close` | Close a USB HID connection |
| `usb.write` | Write to USB HID device    |
| `usb.read`  | Read from USB HID device   |

#### Network Devices

| Method               | Description                      |
| -------------------- | -------------------------------- |
| `network.connect`    | Connect to a network device      |
| `network.disconnect` | Disconnect from a network device |
| `network.send`       | Send data to a network device    |

#### Queue

| Method            | Description          |
| ----------------- | -------------------- |
| `queue.getStatus` | Get queue statistics |
| `queue.getJobs`   | List queued jobs     |
| `queue.cancelJob` | Cancel a pending job |

### Example Request/Response

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "printer.print",
  "params": {
    "deviceId": "printer-001",
    "data": "Hello World\n",
    "format": "raw"
  },
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "result": { "success": true, "jobId": "abc-123" },
  "id": 1
}
```

## Project Structure

```text
src/BridgeService/
├── HardwareBridge.csproj          — Project file (.NET 10.0)
├── Program.cs                     — Entry point, DI configuration
├── Models/
│   ├── Configuration.cs           — All configuration classes
│   └── DeviceModels.cs            — Device data models
├── Services/
│   ├── HardwareBridgeService.cs   — Main hosted background service
│   ├── WebSocketServer.cs         — WebSocket server implementation
│   ├── JsonRpcHandler.cs          — JSON-RPC protocol handler
│   ├── DeviceManager.cs           — Central device management
│   ├── SettingsManager.cs         — Settings persistence
│   ├── LoggingManager.cs          — Logging coordination
│   ├── OfflineQueueManager.cs     — SQLite-backed offline queue
│   ├── SerialPortManager.cs       — Serial port handling
│   ├── NetworkDeviceManager.cs    — Network device discovery
│   ├── BiometricManager.cs        — Biometric device handling
│   ├── Interfaces.cs              — [Windows] Interface definitions
│   ├── PrinterManager.cs          — [Windows] Printer management
│   ├── UsbHidManager.cs           — [Windows] USB HID devices
│   ├── CertificateManager.cs      — [Windows] SSL/TLS certificates
│   └── TaskSchedulerManager.cs    — [Windows] Task scheduling
├── UI/
│   └── MainWindow.xaml.cs         — [Windows] System tray settings UI
├── logs/                          — Runtime log files
└── data/                          — SQLite database (offline queue)
```

## Dependencies

| Package                      | Version | Purpose                     |
| ---------------------------- | ------- | --------------------------- |
| Microsoft.Extensions.Hosting | 10.0.0  | DI and hosted services      |
| Serilog + Extensions         | 9.0.0   | Structured logging          |
| Microsoft.Data.Sqlite        | 10.0.0  | Offline queue storage       |
| Newtonsoft.Json              | 13.0.3  | JSON-RPC serialization      |
| System.IO.Ports              | 10.0.0  | Serial port communication   |
| HidLibrary                   | 3.3.40  | USB HID (Windows)           |
| Certes                       | 3.0.4   | Let's Encrypt (Windows)     |

## Troubleshooting

### Port already in use

Change the port in settings or stop the conflicting process:

```bash
lsof -i :8443   # macOS/Linux
netstat -ano | findstr 8443   # Windows
```

### Serial port access denied (macOS/Linux)

Add your user to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER   # Linux
```

### Platform-specific service not available

Methods for Windows-only features (printers, USB HID) return an error on macOS/Linux:

```json
{ "error": { "code": -32603, "message": "Printer management is not available on this platform" } }
```

## Related Projects

- [BridgeUI](../BridgeUI/README.md) — Cross-platform MAUI desktop app for managing BridgeService

---

Developed by Azlam
