/**
 * Debug connection to Hardware Bridge
 * This script helps identify connection issues
 */

import { HardwareBridgeClient } from '@hardwarebridge/client';

async function debugConnection() {
  console.log('🔍 Debugging Hardware Bridge connection...');
  console.log('📡 Server URL: ws://localhost:8443');
  
  const client = new HardwareBridgeClient({
    url: 'ws://localhost:8443',
    autoReconnect: true,
    reconnectInterval: 5000
  });

  // Add detailed logging
  client.onConnectionStateChange((connected) => {
    console.log('🔌 Connection state changed:', connected);
  });

  try {
    console.log('🚀 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('🔍 Discovering devices...');
    const devices = await client.enumerateDevices();
    console.log('📋 Found devices:', devices.length);
    
    devices.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device.name} (${device.type}) - ${device.status}`);
    });
    
    console.log('✅ Connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('📋 Error details:', error);
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused - make sure Hardware Bridge server is running on port 8443');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timed out - server might be unreachable');
    } else if (error.message.includes('ECONNRESET')) {
      console.error('🔄 Connection reset - server might have disconnected');
    } else {
      console.error('❓ Unknown error:', error);
    }
  } finally {
    if (client.isConnected) {
      console.log('🔌 Disconnecting...');
      await client.disconnect();
      console.log('✅ Disconnected');
    }
  }
}

// Run the debug test
debugConnection().catch(error => {
  console.error('❌ Debug test failed:', error);
});