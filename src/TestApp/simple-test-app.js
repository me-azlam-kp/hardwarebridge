#!/usr/bin/env node

/**
 * Simple Hardware Bridge Test Application
 * This app demonstrates direct WebSocket communication with the Hardware Bridge server
 * using the JSON-RPC 2.0 protocol.
 */

import WebSocket from 'ws';

class SimpleHardwareBridgeTest {
  constructor(serverUrl = 'ws://localhost:9443') {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
  }

  async connect() {
    console.log('🚀 Simple Hardware Bridge Test Application');
    console.log('==========================================');
    console.log(`🔗 Connecting to ${this.serverUrl}...`);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to Hardware Bridge server!');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('🔌 Disconnected from server');
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle responses to our requests
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      }
      // Handle notifications (server-to-client messages without id)
      else if (message.method) {
        console.log('📡 Server notification:', message.method, message.params);
      }
    } catch (error) {
      console.error('❌ Failed to parse message:', error.message);
    }
  }

  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to server'));
        return;
      }

      const request = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: this.requestId++
      };

      // Store the promise callbacks for this request
      this.pendingRequests.set(request.id, { resolve, reject });

      console.log('📤 Sending request:', method);
      this.ws.send(JSON.stringify(request));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  async runTests() {
    console.log('\n🧪 Starting Hardware Bridge Tests');
    console.log('==================================');

    try {
      // Test 1: Get system info
      console.log('\n1️⃣ Testing system.getInfo...');
      const systemInfo = await this.sendRequest('system.getInfo');
      console.log('✅ System Info:', JSON.stringify(systemInfo, null, 2));

      // Test 2: Enumerate devices
      console.log('\n2️⃣ Testing devices.enumerate...');
      const devicesResult = await this.sendRequest('devices.enumerate');
      console.log('✅ Found', devicesResult.devices.length, 'devices');
      
      if (devicesResult.devices.length > 0) {
        devicesResult.devices.forEach((device, index) => {
          console.log(`   ${index + 1}. ${device.name} (${device.type}) - ${device.status}`);
        });

        // Test 3: Get specific device info
        const firstDevice = devicesResult.devices[0];
        console.log(`\n3️⃣ Testing devices.get for ${firstDevice.name}...`);
        const deviceInfo = await this.sendRequest('devices.get', { deviceId: firstDevice.id });
        console.log('✅ Device details:', JSON.stringify(deviceInfo, null, 2));

        // Test 4: Printer operations (if it's a printer)
        if (firstDevice.type === 'printer') {
          await this.testPrinterOperations(firstDevice.id);
        }
      }

      // Test 5: Queue operations
      await this.testQueueOperations();

      console.log('\n✅ All tests completed successfully!');

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }

  async testPrinterOperations(deviceId) {
    console.log(`\n🖨️ Testing printer operations for device ${deviceId}...`);

    try {
      // Test printer status
      console.log('   📋 Getting printer status...');
      const status = await this.sendRequest('printer.getStatus', { deviceId });
      console.log('   ✅ Printer status:', JSON.stringify(status, null, 2));

      // Test printer capabilities
      console.log('   🔧 Getting printer capabilities...');
      const capabilities = await this.sendRequest('printer.getCapabilities', { deviceId });
      console.log('   ✅ Printer capabilities:', JSON.stringify(capabilities, null, 2));

      // Test print job
      console.log('   📝 Sending print job...');
      const demoContent = this.generateDemoContent();
      const printResult = await this.sendRequest('printer.print', {
        deviceId: deviceId,
        data: demoContent,
        format: 'raw'
      });
      console.log('   ✅ Print job result:', JSON.stringify(printResult, null, 2));

    } catch (error) {
      console.error('   ❌ Printer test failed:', error.message);
    }
  }

  async testQueueOperations() {
    console.log('\n📦 Testing queue operations...');

    try {
      // Get queue status
      console.log('   📊 Getting queue status...');
      const queueStatus = await this.sendRequest('queue.getStatus');
      console.log('   ✅ Queue status:', JSON.stringify(queueStatus, null, 2));

      // Get queue jobs
      console.log('   📋 Getting queue jobs...');
      const queueJobs = await this.sendRequest('queue.getJobs');
      console.log('   ✅ Queue jobs:', queueJobs.length, 'jobs');

    } catch (error) {
      console.error('   ❌ Queue test failed:', error.message);
    }
  }

  generateDemoContent() {
    return `
=====================================
    HARDWARE BRIDGE DEMO PRINT
=====================================

Date: ${new Date().toLocaleString()}
Server: Hardware Bridge v1.0.0
Client: Simple Test Application
Connection: WebSocket Direct

This is a demo print job sent directly via
WebSocket JSON-RPC 2.0 protocol to
demonstrate the printing functionality.

Supported Print Formats:
- ESC/POS (Epson Standard Code)
- ZPL (Zebra Programming Language)
- EPL (Eltron Programming Language)

Demo Content:
- Line 1: Test print line
- Line 2: Another test line
- Line 3: Final test line

=====================================
    END OF DEMO PRINT
=====================================
`;
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

// Demo content for different printer types
const demoContents = {
  escpos: `
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
`,
  zpl: `
^XA
^FO50,50^ADN,36,20^FDHardware Bridge Demo^FS
^FO50,100^ADN,18,10^FDDate: ${new Date().toLocaleString()}^FS
^FO50,150^ADN,18,10^FDZPL Format Test^FS
^FO50,200^ADN,18,10^FDDemo Barcode:^FS
^FO50,250^BCN,100,Y,N,N^FD123456789^FS
^XZ
`,
  epl: `
N
q609
Q203,26
B5,26,0,1,2,2,152,B,"123456789"
A5,56,0,2,1,1,N,"Hardware Bridge Demo"
A5,86,0,2,1,1,N,"EPL Format Test"
A5,116,0,2,1,1,N,"${new Date().toLocaleString()}"
P1
`
};

// Run the test application
async function main() {
  const app = new SimpleHardwareBridgeTest();
  
  try {
    await app.connect();
    await app.runTests();
  } catch (error) {
    console.error('❌ Application error:', error.message);
  } finally {
    app.disconnect();
    setTimeout(() => process.exit(0), 1000);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the application
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});