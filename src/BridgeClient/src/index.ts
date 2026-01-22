// Core exports
export { HardwareBridgeClient } from './core/hardware-bridge-client';
export { WebSocketClient } from './core/websocket-client';

// Type exports
export type {
  DeviceInfo,
  PrinterDevice,
  SerialPortDevice,
  UsbHidDevice,
  ConnectionConfig,
  ConnectionState,
  ConnectionStatus,
  ClientOptions,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  PrintJob,
  PrintResult,
  PrintFormat,
  SerialPortConfig,
  SerialData,
  UsbHidReport,
  QueueJob,
  QueueStatus,
  SystemHealth,
  DeviceEvent,
  DeviceType,
  JobStatus,
  ConnectionStatus as ConnectionStatusType
} from './types';

// Version
export const VERSION = '1.0.0';

// Default export
// Default export removed due to TypeScript compilation issues