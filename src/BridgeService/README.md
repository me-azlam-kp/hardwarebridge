# 🔧 Hardware Bridge Service

A comprehensive .NET-based hardware automation service that provides secure WebSocket communication, device management, and printing capabilities for Windows environments.

## 🎯 Overview

The Hardware Bridge Service is a Windows desktop application built with .NET 10.0 that acts as a bridge between web applications and hardware devices. It provides a secure WebSocket server, device management, and comprehensive printing capabilities.

## 🚀 Key Features

### 🔌 **Device Management**
- **Serial Port Communication**: Full serial port support with configurable settings
- **USB HID Device Support**: Direct USB HID device communication
- **Printer Management**: Comprehensive printer discovery and management
- **Device Discovery**: Automatic detection of connected hardware devices

### 🖨️ **Printing Capabilities**
- **ESC/POS Support**: Thermal receipt printer protocol
- **ZPL Support**: Zebra Programming Language for label printers
- **EPL Support**: Eltron Programming Language
- **Raw Text Printing**: Direct text output to printers
- **Print Queue Management**: Advanced queue system with priority handling

### 🔐 **Security & Communication**
- **Secure WebSocket Server**: WSS support with certificate management
- **JSON-RPC Protocol**: Standardized communication protocol
- **Offline Queue Management**: Persistent queue storage during disconnections
- **Certificate Management**: SSL/TLS certificate handling

### 🛠️ **System Integration**
- **Windows Service Integration**: Can run as a Windows service
- **Task Scheduling**: Built-in task scheduler for automated operations
- **Logging System**: Comprehensive logging with multiple levels
- **Settings Management**: Persistent configuration storage

## 📋 Prerequisites

### System Requirements
- **Operating System**: Windows 10/11 or Windows Server 2019+
- **.NET Runtime**: .NET 10.0 or higher
- **Visual Studio**: 2022 or later (for development)
- **Administrator Rights**: Required for device access and service installation

### Development Requirements
- **.NET 10.0 SDK**: [Download from Microsoft](https://dotnet.microsoft.com/download/dotnet/10.0)
- **Visual Studio 2022**: Community edition or higher
- **Windows SDK**: Latest version recommended

## 🛠️ Installation & Setup

### 1. Clone and Build
```bash
# Clone the repository
git clone [repository-url]
cd src/BridgeService

# Build the project
dotnet build
```

### 2. Run the Application
```bash
# Run in development mode
dotnet run

# Or build and run the executable
dotnet build -c Release
cd bin/Release/net10.0-windows
./HardwareBridge.exe
```

### 3. Install as Windows Service (Optional)
```bash
# Install as Windows service (requires admin rights)
dotnet run -- install-service

# Start the service
net start HardwareBridgeService
```

## 🔧 Configuration

### WebSocket Server Settings
The service runs a WebSocket server on port 8443 by default. Configuration is stored in `appsettings.json`:

```json
{
  "WebSocketServer": {
    "Port": 8443,
    "UseSSL": true,
    "CertificatePath": "certificates/server.pfx",
    "CertificatePassword": "your-password"
  },
  "DeviceManager": {
    "AutoDiscovery": true,
    "DiscoveryInterval": 5000,
    "MaxRetries": 3
  },
  "Logging": {
    "LogLevel": "Information",
    "LogFilePath": "logs/hardware-bridge.log"
  }
}
```

### Device Configuration
Devices are automatically discovered and configured. Manual device configuration can be added to `devices.json`:

```json
{
  "Devices": [
    {
      "Id": "printer-001",
      "Name": "Thermal Receipt Printer",
      "Type": "printer",
      "Connection": "USB",
      "Protocol": "ESC/POS"
    },
    {
      "Id": "serial-001",
      "Name": "Serial Device",
      "Type": "serial",
      "Port": "COM1",
      "BaudRate": 9600
    }
  ]
}
```

## 📡 API Reference

### WebSocket Connection
Connect to the WebSocket server at `ws://localhost:8443` or `wss://localhost:8443` for SSL.

### JSON-RPC Methods

#### Device Management
```json
{
  "jsonrpc": "2.0",
  "method": "devices.list",
  "params": {},
  "id": 1
}
```

#### Printing
```json
{
  "jsonrpc": "2.0",
  "method": "printer.print",
  "params": {
    "deviceId": "printer-001",
    "data": "Hello World",
    "format": "raw"
  },
  "id": 2
}
```

#### Queue Management
```json
{
  "jsonrpc": "2.0",
  "method": "queue.status",
  "params": {},
  "id": 3
}
```

## 🧪 Testing

### Unit Tests
```bash
# Run unit tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
```

### Integration Tests
```bash
# Run integration tests
dotnet test --filter Category=Integration
```

### Manual Testing
Use the provided test harness in `src/TestHarness/` for manual testing of device connections and printing functionality.

## 🔍 Troubleshooting

### Common Issues

#### **Port Already in Use**
```
Error: Address already in use
```
**Solution**: Change the port in `appsettings.json` or stop the conflicting service.

#### **Certificate Issues**
```
Error: Certificate not found or invalid
```
**Solution**: Generate a new certificate or check certificate path and password.

#### **Device Access Denied**
```
Error: Access denied to device
```
**Solution**: Run the application as administrator or check device permissions.

#### **Printer Not Found**
```
Error: Printer not found
```
**Solution**: Ensure printer is connected and drivers are installed correctly.

### Debug Mode
Enable debug logging in `appsettings.json`:
```json
{
  "Logging": {
    "LogLevel": "Debug"
  }
}
```

## 📊 Performance Optimization

### Memory Management
- Implement proper disposal patterns for device connections
- Use connection pooling for frequently accessed devices
- Monitor memory usage with built-in diagnostics

### Threading
- Use async/await patterns for all I/O operations
- Implement proper cancellation tokens for long-running operations
- Configure thread pool settings for high-throughput scenarios

### Caching
- Cache device information to reduce discovery overhead
- Implement smart caching for frequently accessed data
- Use memory-efficient data structures

## 🔒 Security Considerations

### Certificate Management
- Use valid SSL certificates in production
- Implement certificate rotation mechanisms
- Store certificates securely with proper permissions

### Access Control
- Implement authentication for WebSocket connections
- Use role-based access control for device operations
- Log all security-related events

### Data Protection
- Encrypt sensitive configuration data
- Implement secure key storage
- Use secure communication protocols

## 🚀 Deployment

### Production Deployment
1. **Build for Release**: `dotnet build -c Release`
2. **Configure SSL**: Set up proper certificates
3. **Install Service**: Run as Windows service
4. **Configure Firewall**: Allow WebSocket port access
5. **Set Up Monitoring**: Implement health checks and monitoring

### Docker Support (Future)
```dockerfile
FROM mcr.microsoft.com/dotnet/runtime:10.0-windowsservercore-ltsc2019
COPY bin/Release/net10.0-windows/ /app/
WORKDIR /app
ENTRYPOINT ["HardwareBridge.exe"]
```

## 📚 Related Documentation

- **[CrossPlatformServer README](../CrossPlatformServer/README.md)**: Node.js-based cross-platform server
- **[BridgeClient README](../BridgeClient/README.md)**: JavaScript client library
- **[Web-to-Print Guide](../../examples/web-to-print/README.md)**: Web application example
- **[System Architecture](../../CROSS_PLATFORM_SOLUTION.md)**: Overall system design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add unit tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Issues**: Create an issue in the repository
- **Documentation**: Check the docs folder for detailed guides
- **Community**: Join our community discussions

---

**Developed by Azlam**