import { HardwareBridgeClient } from '../core/hardware-bridge-client';
import { ConnectionConfig, ClientOptions } from '../types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CLOSED;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;

  constructor(_url: string, _protocols?: string | string[]) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(_data: string): void {
    // Mock send
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

// Store original WebSocket
const OriginalWebSocket = global.WebSocket;

describe('HardwareBridgeClient', () => {
  beforeAll(() => {
    // @ts-expect-error - Mock WebSocket globally
    global.WebSocket = MockWebSocket;
  });

  afterAll(() => {
    global.WebSocket = OriginalWebSocket;
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      const config: ConnectionConfig = {
        url: 'ws://localhost:9876',
      };
      const client = new HardwareBridgeClient(config);
      expect(client).toBeInstanceOf(HardwareBridgeClient);
    });

    it('should create client with custom options', () => {
      const config: ConnectionConfig = {
        url: 'ws://localhost:9876',
      };
      const options: ClientOptions = {
        autoReconnect: false,
        timeout: 5000,
        debug: true,
      };
      const client = new HardwareBridgeClient(config, options);
      expect(client).toBeInstanceOf(HardwareBridgeClient);
    });

    it('should accept secure WebSocket URL', () => {
      const config: ConnectionConfig = {
        url: 'wss://localhost:9876',
      };
      const client = new HardwareBridgeClient(config);
      expect(client).toBeInstanceOf(HardwareBridgeClient);
    });
  });

  describe('connection state', () => {
    it('should report not connected initially', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(client.isConnected).toBe(false);
    });

    it('should report not connecting initially', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(client.isConnecting).toBe(false);
    });

    it('should return connection status string', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      const status = client.getConnectionStatus();
      expect(typeof status).toBe('string');
    });
  });

  describe('dispose', () => {
    it('should dispose client without error', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(() => client.dispose()).not.toThrow();
    });
  });

  describe('connection management', () => {
    it('should have connect method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.connect).toBe('function');
    });

    it('should have disconnect method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.disconnect).toBe('function');
    });

    it('should have onConnectionStateChange method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.onConnectionStateChange).toBe('function');
    });
  });

  describe('device operations', () => {
    it('should have enumerateDevices method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.enumerateDevices).toBe('function');
    });

    it('should have getDevice method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getDevice).toBe('function');
    });

    it('should have watchDevices method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.watchDevices).toBe('function');
    });

    it('should have unwatchDevices method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.unwatchDevices).toBe('function');
    });
  });

  describe('printer operations', () => {
    it('should have print method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.print).toBe('function');
    });

    it('should have getPrinterStatus method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getPrinterStatus).toBe('function');
    });

    it('should have getPrinterCapabilities method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getPrinterCapabilities).toBe('function');
    });
  });

  describe('serial port operations', () => {
    it('should have openSerialPort method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.openSerialPort).toBe('function');
    });

    it('should have closeSerialPort method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.closeSerialPort).toBe('function');
    });

    it('should have sendSerialData method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.sendSerialData).toBe('function');
    });

    it('should have receiveSerialData method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.receiveSerialData).toBe('function');
    });

    it('should have getSerialPortStatus method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getSerialPortStatus).toBe('function');
    });
  });

  describe('USB HID operations', () => {
    it('should have openUsbDevice method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.openUsbDevice).toBe('function');
    });

    it('should have closeUsbDevice method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.closeUsbDevice).toBe('function');
    });

    it('should have sendUsbReport method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.sendUsbReport).toBe('function');
    });

    it('should have receiveUsbReport method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.receiveUsbReport).toBe('function');
    });

    it('should have getUsbDeviceStatus method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getUsbDeviceStatus).toBe('function');
    });
  });

  describe('queue operations', () => {
    it('should have getQueueStatus method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getQueueStatus).toBe('function');
    });

    it('should have getQueueJobs method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getQueueJobs).toBe('function');
    });

    it('should have cancelQueueJob method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.cancelQueueJob).toBe('function');
    });
  });

  describe('system operations', () => {
    it('should have getSystemInfo method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getSystemInfo).toBe('function');
    });

    it('should have getSystemHealth method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.getSystemHealth).toBe('function');
    });
  });

  describe('utility methods', () => {
    it('should have waitForConnection method', () => {
      const client = new HardwareBridgeClient({ url: 'ws://localhost:9876' });
      expect(typeof client.waitForConnection).toBe('function');
    });
  });
});
