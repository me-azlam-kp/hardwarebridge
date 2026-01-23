# Hardware Bridge Control Center

A comprehensive web-based interface for managing Hardware Bridge servers and connected devices with visual icons, real-time monitoring, and complete device management capabilities.

## Features

### Server Management
- **Start/Stop Server**: Control the Hardware Bridge server directly from the web interface
- **Server Status Monitoring**: Real-time server status with visual indicators
- **Connection Management**: Automatic client connection when server starts
- **URL Configuration**: Configurable server connection URL

### Device Management
- **Visual Device Cards**: Beautiful card-based layout with device-specific icons and colors
- **Device Discovery**: Automatic discovery of all connected hardware devices
- **Network Device Discovery**: Specialized network scanning for network-connected devices
- **Device Connection**: Connect/disconnect devices directly from the interface
- **Device Testing**: Built-in testing functionality for each device type
- **Detailed Device Information**: Comprehensive device properties and specifications

### Real-time Monitoring
- **Live Statistics**: Real-time device statistics (total, connected, available, errors)
- **Device Status Updates**: Automatic status updates with visual indicators
- **Event Logging**: Comprehensive system log with timestamps and color-coded entries
- **Auto-refresh**: Automatic device list refresh every 10 seconds

### Visual Design
- **Device Type Icons**: Custom icons for each device type:
  - **Printers**: Purple theme with printer icon
  - **Network Devices**: Blue theme with WiFi icon
  - **USB Devices**: Green theme with USB icon
  - **Serial Devices**: Orange theme with CPU icon
  - **Biometric Devices**: Red theme with fingerprint icon

- **Status Indicators**:
  - **Connected**: Green indicator for active connections
  - **Available**: Blue indicator for available devices
  - **Error**: Red indicator for devices with errors

## Installation

1. **Install Dependencies**
   ```bash
   cd examples/web-to-print
   npm install
   ```

2. **Build the Hardware Bridge Client**
   ```bash
   cd ../../src/BridgeClient
   npm run build
   ```

3. **Install CrossPlatformServer Dependencies**
   ```bash
   cd ../../src/CrossPlatformServer
   npm install
   ```

## Usage

### Starting the Interface

1. **Open the Enhanced Interface**
   Open `enhanced-interface.html` in your web browser or serve it through a web server:
   ```bash
   npx serve . -p 8080
   ```
   Then navigate to `http://localhost:8080/enhanced-interface.html`

2. **Start the Server**
   - Click the **"Start Server"** button
   - The interface will automatically:
     - Start the Hardware Bridge server process
     - Connect to the server
     - Discover connected devices
     - Begin monitoring device status

### Device Management

#### Discovering Devices
- **Refresh Devices**: Click "Refresh Devices" to scan for all connected devices
- **Network Discovery**: Click "Discover Network" to find network-connected devices

#### Connecting Devices
- Click **"Connect"** on any available device card
- The device status will update to "Connected" when successful
- Connection protocols are automatically handled based on device type

#### Testing Devices
- Click **"Test"** on any connected device to run device-specific tests:
  - **Printers**: Print test page
  - **Network Devices**: Ping test
  - **Serial Devices**: Connection test
  - **USB Devices**: Device communication test

#### Viewing Device Details
- Click **"Details"** to open a modal with comprehensive device information
- View basic info, connection details, and all device properties

### Server Management

#### Starting/Stopping the Server
- **Start Server**: Initializes the Hardware Bridge server and connects the client
- **Stop Server**: Gracefully shuts down the server and disconnects all devices

#### Server Configuration
- **Server URL**: Configure the WebSocket URL (default: `ws://localhost:9443`)
- **Auto-reconnection**: Client automatically attempts to reconnect if connection is lost

## Device Types Supported

### Printers
- **Protocols**: ESC/POS, PCL, ZPL, EPL, Raw text
- **Connection Types**: USB, Serial, Network
- **Features**: Test page printing, status monitoring, job queue management

