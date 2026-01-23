# Cross Platform Server

A modern Node.js-based cross-platform hardware automation server that provides WebSocket communication, device management, and printing capabilities across Windows, macOS, and Linux.

## Overview

The Cross Platform Server is a Node.js application that serves as the central communication hub for hardware devices. It provides a unified WebSocket API for device discovery, printing, and queue management, working seamlessly across all major operating systems.

## Key Features

### Cross-Platform Compatibility
- **Windows**: Full native support with all device types
- **macOS**: Complete support including USB and serial devices
- **Linux**: Comprehensive support with device permissions
- **Node.js 22+**: Built for the latest Node.js LTS

### Advanced Printing System
- **Multi-Format Support**: ESC/POS, ZPL, EPL, Raw text
- **Print Queue Management**: Persistent queue with priority handling
- **Real-Time Status**: Live queue updates and job status
- **Error Recovery**: Automatic retry and error handling

### WebSocket Communication
- **JSON-RPC Protocol**: Standardized communication
- **Real-Time Updates**: Live device and queue status
- **Connection Management**: Robust connection handling
- **Broadcasting**: Multi-client synchronization

### Database Integration
- **SQLite Database**: Lightweight, embedded database
- **Persistent Queue**: Jobs survive server restarts
- **Device History**: Complete device interaction logs
- **Statistics**: Usage analytics and reporting

### Security & Reliability
- **Connection Validation**: Input sanitization and validation
- **Error Handling**: Comprehensive error management
- **Logging System**: Detailed operation logging
- **Graceful Shutdown**: Clean resource management

## Prerequisites

### System Requirements
- **Node.js**: v22.12.0 or higher (LTS recommended)
- **npm**: v10.0.0 or higher
- **Operating System**: Windows 10+, macOS 10.15+, or Linux

### Development Requirements
- **Git**: For version control
- **Code Editor**: VS Code, WebStorm, or similar
- **Terminal**: Command line access

## Installation & Setup

### 1. Clone and Install
```bash
# Navigate to the server directory
cd src/CrossPlatformServer

# Install dependencies
npm install

# Install development dependencies (optional)
npm install --include=dev
```

### 2. Configuration
Create a `config.json` file in the server directory:

```json
{
  "server": {
    "port": 9443,
    "host": "localhost",
    "ssl": {
      "enabled": false,
      "cert": "certificates/server.crt",
      "key": "certificates/server.key"
    }
  },
  "database": {
    "path": "data/queue.db",
    "backupInterval": 3600000
  },
  "devices": {
    "autoDiscovery": true,
    "discoveryInterval": 5000,
    "maxRetries": 3
  },
  "logging": {
    "level": "info",
    "file": "logs/server.log",
    "console": true
  }
}
```

### 3. Run the Server
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# With custom port
PORT=8080 npm start
```

## API Reference

### WebSocket Connection
Connect to the WebSocket server at `ws://localhost:9443` or `wss://localhost:9443` for SSL.

### JSON-RPC Methods

#### Device Discovery
```json
{
  "jsonrpc": "2.0",
  "method": "devices.list",
  "params": {},
  "id": 1
}
```

#### Get Device Information
```json
{
  "jsonrpc": "2.0",
  "method": "devices.get",
  "params": {
    "deviceId": "printer-001"
  },
  "id": 2
}
```

#### Print Job
```json
{
  "jsonrpc": "2.0",
  "method": "printer.print",
  "params": {
    "deviceId": "printer-001",
    "data": "Hello World",
    "format": "raw",
    "priority": 1
  },
  "id": 3
}
```

#### Queue Status
```json
{
  "jsonrpc": "2.0",
  "method": "queue.status",
  "params": {},
  "id": 4
}
```

#### Multi-Format Printing
```json
{
  "jsonrpc": "2.0",
  "method": "printer.print",
  "params": {
    "deviceId": "thermal-printer",
    "data": "\x1B@\x1BE\x1D!\x01Hello ESC/POS\x0A\x1D!\x00",
    "format": "escpos"
  },
  "id": 5
}
```

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testNamePattern="device"
```

### Integration Tests
```bash
# Start server and run integration tests
npm run test:integration

# Test with live server
npm run test:live
```

### Manual Testing
Use the provided test applications:
- **Simple Test**: `node src/simple-server.js`
- **Enhanced Test**: Use the test applications in `src/TestApp/`
- **Web Interface**: Use the web-to-print application in `examples/web-to-print/`

## Troubleshooting

### Common Issues

#### **Port Already in Use**
```
Error: EADDRINUSE: address already in use :::9443
```
**Solution**: Change the port in `config.json` or stop the conflicting service.

#### **Database Locked**
```
Error: SQLITE_BUSY: database is locked
```
**Solution**: Stop any other instances of the server and restart.

#### **Permission Denied (Linux/macOS)**
```
Error: EACCES: permission denied
```
**Solution**: Run with appropriate permissions or adjust device permissions.

#### **Module Not Found**
```
Error: Cannot find module 'ws'
```
**Solution**: Run `npm install` to install all dependencies.

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
# Enable debug logging
DEBUG=server:* npm start

# Enable all debug logs
DEBUG=* npm start
```

### Log Files
Check the log files in the `logs/` directory for detailed error information:
- `server.log`: Main server logs
- `error.log`: Error-specific logs
- `debug.log`: Debug information (when enabled)

## Performance Optimization

### Memory Management
- **Connection Pooling**: Reuse WebSocket connections
- **Database Optimization**: Regular database maintenance
- **Garbage Collection**: Monitor memory usage

### Scaling
- **Cluster Mode**: Use PM2 for multi-process scaling
- **Load Balancing**: Implement reverse proxy with nginx
- **Database Scaling**: Consider external database for high load

### Monitoring
- **Health Checks**: Implement health check endpoints
- **Metrics Collection**: Monitor performance metrics
- **Alerting**: Set up alerts for critical issues

## Security Considerations

### Production Security
- **SSL/TLS**: Always use SSL in production
- **Authentication**: Implement proper authentication
- **Input Validation**: Validate all incoming data
- **Rate Limiting**: Prevent abuse with rate limiting

### Network Security
- **Firewall Rules**: Configure appropriate firewall rules
- **VPN Access**: Consider VPN for remote access
- **Network Segmentation**: Isolate server network

### Data Protection
- **Encryption**: Encrypt sensitive data at rest
- **Backup Strategy**: Regular database backups
- **Access Control**: Implement proper access controls

## Deployment

### Production Deployment
1. **Environment Setup**:
   ```bash
   # Set production environment
   export NODE_ENV=production

   # Install production dependencies only
   npm ci --only=production
   ```

2. **Process Management**:
   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Start with PM2
   pm2 start ecosystem.config.js

   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

3. **SSL Configuration**:
   ```bash
   # Generate SSL certificates
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

### Docker Deployment
```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 9443

CMD ["npm", "start"]
```

### Systemd Service (Linux)
```ini
[Unit]
Description=Hardware Bridge Cross Platform Server
After=network.target

[Service]
Type=simple
User=bridge
WorkingDirectory=/opt/hardware-bridge/cross-platform-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Related Documentation

- **[BridgeService README](../BridgeService/README.md)**: .NET-based Windows service
- **[BridgeClient README](../BridgeClient/README.md)**: JavaScript client library
- **[Web-to-Print Guide](../../examples/web-to-print/README.md)**: Web application example
- **[System Architecture](../../CROSS_PLATFORM_SOLUTION.md)**: Overall system design

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

For support and questions:
- **Issues**: Create an issue in the repository
- **Documentation**: Check the docs folder for detailed guides
- **Community**: Join our community discussions
