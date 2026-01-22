import {
  ConnectionConfig,
  ClientOptions,
  DeviceInfo,
  PrintFormat,
  SerialPortConfig,
  QueueStatus,
  SystemHealth,
} from '../types';

describe('Types', () => {
  describe('ConnectionConfig', () => {
    it('should accept valid connection config', () => {
      const config: ConnectionConfig = {
        url: 'ws://localhost:9876',
      };
      expect(config.url).toBe('ws://localhost:9876');
    });

    it('should accept connection config with all options', () => {
      const config: ConnectionConfig = {
        url: 'wss://localhost:9876',
        protocols: ['jsonrpc-2.0'],
        timeout: 30000,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
      };
      expect(config.url).toBe('wss://localhost:9876');
      expect(config.protocols).toEqual(['jsonrpc-2.0']);
      expect(config.timeout).toBe(30000);
    });
  });

  describe('ClientOptions', () => {
    it('should accept valid client options', () => {
      const options: ClientOptions = {
        autoReconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        timeout: 30000,
        debug: false,
      };
      expect(options.autoReconnect).toBe(true);
      expect(options.timeout).toBe(30000);
    });

    it('should accept partial client options', () => {
      const options: ClientOptions = {
        debug: true,
      };
      expect(options.debug).toBe(true);
      expect(options.autoReconnect).toBeUndefined();
    });
  });

  describe('DeviceInfo', () => {
    it('should accept valid device info', () => {
      const device: DeviceInfo = {
        id: 'printer_1',
        name: 'Test Printer',
        type: 'printer',
        status: 'available',
        manufacturer: 'Test Corp',
        model: 'Model X',
        serialNumber: 'SN12345',
        properties: {},
        lastSeen: new Date(),
        isConnected: true,
      };
      expect(device.id).toBe('printer_1');
      expect(device.type).toBe('printer');
      expect(device.isConnected).toBe(true);
    });
  });

  describe('PrintFormat', () => {
    it('should accept valid print formats', () => {
      const formats: PrintFormat[] = ['raw', 'escpos', 'zpl', 'epl'];
      expect(formats).toHaveLength(4);
      expect(formats).toContain('escpos');
      expect(formats).toContain('zpl');
    });
  });

  describe('SerialPortConfig', () => {
    it('should accept valid serial port config', () => {
      const config: SerialPortConfig = {
        baudRate: 9600,
        dataBits: 8,
        stopBits: '1',
        parity: 'None',
        flowControl: 'None',
      };
      expect(config.baudRate).toBe(9600);
      expect(config.dataBits).toBe(8);
    });

    it('should accept different configurations', () => {
      const config1: SerialPortConfig = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: '1',
        parity: 'None',
        flowControl: 'None',
      };

      const config2: SerialPortConfig = {
        baudRate: 9600,
        dataBits: 7,
        stopBits: '2',
        parity: 'Even',
        flowControl: 'XOnXOff',
      };

      expect(config1.baudRate).toBe(115200);
      expect(config2.parity).toBe('Even');
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
      expect(status.pendingJobs).toBe(5);
    });
  });

  describe('SystemHealth', () => {
    it('should accept valid system health', () => {
      const health: SystemHealth = {
        status: 'healthy',
        timestamp: new Date(),
        totalDevices: 5,
        connectedDevices: 3,
        activeConnections: 2,
        jobsInQueue: 10,
        cpuUsage: 25.5,
        memoryUsage: 512,
        deviceHealth: {},
      };
      expect(health.status).toBe('healthy');
      expect(health.connectedDevices).toBe(3);
    });
  });
});
