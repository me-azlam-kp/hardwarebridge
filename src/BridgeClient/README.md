# 🔌 Hardware Bridge Client

[![npm version](https://badge.fury.io/js/%40hardwarebridge%2Fclient.svg)](https://badge.fury.io/js/%40hardwarebridge%2Fclient)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

A professional TypeScript client library for connecting to Hardware Bridge WebSocket services. Control hardware devices including printers, serial ports, and USB HID devices with ease.

## 🚀 Quick Start

```bash
npm install @hardwarebridge/client
```

```typescript
import { HardwareBridgeClient } from '@hardwarebridge/client';

const client = new HardwareBridgeClient({
  url: 'ws://localhost:8443',
  autoReconnect: true
});

await client.connect();
const devices = await client.enumerateDevices();
```

## 📋 Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
- [Hardware Support](#hardware-support)
- [Examples](#examples)
- [TypeScript Support](#typescript-support)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## ✨ Features

- 🔌 **WebSocket Communication** - Real-time connection to Hardware Bridge server
- 🖨️ **Printer Support** - ESC/POS, ZPL, EPL protocols
- 🔌 **Serial Port Control** - Full serial communication capabilities
- 📱 **USB HID Devices** - Human Interface Device communication
- 📦 **Queue Management** - Built-in job queuing system
- 🔒 **TypeScript Support** - Full type definitions and IntelliSense
- 🔄 **Auto-reconnection** - Robust connection handling
- 📊 **Device Discovery** - Automatic device enumeration
- ⚡ **Multi-format Support** - CommonJS, ES Modules, UMD builds

## 📦 Installation

```bash
# npm
npm install @hardwarebridge/client

# yarn
yarn add @hardwarebridge/client

# pnpm
pnpm add @hardwarebridge/client
```

## 🔧 Basic Usage

### Connecting to the Server

```typescript
import { HardwareBridgeClient } from '@hardwarebridge/client';

const client = new HardwareBridgeClient({
  url: 'ws://localhost:8443',
  autoReconnect: true,
  reconnectInterval: 5000
});

// Connect to the server
await client.connect();
console.log('Connected to Hardware Bridge server!');
```

### Device Discovery

```typescript
// Discover all available devices
const devices = await client.enumerateDevices();
console.log(`Found ${devices.length} devices`);

devices.forEach(device => {
  console.log(`${device.name} (${device.type}) - ${device.status}`);
});

// Get detailed information about a specific device
const printer = await client.getDevice('printer_test1');
console.log('Printer details:', printer);
```

### Printer Operations

```typescript
// Get printer status
const status = await client.getPrinterStatus('printer_test1');
console.log('Printer status:', status.status);

// Get printer capabilities
const capabilities = await client.getPrinterCapabilities('printer_test1');
console.log('Supported protocols:', capabilities.supportedProtocols);

// Print content
const printResult = await client.print('printer_test1', 'Hello World!', 'raw');
console.log('Print job:', printResult.jobId);
```

### Queue Management

```typescript
// Get queue status
const queueStatus = await client.getQueueStatus();
console.log('Queue status:', queueStatus);

// Get queue jobs
const jobs = await client.getQueueJobs();
console.log(`Found ${jobs.length} jobs in queue`);
```

## 📚 API Reference

### HardwareBridgeClient

#### Constructor Options

```typescript
interface ClientOptions {
  url: string;                    // WebSocket URL
  autoReconnect?: boolean;        // Auto-reconnect on disconnect
  reconnectInterval?: number;     // Reconnection interval in ms
  timeout?: number;               // Request timeout in ms
}
```

#### Methods

### Connection Management

```typescript
// Connect to server
await client.connect();

// Disconnect from server
await client.disconnect();

// Check connection status
const isConnected = client.isConnected();
```

### Device Operations

```typescript
// Enumerate all devices
const devices = await client.enumerateDevices();

// Get specific device info
const device = await client.getDevice(deviceId);

// Listen for device events
client.onDeviceEvent((event) => {
  console.log('Device event:', event);
});
```

### Printer Operations

```typescript
// Get printer status
const status = await client.getPrinterStatus(deviceId);

// Get printer capabilities
const capabilities = await client.getPrinterCapabilities(deviceId);

// Print content
const result = await client.print(deviceId, data, format);
```

### Queue Operations

```typescript
// Get queue status
const status = await client.getQueueStatus();

// Get queue jobs
const jobs = await client.getQueueJobs({
  deviceId?: string,
  status?: string,
  limit?: number
});

// Cancel a queue job
await client.cancelQueueJob(jobId);
```

## 🖨️ Hardware Support

### Supported Protocols

- **ESC/POS** - Epson Standard Code for Point of Sale
- **ZPL** - Zebra Programming Language
- **EPL** - Eltron Programming Language
- **Raw** - Direct data transmission

### Device Types

- **Printers** - Thermal, label, receipt printers
- **Serial Ports** - COM ports, UART communication
- **USB HID** - Human Interface Devices
- **Custom Devices** - Extensible device support

## 📖 Examples

### Complete Printer Example

```typescript
import { HardwareBridgeClient } from '@hardwarebridge/client';

async function printReceipt() {
  const client = new HardwareBridgeClient({
    url: 'ws://localhost:8443'
  });

  try {
    await client.connect();
    
    // Find printer
    const devices = await client.enumerateDevices();
    const printer = devices.find(d => d.type === 'printer');
    
    if (!printer) {
      throw new Error('No printer found');
    }

    // Print receipt in ESC/POS format
    const receipt = `
RECEIPT #12345
================
Date: ${new Date().toLocaleString()}

Item          Qty  Price
Coffee         2   $5.00
Sandwich       1   $8.50
----------------
Total:         $13.50

Thank you!
================
`;

    const result = await client.print(printer.id, receipt, 'escpos');
    console.log('Receipt printed:', result.jobId);
    
  } catch (error) {
    console.error('Print error:', error);
  } finally {
    await client.disconnect();
  }
}

printReceipt();
```

### Serial Port Communication

```typescript
async function serialCommunication() {
  const client = new HardwareBridgeClient({
    url: 'ws://localhost:8443'
  });

  await client.connect();
  
  // Find serial device
  const devices = await client.enumerateDevices();
  const serialDevice = devices.find(d => d.type === 'serial');
  
  if (serialDevice) {
    // Open serial port
    await client.openSerialPort(serialDevice.id, {
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1
    });
    
    // Send data
    await client.sendSerialData(serialDevice.id, 'Hello Serial!');
    
    // Receive data
    const data = await client.receiveSerialData(serialDevice.id);
    console.log('Received:', data);
  }
  
  await client.disconnect();
}
```

### Queue Management Example

```typescript
async function queueManagement() {
  const client = new HardwareBridgeClient({
    url: 'ws://localhost:8443'
  });

  await client.connect();
  
  // Get queue status
  const status = await client.getQueueStatus();
  console.log('Queue status:', {
    total: status.totalJobs,
    pending: status.pendingJobs,
    processing: status.processingJobs,
    completed: status.completedJobs
  });
  
  // Get recent jobs
  const jobs = await client.getQueueJobs({ limit: 10 });
  jobs.forEach(job => {
    console.log(`${job.id}: ${job.operation} - ${job.status}`);
  });
  
  await client.disconnect();
}
```

## 🎨 Print Format Examples

### ESC/POS (Receipt Format)
```typescript
const escposReceipt = `
RECEIPT #12345
================
Date: ${new Date().toLocaleString()}

Item          Qty  Price
Coffee         2   $5.00
Sandwich       1   $8.50
Cookie         3   $4.50
----------------
Total:         $18.00

Thank you!
================
`;

await client.print(printerId, escposReceipt, 'escpos');
```

### ZPL (Zebra Programming Language)
```typescript
const zplLabel = `
^XA
^FO50,30^ADN,36,20^FDHardware Bridge Demo^FS
^FO50,80^ADN,18,10^FDZPL Format Test^FS
^FO50,120^BCN,80,Y,N,N^FD123456789^FS
^XZ
`;

await client.print(printerId, zplLabel, 'zpl');
```

### EPL (Eltron Programming Language)
```typescript
const eplLabel = `
N
q609
Q203,26
A5,26,0,2,1,1,N,"Hardware Bridge Demo"
A5,56,0,2,1,1,N,"EPL Format Test"
B5,86,0,1,2,2,100,B,"TEST123456"
P1
`;

await client.print(printerId, eplLabel, 'epl');
```

## 🔒 Error Handling

```typescript
import { HardwareBridgeClient, HardwareBridgeError } from '@hardwarebridge/client';

const client = new HardwareBridgeClient({
  url: 'ws://localhost:8443',
  autoReconnect: true
});

// Handle connection errors
client.onConnectionStateChange((connected) => {
  if (!connected) {
    console.log('Connection lost, will attempt to reconnect...');
  }
});

// Handle device events
client.onDeviceEvent((event) => {
  console.log('Device event:', event);
});

// Handle errors gracefully
try {
  await client.connect();
  
  // Your code here
  const devices = await client.enumerateDevices();
  
} catch (error) {
  if (error instanceof HardwareBridgeError) {
    console.error('Hardware Bridge Error:', error.message);
    console.error('Error Code:', error.code);
  } else {
    console.error('Unknown Error:', error);
  }
} finally {
  await client.disconnect();
}
```

## 🌐 Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>Hardware Bridge Demo</title>
</head>
<body>
  <h1>Hardware Bridge Client Demo</h1>
  <button id="connect">Connect</button>
  <button id="print">Print Test</button>
  <div id="status">Disconnected</div>
  <div id="devices"></div>

  <script type="module">
    import { HardwareBridgeClient } from 'https://unpkg.com/@hardwarebridge/client@latest/dist/index.esm.js';
    
    const client = new HardwareBridgeClient({
      url: 'ws://localhost:8443'
    });
    
    document.getElementById('connect').addEventListener('click', async () => {
      try {
        await client.connect();
        document.getElementById('status').textContent = 'Connected!';
        
        const devices = await client.enumerateDevices();
        document.getElementById('devices').innerHTML = 
          devices.map(d => `<p>${d.name} (${d.type})</p>`).join('');
      } catch (error) {
        document.getElementById('status').textContent = 'Connection failed: ' + error.message;
      }
    });
    
    document.getElementById('print').addEventListener('click', async () => {
      try {
        const devices = await client.enumerateDevices();
        const printer = devices.find(d => d.type === 'printer');
        
        if (printer) {
          await client.print(printer.id, 'Hello from Browser!', 'raw');
          alert('Printed successfully!');
        } else {
          alert('No printer found');
        }
      } catch (error) {
        alert('Print failed: ' + error.message);
      }
    });
  </script>
</body>
</html>
```

## 🛠️ Configuration

### Server Configuration

```typescript
const client = new HardwareBridgeClient({
  url: 'ws://localhost:8443',           // WebSocket URL
  autoReconnect: true,                  // Auto-reconnect on disconnect
  reconnectInterval: 5000,              // Reconnection interval (ms)
  timeout: 10000,                       // Request timeout (ms)
  maxRetries: 3,                        // Maximum reconnection attempts
  enableLogging: true                   // Enable debug logging
});
```

### Security Configuration

```typescript
const client = new HardwareBridgeClient({
  url: 'wss://secure-server.com:8443',  // Use WSS for secure connections
  authToken: 'your-auth-token',         // Authentication token
  validateCertificate: true             // Validate SSL certificates
});
```

## 🧪 Testing

```bash
# Run the test applications
cd src/TestApp
npm install
npm start

# Or run specific tests
node simple-test-app.js
node enhanced-test-app.js
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository: `https://github.com/me-azlam-kp/hardwarebridge.git`
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2024 Azlam

## 🆘 Support

For support and questions:
- **Issues**: [Create an issue](https://github.com/me-azlam-kp/hardwarebridge/issues) in the repository
- **Documentation**: Check the [docs folder](https://github.com/me-azlam-kp/hardwarebridge/tree/main/docs) for detailed guides
- **Repository**: [https://github.com/me-azlam-kp/hardwarebridge](https://github.com/me-azlam-kp/hardwarebridge)

---

**Developed by Azlam**
