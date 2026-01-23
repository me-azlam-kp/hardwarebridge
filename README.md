# Hardware Bridge

A cross-platform bridge that exposes printers, serial ports, USB HID, network, and biometric devices to web applications over a WebSocket server using JSON-RPC 2.0.

## Overview

Hardware Bridge provides two server implementations and a TypeScript client library:

- **CrossPlatformServer** (Node.js) - Works on macOS, Linux, and Windows. Enumerates real OS devices, manages TCP socket connections, and prints via CUPS or raw TCP.
- **BridgeService** (.NET) - Windows desktop application with system tray UI, WPF settings interface, and native device access.
- **BridgeClient** (TypeScript) - Client library published as `@hardwarebridge/client` on npm. Works in both Node.js and browser environments.

## Project Structure

```
HardwareBridge/
├── src/
│   ├── CrossPlatformServer/       # Node.js/TypeScript server (macOS, Linux, Windows)
│   │   ├── src/
│   │   │   ├── server.ts          # Entry point
│   │   │   ├── websocket-server.ts       # WebSocket + JSON-RPC handler
│   │   │   ├── device-enumerator.ts      # OS-level device discovery
│   │   │   ├── network-device-manager.ts # TCP socket connections
│   │   │   ├── tcp-printer-service.ts    # Raw TCP printing
│   │   │   ├── database-manager.ts       # SQLite job queue
│   │   │   └── types.ts
│   │   ├── config.json            # Server configuration
│   │   └── package.json
│   ├── BridgeClient/              # TypeScript client library (@hardwarebridge/client)
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── hardware-bridge-client.ts  # Main client API
│   │   │   │   └── websocket-client.ts        # WebSocket transport
│   │   │   ├── types.ts           # Type definitions
│   │   │   └── index.ts           # Package exports
│   │   └── package.json
│   ├── BridgeService/             # .NET Windows service (C#)
│   │   ├── Services/              # Core service implementations
│   │   ├── Models/                # Data models
│   │   ├── UI/                    # WPF settings interface
│   │   └── HardwareBridge.csproj
│   ├── TestApp/                   # Test applications
│   └── TestHarness/               # Browser-based test harness
├── examples/
│   └── web-to-print/             # Web application example
│       ├── index.html            # Basic interface
│       ├── enhanced-interface.html # Control center with device management
│       ├── app.js                # Basic app logic
│       ├── enhanced-app.js       # Enhanced control center logic
│       └── server.js             # Express dev server
├── docs/                         # Documentation
│   ├── LOCAL_TESTING_GUIDE.md
│   ├── WEB_TO_PRINT_SETUP.md
│   └── DOTNET_MACOS_COMPATIBILITY.md
└── HardwareBridge.sln            # Visual Studio solution
```

## Features

### Device Support
- **Printers** - ESC/POS, ZPL, EPL, and raw text protocols. Real printing via CUPS (macOS/Linux) or raw TCP (port 9100).
- **Serial Ports** - Configurable baud rate, parity, data bits, stop bits, and flow control.
- **USB HID** - Input/output/feature reports with device open/close lifecycle.
- **Network Devices** - TCP socket connections with ping, discovery, and data transfer.
- **Biometric Devices** - Enrollment, authentication (verify/identify), and user management.

### Server Capabilities
- **Real device enumeration** - Uses `lpstat` (printers) and `/dev/tty.*` (serial) on macOS/Linux, `wmic`/`Get-Printer` on Windows.
- **Network discovery** - Scans local subnet for devices on ports 9100, 631, 515, 4370 with configurable parallelism.
- **TCP socket management** - Persistent connections to network devices with ping measurement.
- **SQLite job queue** - Persistent print queue with job status tracking.
- **Auto-reconnection** - Client reconnects automatically on disconnect.
- **WebSocket broadcasting** - Device events pushed to all connected clients.

### Communication
- **JSON-RPC 2.0** over WebSocket
- **Request/response** with unique IDs and timeout handling
- **Event notifications** for device connect/disconnect/status changes

## Quick Start

### Prerequisites
- Node.js 22+ (for CrossPlatformServer)
- npm 10+

