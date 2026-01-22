# Hardware Bridge - Local Testing Guide

This comprehensive guide covers everything you need to test the Hardware Bridge application locally, including setup, running tests, manual testing procedures, and troubleshooting.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Component Overview](#component-overview)
4. [Setting Up the Development Environment](#setting-up-the-development-environment)
5. [Running the Bridge Service](#running-the-bridge-service)
6. [Running the TypeScript Client](#running-the-typescript-client)
7. [Running the Cross-Platform Server](#running-the-cross-platform-server)
8. [Using the Test Harness](#using-the-test-harness)
9. [Automated Testing](#automated-testing)
10. [Manual Testing Procedures](#manual-testing-procedures)
11. [Testing Device Operations](#testing-device-operations)
12. [Performance Testing](#performance-testing)
13. [Security Testing](#security-testing)
14. [Troubleshooting](#troubleshooting)
15. [Testing Checklist](#testing-checklist)

---

## Prerequisites

### For Windows Service (BridgeService)

- **Windows 10/11** (64-bit)
- **.NET 10 SDK** - [Download](https://dotnet.microsoft.com/download/dotnet/10.0)
- **Visual Studio 2022** (optional, for debugging)
- **Administrator privileges** (for service installation)

### For TypeScript Client (BridgeClient)

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm 9+** (comes with Node.js)

### For Cross-Platform Server

- **Node.js 18+**
- **npm 9+**

### For Testing

- **A web browser** (Chrome, Firefox, or Edge recommended)
- **Hardware devices** (optional, for device testing):
  - USB printer (thermal receipt printer recommended)
  - Serial port device (or USB-to-Serial adapter)
  - USB HID device (barcode scanner, card reader, etc.)

---

## Quick Start

### Option 1: Windows Full Stack (Recommended for Windows users)

```bash
# 1. Start the Windows Bridge Service
cd src/BridgeService
dotnet restore
dotnet run

# 2. Open Test Harness in browser
# Open src/TestHarness/index.html in your browser

# 3. Connect and test
# Click "Connect" in the Test Harness UI
```

### Option 2: Cross-Platform Stack (macOS/Linux)

```bash
# 1. Start the Cross-Platform Server
cd src/CrossPlatformServer
npm install
npm run dev

# 2. Open Test Harness in browser
# Open src/TestHarness/index.html in your browser

# 3. Connect and test
# Click "Connect" in the Test Harness UI
```

---

## Component Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| **BridgeService** | `src/BridgeService/` | Windows service providing WebSocket API for hardware access |
| **BridgeClient** | `src/BridgeClient/` | TypeScript client library for web applications |
| **CrossPlatformServer** | `src/CrossPlatformServer/` | Node.js alternative server for macOS/Linux |
| **TestHarness** | `src/TestHarness/` | Interactive web-based testing interface |

---

## Setting Up the Development Environment

### 1. Clone and Navigate to Project

```bash
cd HardwareBridge
```

### 2. Set Up BridgeService (Windows)

```bash
cd src/BridgeService

# Restore NuGet packages
dotnet restore

# Verify build
dotnet build

# Return to root
cd ../..
```

### 3. Set Up BridgeClient

```bash
cd src/BridgeClient

# Install dependencies
npm install

# Build the library
npm run build

# Return to root
cd ../..
```

### 4. Set Up CrossPlatformServer

```bash
cd src/CrossPlatformServer

# Install dependencies
npm install

# Build TypeScript
npm run build

# Return to root
cd ../..
```

---

## Running the Bridge Service

### Development Mode (Windows)

```bash
cd src/BridgeService

# Run in development mode
dotnet run

# Or run with specific configuration
dotnet run --configuration Debug
```

The service will start and listen on:
- **WebSocket**: `wss://localhost:9876` (secure)
- **HTTP**: `http://localhost:9877` (health endpoint)

### As Windows Service

```bash
# Build release version
dotnet publish -c Release -r win-x64 --self-contained

# Install as Windows Service (Admin required)
sc create HardwareBridge binPath= "C:\path\to\HardwareBridge.exe"
sc start HardwareBridge
```

### Verify Service is Running

```bash
# Check health endpoint
curl http://localhost:9877/health

# Or in PowerShell
Invoke-WebRequest -Uri "http://localhost:9877/health"
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": "00:05:23",
  "connections": 0
}
```

---

## Running the TypeScript Client

### Build the Client Library

```bash
cd src/BridgeClient

# Development build with watch
npm run build:watch

# Or single production build
npm run build
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Lint the Code

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

---

## Running the Cross-Platform Server

### Development Mode

```bash
cd src/CrossPlatformServer

# Run with TypeScript (requires ts-node)
npm run dev

# Or run the simple server
node src/simple-server.js
```

### Production Mode

```bash
# Build TypeScript
npm run build

# Run compiled version
npm start
```

The server will listen on:
- **WebSocket**: `ws://localhost:9876`
- **HTTP**: `http://localhost:9877`

---

## Using the Test Harness

The Test Harness is an interactive web application for testing all Hardware Bridge features.

### Starting the Test Harness

1. **Ensure a server is running** (BridgeService or CrossPlatformServer)

2. **Open the Test Harness**:
   - Navigate to `src/TestHarness/index.html`
   - Open in a web browser (Chrome recommended)
   - Or serve via a local HTTP server:
     ```bash
     # Using Python
     python -m http.server 8080
     # Then open http://localhost:8080/src/TestHarness/index.html

     # Using Node.js
     npx serve .
     # Then open the provided URL
     ```

### Test Harness Features

#### Connection Panel
- **Server URL**: Enter WebSocket server address (default: `ws://localhost:9876`)
- **Connect/Disconnect**: Toggle connection to the server
- **Connection Status**: Shows current connection state

#### Device Discovery
- **Refresh Devices**: Enumerate all connected hardware
- **Device List**: Shows printers, serial ports, and USB HID devices
- **Device Details**: Click a device to see detailed information

#### Printer Testing
- **Select Printer**: Choose from discovered printers
- **Print Test Page**: Send a test print job
- **Print Raw Data**: Send raw ESC/POS or ZPL commands
- **Check Status**: Query printer status (paper, cover, etc.)

#### Serial Port Testing
- **Select Port**: Choose from available COM ports
- **Baud Rate**: Configure communication speed
- **Open/Close Port**: Manage port connection
- **Send Data**: Transmit data to the device
- **Receive Data**: View incoming data stream

#### USB HID Testing
- **Select Device**: Choose from HID devices
- **Read Reports**: Receive HID input reports
- **Write Reports**: Send HID output reports
- **Feature Reports**: Read/write feature reports

#### Event Log
- **Real-time Logging**: All events are logged with timestamps
- **Filter Events**: Filter by event type or device
- **Export Log**: Download log for analysis

---

## Automated Testing

### Unit Tests (BridgeClient)

```bash
cd src/BridgeClient

# Run all unit tests
npm test

# Run specific test file
npm test -- --testPathPattern="websocket"

# Run with verbose output
npm test -- --verbose

# Generate coverage report
npm test -- --coverage
```

### Integration Tests

Create integration tests in `tests/` directory:

```typescript
// tests/integration/connection.test.ts
import { HardwareBridgeClient } from '../../src/BridgeClient/src';

describe('HardwareBridge Integration', () => {
  let client: HardwareBridgeClient;

  beforeEach(() => {
    client = new HardwareBridgeClient({
      url: 'ws://localhost:9876'
    });
  });

  afterEach(async () => {
    await client.disconnect();
  });

  test('should connect to server', async () => {
    await client.connect();
    expect(client.isConnected()).toBe(true);
  });

  test('should enumerate devices', async () => {
    await client.connect();
    const devices = await client.getDevices();
    expect(Array.isArray(devices)).toBe(true);
  });
});
```

### Running Integration Tests

```bash
# Ensure server is running first
cd src/BridgeService && dotnet run &

# Run integration tests
npm test -- --testPathPattern="integration"
```

---

## Manual Testing Procedures

### Test 1: Basic Connection

1. Start the Bridge Service
2. Open Test Harness
3. Click "Connect"
4. **Expected**: Connection status shows "Connected"
5. **Verify**: Server logs show new connection

### Test 2: Device Enumeration

1. Connect to the Bridge Service
2. Click "Refresh Devices"
3. **Expected**: All connected hardware appears in lists
4. **Verify**: Device counts match physically connected devices

### Test 3: Reconnection

1. Connect to the Bridge Service
2. Stop the Bridge Service
3. **Expected**: Status shows "Disconnected"
4. Restart the Bridge Service
5. **Expected**: Client auto-reconnects (if enabled)

### Test 4: Multiple Connections

1. Open Test Harness in multiple browser tabs
2. Connect all tabs to the same server
3. **Expected**: All connections succeed
4. **Verify**: Server shows correct connection count

### Test 5: Error Handling

1. Try to connect with wrong server URL
2. **Expected**: Error message displayed
3. Try to print without selecting a printer
4. **Expected**: Validation error shown

---

## Testing Device Operations

### Printer Testing

#### Prerequisites
- Connect a USB or network printer
- Ensure printer drivers are installed (Windows)

#### Test Procedure

```javascript
// Using the client library
const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
await client.connect();

// Get printers
const printers = await client.getPrinters();
console.log('Available printers:', printers);

// Print test page
const result = await client.print({
  printerId: printers[0].id,
  data: 'Hello, Hardware Bridge!\n',
  type: 'text'
});
console.log('Print result:', result);
```

#### Test Cases

| Test | Action | Expected Result |
|------|--------|-----------------|
| List Printers | Call `getPrinters()` | Returns array of printer objects |
| Print Text | Send plain text | Text prints correctly |
| Print ESC/POS | Send ESC/POS commands | Receipt prints with formatting |
| Print ZPL | Send ZPL commands | Label prints correctly |
| Printer Status | Call `getPrinterStatus()` | Returns paper/cover/error status |
| Print Queue | Send multiple jobs | Jobs queue and print in order |

### Serial Port Testing

#### Prerequisites
- Connect a serial device or USB-to-Serial adapter
- Note the COM port number (Windows) or device path (macOS/Linux)

#### Test Procedure

```javascript
// Get available serial ports
const ports = await client.getSerialPorts();
console.log('Available ports:', ports);

// Open a port
await client.openSerialPort({
  portId: ports[0].id,
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
});

// Send data
await client.writeSerialPort({
  portId: ports[0].id,
  data: 'AT\r\n'
});

// Listen for data
client.onSerialData((data) => {
  console.log('Received:', data);
});
```

#### Test Cases

| Test | Action | Expected Result |
|------|--------|-----------------|
| List Ports | Call `getSerialPorts()` | Returns array of port objects |
| Open Port | Open with valid settings | Port opens successfully |
| Send Data | Write bytes to port | Data transmitted |
| Receive Data | Read from active device | Data received via event |
| Close Port | Close open port | Port released |
| Invalid Settings | Open with wrong baud rate | Error returned |

### USB HID Testing

#### Prerequisites
- Connect a USB HID device (barcode scanner, card reader, etc.)
- Device must not require special drivers

#### Test Procedure

```javascript
// Get HID devices
const hidDevices = await client.getHidDevices();
console.log('HID devices:', hidDevices);

// Open device
await client.openHidDevice({
  deviceId: hidDevices[0].id
});

// Listen for input reports
client.onHidReport((report) => {
  console.log('HID Report:', report);
});

// Send output report (if supported)
await client.writeHidReport({
  deviceId: hidDevices[0].id,
  reportId: 0,
  data: [0x00, 0x01, 0x02]
});
```

#### Test Cases

| Test | Action | Expected Result |
|------|--------|-----------------|
| List Devices | Call `getHidDevices()` | Returns array of HID devices |
| Open Device | Open by device ID | Device opens successfully |
| Read Report | Scan barcode/swipe card | Input report received |
| Write Report | Send output report | Report sent (if supported) |
| Feature Report | Read/write feature | Feature report handled |
| Close Device | Close open device | Device released |

---

## Performance Testing

### Connection Load Test

```javascript
// Test multiple concurrent connections
async function loadTest(connectionCount) {
  const clients = [];
  const startTime = Date.now();

  for (let i = 0; i < connectionCount; i++) {
    const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
    await client.connect();
    clients.push(client);
  }

  const connectTime = Date.now() - startTime;
  console.log(`${connectionCount} connections in ${connectTime}ms`);

  // Cleanup
  for (const client of clients) {
    await client.disconnect();
  }
}

// Run tests
loadTest(10);   // 10 connections
loadTest(50);   // 50 connections
loadTest(100);  // 100 connections
```

### Throughput Test

```javascript
// Test message throughput
async function throughputTest(messageCount) {
  const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
  await client.connect();

  const startTime = Date.now();

  for (let i = 0; i < messageCount; i++) {
    await client.getDevices();
  }

  const elapsed = Date.now() - startTime;
  const rps = (messageCount / elapsed) * 1000;

  console.log(`${messageCount} requests in ${elapsed}ms (${rps.toFixed(2)} req/sec)`);

  await client.disconnect();
}

throughputTest(1000);
```

### Memory Usage Monitoring

```bash
# Windows - Monitor service memory
Get-Process HardwareBridge | Select-Object WorkingSet64, PrivateMemorySize64

# Cross-platform server
node --expose-gc src/simple-server.js
# Then use process.memoryUsage() to check memory
```

---

## Security Testing

### TLS Certificate Verification

```bash
# Check certificate
openssl s_client -connect localhost:9876 -servername localhost

# Verify TLS version (should be 1.3)
openssl s_client -connect localhost:9876 -tls1_3
```

### Origin Validation Test

```javascript
// Test from different origins
// Should be blocked if not in allowed list
const client = new HardwareBridgeClient({
  url: 'wss://localhost:9876',
  origin: 'https://malicious-site.com'
});

try {
  await client.connect();
  console.log('ERROR: Connection should have been blocked');
} catch (error) {
  console.log('PASS: Connection blocked as expected');
}
```

### Rate Limiting Test

```javascript
// Test rate limiting
async function rateLimitTest() {
  const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
  await client.connect();

  // Send requests rapidly
  for (let i = 0; i < 1000; i++) {
    try {
      await client.getDevices();
    } catch (error) {
      if (error.message.includes('rate limit')) {
        console.log(`Rate limited after ${i} requests`);
        break;
      }
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### "Connection Refused" Error

**Cause**: Server not running or wrong port

**Solution**:
```bash
# Check if server is listening
netstat -an | findstr 9876  # Windows
lsof -i :9876               # macOS/Linux

# Verify server is running
curl http://localhost:9877/health
```

#### "Certificate Error" in Browser

**Cause**: Self-signed certificate not trusted

**Solution**:
1. Open `https://localhost:9876` directly in browser
2. Accept the security warning
3. Or import the certificate to trusted store

#### "No Devices Found"

**Cause**: Devices not connected or drivers missing

**Solution**:
```bash
# Windows - List USB devices
wmic path Win32_PnPEntity get Name, DeviceID | findstr USB

# Check printer drivers
wmic printer list brief

# macOS - List USB devices
system_profiler SPUSBDataType
```

#### "Permission Denied" on Serial Port

**Cause**: Port locked by another application or insufficient permissions

**Solution**:
```bash
# Windows - Check port usage
mode COM3

# macOS/Linux - Check permissions
ls -la /dev/tty*
sudo chmod 666 /dev/ttyUSB0
```

#### Client Not Reconnecting

**Cause**: Auto-reconnect disabled or max retries exceeded

**Solution**:
```javascript
const client = new HardwareBridgeClient({
  url: 'ws://localhost:9876',
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectInterval: 1000
});
```

### Debug Logging

#### Enable Server Debug Logs

```bash
# Windows Service
set HARDWAREBRIDGE_LOG_LEVEL=Debug
dotnet run

# Cross-platform
DEBUG=* npm run dev
```

#### Enable Client Debug Logs

```javascript
const client = new HardwareBridgeClient({
  url: 'ws://localhost:9876',
  debug: true
});
```

### Log File Locations

| Component | Log Location |
|-----------|--------------|
| Windows Service | `%APPDATA%\HardwareBridge\logs\` |
| Cross-platform Server | `./logs/` or console |
| Client | Browser DevTools Console |

---

## Testing Checklist

Use this checklist to ensure comprehensive testing:

### Setup Verification
- [ ] .NET 10 SDK installed (for Windows Service)
- [ ] Node.js 18+ installed
- [ ] All npm dependencies installed
- [ ] Project builds without errors

### Connection Tests
- [ ] Client connects to server successfully
- [ ] Connection status displayed correctly
- [ ] Disconnect works properly
- [ ] Auto-reconnect functions (if enabled)
- [ ] Multiple simultaneous connections work
- [ ] Connection survives server restart

### Device Discovery Tests
- [ ] Printers enumerated correctly
- [ ] Serial ports enumerated correctly
- [ ] USB HID devices enumerated correctly
- [ ] Hot-plug detection works (device connect/disconnect)
- [ ] Device details accurate

### Printer Tests
- [ ] Print plain text
- [ ] Print with ESC/POS formatting
- [ ] Print ZPL labels (if applicable)
- [ ] Get printer status
- [ ] Handle print errors gracefully
- [ ] Print queue management

### Serial Port Tests
- [ ] List available ports
- [ ] Open port with various settings
- [ ] Send data successfully
- [ ] Receive data via events
- [ ] Close port properly
- [ ] Handle port errors

### USB HID Tests
- [ ] List HID devices
- [ ] Open device
- [ ] Receive input reports
- [ ] Send output reports (if supported)
- [ ] Handle feature reports
- [ ] Close device properly

### Error Handling Tests
- [ ] Invalid server URL handled
- [ ] Network timeout handled
- [ ] Device not found handled
- [ ] Permission denied handled
- [ ] Invalid parameters validated
- [ ] Server errors propagated to client

### Performance Tests
- [ ] 10+ concurrent connections
- [ ] 100+ requests per second
- [ ] Memory usage stable over time
- [ ] No connection leaks

### Security Tests
- [ ] TLS 1.3 enforced (Windows Service)
- [ ] Invalid origins rejected
- [ ] Rate limiting works
- [ ] No sensitive data in logs

### Cross-Platform Tests
- [ ] Windows Service works
- [ ] Cross-platform server works on macOS
- [ ] Cross-platform server works on Linux
- [ ] Client works in Chrome
- [ ] Client works in Firefox
- [ ] Client works in Edge

---

## Additional Resources

- [Web-to-Print Setup Guide](./WEB_TO_PRINT_SETUP.md)
- [macOS Compatibility Notes](./DOTNET_MACOS_COMPATIBILITY.md)
- [API Reference](../README.md)
- [Cross-Platform Solution](../CROSS_PLATFORM_SOLUTION.md)

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review server and client logs
3. Search existing GitHub issues
4. Create a new issue with:
   - Operating system and version
   - Node.js/.NET version
   - Error messages and logs
   - Steps to reproduce
