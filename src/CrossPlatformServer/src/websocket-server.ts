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

export class CrossPlatformWebSocketServer {
  private wss: WebSocketServer | null = null;
  private config: ServerConfig;
  private connections = new Map<string, WebSocket>();
  private messageHandlers = new Map<string, (params: any, connectionId: string) => Promise<any>>();
  private deviceEventListeners: Array<(event: DeviceEvent) => void> = [];

  constructor(config: ServerConfig) {
    this.config = config;
    this.setupMessageHandlers();
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

    // Queue management
    this.messageHandlers.set('queue.getStatus', this.getQueueStatus.bind(this));
    this.messageHandlers.set('queue.getJobs', this.getQueueJobs.bind(this));
    this.messageHandlers.set('queue.cancelJob', this.cancelQueueJob.bind(this));

    // System information
    this.messageHandlers.set('system.getInfo', this.getSystemInfo.bind(this));
    this.messageHandlers.set('system.getHealth', this.getSystemHealth.bind(this));
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ 
          port: this.config.port, 
          host: this.config.host 
        });

        this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
          this.handleConnection(ws, request);
        });

        this.wss.on('error', (error: Error) => {
          console.error('WebSocket server error:', error);
        });

        this.wss.on('listening', () => {
          console.log(`Cross-platform WebSocket server listening on ${this.config.host}:${this.config.port}`);
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all connections
        for (const [connectionId, ws] of this.connections) {
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
    const devices = this.getSimulatedDevices();
    return { devices, timestamp: new Date() };
  }

  private async getDevice(params: any, connectionId: string): Promise<any> {
    const deviceId = params?.deviceId;
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    const devices = this.getSimulatedDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return device;
  }

  private async watchDevices(params: any, connectionId: string): Promise<any> {
    // Simulate device watching
    return { success: true, message: 'Started watching devices' };
  }

  private async unwatchDevices(params: any, connectionId: string): Promise<any> {
    // Simulate device unwatching
    return { success: true, message: 'Stopped watching devices' };
  }

  private async print(params: any, connectionId: string): Promise<any> {
    const { deviceId, data, format = 'raw' } = params;
    
    if (!deviceId || !data) {
      throw new Error('Device ID and data are required');
    }

    // Simulate print operation
    return {
      success: true,
      jobId: `job_${Date.now()}`,
      bytesPrinted: data.length,
      timestamp: new Date()
    };
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

  private async getSystemHealth(params: any, connectionId: string): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date(),
      totalDevices: 3,
      connectedDevices: 0,
      activeConnections: this.connections.size,
      jobsInQueue: 0,
      cpuUsage: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      deviceHealth: {}
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
}