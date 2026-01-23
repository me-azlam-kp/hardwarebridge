import { PrinterDevice, SerialPortDevice } from './types.js';

export interface ActiveConnection {
  id: string;
  deviceId: string;
  socket: import('net').Socket;
  host: string;
  port: number;
  protocol: 'tcp';
  connectedAt: Date;
  lastActivity: Date;
  bytesWritten: number;
  bytesRead: number;
  isAlive: boolean;
}

export interface DiscoveryOptions {
  subnet?: string;
  ports?: number[];
  timeout?: number;
  maxConcurrent?: number;
}

export interface DiscoveredDevice {
  host: string;
  port: number;
  responseTime: number;
  inferredType: 'printer' | 'biometric' | 'network';
  inferredProtocol: 'socket' | 'ipp' | 'lpd' | 'tcp';
}

export interface PingResult {
  success: boolean;
  deviceId: string;
  responseTime: number;
  isOnline: boolean;
  timestamp: Date;
  error?: string;
}

export interface PrintJobState {
  jobId: string;
  deviceId: string;
  status: 'sending' | 'sent' | 'error';
  bytesSent: number;
  totalBytes: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface EnumerationResult {
  printers: PrinterDevice[];
  serialPorts: SerialPortDevice[];
  timestamp: Date;
  platform: string;
}

export const WELL_KNOWN_PORTS: Record<number, { type: 'printer' | 'biometric' | 'network'; protocol: string; description: string }> = {
  9100: { type: 'printer', protocol: 'socket', description: 'RAW/JetDirect' },
  631: { type: 'printer', protocol: 'ipp', description: 'IPP (CUPS)' },
  515: { type: 'printer', protocol: 'lpd', description: 'LPD/LPR' },
  4370: { type: 'biometric', protocol: 'tcp', description: 'ZKTeco attendance' },
};
