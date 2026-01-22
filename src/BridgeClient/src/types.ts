export interface DeviceInfo {
  id: string;
  name: string;
  type: 'printer' | 'serial' | 'usbhid';
  status: 'available' | 'connected' | 'error';
  manufacturer: string;
  model: string;
  serialNumber: string;
  properties: Record<string, any>;
  lastSeen: Date;
  isConnected: boolean;
  connectionId?: string;
}

export interface PrinterDevice extends DeviceInfo {
  supportedProtocols: string[];
  maxPrintWidth: number;
  supportsColor: boolean;
  supportsDuplex: boolean;
  maxResolution: number;
  currentStatus: string;
  jobsInQueue: number;
}

export interface SerialPortDevice extends DeviceInfo {
  portName: string;
  baudRate: number;
  parity: string;
  dataBits: number;
  stopBits: string;
  flowControl: string;
  isOpen: boolean;
  bytesToRead: number;
  bytesToWrite: number;
}

export interface UsbHidDevice extends DeviceInfo {
  vendorId: number;
  productId: number;
  version: number;
  devicePath: string;
  inputReportLength: number;
  outputReportLength: number;
  featureReportLength: number;
  isOpen: boolean;
}

export interface ConnectionConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id?: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface PrintJob {
  id: string;
  deviceId: string;
  data: string;
  format: 'raw' | 'escpos' | 'zpl' | 'epl';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  options?: Record<string, any>;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  bytesPrinted?: number;
  error?: string;
  timestamp: Date;
}

export interface SerialPortConfig {
  baudRate: number;
  parity: 'None' | 'Odd' | 'Even' | 'Mark' | 'Space';
  dataBits: 7 | 8;
  stopBits: '1' | '1.5' | '2';
  flowControl: 'None' | 'XOnXOff' | 'RequestToSend' | 'RequestToSendXOnXOff';
}

export interface SerialData {
  deviceId: string;
  data: string;
  timestamp: Date;
  direction: 'send' | 'receive';
  bytesTransferred: number;
}

export interface UsbHidReport {
  deviceId: string;
  reportId: number;
  data: string;
  timestamp: Date;
  reportType: 'input' | 'output' | 'feature';
}

export interface QueueJob {
  id: string;
  deviceId: string;
  deviceType: string;
  operation: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  parameters?: Record<string, any>;
}

export interface QueueStatus {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  lastProcessed: Date;
  averageProcessingTime: number;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error' | 'no_devices';
  timestamp: Date;
  totalDevices: number;
  connectedDevices: number;
  activeConnections: number;
  jobsInQueue: number;
  cpuUsage: number;
  memoryUsage: number;
  deviceHealth: Record<string, any>;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error?: string;
  reconnectAttempts: number;
  lastConnectionTime?: Date;
}

export interface DeviceEvent {
  eventType: 'connected' | 'disconnected' | 'discovered' | 'removed' | 'status_changed' | 'error' | 'data';
  deviceId: string;
  deviceType: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface ClientOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
  debug?: boolean;
  protocols?: string[];
  headers?: Record<string, string>;
}

export type DeviceType = 'printer' | 'serial' | 'usbhid';
export type PrintFormat = 'raw' | 'escpos' | 'zpl' | 'epl';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';