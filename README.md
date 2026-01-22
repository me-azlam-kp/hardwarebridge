# Hardware Bridge

A zero-install, single-file Windows system-tray bridge that exposes printers, serial ports, and USB HID devices to web applications over a secure WebSocket server.

## Features

### Core Functionality
- **Zero-install deployment**: Single-file executable with system tray integration
- **TLS 1.3-only WebSocket server** with ACME-driven auto-renewing certificates
- **Multi-device support**: Printers, serial ports, and USB HID devices
- **Hot-plug discovery**: Real-time device enumeration and connection pooling
- **Offline queueing**: SQLite-based job queue with retry mechanisms
- **JSON-RPC v2 API**: Async communication with web applications
- **Real-time telemetry**: Streaming health metrics and device status

### Security
- **Origin-based ACL**: Configurable allowed origins
- **Mutual TLS (mTLS)**: Optional client certificate authentication
- **Per-device capability tokens**: Granular access control
- **Let's Encrypt integration**: Automatic certificate management
- **Code-signed binaries**: Windows security compliance

### Device Support
- **Printers**: ESC/POS, ZPL, EPL protocol support
- **Serial Ports**: RS232/485 with configurable parameters
- **USB HID**: Input/output reports with hot-plug support

### Management
- **WPF settings UI**: Accessible via system tray icon
- **Silent MSI installer**: Enterprise deployment ready
- **Chocolatey package**: Package manager distribution
- **Task Scheduler integration**: Auto-start capability
- **ETW logging**: Windows Event Tracing support
- **Rolling file logs**: Configurable log retention

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Applications                          │
├─────────────────────────────────────────────────────────────────┤
│                    TypeScript Client Library                     │
│              (Auto-reconnect, RxJS Observables)                  │
├─────────────────────────────────────────────────────────────────┤
│                    WebSocket Server (TLS 1.3)                    │
│              (JSON-RPC v2, Origin-based ACL)                     │
├─────────────────────────────────────────────────────────────────┤
│                    Hardware Bridge Service                       │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │   Device    │   Printer   │   Serial    │    USB HID      │  │
│  │  Manager    │   Manager   │   Manager   │    Manager      │  │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘  │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │   Offline   │ Certificate │   Logging   │   Settings      │  │
│  │    Queue    │   Manager   │   Manager   │   Manager       │  │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Windows System APIs                           │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
HardwareBridge/
├── src/
│   ├── BridgeService/          # C# Windows service
│   │   ├── Models/             # Data models and configuration
│   │   ├── Services/           # Core service implementations
│   │   ├── UI/                 # WPF settings interface
│   │   └── HardwareBridge.csproj
│   ├── BridgeClient/           # TypeScript client library
│   │   ├── src/
│   │   │   ├── core/           # WebSocket client implementation
│   │   │   ├── devices/        # Device-specific managers
│   │   │   ├── frameworks/     # Framework integrations
│   │   │   └── utils/          # Utility functions
│   │   └── package.json
│   ├── TestHarness/            # Single-page test application
│   │   ├── index.html          # Test harness UI
│   │   └── app.js              # Test application logic
│   └── Installer/              # MSI installer configuration
├── tests/                      # Unit and integration tests
├── docs/                       # Documentation
└── tools/                      # Build and deployment tools
```

## Quick Start

### Prerequisites
- Windows 10/11 (64-bit)
- .NET 10 Runtime
- Windows Service installation privileges

### Installation

#### Option 1: MSI Installer (Recommended)
1. Download `HardwareBridge.msi` from releases
2. Run installer with administrator privileges
3. Service will auto-start after installation

#### Option 2: Chocolatey
```powershell
choco install hardwarebridge
```

#### Option 3: Portable
1. Download `HardwareBridge.exe` from releases
2. Run with administrator privileges
3. Configure via system tray icon

### Configuration

#### Basic Configuration
1. Right-click system tray icon
2. Select "Settings"
3. Configure WebSocket server settings:
   - Port (default: 8443)
   - TLS settings
   - Allowed origins
4. Configure device discovery settings
5. Save and restart service

#### Advanced Configuration
Edit `settings.json` in the application directory:

```json
{
  "WebSocket": {
    "Port": 8443,
    "UseTls": true,
    "AllowedOrigins": ["https://your-app.com"],
    "EnableMutualTls": false
  },
  "Certificate": {
    "UseLetsEncrypt": true,
    "Domain": "your-domain.com",
    "Email": "admin@your-domain.com"
  },
  "Device": {
    "EnablePrinterDiscovery": true,
    "EnableSerialPortDiscovery": true,
    "EnableUsbHidDiscovery": true,
    "DiscoveryInterval": 5000
  }
}
```

## Usage

### Web Application Integration

#### Basic Connection
```javascript
import { HardwareBridgeClient } from '@hardwarebridge/client';

const client = new HardwareBridgeClient({
  url: 'wss://localhost:8443',
  protocols: ['jsonrpc-2.0']
});

await client.connect();
```

#### Device Discovery
```javascript
// Enumerate all devices
const devices = await client.enumerateDevices();

// Watch for device changes
client.onConnectionStateChange((connected) => {
  console.log('Connection status:', connected);
});
```

#### Printer Operations
```javascript
// Print to ESC/POS printer
const result = await client.print('printer_123', escPosData, 'escpos');

