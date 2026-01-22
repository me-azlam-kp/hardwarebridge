import { 
  ConnectionConfig, 
  ConnectionState, 
  ConnectionStatus, 
  JsonRpcRequest, 
  JsonRpcResponse, 
  ClientOptions,
  DeviceEvent 
} from '../types';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private options: ClientOptions;
  private connectionState: ConnectionState;
  private connectionListeners: Array<(state: ConnectionState) => void> = [];
  private messageListeners: Array<(message: JsonRpcResponse) => void> = [];
  private deviceEventListeners: Array<(event: DeviceEvent) => void> = [];
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private messageId = 0;
  private pendingRequests = new Map<string | number, { resolve: Function; reject: Function; timeout: any }>();

  constructor(config: ConnectionConfig, options: ClientOptions = {}) {
    this.config = config;
    this.options = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      timeout: 30000,
      debug: false,
      protocols: ['jsonrpc-2.0'],
      ...options
    };
    
    this.connectionState = {
      connected: false,
      connecting: false,
      reconnectAttempts: 0
    };
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): void {
    this.connectionListeners.push(listener);
  }

  onMessage(listener: (message: JsonRpcResponse) => void): void {
    this.messageListeners.push(listener);
  }

  onDeviceEvent(listener: (event: DeviceEvent) => void): void {
    this.deviceEventListeners.push(listener);
  }

  get isConnected(): boolean {
    return this.connectionState.connected;
  }

  get isConnecting(): boolean {
    return this.connectionState.connecting;
  }

  getConnectionStatus(): ConnectionStatus {
    if (this.connectionState.connecting) return 'connecting';
    if (this.connectionState.connected) return 'connected';
    if (this.connectionState.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.updateConnectionState({ connecting: true });

    try {
      await this.createWebSocket();
      this.updateConnectionState({ 
        connected: true, 
        connecting: false,
        reconnectAttempts: 0,
        lastConnectionTime: new Date()
      });
      this.startPingTimer();
      this.log('Connected to WebSocket server');
    } catch (error) {
      this.updateConnectionState({ connecting: false, error: (error as Error).message });
      this.log('Failed to connect to WebSocket server', error);
      
      if (this.options.autoReconnect) {
        this.scheduleReconnect();
      }
      
      throw error;
    }
  }

  disconnect(): void {
    this.log('Disconnecting from WebSocket server');
    
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.updateConnectionState({ 
      connected: false, 
      connecting: false,
      error: undefined
    });
  }

  async sendRequest<T = any>(method: string, params?: any): Promise<T> {
    if (!this.isConnected) {
      throw new Error('WebSocket client is not connected');
    }

    const id = ++this.messageId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      try {
        this.sendMessage(request);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  sendNotification(method: string, params?: any): void {
    if (!this.isConnected) {
      throw new Error('WebSocket client is not connected');
    }

    const notification: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(notification);
  }

  private async createWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocols = this.options.protocols || [];
        const ws = new WebSocket(this.config.url, protocols);
        
        ws.onopen = () => {
          this.log('WebSocket connection opened');
          resolve();
        };
        
        ws.onclose = (event) => {
          this.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
          this.handleDisconnect();
        };
        
        ws.onerror = (error) => {
          this.log('WebSocket error', error);
          reject(new Error('WebSocket connection failed'));
        };
        
        ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws = ws;
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message: JsonRpcResponse = JSON.parse(data);
      
      if (message.jsonrpc !== '2.0') {
        this.log('Invalid JSON-RPC message received', message);
        return;
      }
      
      // Handle responses to requests
      if (message.id !== undefined && message.id !== null) {
        const pendingRequest = this.pendingRequests.get(message.id);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            pendingRequest.reject(new Error(`JSON-RPC Error ${message.error.code}: ${message.error.message}`));
          } else {
            pendingRequest.resolve(message.result);
          }
        }
      }
      
      // Handle notifications and broadcast messages
      if (message.id === undefined || message.id === null) {
        // Notify message listeners
        this.messageListeners.forEach(listener => listener(message));
        
        // Handle device events (check if it's a notification with method and params)
        const notification = message as any;
        if (notification.method === 'device.event' && notification.params) {
          const deviceEvent = notification.params as DeviceEvent;
          this.deviceEventListeners.forEach(listener => listener(deviceEvent));
        }
      }
      
    } catch (error) {
      this.log('Error parsing WebSocket message', error);
    }
  }

  private handleDisconnect(): void {
    this.cleanup();
    
    this.updateConnectionState({ 
      connected: false, 
      connecting: false 
    });
    
    if (this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    
    const currentState = this.connectionState;
    if (currentState.reconnectAttempts >= (this.options.maxReconnectAttempts || 10)) {
      this.log('Max reconnection attempts reached');
      return;
    }
    
    const nextAttempt = currentState.reconnectAttempts + 1;
    this.log(`Scheduling reconnection attempt ${nextAttempt}`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.updateConnectionState({ reconnectAttempts: nextAttempt });
      this.connect().catch(() => {
        // Reconnection failed, will be handled by scheduleReconnect
      });
    }, this.options.reconnectInterval);
  }

  private startPingTimer(): void {
    if (this.pingTimer) {
      return;
    }
    
    // Send ping every 30 seconds to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        try {
          this.sendNotification('ping');
        } catch (error) {
          this.log('Ping failed', error);
        }
      }
    }, 30000);
  }

  private cleanup(): void {
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    // Clear pending requests
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  private sendMessage(message: JsonRpcRequest): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    const data = JSON.stringify(message);
    this.ws.send(data);
    this.log(`Sent message: ${message.method}`);
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.connectionListeners.forEach(listener => listener(this.connectionState));
  }

  private log(message: string, data?: any): void {
    if (this.options.debug) {
      console.log(`[HardwareBridge] ${message}`, data);
    }
  }

  dispose(): void {
    this.log('Disposing WebSocket client');
    this.disconnect();
    
    this.connectionListeners = [];
    this.messageListeners = [];
    this.deviceEventListeners = [];
  }
}