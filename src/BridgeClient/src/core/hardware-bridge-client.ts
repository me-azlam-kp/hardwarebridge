import { WebSocketClient } from './websocket-client';
import {
  DeviceInfo,
  PrintResult,
  PrintFormat,
  SerialPortConfig,
  QueueJob,
  QueueStatus,
  SystemHealth,
  DeviceEvent,
  ConnectionConfig,
  ClientOptions
} from '../types';

export class HardwareBridgeClient {
  private wsClient: WebSocketClient;
  private options: ClientOptions;

  constructor(config: ConnectionConfig, options: ClientOptions = {}) {
    this.options = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      timeout: 30000,
      debug: false,
      ...options
    };
    
    this.wsClient = new WebSocketClient(config, this.options);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward device events
    this.wsClient.onDeviceEvent((event: DeviceEvent) => {
      this.onDeviceEvent(event);
    });
  }

  // Connection Management
  async connect(): Promise<void> {
    return this.wsClient.connect();
  }

  disconnect(): void {
    this.wsClient.disconnect();
  }

  get isConnected(): boolean {
    return this.wsClient.isConnected;
  }

  get isConnecting(): boolean {
    return this.wsClient.isConnecting;
  }

  getConnectionStatus(): string {
    return this.wsClient.getConnectionStatus();
  }

  onConnectionStateChange(listener: (connected: boolean) => void): void {
    this.wsClient.onConnectionStateChange((state) => {
      listener(state.connected);
    });
  }

  // Device Discovery
  async enumerateDevices(): Promise<DeviceInfo[]> {
    const result = await this.wsClient.sendRequest<{ devices: DeviceInfo[] }>('devices.enumerate');
    return result.devices;
  }

  async getDevice(deviceId: string): Promise<DeviceInfo> {
    return this.wsClient.sendRequest<DeviceInfo>('devices.get', { deviceId });
  }

  async watchDevices(): Promise<void> {
    return this.wsClient.sendRequest('devices.watch');
  }

  async unwatchDevices(): Promise<void> {
    return this.wsClient.sendRequest('devices.unwatch');
  }

  // Printer Operations
  async print(deviceId: string, data: string, format: PrintFormat = 'raw'): Promise<PrintResult> {
    return this.wsClient.sendRequest<PrintResult>('printer.print', {
      deviceId,
      data,
      format
    });
  }

  async getPrinterStatus(deviceId: string): Promise<{
    isConnected: boolean;
    status: string;
    isReady: boolean;
    isBusy: boolean;
    isPaused: boolean;
    jobsInQueue: number;
    error?: string;
    timestamp: Date;
  }> {
    return this.wsClient.sendRequest('printer.getStatus', { deviceId });
  }

  async getPrinterCapabilities(deviceId: string): Promise<{
    supportedProtocols: string[];
    maxPrintWidth: number;
    supportsColor: boolean;
    supportsDuplex: boolean;
    maxResolution: number;
    maxJobSize: number;
    error?: string;
  }> {
    return this.wsClient.sendRequest('printer.getCapabilities', { deviceId });
  }

  // Serial Port Operations
  async openSerialPort(deviceId: string, config: SerialPortConfig): Promise<{
    success: boolean;
    portName?: string;
    config?: SerialPortConfig;
    openedAt?: Date;
    error?: string;
  }> {
    return this.wsClient.sendRequest('serial.open', {
      deviceId,
      ...config
    });
  }

  async closeSerialPort(deviceId: string): Promise<{
    success: boolean;
    portName?: string;
    closedAt?: Date;
    error?: string;
  }> {
    return this.wsClient.sendRequest('serial.close', { deviceId });
  }

  async sendSerialData(deviceId: string, data: string): Promise<{
    success: boolean;
    bytesTransferred: number;
    data: string;
    error?: string;
    timestamp: Date;
  }> {
    return this.wsClient.sendRequest('serial.send', { deviceId, data });
  }

  async receiveSerialData(deviceId: string, maxBytes: number = 1024, timeout: number = 10000): Promise<{
    success: boolean;
    bytesTransferred: number;
    data: string;
    error?: string;
    timestamp: Date;
  }> {
    return this.wsClient.sendRequest('serial.receive', { deviceId, maxBytes, timeout });
  }

  async getSerialPortStatus(deviceId: string): Promise<{
    isConnected: boolean;
    status: string;
    portName?: string;
    baudRate?: number;
    parity?: string;
    dataBits?: number;
    stopBits?: string;
    flowControl?: string;
    bytesToRead?: number;
    bytesToWrite?: number;
    isOpen?: boolean;
    cdHolding?: boolean;
    ctsHolding?: boolean;
    dsrHolding?: boolean;
    connectedAt?: Date;
    lastActivity?: Date;
    error?: string;
  }> {
    return this.wsClient.sendRequest('serial.getStatus', { deviceId });
  }

  // USB HID Operations
  async openUsbDevice(deviceId: string): Promise<{
    success: boolean;
    deviceId: string;
    vendorId?: number;
    productId?: number;
    openedAt?: Date;
    error?: string;
  }> {
    return this.wsClient.sendRequest('usb.open', { deviceId });
  }

  async closeUsbDevice(deviceId: string): Promise<{
    success: boolean;
    deviceId: string;
    closedAt?: Date;
    error?: string;
  }> {
    return this.wsClient.sendRequest('usb.close', { deviceId });
  }

  async sendUsbReport(deviceId: string, reportId: number, data: string): Promise<{
    success: boolean;
    reportId: number;
    bytesTransferred: number;
    data: string;
    error?: string;
    timestamp: Date;
  }> {
    return this.wsClient.sendRequest('usb.sendReport', { deviceId, reportId, data });
  }

  async receiveUsbReport(deviceId: string, reportId: number, timeout: number = 5000): Promise<{
    success: boolean;
    reportId: number;
    bytesTransferred: number;
    data: string;
    error?: string;
    timestamp: Date;
  }> {
    return this.wsClient.sendRequest('usb.receiveReport', { deviceId, reportId, timeout });
  }

  async getUsbDeviceStatus(deviceId: string): Promise<{
    isConnected: boolean;
    status: string;
    deviceId: string;
    vendorId?: number;
    productId?: number;
    version?: number;
    isOpen?: boolean;
    inputReportLength?: number;
    outputReportLength?: number;
    featureReportLength?: number;
    connectedAt?: Date;
    lastActivity?: Date;
    error?: string;
  }> {
    return this.wsClient.sendRequest('usb.getStatus', { deviceId });
  }

  // Queue Management
  async getQueueStatus(): Promise<QueueStatus> {
    return this.wsClient.sendRequest('queue.getStatus');
  }

  async getQueueJobs(deviceId?: string, status?: string, limit: number = 100): Promise<QueueJob[]> {
    return this.wsClient.sendRequest('queue.getJobs', { deviceId, status, limit });
  }

  async cancelQueueJob(jobId: string): Promise<boolean> {
    return this.wsClient.sendRequest('queue.cancelJob', { jobId });
  }

  // System Information
  async getSystemInfo(): Promise<{
    version: string;
    platform: string;
    timestamp: Date;
    uptime: number;
  }> {
    return this.wsClient.sendRequest('system.getInfo');
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return this.wsClient.sendRequest('system.getHealth');
  }

  // Event Handlers
  onDeviceEvent(event: DeviceEvent): void {
    // This can be overridden by subclasses or used to emit events
    console.log('Device event:', event);
  }

  // Utility Methods
  async waitForConnection(timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  dispose(): void {
    this.wsClient.dispose();
  }
}