### 1. Install and Build

```bash
# Build the client library
cd src/BridgeClient
npm install
npm run build

# Install server dependencies
cd ../CrossPlatformServer
npm install
```

### 2. Start the Server

```bash
cd src/CrossPlatformServer

# Development mode (with tsx)
npm run dev

# Or build and run
npm run build
npm start
```

The server starts on `ws://localhost:8443` by default (configurable via `config.json`).

### 3. Connect from a Web Application

```typescript
import { HardwareBridgeClient } from '@hardwarebridge/client';

const client = new HardwareBridgeClient({
  url: 'ws://localhost:8443',
  autoReconnect: true,
  reconnectInterval: 5000
});

await client.connect();
const devices = await client.enumerateDevices();
```

### 4. Run the Example Application

```bash
cd examples/web-to-print
npm install
npm start
```

Open `http://localhost:3001` in your browser. For the enhanced control center, open `enhanced-interface.html` directly or via a static server.

## Configuration

The CrossPlatformServer reads `config.json` from the working directory:

```json
{
  "port": 8443,
  "host": "localhost",
  "useTls": false,
  "allowedOrigins": ["*"],
  "maxConnections": 100,
  "databasePath": "data/queue.db",
  "logLevel": "info"
}
```

## Client Library

Install the client library:

```bash
npm install @hardwarebridge/client
```

### Device Discovery

```typescript
// List all devices
const devices = await client.enumerateDevices();

// Get full result with source info (real vs simulated)
const result = await client.enumerateDevicesWithInfo();
console.log(result.source); // 'real' or 'simulated'

// Discover network devices on local subnet
const discovered = await client.discoverNetworkDevices({
  subnet: '192.168.1',
  ports: [9100, 631, 515],
  timeout: 3000,
  maxConcurrent: 50
});
```

### Printing

```typescript
// Print raw text
await client.print(deviceId, 'Hello World\n', 'raw');

// Print ESC/POS receipt
await client.print(deviceId, escposData, 'escpos');

// Print ZPL label
await client.print(deviceId, zplData, 'zpl');

// Print to network printer via TCP
await client.printToNetworkPrinter(deviceId, '192.168.1.100', 9100, data, 'raw');

// Get printer status and capabilities
const status = await client.getPrinterStatus(deviceId);
const caps = await client.getPrinterCapabilities(deviceId);
```

### Serial Port

```typescript
await client.openSerialPort(deviceId, {
  baudRate: 9600,
  parity: 'None',
  dataBits: 8,
  stopBits: '1',
  flowControl: 'None'
});

await client.sendSerialData(deviceId, 'AT\r\n');
const response = await client.receiveSerialData(deviceId, 1024, 5000);
await client.closeSerialPort(deviceId);
```

### Network Devices

```typescript
// Connect to a network device
await client.connectNetworkDevice(deviceId, {
  host: '192.168.1.100',
  port: 9100,
  protocol: 'tcp'
});

// Ping with TCP round-trip measurement
const ping = await client.pingNetworkDevice(deviceId, '192.168.1.100', 9100);
console.log(`Response time: ${ping.responseTime}ms`);

// Send data over TCP socket
await client.sendNetworkData(deviceId, 'data payload');

// Disconnect
await client.disconnectNetworkDevice(deviceId);
```

### USB HID

```typescript
await client.openUsbDevice(deviceId);
await client.sendUsbReport(deviceId, 0, '01020304');
const report = await client.receiveUsbReport(deviceId, 0, 5000);
await client.closeUsbDevice(deviceId);
```

### Biometric Devices

```typescript
// Enroll a user
await client.enrollBiometric(deviceId, 'user123', 'John Doe', biometricData);

// Verify identity
const result = await client.verifyBiometric(deviceId, 'user123', biometricData);
console.log(`Confidence: ${result.confidence}`);

// Identify unknown user
const identified = await client.identifyBiometric(deviceId, biometricData);

// Manage users
const users = await client.getBiometricUsers(deviceId);
await client.deleteBiometricUser(deviceId, 'user123');
```

### Queue Management

