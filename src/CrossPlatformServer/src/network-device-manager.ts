import * as net from 'net';
import * as os from 'os';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { NetworkDeviceConfig, DeviceEvent } from './types.js';
import {
  ActiveConnection,
  DiscoveryOptions,
  DiscoveredDevice,
  PingResult,
  WELL_KNOWN_PORTS
} from './network-types.js';

interface NetworkManagerConfig {
  defaultTimeout: number;
  maxConnections: number;
  pingInterval: number;
}

export class NetworkDeviceManager extends EventEmitter {
  private connections = new Map<string, ActiveConnection>();
  private config: NetworkManagerConfig;

  constructor(config?: Partial<NetworkManagerConfig>) {
    super();
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 5000,
      maxConnections: config?.maxConnections ?? 50,
      pingInterval: config?.pingInterval ?? 30000,
    };
  }

  async connect(deviceId: string, config: NetworkDeviceConfig): Promise<{
    success: boolean; deviceId: string; status: string; connectionId?: string; timestamp: Date; error?: string;
  }> {
    // Check if already connected
    const existing = this.connections.get(deviceId);
    if (existing && existing.isAlive) {
      return {
        success: true,
        deviceId,
        status: 'already_connected',
        connectionId: existing.id,
        timestamp: new Date(),
      };
    }

    // Check connection limit
    if (this.connections.size >= this.config.maxConnections) {
      return {
        success: false,
        deviceId,
        status: 'error',
        timestamp: new Date(),
        error: 'Maximum connection limit reached',
      };
    }

    const timeout = config.timeout ?? this.config.defaultTimeout;

    try {
      const socket = await this.createSocket(config.host, config.port, timeout);
      const connectionId = uuidv4();

      const connection: ActiveConnection = {
        id: connectionId,
        deviceId,
        socket,
        host: config.host,
        port: config.port,
        protocol: 'tcp',
        connectedAt: new Date(),
        lastActivity: new Date(),
        bytesWritten: 0,
        bytesRead: 0,
        isAlive: true,
      };

      // Handle socket events
      socket.on('data', (data) => {
        connection.bytesRead += data.length;
        connection.lastActivity = new Date();
      });

      socket.on('error', (error) => {
        console.error(`[NetworkManager] Socket error for device ${deviceId}:`, error.message);
        connection.isAlive = false;
        this.connections.delete(deviceId);
        this.emitDeviceEvent({
          eventType: 'disconnected',
          deviceId,
          deviceType: 'network',
          timestamp: new Date(),
          data: { reason: 'error', error: error.message },
        });
      });

      socket.on('close', () => {
        connection.isAlive = false;
        this.connections.delete(deviceId);
        this.emitDeviceEvent({
          eventType: 'disconnected',
          deviceId,
          deviceType: 'network',
          timestamp: new Date(),
          data: { reason: 'closed' },
        });
      });

      socket.on('timeout', () => {
        console.warn(`[NetworkManager] Socket timeout for device ${deviceId}`);
        connection.isAlive = false;
        socket.destroy();
      });

      this.connections.set(deviceId, connection);

      this.emitDeviceEvent({
        eventType: 'connected',
        deviceId,
        deviceType: 'network',
        timestamp: new Date(),
        data: { host: config.host, port: config.port, connectionId },
      });

      return {
        success: true,
        deviceId,
        status: 'connected',
        connectionId,
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      return {
        success: false,
        deviceId,
        status: 'error',
        timestamp: new Date(),
        error: message,
      };
    }
  }

  async disconnect(deviceId: string): Promise<{
    success: boolean; deviceId: string; status: string; timestamp: Date; error?: string;
  }> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      return {
        success: true,
        deviceId,
        status: 'not_connected',
        timestamp: new Date(),
      };
    }

    try {
      connection.socket.destroy();
      connection.isAlive = false;
      this.connections.delete(deviceId);
      return {
        success: true,
        deviceId,
        status: 'disconnected',
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Disconnect failed';
      return {
        success: false,
        deviceId,
        status: 'error',
        timestamp: new Date(),
        error: message,
      };
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [deviceId, connection] of this.connections) {
      try {
        connection.socket.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.connections.clear();
  }

  async sendData(deviceId: string, data: Buffer | string): Promise<{
    success: boolean; bytesWritten: number; timestamp: Date; error?: string;
  }> {
    const connection = this.connections.get(deviceId);
    if (!connection || !connection.isAlive) {
      return {
        success: false,
        bytesWritten: 0,
        timestamp: new Date(),
        error: `Device ${deviceId} is not connected`,
      };
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    return new Promise((resolve) => {
      connection.socket.write(buffer, (error) => {
        if (error) {
          resolve({
            success: false,
            bytesWritten: 0,
            timestamp: new Date(),
            error: error.message,
          });
        } else {
          connection.bytesWritten += buffer.length;
          connection.lastActivity = new Date();
          resolve({
            success: true,
            bytesWritten: buffer.length,
            timestamp: new Date(),
          });
        }
      });
    });
  }

  async sendAndReceive(deviceId: string, data: Buffer | string, timeout?: number): Promise<{
    success: boolean; bytesWritten: number; response: Buffer; timestamp: Date; error?: string;
  }> {
    const connection = this.connections.get(deviceId);
    if (!connection || !connection.isAlive) {
      return {
        success: false,
        bytesWritten: 0,
        response: Buffer.alloc(0),
        timestamp: new Date(),
        error: `Device ${deviceId} is not connected`,
      };
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const responseTimeout = timeout ?? this.config.defaultTimeout;

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let timer: NodeJS.Timeout;

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        // Reset timer on each data chunk
        clearTimeout(timer);
        timer = setTimeout(finish, 500); // Wait 500ms after last chunk
      };

      const finish = () => {
        connection.socket.removeListener('data', onData);
        clearTimeout(timer);
        const response = Buffer.concat(chunks);
        connection.bytesRead += response.length;
        connection.lastActivity = new Date();
        resolve({
          success: true,
          bytesWritten: buffer.length,
          response,
          timestamp: new Date(),
        });
      };

      const onError = (error: Error) => {
        connection.socket.removeListener('data', onData);
        clearTimeout(timer);
        resolve({
          success: false,
          bytesWritten: 0,
          response: Buffer.alloc(0),
          timestamp: new Date(),
          error: error.message,
        });
      };

      connection.socket.once('error', onError);
      connection.socket.on('data', onData);

      // Overall timeout
      timer = setTimeout(() => {
        connection.socket.removeListener('data', onData);
        connection.socket.removeListener('error', onError);
        const response = Buffer.concat(chunks);
        resolve({
          success: chunks.length > 0,
          bytesWritten: buffer.length,
          response,
          timestamp: new Date(),
          error: chunks.length === 0 ? 'Response timeout' : undefined,
        });
      }, responseTimeout);

      // Send the data
      connection.socket.write(buffer, (error) => {
        if (error) {
          connection.socket.removeListener('data', onData);
          clearTimeout(timer);
          resolve({
            success: false,
            bytesWritten: 0,
            response: Buffer.alloc(0),
            timestamp: new Date(),
            error: error.message,
          });
        } else {
          connection.bytesWritten += buffer.length;
          connection.lastActivity = new Date();
        }
      });
    });
  }

  async ping(deviceId: string, host: string, port: number, timeout?: number): Promise<PingResult> {
    const pingTimeout = timeout ?? this.config.defaultTimeout;
    const startTime = Date.now();

    try {
      const socket = await this.createSocket(host, port, pingTimeout);
      const responseTime = Date.now() - startTime;
      socket.destroy();
      return {
        success: true,
        deviceId,
        responseTime,
        isOnline: true,
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ping failed';
      return {
        success: false,
        deviceId,
        responseTime: Date.now() - startTime,
        isOnline: false,
        timestamp: new Date(),
        error: message,
      };
    }
  }

  async discover(options?: DiscoveryOptions): Promise<{
    success: boolean; devices: DiscoveredDevice[]; count: number; timestamp: Date;
  }> {
    const ports = options?.ports ?? [9100, 631, 515, 4370];
    const timeout = options?.timeout ?? 2000;
    const maxConcurrent = options?.maxConcurrent ?? 50;
    const subnet = options?.subnet ?? this.getLocalSubnet();

    if (!subnet) {
      return { success: false, devices: [], count: 0, timestamp: new Date() };
    }

    const ipRange = this.generateIPRange(subnet);
    const discovered: DiscoveredDevice[] = [];

    // Build list of all scan targets
    const targets: { host: string; port: number }[] = [];
    for (const host of ipRange) {
      for (const port of ports) {
        targets.push({ host, port });
      }
    }

    // Scan with throttled concurrency
    for (let i = 0; i < targets.length; i += maxConcurrent) {
      const batch = targets.slice(i, i + maxConcurrent);
      const results = await Promise.all(
        batch.map(t => this.scanPort(t.host, t.port, timeout))
      );
      for (const result of results) {
        if (result) {
          discovered.push(result);
        }
      }
    }

    console.log(`[NetworkManager] Discovery complete: found ${discovered.length} devices on subnet ${subnet}`);

    return {
      success: true,
      devices: discovered,
      count: discovered.length,
      timestamp: new Date(),
    };
  }

  getConnectionStatus(deviceId: string): Omit<ActiveConnection, 'socket'> | undefined {
    const conn = this.connections.get(deviceId);
    if (!conn) return undefined;
    return {
      id: conn.id,
      deviceId: conn.deviceId,
      host: conn.host,
      port: conn.port,
      protocol: conn.protocol,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
      bytesWritten: conn.bytesWritten,
      bytesRead: conn.bytesRead,
      isAlive: conn.isAlive,
    };
  }

  getActiveConnections(): Map<string, ActiveConnection> {
    return this.connections;
  }

  isConnected(deviceId: string): boolean {
    const conn = this.connections.get(deviceId);
    return conn?.isAlive === true;
  }

  dispose(): void {
    this.disconnectAll();
    this.removeAllListeners();
  }

  // --- Private helpers ---

  private createSocket(host: string, port: number, timeout: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      const onError = (error: Error) => {
        socket.destroy();
        reject(error);
      };

      const onTimeout = () => {
        socket.destroy();
        reject(new Error(`Connection timeout to ${host}:${port}`));
      };

      socket.once('error', onError);
      socket.once('timeout', onTimeout);

      socket.connect(port, host, () => {
        socket.removeListener('error', onError);
        socket.removeListener('timeout', onTimeout);
        resolve(socket);
      });
    });
  }

  private getLocalSubnet(): string | null {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const addrs = interfaces[name];
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          // Extract /24 subnet: e.g., 192.168.1.105 -> 192.168.1
          const parts = addr.address.split('.');
          return `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
    }
    return null;
  }

  private generateIPRange(subnet: string): string[] {
    const ips: string[] = [];
    for (let i = 1; i <= 254; i++) {
      ips.push(`${subnet}.${i}`);
    }
    return ips;
  }

  private async scanPort(host: string, port: number, timeout: number): Promise<DiscoveredDevice | null> {
    const startTime = Date.now();
    try {
      const socket = await this.createSocket(host, port, timeout);
      const responseTime = Date.now() - startTime;
      socket.destroy();

      const portInfo = WELL_KNOWN_PORTS[port];
      return {
        host,
        port,
        responseTime,
        inferredType: (portInfo?.type as 'printer' | 'biometric' | 'network') ?? 'network',
        inferredProtocol: (portInfo?.protocol as 'socket' | 'ipp' | 'lpd' | 'tcp') ?? 'tcp',
      };
    } catch {
      return null;
    }
  }

  private emitDeviceEvent(event: DeviceEvent): void {
    this.emit('device-event', event);
  }
}
