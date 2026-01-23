export interface DeviceInfo {
  id: string;
  name: string;
  type: 'printer' | 'serial' | 'usbhid' | 'network' | 'biometric';
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

export interface NetworkDevice extends DeviceInfo {
  host: string;
  port: number;
  protocol: 'tcp' | 'udp' | 'http' | 'https';
  connectionType: 'wifi' | 'ethernet' | 'bluetooth';
  macAddress?: string;
  ipAddress?: string;
  isOnline: boolean;
  lastPingTime?: Date;
  networkInterface?: string;
}

export interface NetworkPrinterDevice extends NetworkDevice, PrinterDevice {
  printProtocol: 'ipp' | 'lpd' | 'socket' | 'http';
  supportsIPP: boolean;
  supportsAirPrint: boolean;
  supportsGoogleCloudPrint: boolean;
  printerUri?: string;
  queueName?: string;
}

export interface BiometricDevice extends NetworkDevice {
  biometricType: 'fingerprint' | 'face' | 'iris' | 'voice' | 'palm';
  supportedTemplates: string[];
  maxUsers: number;
  currentUsers: number;
  authenticationMethods: string[];
  securityLevel: 'low' | 'medium' | 'high' | 'maximum';
  isEnrolled: boolean;
  enrollmentStatus?: 'enrolling' | 'enrolled' | 'failed';
  lastAuthentication?: Date;
  failedAttempts: number;
  lockoutEndTime?: Date;
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

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  bytesPrinted?: number;
  error?: string;
  timestamp: Date;
}

export interface SerialDataResult {
  success: boolean;
  bytesTransferred: number;
  data: string;
  error?: string;
  timestamp: Date;
}

export interface UsbHidReportResult {
  success: boolean;
  reportId: number;
  bytesTransferred: number;
  data: string;
  error?: string;
  timestamp: Date;
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

export interface ServerConfig {
  port: number;
  host: string;
  useTls: boolean;
  certPath?: string;
  keyPath?: string;
  allowedOrigins: string[];
  maxConnections: number;
  databasePath: string;
  logLevel: string;
}

export interface DeviceEvent {
  eventType: 'connected' | 'disconnected' | 'discovered' | 'removed' | 'status_changed' | 'error' | 'data';
  deviceId: string;
  deviceType: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface NetworkDeviceConfig {
  host: string;
  port: number;
  protocol: 'tcp' | 'udp' | 'http' | 'https';
  timeout?: number;
  retryAttempts?: number;
  authentication?: {
    type: 'basic' | 'bearer' | 'apikey';
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
  };
  ssl?: {
    enabled: boolean;
    verifyCertificate?: boolean;
    clientCertificate?: string;
    clientKey?: string;
  };
}

export interface BiometricConfig {
  securityLevel: 'low' | 'medium' | 'high' | 'maximum';
  timeout: number;
  retryAttempts: number;
  livenessDetection: boolean;
  templateFormat: 'iso' | 'ansi' | 'custom';
  maxUsers: number;
  authenticationMethods: string[];
}

export interface BiometricEnrollmentRequest {
  userId: string;
  userName: string;
  biometricData: string;
  backupData?: string;
  metadata?: Record<string, any>;
}

export interface BiometricAuthenticationRequest {
  userId?: string;
  biometricData: string;
  authenticationType: 'verify' | 'identify';
  timeout?: number;
}

export interface BiometricResult {
  success: boolean;
  userId?: string;
  userName?: string;
  confidence: number;
  matchScore?: number;
  authenticationTime: number;
  error?: string;
  attemptsRemaining?: number;
  lockoutTime?: number;
}