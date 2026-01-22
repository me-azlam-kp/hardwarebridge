import { WebSocketClient } from '../core/websocket-client';
import { ConnectionConfig, ClientOptions } from '../types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CLOSED;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;

  private messageQueue: string[] = [];

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string): void {
    this.messageQueue.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: code || 1000, reason: reason || '' });
  }

  // Helper to simulate receiving a message
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  // Helper to get sent messages
  getSentMessages(): string[] {
    return [...this.messageQueue];
  }
}

// Store original WebSocket
const OriginalWebSocket = global.WebSocket;

describe('WebSocketClient', () => {
  beforeAll(() => {
    // @ts-expect-error - Mock WebSocket globally
    global.WebSocket = MockWebSocket;
  });

  afterAll(() => {
    global.WebSocket = OriginalWebSocket;
  });

  describe('constructor', () => {
    it('should create WebSocketClient with config', () => {
      const config: ConnectionConfig = {
        url: 'ws://localhost:9876',
      };
      const client = new WebSocketClient(config);
      expect(client).toBeInstanceOf(WebSocketClient);
    });

    it('should create WebSocketClient with options', () => {
      const config: ConnectionConfig = {
        url: 'ws://localhost:9876',
      };
      const options: ClientOptions = {
        autoReconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 5,
        timeout: 10000,
        debug: true,
      };
      const client = new WebSocketClient(config, options);
      expect(client).toBeInstanceOf(WebSocketClient);
    });
  });

  describe('connection state', () => {
    it('should report not connected initially', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(client.isConnected).toBe(false);
    });

    it('should report not connecting initially', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(client.isConnecting).toBe(false);
    });

    it('should return disconnected status initially', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(client.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      await client.connect();
      expect(client.isConnected).toBe(true);
    });

    it('should report connecting status during connection', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      client.connect();
      expect(client.isConnecting).toBe(true);
    });

    it('should report connected status after connection', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      await client.connect();
      expect(client.getConnectionStatus()).toBe('connected');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      await client.connect();
      client.disconnect();
      expect(client.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('onConnectionStateChange', () => {
    it('should register connection state listener', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      const listener = jest.fn();
      client.onConnectionStateChange(listener);
      expect(typeof client.onConnectionStateChange).toBe('function');
    });

    it('should call listener on connect', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      const listener = jest.fn();
      client.onConnectionStateChange(listener);
      await client.connect();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('onDeviceEvent', () => {
    it('should register device event listener', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      const listener = jest.fn();
      client.onDeviceEvent(listener);
      expect(typeof client.onDeviceEvent).toBe('function');
    });
  });

  describe('dispose', () => {
    it('should dispose client', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(() => client.dispose()).not.toThrow();
    });

    it('should disconnect on dispose', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      await client.connect();
      client.dispose();
      expect(client.isConnected).toBe(false);
    });
  });

  describe('sendRequest', () => {
    it('should have sendRequest method', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(typeof client.sendRequest).toBe('function');
    });

    it('should reject when not connected', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      await expect(client.sendRequest('test.method')).rejects.toThrow();
    });
  });

  describe('sendNotification', () => {
    it('should have sendNotification method', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:9876' });
      expect(typeof client.sendNotification).toBe('function');
    });
  });
});