// Print to ZPL printer
const result = await client.print('printer_456', zplData, 'zpl');

// Get printer status
const status = await client.getPrinterStatus('printer_123');
```

#### Serial Port Communication
```javascript
// Open serial port
await client.openSerialPort('serial_com1', {
  baudRate: 115200,
  parity: 'None',
  dataBits: 8,
  stopBits: '1',
  flowControl: 'None'
});

// Send data
await client.sendSerialData('serial_com1', 'Hello, World!');

// Receive data
const received = await client.receiveSerialData('serial_com1', 1024, 5000);
```

#### USB HID Operations
```javascript
// Open USB HID device
await client.openUsbDevice('usbhid_1234_5678');

// Send report
await client.sendUsbReport('usbhid_1234_5678', 0, '01020304');

// Receive report
const report = await client.receiveUsbReport('usbhid_1234_5678', 0, 5000);
```

### Test Harness

The included test harness provides a comprehensive web interface for testing all functionality:

1. Open `HardwareBridge/src/TestHarness/index.html` in a web browser
2. Connect to the WebSocket server
3. Discover and interact with devices
4. Monitor real-time performance metrics
5. Test print jobs, serial communication, and USB HID operations

## API Reference

### JSON-RPC v2 Methods

#### Device Management
- `devices.enumerate` - List all available devices
- `devices.get` - Get specific device information
- `devices.watch` - Start watching for device changes
- `devices.unwatch` - Stop watching for device changes

#### Printer Operations
- `printer.print` - Submit print job
- `printer.getStatus` - Get printer status
- `printer.getCapabilities` - Get printer capabilities

#### Serial Port Operations
- `serial.open` - Open serial port with configuration
- `serial.close` - Close serial port
- `serial.send` - Send data to serial port
- `serial.receive` - Receive data from serial port
- `serial.getStatus` - Get serial port status

#### USB HID Operations
- `usb.open` - Open USB HID device
- `usb.close` - Close USB HID device
- `usb.sendReport` - Send HID report
- `usb.receiveReport` - Receive HID report
- `usb.getStatus` - Get USB device status

#### Queue Management
- `queue.getStatus` - Get queue statistics
- `queue.getJobs` - List queue jobs
- `queue.cancelJob` - Cancel specific job

#### System Information
- `system.getInfo` - Get system information
- `system.getHealth` - Get system health status

## Development

### Building from Source

#### Prerequisites
- .NET 10 SDK
- Node.js 18+ and npm
- Windows 10/11 development environment

#### Build C# Service
```bash
cd HardwareBridge/src/BridgeService
dotnet restore
dotnet build -c Release
```

#### Build TypeScript Client
```bash
cd HardwareBridge/src/BridgeClient
npm install
npm run build
```

#### Run Tests
```bash
# C# tests
dotnet test HardwareBridge/tests/BridgeService.Tests

# TypeScript tests
cd HardwareBridge/src/BridgeClient
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

### Certificate Management
- Automatic Let's Encrypt certificate provisioning
- Certificate renewal before expiration
- Support for custom certificates
- TLS 1.3 enforcement

### Access Control
- Origin-based access control lists
- Optional mutual TLS authentication
- Per-device capability tokens
- Rate limiting and connection throttling

### Data Protection
- All communications encrypted with TLS 1.3
- No sensitive data stored locally
- Secure offline queue with encryption
- Audit logging for security events

## Performance

### Benchmarks
- **WebSocket Connections**: 100+ concurrent connections
- **Device Discovery**: < 5 seconds for 50+ devices
- **Print Jobs**: < 100ms submission time
- **Serial Communication**: 115,200 baud supported
- **USB HID**: 1,000+ reports/second

### Optimization Features
- Connection pooling for device management
- Efficient JSON-RPC message handling
- Minimal memory footprint
- Background garbage collection
- Configurable timeouts and buffers

## Troubleshooting

### Common Issues

#### Service Won't Start
1. Check Windows Event Log for errors
2. Verify .NET 10 runtime is installed
3. Ensure proper permissions for service installation
4. Check firewall settings for WebSocket port

#### Certificate Issues
1. Verify domain configuration
2. Check Let's Encrypt rate limits
3. Ensure port 80 is available for ACME challenges
4. Review certificate logs in application directory

#### Device Discovery Problems
1. Verify device drivers are installed
2. Check device permissions
3. Ensure device is not in use by another application
4. Review device discovery logs

#### Connection Issues
1. Verify WebSocket URL and port
2. Check TLS certificate validity
3. Review origin-based ACL settings
4. Test with included test harness

### Debug Mode
Enable debug logging in settings:
```json
{
  "Logging": {
    "LogLevel": "Debug",
    "EnableConsole": true,
    "EnableFile": true
  }
}
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [https://docs.hardwarebridge.io](https://docs.hardwarebridge.io)
- **Issues**: [GitHub Issues](https://github.com/hardwarebridge/bridge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hardwarebridge/bridge/discussions)
- **Email**: support@hardwarebridge.io

## Acknowledgments

- Let's Encrypt for certificate management
- Microsoft for .NET platform
- Open source community for various libraries
- Contributors and testers

---

**Developed by Azlam**