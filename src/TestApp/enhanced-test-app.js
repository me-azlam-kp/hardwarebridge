#!/usr/bin/env node

/**
 * Enhanced Hardware Bridge Test Application
 * This app demonstrates advanced usage with different print formats and error handling
 */

import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { join } from 'path';

class EnhancedHardwareBridgeTest {
  constructor(serverUrl = 'ws://localhost:9443') {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.testResults = [];
  }

  async connect() {
    console.log('🚀 Enhanced Hardware Bridge Test Application');
    console.log('============================================');
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
        const { resolve, reject, method } = this.pendingRequests.get(message.id);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          console.error(`❌ ${method} failed:`, message.error.message);
          reject(new Error(message.error.message));
        } else {
          console.log(`✅ ${method} completed successfully`);
          resolve(message.result);
        }
      }
      // Handle notifications
      else if (message.method) {
        console.log('📡 Server notification:', message.method);
        if (message.params) {
          console.log('   Parameters:', JSON.stringify(message.params, null, 2));
        }
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

      this.pendingRequests.set(request.id, { resolve, reject, method });

      console.log(`📤 Sending: ${method}`);
      this.ws.send(JSON.stringify(request));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error(`${method} request timeout`));
        }
      }, 10000);
    });
  }

  async runComprehensiveTests() {
    console.log('\n🧪 Running Comprehensive Hardware Bridge Tests');
    console.log('==============================================');

    const tests = [
      { name: 'System Information', fn: this.testSystemInfo.bind(this) },
      { name: 'Device Discovery', fn: this.testDeviceDiscovery.bind(this) },
      { name: 'Printer Operations', fn: this.testPrinterOperations.bind(this) },
      { name: 'Queue Management', fn: this.testQueueManagement.bind(this) },
      { name: 'Print Format Demos', fn: this.testPrintFormats.bind(this) },
      { name: 'Error Handling', fn: this.testErrorHandling.bind(this) }
    ];

    for (const test of tests) {
      console.log(`\n📋 ${test.name}`);
      console.log('─'.repeat(50));
      
      try {
        await test.fn();
        this.testResults.push({ test: test.name, status: 'PASSED' });
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
        this.testResults.push({ test: test.name, status: 'FAILED', error: error.message });
      }
    }

    this.printTestSummary();
  }

  async testSystemInfo() {
    console.log('1️⃣ Getting system information...');
    const systemInfo = await this.sendRequest('system.getInfo');
    console.log('✅ Server Version:', systemInfo.version);
    console.log('✅ Platform:', systemInfo.platform);
    console.log('✅ Uptime:', Math.round(systemInfo.uptime), 'seconds');
  }

  async testDeviceDiscovery() {
    console.log('2️⃣ Discovering devices...');
    const result = await this.sendRequest('devices.enumerate');
    const devices = result.devices;
    
    console.log(`✅ Found ${devices.length} devices:`);
    devices.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.name} (${device.type}) - ${device.status}`);
      if (device.type === 'printer') {
        console.log(`      📄 Protocols: ${device.supportedProtocols?.join(', ') || 'N/A'}`);
        console.log(`      📏 Max Width: ${device.maxPrintWidth || 'N/A'}px`);
      }
    });

    // Store available printers for later tests
    this.availablePrinters = devices.filter(d => d.type === 'printer');
    console.log(`✅ Available printers: ${this.availablePrinters.length}`);
  }

  async testPrinterOperations() {
    if (!this.availablePrinters || this.availablePrinters.length === 0) {
      console.log('⚠️  No printers available for testing');
      return;
    }

    const printer = this.availablePrinters[0];
    console.log(`3️⃣ Testing printer operations for ${printer.name}...`);

    // Test printer status
    console.log('   📋 Getting printer status...');
    const status = await this.sendRequest('printer.getStatus', { deviceId: printer.id });
    console.log('   ✅ Status:', status.status);
    console.log('   ✅ Ready:', status.isReady);
    console.log('   ✅ Jobs in queue:', status.jobsInQueue);

    // Test printer capabilities
    console.log('   🔧 Getting printer capabilities...');
    const capabilities = await this.sendRequest('printer.getCapabilities', { deviceId: printer.id });
    console.log('   ✅ Supported protocols:', capabilities.supportedProtocols.join(', '));
    console.log('   ✅ Max print width:', capabilities.maxPrintWidth);
    console.log('   ✅ Max resolution:', capabilities.maxResolution);
    console.log('   ✅ Max job size:', Math.round(capabilities.maxJobSize / 1024), 'KB');
  }

  async testQueueManagement() {
    console.log('4️⃣ Testing queue management...');

    // Get queue status
    console.log('   📊 Getting queue status...');
    const queueStatus = await this.sendRequest('queue.getStatus');
    console.log('   ✅ Total jobs:', queueStatus.totalJobs);
    console.log('   ✅ Pending:', queueStatus.pendingJobs);
    console.log('   ✅ Processing:', queueStatus.processingJobs);
    console.log('   ✅ Completed:', queueStatus.completedJobs);
    console.log('   ✅ Failed:', queueStatus.failedJobs);

    // Get queue jobs
    console.log('   📋 Getting queue jobs...');
    const queueJobs = await this.sendRequest('queue.getJobs');
    console.log(`   ✅ Found ${queueJobs.length} jobs in queue`);
    
    if (queueJobs.length > 0) {
      const recentJobs = queueJobs.slice(0, 3); // Show first 3 jobs
      recentJobs.forEach((job, index) => {
        console.log(`      ${index + 1}. ${job.operation} on ${job.deviceId} - ${job.status}`);
      });
    }
  }

  async testPrintFormats() {
    if (!this.availablePrinters || this.availablePrinters.length === 0) {
      console.log('⚠️  No printers available for format testing');
      return;
    }

    const printer = this.availablePrinters[0];
    console.log(`5️⃣ Testing different print formats on ${printer.name}...`);

    const formats = [
      { name: 'Raw Text', format: 'raw', content: this.generateRawContent() },
      { name: 'ESC/POS', format: 'escpos', content: this.generateESCPosContent() },
      { name: 'ZPL', format: 'zpl', content: this.generateZPLContent() },
      { name: 'EPL', format: 'epl', content: this.generateEPLContent() }
    ];

    for (const format of formats) {
      try {
        console.log(`   📝 Testing ${format.name} format...`);
        const result = await this.sendRequest('printer.print', {
          deviceId: printer.id,
          data: format.content,
          format: format.format
        });
        console.log(`   ✅ ${format.name} print successful:`, result.jobId);
        console.log(`   📊 Bytes printed:`, result.bytesPrinted);
      } catch (error) {
        console.error(`   ❌ ${format.name} print failed:`, error.message);
      }
    }
  }

  async testErrorHandling() {
    console.log('6️⃣ Testing error handling...');

    // Test with invalid device ID
    try {
      console.log('   🧪 Testing invalid device ID...');
      await this.sendRequest('devices.get', { deviceId: 'invalid_device' });
      console.log('   ❌ Expected error but got success');
    } catch (error) {
      console.log('   ✅ Correctly handled invalid device ID:', error.message);
    }

    // Test with missing parameters
    try {
      console.log('   🧪 Testing missing parameters...');
      await this.sendRequest('printer.print', {});
      console.log('   ❌ Expected error but got success');
    } catch (error) {
      console.log('   ✅ Correctly handled missing parameters:', error.message);
    }

    // Test with invalid method
    try {
      console.log('   🧪 Testing invalid method...');
      await this.sendRequest('invalid.method');
      console.log('   ❌ Expected error but got success');
    } catch (error) {
      console.log('   ✅ Correctly handled invalid method:', error.message);
    }
  }

  generateRawContent() {
    return `RAW FORMAT DEMO
