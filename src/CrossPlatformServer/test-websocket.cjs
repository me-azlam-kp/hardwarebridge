#!/usr/bin/env node

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:9443';

console.log('Testing Hardware Bridge WebSocket Server...');
console.log('Connecting to:', SERVER_URL);

const ws = new WebSocket(SERVER_URL);

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully!');
  
  // Test system info request
  const request = {
    jsonrpc: '2.0',
    method: 'system.getInfo',
    id: 1
  };
  
  console.log('Sending test request:', JSON.stringify(request, null, 2));
  ws.send(JSON.stringify(request));
});

ws.on('message', function message(data) {
  console.log('📨 Received response:');
  try {
    const response = JSON.parse(data.toString());
    console.log(JSON.stringify(response, null, 2));
    
    if (response.result) {
      console.log('✅ Server is responding correctly!');
      console.log('Server version:', response.result.serverVersion || 'Unknown');
      console.log('Supported devices:', response.result.supportedDevices || []);
    }
  } catch (error) {
    console.log('Raw response:', data.toString());
  }
  
  // Close connection after receiving response
  setTimeout(() => {
    ws.close();
  }, 1000);
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
  console.log('✅ Test completed successfully!');
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timed out');
  ws.close();
  process.exit(1);
}, 10000);