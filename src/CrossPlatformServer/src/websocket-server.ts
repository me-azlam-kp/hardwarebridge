import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  ServerConfig,
  DeviceEvent
} from './types.js';
import { NetworkDeviceManager } from './network-device-manager.js';
import { DeviceEnumerator } from './device-enumerator.js';
import { TcpPrinterService } from './tcp-printer-service.js';

export class CrossPlatformWebSocketServer {
  private wss: WebSocketServer | null = null;
  private config: ServerConfig;
  private connections = new Map<string, WebSocket>();
  private messageHandlers = new Map<string, (params: any, connectionId: string) => Promise<any>>();
  private deviceEventListeners: Array<(event: DeviceEvent) => void> = [];
  private onServerError: ((error: Error) => void) | null = null;
  private onServerClose: (() => void) | null = null;

  private networkManager: NetworkDeviceManager;
  private deviceEnumerator: DeviceEnumerator;
  private tcpPrinterService: TcpPrinterService;

  constructor(config: ServerConfig) {
    this.config = config;
    this.networkManager = new NetworkDeviceManager({
      defaultTimeout: 5000,
      maxConnections: 50,
    });
    this.deviceEnumerator = new DeviceEnumerator(10000);
    this.tcpPrinterService = new TcpPrinterService(this.networkManager);
    this.setupMessageHandlers();
    this.setupNetworkEventForwarding();
  }

  onDeviceEvent(listener: (event: DeviceEvent) => void): void {
    this.deviceEventListeners.push(listener);
  }

  private setupMessageHandlers(): void {
    // Device management
    this.messageHandlers.set('devices.enumerate', this.enumerateDevices.bind(this));
    this.messageHandlers.set('devices.get', this.getDevice.bind(this));
    this.messageHandlers.set('devices.watch', this.watchDevices.bind(this));
    this.messageHandlers.set('devices.unwatch', this.unwatchDevices.bind(this));

    // Printer operations
    this.messageHandlers.set('printer.print', this.print.bind(this));
    this.messageHandlers.set('printer.getStatus', this.getPrinterStatus.bind(this));
    this.messageHandlers.set('printer.getCapabilities', this.getPrinterCapabilities.bind(this));

    // Serial port operations
    this.messageHandlers.set('serial.open', this.openSerialPort.bind(this));
    this.messageHandlers.set('serial.close', this.closeSerialPort.bind(this));
    this.messageHandlers.set('serial.send', this.sendSerialData.bind(this));
    this.messageHandlers.set('serial.receive', this.receiveSerialData.bind(this));
    this.messageHandlers.set('serial.getStatus', this.getSerialPortStatus.bind(this));

    // USB HID operations
    this.messageHandlers.set('usb.open', this.openUsbDevice.bind(this));
    this.messageHandlers.set('usb.close', this.closeUsbDevice.bind(this));
    this.messageHandlers.set('usb.sendReport', this.sendUsbReport.bind(this));
    this.messageHandlers.set('usb.receiveReport', this.receiveUsbReport.bind(this));
    this.messageHandlers.set('usb.getStatus', this.getUsbDeviceStatus.bind(this));

    // Network device operations
    this.messageHandlers.set('network.connect', this.connectNetworkDevice.bind(this));
    this.messageHandlers.set('network.disconnect', this.disconnectNetworkDevice.bind(this));
    this.messageHandlers.set('network.ping', this.pingNetworkDevice.bind(this));
    this.messageHandlers.set('network.getStatus', this.getNetworkDeviceStatus.bind(this));
    this.messageHandlers.set('network.discover', this.discoverNetworkDevices.bind(this));

    // Biometric device operations
    this.messageHandlers.set('biometric.enroll', this.enrollBiometric.bind(this));
    this.messageHandlers.set('biometric.authenticate', this.authenticateBiometric.bind(this));
    this.messageHandlers.set('biometric.verify', this.verifyBiometric.bind(this));
    this.messageHandlers.set('biometric.identify', this.identifyBiometric.bind(this));
    this.messageHandlers.set('biometric.getStatus', this.getBiometricStatus.bind(this));
    this.messageHandlers.set('biometric.deleteUser', this.deleteBiometricUser.bind(this));
    this.messageHandlers.set('biometric.getUsers', this.getBiometricUsers.bind(this));

    // Queue management
    this.messageHandlers.set('queue.getStatus', this.getQueueStatus.bind(this));
    this.messageHandlers.set('queue.getJobs', this.getQueueJobs.bind(this));
    this.messageHandlers.set('queue.cancelJob', this.cancelQueueJob.bind(this));

    // Network data operations
    this.messageHandlers.set('network.send', this.sendNetworkData.bind(this));

    // System information
    this.messageHandlers.set('system.getInfo', this.getSystemInfo.bind(this));
    this.messageHandlers.set('system.getHealth', this.getSystemHealth.bind(this));
  }