================
Date: ${new Date().toLocaleString()}
Server: Hardware Bridge
Format: Raw Text
Content: This is a raw text print demo
Status: Success
================
END OF DEMO`;
  }

  generateESCPosContent() {
    return `ESC/POS FORMAT DEMO
====================
Date: ${new Date().toLocaleString()}
Server: Hardware Bridge
Format: ESC/POS

Receipt #12345
--------------------
Item          Qty  Price
Coffee         2   $5.00
Sandwich       1   $8.50
Cookie         3   $4.50
--------------------
Total:         $18.00

Thank you!
====================
END OF DEMO`;
  }

  generateZPLContent() {
    return `^XA
^FO50,30^ADN,36,20^FDHardware Bridge Demo^FS
^FO50,80^ADN,18,10^FDZPL Format Test^FS
^FO50,120^ADN,18,10^FDDate: ${new Date().toLocaleString()}^FS
^FO50,160^ADN,18,10^FDDevice: Test Printer 1^FS
^FO50,200^ADN,18,10^FDStatus: Ready^FS
^FO50,240^BCN,80,Y,N,N^FDTEST123456^FS
^FO50,340^ADN,18,10^FDEnd of ZPL Demo^FS
^XZ`;
  }

  generateEPLContent() {
    return `N
q609
Q203,26
A5,26,0,2,1,1,N,"Hardware Bridge Demo"
A5,56,0,2,1,1,N,"EPL Format Test"
A5,86,0,2,1,1,N,"Date: ${new Date().toLocaleString()}"
A5,116,0,2,1,1,N,"Device: Test Printer 1"
A5,146,0,2,1,1,N,"Status: Ready"
B5,176,0,1,2,2,100,B,"TEST123456"
A5,286,0,2,1,1,N,"End of EPL Demo"
P1`;
  }

  printTestSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(r => {
          console.log(`   ❌ ${r.test}: ${r.error}`);
        });
    }

    console.log('\n🎯 Test Results:');
    this.testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`   ${icon} ${result.test}`);
    });
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

// Run the enhanced test application
async function main() {
  const app = new EnhancedHardwareBridgeTest();
  
  try {
    await app.connect();
    await app.runComprehensiveTests();
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