### Network Devices
- **Protocols**: TCP, UDP, HTTP, HTTPS
- **Connection Types**: WiFi, Ethernet, Bluetooth
- **Features**: Network discovery, ping testing, connection monitoring

### USB HID Devices
- **Device Types**: Keyboards, mice, barcode scanners, custom HID devices
- **Features**: Device enumeration, input/output reports, feature reports

### Serial Devices
- **Protocols**: RS-232, RS-485, TTL
- **Features**: Baud rate configuration, flow control, real-time data

### Biometric Devices
- **Types**: Fingerprint, face, iris, voice recognition
- **Features**: Enrollment, authentication, user management

## System Requirements

### Server Requirements
- **Node.js**: Version 16 or higher
- **TypeScript**: For server compilation
- **Ports**: Default port 9443 (configurable)

### Client Requirements
- **Modern Browser**: Chrome, Firefox, Safari, Edge (latest versions)
- **WebSocket Support**: Required for real-time communication
- **Bootstrap 5**: For UI components (loaded via CDN)

## Configuration

### Server Configuration
The server can be configured through the WebSocket connection URL:
- **Default**: `ws://localhost:9443`
- **Custom**: Enter your server URL in the interface

### Device Configuration
Devices are automatically configured based on their type:
- **Network Devices**: Host, port, protocol
- **Serial Devices**: Port name, baud rate, parity
- **USB Devices**: Vendor ID, product ID
- **Printers**: Protocol-specific settings

## Troubleshooting

### Server Won't Start
1. **Check Port Availability**: Ensure port 9443 is not in use
2. **Check Dependencies**: Verify all npm packages are installed
3. **Check Permissions**: Ensure proper file system permissions
4. **View Logs**: Check the system log panel for error messages

### Devices Not Found
1. **Refresh Devices**: Click "Refresh Devices" to rescan
2. **Check Connections**: Verify physical device connections
3. **Check Drivers**: Ensure device drivers are installed
4. **Network Discovery**: Use "Discover Network" for network devices

### Connection Issues
1. **Server Status**: Verify server is running and connected
2. **Network**: Check network connectivity for remote servers
3. **Firewall**: Ensure firewall allows WebSocket connections
4. **URL**: Verify correct server URL configuration

## Development

### File Structure
```
examples/web-to-print/
├── enhanced-interface.html    # Main HTML interface
├── enhanced-app.js           # Enhanced JavaScript application
├── server-manager.js         # Server process management
├── ENHANCED_INTERFACE_README.md  # This documentation
└── ...existing files...
```

### Extending the Interface

#### Adding New Device Types
1. **Update Device Icons**: Add new icon mappings in `getDeviceIcon()`
2. **Add Device Colors**: Define color schemes in CSS variables
3. **Implement Device Actions**: Add device-specific test functions
4. **Update Type Definitions**: Ensure TypeScript types are updated

#### Customizing the UI
1. **Colors**: Modify CSS variables in the `:root` selector
2. **Layout**: Adjust grid and card layouts in CSS
3. **Icons**: Use Bootstrap Icons or add custom icon libraries
4. **Responsive Design**: Update media queries for different screen sizes

## Security Considerations

- **Local Network**: Designed for local network use
- **Authentication**: Consider adding authentication for production use
- **HTTPS**: Use HTTPS/WSS for secure connections
- **Input Validation**: All user inputs are validated
- **Process Management**: Server processes are properly managed and cleaned up

## Performance

- **Efficient Rendering**: Virtual DOM-like updates for device cards
- **Auto-refresh**: Configurable refresh intervals
- **Memory Management**: Proper cleanup of intervals and event listeners
- **Optimized Network**: Minimal network traffic with efficient WebSocket usage

## Browser Compatibility

- **Chrome 90+**: Full support
- **Firefox 88+**: Full support
- **Safari 14+**: Full support
- **Edge 90+**: Full support
- **Internet Explorer**: Not supported (requires modern JavaScript features)

## License

This enhanced interface is part of the Hardware Bridge project and follows the same licensing terms.