```typescript
const status = await client.getQueueStatus();
const jobs = await client.getQueueJobs(deviceId, 'pending', 50);
await client.cancelQueueJob(jobId);
```

### System Information

```typescript
const info = await client.getSystemInfo();
const health = await client.getSystemHealth();
```

## JSON-RPC API Reference

### Device Operations
| Method | Description |
|--------|-------------|
| `devices.enumerate` | List all available devices |
| `devices.get` | Get specific device info |
| `devices.watch` | Subscribe to device events |
| `devices.unwatch` | Unsubscribe from device events |

### Printer Operations
| Method | Description |
|--------|-------------|
| `printer.print` | Submit print job (raw/escpos/zpl/epl) |
| `printer.getStatus` | Get printer status |
| `printer.getCapabilities` | Get supported protocols and features |

### Serial Port Operations
| Method | Description |
|--------|-------------|
| `serial.open` | Open port with baud/parity/bits config |
| `serial.close` | Close port |
| `serial.send` | Send data |
| `serial.receive` | Receive data with timeout |
| `serial.getStatus` | Get port status |

### USB HID Operations
| Method | Description |
|--------|-------------|
| `usb.open` | Open device |
| `usb.close` | Close device |
| `usb.sendReport` | Send output report |
| `usb.receiveReport` | Receive input report |
| `usb.getStatus` | Get device status |

### Network Operations
| Method | Description |
|--------|-------------|
| `network.connect` | Open TCP connection |
| `network.disconnect` | Close TCP connection |
| `network.ping` | TCP ping with round-trip time |
| `network.getStatus` | Get connection status |
| `network.discover` | Scan subnet for devices |
| `network.send` | Send data over connection |

### Biometric Operations
| Method | Description |
|--------|-------------|
| `biometric.enroll` | Enroll user biometric data |
| `biometric.authenticate` | Verify or identify user |
| `biometric.identify` | Identify unknown biometric |
| `biometric.getStatus` | Get device status |
| `biometric.getUsers` | List enrolled users |
| `biometric.deleteUser` | Remove enrolled user |

### Queue Operations
| Method | Description |
|--------|-------------|
| `queue.getStatus` | Get queue statistics |
| `queue.getJobs` | List jobs (filterable) |
| `queue.cancelJob` | Cancel a job |

### System Operations
| Method | Description |
|--------|-------------|
| `system.getInfo` | Server version, platform, uptime |
| `system.getHealth` | Device counts, CPU/memory usage |

## Development

### Building

```bash
# Client library
cd src/BridgeClient
npm run build          # Rollup build (CJS + ESM + types)
npm run lint           # ESLint

# Server
cd src/CrossPlatformServer
npm run build          # TypeScript compilation
npm run dev            # Development with tsx

# .NET service (Windows)
cd src/BridgeService
dotnet build
```

### Testing

```bash
# Client library tests
cd src/BridgeClient
npm test

# Server tests
cd src/CrossPlatformServer
npm test

# Test applications
cd src/TestApp
npm start
```

### Type Exports

The client library exports all TypeScript types:

```typescript
import type {
  DeviceInfo,
  PrinterDevice,
  SerialPortDevice,
  UsbHidDevice,
  NetworkDevice,
  BiometricDevice,
  ConnectionConfig,
  ClientOptions,
  PrintResult,
  PrintFormat,
  SerialPortConfig,
  QueueStatus,
  QueueJob,
  SystemHealth,
  DeviceEvent,
  DeviceType,
  DeviceSource,
  EnumerateResult,
  DiscoverOptions,
  DiscoverResult,
  DiscoveredDevice
} from '@hardwarebridge/client';
```

## BridgeService (.NET)

The Windows-specific implementation provides:

- System tray icon with WPF settings UI
- Native device access via Windows APIs
- Certificate management for WSS
- Windows Task Scheduler integration for auto-start
- Logging via rolling file logs

Build and run:

```bash
cd src/BridgeService
dotnet build -c Release
./bin/Release/net10.0-windows/HardwareBridge.exe
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Repository

[https://github.com/me-azlam-kp/hardwarebridge](https://github.com/me-azlam-kp/hardwarebridge)

---

**Developed by Azlam**
