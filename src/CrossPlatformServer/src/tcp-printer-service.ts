import * as net from 'net';
import { NetworkDeviceManager } from './network-device-manager.js';
import { PrintResult } from './types.js';
import { PrintJobState } from './network-types.js';

interface PrintOptions {
  format?: 'raw' | 'escpos' | 'zpl' | 'epl';
  copies?: number;
  timeout?: number;
}

export class TcpPrinterService {
  private networkManager: NetworkDeviceManager;
  private activeJobs = new Map<string, PrintJobState>();

  constructor(networkManager: NetworkDeviceManager) {
    this.networkManager = networkManager;
  }

  /**
   * Print data to a network printer via RAW socket (port 9100).
   * Opens a temporary connection, sends data, and closes.
   */
  async printRaw(
    deviceId: string,
    host: string,
    port: number,
    data: string | Buffer,
    options?: PrintOptions
  ): Promise<PrintResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const timeout = options?.timeout ?? 10000;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const jobState: PrintJobState = {
      jobId,
      deviceId,
      status: 'sending',
      bytesSent: 0,
      totalBytes: buffer.length,
      startedAt: new Date(),
    };
    this.activeJobs.set(jobId, jobState);

    try {
      // Check if device is already connected via the network manager
      if (this.networkManager.isConnected(deviceId)) {
        const result = await this.networkManager.sendData(deviceId, buffer);
        if (result.success) {
          jobState.status = 'sent';
          jobState.bytesSent = result.bytesWritten;
          jobState.completedAt = new Date();
          return {
            success: true,
            jobId,
            bytesPrinted: result.bytesWritten,
            timestamp: new Date(),
          };
        } else {
          jobState.status = 'error';
          jobState.error = result.error;
          return {
            success: false,
            jobId,
            bytesPrinted: 0,
            error: result.error,
            timestamp: new Date(),
          };
        }
      }

      // Otherwise, open a temporary socket for this print job
      const result = await this.sendViaTemporarySocket(host, port, buffer, timeout);

      if (result.success) {
        jobState.status = 'sent';
        jobState.bytesSent = result.bytesWritten;
        jobState.completedAt = new Date();
        return {
          success: true,
          jobId,
          bytesPrinted: result.bytesWritten,
          timestamp: new Date(),
        };
      } else {
        jobState.status = 'error';
        jobState.error = result.error;
        return {
          success: false,
          jobId,
          bytesPrinted: 0,
          error: result.error,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print failed';
      jobState.status = 'error';
      jobState.error = message;
      return {
        success: false,
        jobId,
        bytesPrinted: 0,
        error: message,
        timestamp: new Date(),
      };
    }
  }

  getJobStatus(jobId: string): PrintJobState | undefined {
    return this.activeJobs.get(jobId);
  }

  getActiveJobs(): PrintJobState[] {
    return Array.from(this.activeJobs.values()).filter(j => j.status === 'sending');
  }

  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'sending') return false;
    job.status = 'error';
    job.error = 'Cancelled';
    return true;
  }

  dispose(): void {
    this.activeJobs.clear();
  }

  // --- Private ---

  private sendViaTemporarySocket(
    host: string,
    port: number,
    data: Buffer,
    timeout: number
  ): Promise<{ success: boolean; bytesWritten: number; error?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      let resolved = false;
      const finish = (result: { success: boolean; bytesWritten: number; error?: string }) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve(result);
      };

      socket.on('error', (error) => {
        finish({ success: false, bytesWritten: 0, error: error.message });
      });

      socket.on('timeout', () => {
        finish({ success: false, bytesWritten: 0, error: `Connection timeout to ${host}:${port}` });
      });

      socket.connect(port, host, () => {
        socket.write(data, (error) => {
          if (error) {
            finish({ success: false, bytesWritten: 0, error: error.message });
          } else {
            // Give the printer a moment to accept the data before closing
            setTimeout(() => {
              finish({ success: true, bytesWritten: data.length });
            }, 200);
          }
        });
      });
    });
  }
}
