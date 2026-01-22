# Hardware Bridge Test Application

This directory contains test applications that demonstrate how to use the Hardware Bridge Client library to connect to the Hardware Bridge server and perform various operations including printing.

## 🚀 Quick Start

### Prerequisites
- Hardware Bridge server running (default: `ws://localhost:9443`)
- Node.js 22+ installed

### Installation
```bash
cd src/TestApp
npm install
```

### Run the Test Application
```bash
# Simple test app (recommended)
npm start
# or
node simple-test-app.js
```

## 📋 What the Test App Does

The test application demonstrates:

1. **🔌 Connection Management**
   - Connects to the Hardware Bridge WebSocket server
   - Handles connection events and errors
   - Graceful disconnection

2. **📊 System Information**
   - Retrieves server version and platform info
   - Gets server uptime statistics

3. **🔍 Device Discovery**
   - Enumerates all available devices
   - Gets detailed information about specific devices
   - Shows device capabilities and status

4. **🖨️ Printer Operations**
   - Gets printer status and capabilities
   - Sends print jobs in different formats
   - Demonstrates ESC/POS, ZPL, and EPL protocols

5. **📦 Queue Management**
   - Checks queue status and statistics
   - Lists jobs in the print queue

## 🖨️ Print Formats Demonstrated

The test app shows how to print content in different formats:

### ESC/POS (Epson Standard Code for Point of Sale)
```javascript
const escposContent = `
Test Print - ESC/POS Format
---------------------------
Date: ${new Date().toLocaleString()}

Item          Qty    Price
---------------------------
Coffee         2    $5.00
Sandwich       1    $8.50
Cookie         3    $4.50
---------------------------
Total:                $18.00

Thank you for your business!
`;
```

### ZPL (Zebra Programming Language)
```javascript
const zplContent = `
^XA
^FO50,50^ADN,36,20^FDHardware Bridge Demo^FS
^FO50,100^ADN,18,10^FDDate: ${new Date().toLocaleString()}^FS
^FO50,150^ADN,18,10^FDZPL Format Test^FS
^FO50,200^ADN,18,10^FDDemo Barcode:^FS
^FO50,250^BCN,100,Y,N,N^FD123456789^FS
^XZ
`;
```

### EPL (Eltron Programming Language)
```javascript
const eplContent = `
N
q609
Q203,26
B5,26,0,1,2,2,152,B,"123456789"
A5,56,0,2,1,1,N,"Hardware Bridge Demo"
A5,86,0,2,1,1,N,"EPL Format Test"
A5,116,0,2,1,1,N,"${new Date().toLocaleString()}"
P1
`;
```

## 🔧 Customization

You can modify the test app to:

- **Change server URL**: Edit the `serverUrl` parameter in the constructor
- **Add new tests**: Extend the `runTests()` method
- **Test different devices**: Modify device selection logic
- **Custom print content**: Update the `generateDemoContent()` methods

## 📡 WebSocket Protocol

The test app uses JSON-RPC 2.0 over WebSocket:

```json
{
  "jsonrpc": "2.0",
  "method": "printer.print",
  "params": {
    "deviceId": "printer_test1",
    "data": "print content here",
    "format": "raw"
  },
  "id": 1
}
```

## 🚨 Important Notes

- **Simulated Devices**: The current server only provides simulated device responses
- **No Real Printing**: Print jobs are simulated and don't actually print to physical devices
- **Testing Only**: This is designed for testing the API and protocol, not production printing

## 🎯 Next Steps

To add real printer support, you would need to:

1. **Implement Network Discovery**: Add mDNS/Bonjour for finding network printers
2. **Add TCP Communication**: Implement socket connections to printer IPs
3. **Create Printer Drivers**: Add actual printer communication protocols
4. **Handle Authentication**: Support printer authentication if required
5. **Add Error Handling**: Implement network error recovery

## 📚 Related Files

- `simple-test-app.js` - Main test application using direct WebSocket
- `test-app.js` - Advanced test app (requires proper client library loading)
- `package.json` - Dependencies and scripts