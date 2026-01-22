# 🚀 How to Run Test Applications

This guide provides comprehensive instructions for running all test applications that use your published **@hardwarebridge/client** npm package.

## 📋 Prerequisites

Before running any test applications, ensure you have:
- ✅ Node.js 22+ installed
- ✅ Hardware Bridge server running on `ws://localhost:8443`
- ✅ Your published npm package `@hardwarebridge/client` installed

## 🎯 Quick Start

### 1. Start the Hardware Bridge Server
```bash
cd src/CrossPlatformServer
npm run dev
# Server should start on ws://localhost:8443
```

### 2. Run Test Applications
Choose from the options below based on what you want to test.

## 🧪 Test Application Options

### Option 1: Simple Test Application (Recommended for beginners)

**Location**: `src/TestApp/simple-test-app.js`
**Features**: Basic connection and device discovery

```bash
cd src/TestApp
npm start
# or
node simple-test-app.js
```

### Option 2: Enhanced Test Application (Recommended for comprehensive testing)

**Location**: `src/TestApp/enhanced-test-app.js`
**Features**: Comprehensive testing with all features

```bash
cd src/TestApp
npm start
# or
node enhanced-test-app.js
```

### Option 3: Web-to-Print Application (Recommended for web interface)

**Location**: `examples/web-to-print/`
**Features**: Professional web interface with comprehensive features

```bash
cd examples/web-to-print
npm start
# Server runs on http://localhost:3001
# Open http://localhost:3001 in your browser
```

### Option 4: Debug Connection (Recommended for troubleshooting)

**Location**: `examples/web-to-print/debug-connection.js`
**Features**: Detailed connection debugging and error analysis

```bash
cd examples/web-to-print
node debug-connection.js
```

## 🎯 What Each Test Application Does

### Simple Test Application
- **Basic connection** to Hardware Bridge server
- **Device discovery** and enumeration
- **Basic printing** functionality
- **Connection state monitoring**

### Enhanced Test Application
- **Comprehensive connection testing** with all features
- **Multi-format printing** (ESC/POS, ZPL, EPL, Raw)
- **Queue management** with real-time status
- **Device management** with detailed information
- **Error handling** with comprehensive logging

### Web-to-Print Application
- **Professional web interface** with modern UI/UX
- **Multi-format printing** with real-time preview
- **Order management** with items and pricing
- **Queue monitoring** with live statistics
- **Professional styling** with Bootstrap 5

### Debug Connection
- **Detailed connection debugging** with error analysis
- **Connection state monitoring** with comprehensive logging
- **Error identification** with specific error codes
- **Troubleshooting assistance** with detailed diagnostics

## 🔧 Running Specific Tests

### Test Basic Connection
```bash
cd src/TestApp
node simple-test-app.js
```

### Test All Features
```bash
cd src/TestApp
node enhanced-test-app.js
```

### Test Web Interface
```bash
cd examples/web-to-print
npm start
# Open http://localhost:3001 in browser
```

### Debug Connection Issues
```bash
cd examples/web-to-print
node debug-connection.js
```

## 📊 Test Results Interpretation

### Successful Connection
```
✅ Connected successfully!
📋 Found 3 devices
1. Test Printer 1 (printer) - available
2. COM1 (serial) - available
3. USB HID Device (usbhid) - available
✅ Connection test completed successfully!
```

### Connection Issues
```
❌ Connection failed: [Error details]
🚫 Connection refused - make sure Hardware Bridge server is running on port 8443
📋 Error details: [Specific error information]
```

## 🛠️ Troubleshooting

### Connection Issues
1. **Ensure Hardware Bridge server is running**: Check `npm run dev` in CrossPlatformServer
2. **Check port availability**: Ensure port 8443 is not in use
3. **Verify server status**: Check server logs for any errors
4. **Test connection**: Use debug-connection.js for detailed analysis

### Package Issues
1. **Ensure package is installed**: Run `npm list @hardwarebridge/client`
2. **Check package version**: Should show v1.0.0 or higher
3. **Verify installation**: Check package.json for correct dependencies

### Browser Issues
1. **Check browser console**: Open developer tools (F12)
2. **Check network tab**: Look for WebSocket connections
3. **Check console errors**: Look for JavaScript errors
4. **Test in different browsers**: Chrome, Firefox, Safari

## 🎉 Success Indicators

**When everything is working correctly:**
- ✅ Server starts without errors
- ✅ Connection establishes successfully
- ✅ Devices are discovered and listed
- ✅ Print jobs complete successfully
- ✅ Queue status updates in real-time

## 🚀 Next Steps

After successful testing:
1. **Customize the applications** for your specific needs
2. **Add more features** based on your requirements
3. **Deploy to production** with proper hosting
4. **Share your success** with the community

**Congratulations on successfully using your published npm package!** 🎉

Your Hardware Bridge Client is now working in all test applications and ready for production use!