  private setupNetworkEventForwarding(): void {
    this.networkManager.on('device-event', (event: DeviceEvent) => {
      // Broadcast device events to all connected WebSocket clients
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method: 'device.event',
        params: event,
      };
      for (const [connectionId] of this.connections) {
        this.sendToConnection(connectionId, notification);
      }
      // Notify local listeners
      for (const listener of this.deviceEventListeners) {
        listener(event);
      }
    });
  }

  onError(handler: (error: Error) => void): void {
    this.onServerError = handler;
  }

  onClose(handler: () => void): void {
    this.onServerClose = handler;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[WebSocketServer] Starting server on ${this.config.host}:${this.config.port}`);
        console.log(`[WebSocketServer] Configuration:`, this.config);

        this.wss = new WebSocketServer({
          port: this.config.port,
          host: this.config.host
        });
        console.log(`[WebSocketServer] WebSocketServer instance created`);

        let started = false;

        this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
          console.log(`[WebSocketServer] New connection from ${request.socket.remoteAddress}`);
          this.handleConnection(ws, request);
        });

        this.wss.on('error', (error: Error) => {
          console.error('[WebSocketServer] WebSocket server error:', error);
          if (!started) {
            reject(error);
          } else if (this.onServerError) {
            this.onServerError(error);
          }
        });

        this.wss.on('close', () => {
          console.log('[WebSocketServer] WebSocket server closed unexpectedly');
          if (started && this.onServerClose) {
            this.onServerClose();
          }
        });

        this.wss.on('listening', () => {
          started = true;
          console.log(`[WebSocketServer] Cross-platform WebSocket server listening on ${this.config.host}:${this.config.port}`);
          resolve();
        });

      } catch (error) {
        console.error('[WebSocketServer] Failed to start WebSocket server:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    // Dispose network managers
    this.networkManager.dispose();
    this.tcpPrinterService.dispose();

    return new Promise((resolve) => {
      if (this.wss) {
        // Close all WebSocket connections
        for (const [, ws] of this.connections) {
          ws.close(1000, 'Server shutting down');
        }
        this.connections.clear();

        this.wss.close(() => {
          console.log('WebSocket server stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = uuidv4();
    const origin = request.headers.origin || 'unknown';

    console.log(`New WebSocket connection: ${connectionId} from ${origin}`);

    // Validate origin if configured
    if (this.config.allowedOrigins.length > 0 && !this.config.allowedOrigins.includes('*')) {
      if (!origin || !this.config.allowedOrigins.includes(origin)) {
        console.log(`Connection from unauthorized origin: ${origin}`);
        ws.close(1008, 'Unauthorized origin');
        return;
      }
    }

    // Check connection limit
    if (this.connections.size >= this.config.maxConnections) {
      console.log('Connection limit reached');
      ws.close(1013, 'Server overloaded');
      return;
    }

    this.connections.set(connectionId, ws);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(data.toString(), connectionId);
    });

    ws.on('close', (code: number, reason: string) => {
      console.log(`WebSocket connection closed: ${connectionId} (${code}: ${reason})`);
      this.connections.delete(connectionId);
    });

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      this.connections.delete(connectionId);
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      jsonrpc: '2.0',
      method: 'server.connected',
      params: {
        connectionId,
        serverVersion: '1.0.0',
        timestamp: new Date()
      }
    });
  }

  private handleMessage(data: string, connectionId: string): void {
    try {
      const request: JsonRpcRequest = JSON.parse(data);
      
      if (request.jsonrpc !== '2.0') {
        this.sendError(connectionId, request.id, -32600, 'Invalid Request');
        return;
      }

      if (!request.method) {
        this.sendError(connectionId, request.id, -32600, 'Method not specified');
        return;
      }

      this.processRequest(request, connectionId).catch(error => {
        console.error(`Error processing request ${request.method}:`, error);
        this.sendError(connectionId, request.id, -32603, 'Internal error', error.message);
      });

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.sendError(connectionId, null, -32700, 'Parse error');
    }
  }

  private async processRequest(request: JsonRpcRequest, connectionId: string): Promise<void> {
    const handler = this.messageHandlers.get(request.method);
    
    if (!handler) {
      this.sendError(connectionId, request.id, -32601, 'Method not found');
      return;
    }

    try {
      const result = await handler(request.params, connectionId);
      
      if (request.id !== undefined && request.id !== null) {
        this.sendToConnection(connectionId, {
          jsonrpc: '2.0',
          result: result,
          id: request.id
        });
      }
    } catch (error) {
      console.error(`Error in method ${request.method}:`, error);
      this.sendError(connectionId, request.id, -32603, 'Internal error', (error as Error).message);
    }
  }

  private sendToConnection(connectionId: string, message: JsonRpcResponse | JsonRpcNotification): void {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(connectionId: string, id: any, code: number, message: string, data?: string): void {
    const error: JsonRpcError = { code, message };
    if (data) error.data = data;

    this.sendToConnection(connectionId, {
      jsonrpc: '2.0',
      error,
      id
    });
  }

  broadcast(message: JsonRpcResponse, targetConnections?: string[]): void {
    const connections = targetConnections ? 
      targetConnections.filter(id => this.connections.has(id)) :
      Array.from(this.connections.keys());

    for (const connectionId of connections) {
      this.sendToConnection(connectionId, message);
    }
  }

  // Message Handlers
  private async enumerateDevices(params: any, connectionId: string): Promise<any> {
    try {
      const enumResult = await this.deviceEnumerator.enumerate({
        forceRefresh: params?.forceRefresh ?? false,
      });

      const devices: any[] = [
        ...enumResult.printers,
        ...enumResult.serialPorts,
      ];

      // Add connected network devices
      for (const [deviceId, conn] of this.networkManager.getActiveConnections()) {
        devices.push({
          id: deviceId,
          name: `Network Device (${conn.host}:${conn.port})`,
          type: 'network',
          status: 'connected',
          manufacturer: 'Unknown',
          model: 'Unknown',
          serialNumber: '',
          properties: { host: conn.host, port: conn.port, source: 'network' },
          lastSeen: conn.lastActivity,
          isConnected: true,
          host: conn.host,
          port: conn.port,
          protocol: 'tcp',
          connectionType: 'ethernet',
          ipAddress: conn.host,
          isOnline: conn.isAlive,
        });
      }

      // Fallback to simulated if no real devices found
      if (devices.length === 0) {
        return { devices: this.getSimulatedDevices(), timestamp: new Date(), source: 'simulated' };
      }

      return { devices, timestamp: new Date(), source: 'real' };
    } catch (error) {
      console.error('[WebSocketServer] Device enumeration failed:', error);
      return { devices: this.getSimulatedDevices(), timestamp: new Date(), source: 'simulated' };
    }
  }

  private async getDevice(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    // Check connected network devices first
    const conn = this.networkManager.getConnectionStatus(deviceId);
    if (conn) {
      return {
        id: deviceId,
        name: `Network Device (${conn.host}:${conn.port})`,
        type: 'network',
        status: 'connected',
        host: conn.host,
        port: conn.port,
        isConnected: true,
        isOnline: conn.isAlive,
        lastSeen: conn.lastActivity,
      };
    }

    // Check enumerated devices
    const enumResult = await this.deviceEnumerator.enumerate();
    const allDevices = [...enumResult.printers, ...enumResult.serialPorts];
    const device = allDevices.find(d => d.id === deviceId);

    if (!device) {
      // Fallback to simulated
      const simulated = this.getSimulatedDevices().find(d => d.id === deviceId);
      if (!simulated) throw new Error(`Device not found: ${deviceId}`);
      return simulated;
    }

    return device;
  }

  private async watchDevices(params: any, connectionId: string): Promise<any> {
    return { success: true, message: 'Started watching devices' };
  }

  private async unwatchDevices(params: any, connectionId: string): Promise<any> {
    return { success: true, message: 'Stopped watching devices' };
  }

  private async print(params: any, connectionId: string): Promise<any> {
    const { deviceId, data, format = 'raw', host, port } = params;

    if (!deviceId || !data) {
      throw new Error('Device ID and data are required');
    }

    // If host/port provided, do real TCP print
    if (host && port) {
      return this.tcpPrinterService.printRaw(deviceId, host, port, data, { format });
    }

    // If device is connected via network manager, send data through existing socket
    if (this.networkManager.isConnected(deviceId)) {
      const result = await this.networkManager.sendData(deviceId, data);
      return {
        success: result.success,
        jobId: `job_${Date.now()}`,
        bytesPrinted: result.bytesWritten,
        timestamp: new Date(),
        error: result.error,
      };
    }

    // Try CUPS printing for OS-managed printers
    const enumResult = await this.deviceEnumerator.enumerate();
    const printer = enumResult.printers.find(p => p.id === deviceId);
    if (printer && printer.properties.source === 'os') {
      return this.printViaCups(printer.model, data);
    }

    // Fallback: simulated print
    return {
      success: true,
      jobId: `job_${Date.now()}`,
      bytesPrinted: data.length,
      timestamp: new Date(),
    };
  }

  private async printViaCups(cupsName: string, data: string): Promise<{
    success: boolean; jobId?: string; bytesPrinted?: number; error?: string; timestamp: Date;
  }> {
    const { exec } = await import('child_process');
    return new Promise((resolve) => {
      const child = exec(`lp -d "${cupsName}" -`, { timeout: 15000 }, (error, stdout, _stderr) => {
        if (error) {
          resolve({
            success: false,
            error: `CUPS print failed: ${error.message}`,
            timestamp: new Date(),
          });
        } else {
          // Parse job ID from lp output: "request id is PRINTER-123 (1 file(s))"
          const jobMatch = stdout.match(/request id is (\S+)/);
          resolve({
            success: true,
            jobId: jobMatch ? jobMatch[1] : `cups_${Date.now()}`,
            bytesPrinted: data.length,
            timestamp: new Date(),
          });
        }
      });
      // Write print data to stdin
      child.stdin?.write(data);
      child.stdin?.end();
    });
  }

  private async getPrinterStatus(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      isConnected: false,
      status: 'ready',
      isReady: true,
      isBusy: false,
      isPaused: false,
      jobsInQueue: 0,
      timestamp: new Date()
    };
  }

  private async getPrinterCapabilities(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      supportedProtocols: ['ESC/POS', 'ZPL', 'EPL'],
      maxPrintWidth: 576,
      supportsColor: false,
      supportsDuplex: false,
      maxResolution: 300,
      maxJobSize: 10 * 1024 * 1024
    };
  }

  private async openSerialPort(params: any, connectionId: string): Promise<any> {
    const { deviceId, baudRate = 9600, parity = 'None', dataBits = 8, stopBits = '1', flowControl = 'None' } = params;
    
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      success: true,
      portName: deviceId.replace('serial_', ''),
      config: { baudRate, parity, dataBits, stopBits, flowControl },
      openedAt: new Date()
    };
  }

  private async closeSerialPort(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      success: true,
      portName: deviceId.replace('serial_', ''),
      closedAt: new Date()
    };
  }

  private async sendSerialData(params: any, connectionId: string): Promise<any> {
    const { deviceId, data } = params;
    
    if (!deviceId || !data) {
      throw new Error('Device ID and data are required');
    }

    return {
      success: true,
      bytesTransferred: data.length,
      data: data,
      timestamp: new Date()
    };
  }

  private async receiveSerialData(params: any, connectionId: string): Promise<any> {
    const { deviceId, maxBytes = 1024, timeout = 10000 } = params;
    
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    // Simulate received data
    const mockData = `Received ${maxBytes} bytes from ${deviceId}`;
    
    return {
      success: true,
      bytesTransferred: mockData.length,
      data: mockData,
      timestamp: new Date()
    };
  }

  private async getSerialPortStatus(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      isConnected: true,
      status: 'connected',
      portName: deviceId.replace('serial_', ''),
      baudRate: 115200,
      parity: 'None',
      dataBits: 8,
      stopBits: '1',
      flowControl: 'None',
      bytesToRead: 0,
      bytesToWrite: 0,
      isOpen: true,
      cdHolding: false,
      ctsHolding: true,
      dsrHolding: false,
      connectedAt: new Date(),
      lastActivity: new Date()
    };
  }

  private async openUsbDevice(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      success: true,
      deviceId,
      vendorId: 1234,
      productId: 5678,
      openedAt: new Date()
    };
  }

  private async closeUsbDevice(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      success: true,
      deviceId,
      closedAt: new Date()
    };
  }

  private async sendUsbReport(params: any, connectionId: string): Promise<any> {
    const { deviceId, reportId = 0, data } = params;
    
    if (!deviceId || !data) {
      throw new Error('Device ID and data are required');
    }

    return {
      success: true,
      reportId,
      bytesTransferred: data.length,
      data,
      timestamp: new Date()
    };
  }

  private async receiveUsbReport(params: any, connectionId: string): Promise<any> {
    const { deviceId, reportId = 0, timeout = 5000 } = params;
    
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    const mockData = '01 02 03 04 05 06 07 08';
    
    return {
      success: true,
      reportId,
      bytesTransferred: mockData.length,
      data: mockData,
      timestamp: new Date()
    };
  }

  private async getUsbDeviceStatus(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    return {
      isConnected: true,
      status: 'connected',
      deviceId,
      vendorId: 1234,
      productId: 5678,
      version: 1,
      isOpen: true,
      inputReportLength: 64,
      outputReportLength: 64,
      featureReportLength: 0,
      connectedAt: new Date(),
      lastActivity: new Date()
    };
  }

  private async getQueueStatus(params: any, connectionId: string): Promise<any> {
    return {
      totalJobs: Math.floor(Math.random() * 10),
      pendingJobs: Math.floor(Math.random() * 5),
      processingJobs: Math.floor(Math.random() * 2),
      completedJobs: Math.floor(Math.random() * 20),
      failedJobs: Math.floor(Math.random() * 3),
      lastProcessed: new Date(),
      averageProcessingTime: Math.random() * 1000
    };
  }

  private async getQueueJobs(params: any, connectionId: string): Promise<any> {
    const jobs: any[] = [];
    const statuses = ['pending', 'processing', 'completed', 'failed'];
    const operations = ['print', 'serial.send', 'usb.sendReport'];
    
    for (let i = 0; i < 5; i++) {
      jobs.push({
        id: `job_${Date.now() + i}`,
        deviceId: `device_${i}`,
        deviceType: ['printer', 'serial', 'usbhid'][Math.floor(Math.random() * 3)],
        operation: operations[Math.floor(Math.random() * operations.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        createdAt: new Date(Date.now() - Math.random() * 3600000),
        startedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 1800000) : null,
        completedAt: Math.random() > 0.6 ? new Date(Date.now() - Math.random() * 900000) : null,
        retryCount: Math.floor(Math.random() * 3)
      });
    }
    
    return jobs;
  }

  private async cancelQueueJob(params: any, connectionId: string): Promise<any> {
    const jobId = params?.jobId;
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    return { success: true };
  }

  private async getSystemInfo(params: any, connectionId: string): Promise<any> {
    return {
      version: '1.0.0',
      platform: process.platform,
      timestamp: new Date(),
      uptime: process.uptime()
    };
  }

  private async getSystemHealth(params: any, _connectionId: string): Promise<any> {
    const enumResult = await this.deviceEnumerator.enumerate();
    const activeConns = this.networkManager.getActiveConnections();
    const totalDevices = enumResult.printers.length + enumResult.serialPorts.length + activeConns.size;

    return {
      status: totalDevices > 0 ? 'healthy' : 'no_devices',
      timestamp: new Date(),
      totalDevices,
      connectedDevices: activeConns.size,
      activeConnections: this.connections.size,
      jobsInQueue: this.tcpPrinterService.getActiveJobs().length,
      cpuUsage: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      deviceHealth: {},
    };
  }

  private getSimulatedDevices(): any[] {
    return [
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
      },
      {
        id: 'serial_com1',
        name: 'COM1',
        type: 'serial',
        status: 'available',
        manufacturer: 'System',
        model: 'Serial Port',
        serialNumber: '',
        properties: { portName: 'COM1' },
        lastSeen: new Date(),
        isConnected: false,
        portName: 'COM1',
        baudRate: 9600,
        parity: 'None',
        dataBits: 8,
        stopBits: '1',
        flowControl: 'None',
        isOpen: false,
        bytesToRead: 0,
        bytesToWrite: 0
      },
      {
        id: 'usbhid_1234_5678',
        name: 'USB HID Device',
        type: 'usbhid',
        status: 'available',
        manufacturer: 'USB Vendor',
        model: 'HID Device',
        serialNumber: '',
        properties: { vendorId: 1234, productId: 5678 },
        lastSeen: new Date(),
        isConnected: false,
        vendorId: 1234,
        productId: 5678,
        version: 1,
        devicePath: '/dev/hidraw0',
        inputReportLength: 64,
        outputReportLength: 64,
        featureReportLength: 0,
        isOpen: false
      }
    ];
  }

  // Network Device Operations
  private async connectNetworkDevice(params: any, _connectionId: string): Promise<any> {
    const { deviceId, config } = params;
    if (!deviceId || !config?.host || !config?.port) {
      throw new Error('deviceId, config.host, and config.port are required');
    }
    return this.networkManager.connect(deviceId, config);
  }

  private async disconnectNetworkDevice(params: any, connectionId: string): Promise<any> {
    const { deviceId } = params;
    if (!deviceId) throw new Error('deviceId is required');
    return this.networkManager.disconnect(deviceId);
  }

  private async pingNetworkDevice(params: any, connectionId: string): Promise<any> {
    const { deviceId, host, port, timeout } = params;
    if (!deviceId || !host || !port) {
      throw new Error('deviceId, host, and port are required');
    }
    return this.networkManager.ping(deviceId, host, port, timeout);
  }

  private async getNetworkDeviceStatus(params: any, connectionId: string): Promise<any> {
    const { deviceId } = params;
    if (!deviceId) throw new Error('deviceId is required');

    const conn = this.networkManager.getConnectionStatus(deviceId);
    if (!conn) {
      return {
        success: true,
        deviceId,
        status: 'disconnected',
        isConnected: false,
        isOnline: false,
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      deviceId,
      status: 'connected',
      isConnected: true,
      isOnline: conn.isAlive,
      host: conn.host,
      port: conn.port,
      protocol: conn.protocol,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
      bytesWritten: conn.bytesWritten,
      bytesRead: conn.bytesRead,
      timestamp: new Date(),
    };
  }

  private async discoverNetworkDevices(params: any, connectionId: string): Promise<any> {
    const options = {
      subnet: params?.subnet,
      ports: params?.ports || [9100, 631, 515, 4370],
      timeout: params?.timeout || 2000,
      maxConcurrent: params?.maxConcurrent || 50,
    };

    const result = await this.networkManager.discover(options);

    const devices = result.devices.map(d => ({
      id: `network_${d.inferredType}_${d.host.replace(/\./g, '_')}_${d.port}`,
      name: `${d.inferredType === 'printer' ? 'Network Printer' : d.inferredType === 'biometric' ? 'Biometric Device' : 'Network Device'} (${d.host}:${d.port})`,
      type: d.inferredType === 'biometric' ? 'biometric' : 'network',
      status: 'available',
      manufacturer: 'Unknown',
      model: 'Unknown',
      serialNumber: '',
      properties: { host: d.host, port: d.port, protocol: d.inferredProtocol, responseTime: d.responseTime },
      lastSeen: new Date(),
      isConnected: false,
      host: d.host,
      port: d.port,
      protocol: 'tcp',
      connectionType: 'ethernet',
      ipAddress: d.host,
      isOnline: true,
    }));

    return { success: true, devices, count: devices.length, timestamp: new Date() };
  }

  private async sendNetworkData(params: any, _connectionId: string): Promise<any> {
    const { deviceId, data, encoding = 'utf8' } = params;
    if (!deviceId || !data) {
      throw new Error('deviceId and data are required');
    }
    const buffer = Buffer.from(data, encoding as BufferEncoding);
    return this.networkManager.sendData(deviceId, buffer);
  }

  // Biometric Device Operations
  private async enrollBiometric(params: any, connectionId: string): Promise<any> {
    const { deviceId, userId, userName, biometricData } = params;
    
    try {
      const device = this.getSimulatedDevices().find(d => d.id === deviceId && d.type === 'biometric');
      if (!device) {
        throw new Error(`Biometric device not found: ${deviceId}`);
      }

      // Simulate enrollment process
      const enrollmentTime = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
      
      return {
        success: true,
        deviceId,
        userId,
        userName,
        enrollmentTime,
        status: 'enrolled',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        deviceId,
        userId,
        error: error instanceof Error ? error.message : 'Enrollment failed',
        timestamp: new Date()
      };
    }
  }

  private async authenticateBiometric(params: any, connectionId: string): Promise<any> {
    const { deviceId, userId, biometricData, authenticationType = 'verify' } = params;
    
    try {
      const device = this.getSimulatedDevices().find(d => d.id === deviceId && d.type === 'biometric');
      if (!device) {
        throw new Error(`Biometric device not found: ${deviceId}`);
      }

      // Simulate authentication process
      const authenticationTime = Math.floor(Math.random() * 2000) + 500; // 0.5-2.5 seconds
      const confidence = Math.floor(Math.random() * 30) + 70; // 70-99%
      const success = confidence > 75; // 75% threshold

      return {
        success,
        deviceId,
        userId,
        authenticationType,
        confidence: success ? confidence : Math.floor(Math.random() * 40) + 10, // 10-49% for failures
        authenticationTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        deviceId,
        userId,
        error: error instanceof Error ? error.message : 'Authentication failed',
        timestamp: new Date()
      };
    }
  }

  private async verifyBiometric(params: any, connectionId: string): Promise<any> {
    return this.authenticateBiometric({ ...params, authenticationType: 'verify' }, connectionId);
  }

  private async identifyBiometric(params: any, connectionId: string): Promise<any> {
    const { deviceId, biometricData } = params;
    
    try {
      const device = this.getSimulatedDevices().find(d => d.id === deviceId && d.type === 'biometric');
      if (!device) {
        throw new Error(`Biometric device not found: ${deviceId}`);
      }

      // Simulate identification process
      const authenticationTime = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
      const confidence = Math.floor(Math.random() * 25) + 75; // 75-99%
      const success = confidence > 80; // 80% threshold

      if (success) {
        return {
          success: true,
          deviceId,
          userId: 'user_' + Math.floor(Math.random() * 1000),
          userName: 'John Doe',
          confidence,
          authenticationTime,
          timestamp: new Date()
        };
      } else {
        return {
          success: false,
          deviceId,
          confidence: Math.floor(Math.random() * 30) + 20, // 20-49%
          authenticationTime,
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        success: false,
        deviceId,
        error: error instanceof Error ? error.message : 'Identification failed',
        timestamp: new Date()
      };
    }
  }

  private async getBiometricStatus(params: any, connectionId: string): Promise<any> {
    const { deviceId } = params;
    
    try {
      const device = this.getSimulatedDevices().find(d => d.id === deviceId && d.type === 'biometric');
      if (!device) {
        throw new Error(`Biometric device not found: ${deviceId}`);
      }

      return {
        success: true,
        deviceId,
        status: device.status,
        isConnected: device.isConnected,
        isOnline: device.isOnline,
        biometricType: device.biometricType,
        currentUsers: device.currentUsers,
        maxUsers: device.maxUsers,
        securityLevel: device.securityLevel,
        failedAttempts: device.failedAttempts,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        deviceId,
        error: error instanceof Error ? error.message : 'Status check failed',
        timestamp: new Date()
      };
    }
  }

  private async deleteBiometricUser(params: any, connectionId: string): Promise<any> {
    const { deviceId, userId } = params;
    
    try {
      const device = this.getSimulatedDevices().find(d => d.id === deviceId && d.type === 'biometric');
      if (!device) {
        throw new Error(`Biometric device not found: ${deviceId}`);
      }

      return {
        success: true,
        deviceId,
        userId,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        deviceId,
        userId,
        error: error instanceof Error ? error.message : 'User deletion failed',
        timestamp: new Date()
      };
    }
  }

  private async getBiometricUsers(params: any, connectionId: string): Promise<any> {
    const { deviceId } = params;
    
    try {
      const device = this.getSimulatedDevices().find(d => d.id === deviceId && d.type === 'biometric');
      if (!device) {
        throw new Error(`Biometric device not found: ${deviceId}`);
      }

      // Simulate user list
      const users = [
        { userId: 'user_001', userName: 'John Doe', enrolledAt: new Date('2024-01-15') },
        { userId: 'user_002', userName: 'Jane Smith', enrolledAt: new Date('2024-01-20') },
        { userId: 'user_003', userName: 'Bob Johnson', enrolledAt: new Date('2024-02-01') }
      ];

      return {
        success: true,
        deviceId,
        users,
        totalUsers: users.length,
        maxUsers: device.maxUsers,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        deviceId,
        error: error instanceof Error ? error.message : 'User list retrieval failed',
        timestamp: new Date()
      };
    }
  }
}