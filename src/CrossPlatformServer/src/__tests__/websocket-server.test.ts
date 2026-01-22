import { CrossPlatformWebSocketServer } from '../websocket-server.js';
import { ServerConfig } from '../types.js';
import WebSocket from 'ws';

describe('CrossPlatformWebSocketServer', () => {
  const testPort = 19876; // Use a different port to avoid conflicts
  let server: CrossPlatformWebSocketServer;
  let config: ServerConfig;

  beforeEach(() => {
    config = {
      port: testPort,
      host: 'localhost',
      useTls: false,
      allowedOrigins: ['*'],
      maxConnections: 10,
      databasePath: ':memory:',
      logLevel: 'error', // Suppress logs during tests
    };
    server = new CrossPlatformWebSocketServer(config);
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('constructor', () => {
    it('should create server with config', () => {
      expect(server).toBeInstanceOf(CrossPlatformWebSocketServer);
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      await expect(server.start()).resolves.not.toThrow();
    });

    it('should accept client connections', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${testPort}`);

      await new Promise<void>((resolve, reject) => {
        client.on('open', () => {
          client.close();
          resolve();
        });
        client.on('error', reject);
      });
    });

    it('should send welcome message on connection', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${testPort}`);

      const message = await new Promise<string>((resolve, reject) => {
        client.on('message', (data) => {
          client.close();
          resolve(data.toString());
        });
        client.on('error', reject);
      });

      const parsed = JSON.parse(message);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('server.connected');
      expect(parsed.params).toHaveProperty('connectionId');
    });
  });

  describe('stop', () => {
    it('should stop server successfully', async () => {
      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should be safe to call stop when not started', async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('JSON-RPC handling', () => {
    let client: WebSocket;

    beforeEach(async () => {
      await server.start();
      client = new WebSocket(`ws://localhost:${testPort}`);
      // Wait for connection and welcome message
      await new Promise<void>((resolve) => {
        client.on('message', () => resolve());
      });
    });

    afterEach(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    it('should respond to devices.enumerate', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'devices.enumerate',
        id: 1,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(1);
      expect(parsed.result).toHaveProperty('devices');
      expect(Array.isArray(parsed.result.devices)).toBe(true);
    });

    it('should respond to system.getInfo', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'system.getInfo',
        id: 2,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(2);
      expect(parsed.result).toHaveProperty('version');
      expect(parsed.result).toHaveProperty('platform');
    });

    it('should respond to system.getHealth', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'system.getHealth',
        id: 3,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(3);
      expect(parsed.result).toHaveProperty('status');
      expect(parsed.result.status).toBe('healthy');
    });

    it('should return error for unknown method', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'unknown.method',
        id: 4,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(4);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32601); // Method not found
    });

    it('should return error for invalid JSON', async () => {
      client.send('invalid json');

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32700); // Parse error
    });

    it('should return error for invalid JSON-RPC version', async () => {
      const request = {
        jsonrpc: '1.0',
        method: 'devices.enumerate',
        id: 5,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe(-32600); // Invalid Request
    });
  });

  describe('device operations', () => {
    let client: WebSocket;

    beforeEach(async () => {
      await server.start();
      client = new WebSocket(`ws://localhost:${testPort}`);
      await new Promise<void>((resolve) => {
        client.on('message', () => resolve());
      });
    });

    afterEach(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    it('should enumerate simulated devices', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'devices.enumerate',
        id: 1,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      const devices = parsed.result.devices;

      expect(devices.length).toBeGreaterThan(0);

      // Should have printer, serial, and USB HID devices
      const types = devices.map((d: { type: string }) => d.type);
      expect(types).toContain('printer');
      expect(types).toContain('serial');
      expect(types).toContain('usbhid');
    });

    it('should get device by ID', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'devices.get',
        params: { deviceId: 'printer_test1' },
        id: 2,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.result).toHaveProperty('id', 'printer_test1');
      expect(parsed.result).toHaveProperty('type', 'printer');
    });

    it('should return error for non-existent device', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'devices.get',
        params: { deviceId: 'non_existent' },
        id: 3,
      };

      client.send(JSON.stringify(request));

      const response = await new Promise<string>((resolve) => {
        client.on('message', (data) => resolve(data.toString()));
      });

      const parsed = JSON.parse(response);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('connection limits', () => {
    it('should enforce max connections', async () => {
      const limitedConfig: ServerConfig = {
        ...config,
        maxConnections: 2,
      };
      const limitedServer = new CrossPlatformWebSocketServer(limitedConfig);
      await limitedServer.start();

      const clients: WebSocket[] = [];

      try {
        // Create 2 connections (should succeed)
        for (let i = 0; i < 2; i++) {
          const client = new WebSocket(`ws://localhost:${testPort}`);
          await new Promise<void>((resolve, reject) => {
            client.on('open', () => resolve());
            client.on('error', reject);
          });
          clients.push(client);
        }

        // Create 3rd connection (should be closed)
        const thirdClient = new WebSocket(`ws://localhost:${testPort}`);

        await new Promise<void>((resolve) => {
          thirdClient.on('close', (code) => {
            expect(code).toBe(1013); // Server overloaded
            resolve();
          });
          thirdClient.on('open', () => {
            // If it opens, wait for close
          });
        });
      } finally {
        clients.forEach(c => c.close());
        await limitedServer.stop();
      }
    });
  });

  describe('origin validation', () => {
    it('should reject unauthorized origin', async () => {
      const restrictedConfig: ServerConfig = {
        ...config,
        allowedOrigins: ['https://allowed-origin.com'],
      };
      const restrictedServer = new CrossPlatformWebSocketServer(restrictedConfig);
      await restrictedServer.start();

      const client = new WebSocket(`ws://localhost:${testPort}`, {
        headers: { origin: 'https://unauthorized-origin.com' },
      });

      await new Promise<void>((resolve) => {
        client.on('close', (code) => {
          expect(code).toBe(1008); // Policy violation
          resolve();
        });
      });

      await restrictedServer.stop();
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all connections', async () => {
      await server.start();

      const clients: WebSocket[] = [];
      const messages: string[][] = [[], []];

      // Create 2 clients
      for (let i = 0; i < 2; i++) {
        const client = new WebSocket(`ws://localhost:${testPort}`);
        await new Promise<void>((resolve) => {
          client.on('message', () => resolve()); // Wait for welcome
        });
        client.on('message', (data) => {
          messages[i].push(data.toString());
        });
        clients.push(client);
      }

      // Broadcast a message
      server.broadcast({
        jsonrpc: '2.0',
        result: { broadcast: 'test' },
        id: null,
      });

      // Wait for messages
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clean up
      clients.forEach(c => c.close());

      // Both clients should have received the broadcast
      expect(messages[0].length).toBeGreaterThan(0);
      expect(messages[1].length).toBeGreaterThan(0);
    });
  });
});
