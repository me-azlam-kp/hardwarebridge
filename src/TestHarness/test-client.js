#!/usr/bin/env node

// Test the BridgeClient by importing it and testing basic functionality
const { CrossPlatformHardwareBridgeClient } = require('../BridgeClient/dist/index.js');

console.log('Testing Hardware Bridge Client...');

try {
    // Test client instantiation
    const client = new CrossPlatformHardwareBridgeClient('ws://localhost:9443');
    
    console.log('✅ BridgeClient imported successfully');
    console.log('✅ Client instance created');
    
    // Test connection (this will be async)
    client.connect()
        .then(() => {
            console.log('✅ Client connected to server');
            return client.getSystemInfo();
        })
        .then(info => {
            console.log('✅ System info retrieved:', info);
            return client.disconnect();
        })
        .then(() => {
            console.log('✅ Client disconnected successfully');
            console.log('✅ All BridgeClient tests passed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Client test failed:', error.message);
            process.exit(1);
        });
        
} catch (error) {
    console.error('❌ BridgeClient import failed:', error.message);
    process.exit(1);
}