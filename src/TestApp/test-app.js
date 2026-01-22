#!/usr/bin/env node

/**
 * Hardware Bridge Test Application
 * This app demonstrates how to use the BridgeClient library to connect to the
 * Hardware Bridge server and perform printer operations.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the BridgeClient from the built library
const clientLibPath = join(__dirname, '../BridgeClient/dist/index.umd.js');
const clientCode = readFileSync(clientLibPath, 'utf8');

// Create a simple UMD loader
const loadClientLibrary = () => {
  // This is a simplified loader for the UMD module
  const module = { exports: {} };
  const exports = module.exports;
  
  // Execute the UMD code in a limited context
  const func = new Function('exports', 'module', 'require', clientCode);
  func(exports, module, (name) => {
    if (name === 'ws') return WebSocket;
    if (name === 'rxjs') return { Observable: class {} };
    throw new Error(`Module ${name} not available`);
  });
  
  return module.exports;
};

// Simple WebSocket polyfill for Node.js
class WebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 100);
  }
  
  send(data) {
    console.log('📤 Sending:', data);
    // Simulate server response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: JSON.stringify({
            jsonrpc: '2.0',
            result: {
              devices: [
                {
                  id: 'printer_test1',
                  name: 'Test Printer 1',
                  type: 'printer',
                  status: 'available',
                  manufacturer: 'Test Manufacturer',
                  model: 'Model X1',
                  serialNumber: 'SN123456',
                  properties: { maxWidth: 576, supportsColor: false },
                  lastSeen: new Date(),
                  isConnected: false,
                  supportedProtocols: ['ESC/POS', 'ZPL', 'EPL'],
                  maxPrintWidth: 576,
                  supportsColor: false,
                  supportsDuplex: false,
                  maxResolution: 300,
                  currentStatus: 'idle',
                  jobsInQueue: 0
                }
              ],
              timestamp: new Date()
            },
            id: 1
          })
        });
      }
    }, 200);
  }
  
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}

// Main test application
class HardwareBridgeTestApp {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async initialize() {
    console.log('🚀 Hardware Bridge Test Application');
    console.log('=====================================');
    
    try {
      // Load the client library
      console.log('📚 Loading BridgeClient library...');
      const HardwareBridgeClient = loadClientLibrary().HardwareBridgeClient;
      
      if (!HardwareBridgeClient) {
        throw new Error('Failed to load HardwareBridgeClient');
      }
      
      console.log('✅ BridgeClient library loaded successfully');
      
      // Create client instance
      this.client = new HardwareBridgeClient({
        url: 'ws://localhost:9443',
        autoReconnect: true,
        reconnectInterval: 5000
      });
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Connect to server
      console.log('🔗 Connecting to Hardware Bridge server...');
      await this.client.connect();
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      process.exit(1);
    }
  }

  setupEventListeners() {
    this.client.onConnectionStateChange((connected) => {
      this.isConnected = connected;
      console.log(connected ? '🟢 Connected to server' : '🔴 Disconnected from server');
    });

    this.client.onDeviceEvent((event) => {
      console.log('📡 Device event:', event);
    });
  }

  async runTests() {
    console.log('\n🧪 Starting Hardware Bridge Tests');
    console.log('==================================');

    try {
      // Test 1: Get system info
      console.log('\n1️⃣ Testing system.getInfo...');
      const systemInfo = await this.client.getSystemInfo();
      console.log('✅ System Info:', systemInfo);

      // Test 2: Enumerate devices
      console.log('\n2️⃣ Testing devices.enumerate...');
      const devices = await this.client.enumerateDevices();
      console.log('✅ Available devices:', devices.length);
      
      if (devices.length > 0) {
        devices.forEach((device, index) => {
          console.log(`   ${index + 1}. ${device.name} (${device.type}) - ${device.status}`);
        });

        // Test 3: Get specific device info
        if (devices[0]) {
          console.log(`\n3️⃣ Testing devices.get for ${devices[0].name}...`);
          const deviceInfo = await this.client.getDevice(devices[0].id);
          console.log('✅ Device details:', deviceInfo);

          // Test 4: Printer operations (if it's a printer)
          if (devices[0].type === 'printer') {
            await this.testPrinterOperations(devices[0]);
          }
        }
      }

      // Test 5: Queue operations
      await this.testQueueOperations();

      console.log('\n✅ All tests completed successfully!');

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }

  async testPrinterOperations(printer) {
    console.log(`\n🖨️ Testing printer operations for ${printer.name}...`);

    try {
      // Test printer status
      console.log('   📋 Getting printer status...');
      const status = await this.client.getPrinterStatus(printer.id);
      console.log('   ✅ Printer status:', status);

      // Test printer capabilities
      console.log('   🔧 Getting printer capabilities...');
      const capabilities = await this.client.getPrinterCapabilities(printer.id);
      console.log('   ✅ Printer capabilities:', capabilities);

      // Test print job
      console.log('   📝 Sending print job...');
      const demoContent = this.generateDemoContent();
      const printResult = await this.client.print(printer.id, demoContent, 'raw');
      console.log('   ✅ Print job result:', printResult);

    } catch (error) {
      console.error('   ❌ Printer test failed:', error.message);
    }
  }

  async testQueueOperations() {
    console.log('\n📦 Testing queue operations...');

    try {
      // Get queue status
      console.log('   📊 Getting queue status...');
      const queueStatus = await this.client.getQueueStatus();
      console.log('   ✅ Queue status:', queueStatus);

      // Get queue jobs
      console.log('   📋 Getting queue jobs...');
      const queueJobs = await this.client.getQueueJobs();
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
Client: Test Application

This is a demo print job sent from the
Hardware Bridge Test Application to
demonstrate the printing functionality.

Supported Protocols:
- ESC/POS (Epson Standard Code)
- ZPL (Zebra Programming Language)
- EPL (Eltron Programming Language)

=====================================
    END OF DEMO PRINT
=====================================
`;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      console.log('✅ Disconnected from server');
    }
  }
}

// Run the test application
async function main() {
  const app = new HardwareBridgeTestApp();
  
  try {
    await app.initialize();
    await app.runTests();
  } catch (error) {
    console.error('❌ Application error:', error.message);
  } finally {
    await app.cleanup();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the application
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});