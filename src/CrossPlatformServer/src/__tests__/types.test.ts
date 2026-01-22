import {
  ServerConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  DeviceEvent,
  QueueJob,
  QueueStatus,
} from '../types.js';

describe('Server Types', () => {
  describe('ServerConfig', () => {
    it('should accept valid server config', () => {
      const config: ServerConfig = {
        port: 8443,
        host: 'localhost',
        useTls: false,
        allowedOrigins: ['*'],
        maxConnections: 100,
        databasePath: 'data/queue.db',
        logLevel: 'info',
      };
      expect(config.port).toBe(8443);
      expect(config.host).toBe('localhost');
    });

    it('should accept TLS config', () => {
      const config: ServerConfig = {
        port: 8443,
        host: '0.0.0.0',
        useTls: true,
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        allowedOrigins: ['https://example.com'],
        maxConnections: 50,
        databasePath: 'data/queue.db',
        logLevel: 'debug',
      };
      expect(config.useTls).toBe(true);
      expect(config.certPath).toBe('/path/to/cert.pem');
    });
  });

  describe('JsonRpcRequest', () => {
    it('should accept valid JSON-RPC request', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'devices.enumerate',
        id: 1,
      };
      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('devices.enumerate');
    });

    it('should accept request with params', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'printer.print',
        params: { deviceId: 'printer_1', data: 'Hello' },
        id: 2,
      };
      expect(request.params).toHaveProperty('deviceId');
    });

    it('should accept notification (no id)', () => {
      const notification: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ping',
      };
      expect(notification.id).toBeUndefined();
    });
  });

  describe('JsonRpcResponse', () => {
    it('should accept success response', () => {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        result: { success: true },
        id: 1,
      };
      expect(response.result).toHaveProperty('success');
      expect(response.error).toBeUndefined();
    });

    it('should accept error response', () => {
      const error: JsonRpcError = {
        code: -32600,
        message: 'Invalid Request',
      };
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        error,
        id: 1,
      };
      expect(response.error?.code).toBe(-32600);
    });
  });

  describe('DeviceEvent', () => {
    it('should accept device connected event', () => {
      const event: DeviceEvent = {
        eventType: 'connected',
        deviceId: 'printer_1',
        deviceType: 'printer',
        timestamp: new Date(),
      };
      expect(event.eventType).toBe('connected');
      expect(event.deviceId).toBe('printer_1');
    });

    it('should accept device disconnected event', () => {
      const event: DeviceEvent = {
        eventType: 'disconnected',
        deviceId: 'serial_com1',
        deviceType: 'serial',
        timestamp: new Date(),
      };
      expect(event.eventType).toBe('disconnected');
    });

    it('should accept data event', () => {
      const event: DeviceEvent = {
        eventType: 'data',
        deviceId: 'usbhid_1234',
        deviceType: 'usbhid',
        timestamp: new Date(),
        data: { reportId: 0, bytes: [1, 2, 3] },
      };
      expect(event.eventType).toBe('data');
      expect(event.data).toHaveProperty('reportId');
    });
  });

  describe('QueueJob', () => {
    it('should accept valid queue job', () => {
      const job: QueueJob = {
        id: 'job_123',
        deviceId: 'printer_1',
        deviceType: 'printer',
        operation: 'print',
        status: 'pending',
        createdAt: new Date(),
        retryCount: 0,
        parameters: { data: 'Hello' },
      };
      expect(job.id).toBe('job_123');
      expect(job.status).toBe('pending');
    });

    it('should accept completed job', () => {
      const job: QueueJob = {
        id: 'job_124',
        deviceId: 'printer_1',
        deviceType: 'printer',
        operation: 'print',
        status: 'completed',
        createdAt: new Date(Date.now() - 60000),
        startedAt: new Date(Date.now() - 30000),
        completedAt: new Date(),
        retryCount: 0,
        parameters: {},
      };
      expect(job.status).toBe('completed');
      expect(job.completedAt).toBeDefined();
    });

    it('should accept failed job with error', () => {
      const job: QueueJob = {
        id: 'job_125',
        deviceId: 'printer_1',
        deviceType: 'printer',
        operation: 'print',
        status: 'failed',
        createdAt: new Date(),
        error: 'Printer offline',
        retryCount: 3,
        parameters: {},
      };
      expect(job.status).toBe('failed');
      expect(job.error).toBe('Printer offline');
    });
  });

  describe('QueueStatus', () => {
    it('should accept valid queue status', () => {
      const status: QueueStatus = {
        totalJobs: 100,
        pendingJobs: 5,
        processingJobs: 2,
        completedJobs: 90,
        failedJobs: 3,
        lastProcessed: new Date(),
        averageProcessingTime: 150,
      };
      expect(status.totalJobs).toBe(100);
      expect(status.pendingJobs + status.processingJobs + status.completedJobs + status.failedJobs).toBe(100);
    });
  });
});
