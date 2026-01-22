#!/usr/bin/env node

import { CrossPlatformWebSocketServer } from './websocket-server.js';
import { DatabaseManager } from './database-manager.js';
import { ServerConfig } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

class CrossPlatformHardwareBridgeServer {
  private wsServer: CrossPlatformWebSocketServer;
  private dbManager: DatabaseManager;
  private config: ServerConfig;

  constructor() {
    this.config = this.loadConfig();
    this.wsServer = new CrossPlatformWebSocketServer(this.config);
    this.dbManager = new DatabaseManager(this.config.databasePath);
  }

  private loadConfig(): ServerConfig {
    const configPath = path.join(process.cwd(), 'config.json');
    const defaultConfig: ServerConfig = {
      port: 8443,
      host: 'localhost',
      useTls: false,
      allowedOrigins: ['*'],
      maxConnections: 100,
      databasePath: 'data/queue.db',
      logLevel: 'info'
    };

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const userConfig = JSON.parse(configData);
        return { ...defaultConfig, ...userConfig };
      }
    } catch (error) {
      console.warn('Error loading config file, using defaults:', error);
    }

    return defaultConfig;
  }

  async start(): Promise<void> {
    try {
      console.log('Starting Cross-Platform Hardware Bridge Server...');
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.config.databasePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database
      await this.dbManager.initialize();
      console.log('Database initialized');

      // Start WebSocket server
      await this.wsServer.start();
      console.log(`WebSocket server started on ${this.config.host}:${this.config.port}`);

      // Set up database integration
      this.setupDatabaseIntegration();

      console.log('Cross-Platform Hardware Bridge Server is running');
      console.log(`WebSocket URL: ws://${this.config.host}:${this.config.port}`);
      console.log('Press Ctrl+C to stop');

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupDatabaseIntegration(): void {
    // Override WebSocket server methods to use database
    const originalPrint = (this.wsServer as any).print.bind(this.wsServer);
    (this.wsServer as any).print = async (params: any, connectionId: string) => {
      const result = await originalPrint(params, connectionId);
      
      // Add job to queue
      if (result.success) {
        await this.dbManager.addJob(
          params.deviceId,
          'printer',
          'print',
          { data: params.data, format: params.format }
        );
      }
      
      return result;
    };

    (this.wsServer as any).getQueueStatus = async () => {
      return await this.dbManager.getQueueStatus();
    };

    (this.wsServer as any).getQueueJobs = async (params: any) => {
      return await this.dbManager.getJobs(
        params?.deviceId,
        params?.status,
        params?.limit || 100
      );
    };

    (this.wsServer as any).cancelQueueJob = async (params: any) => {
      const jobId = params?.jobId;
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      await this.dbManager.updateJobStatus(jobId, 'cancelled');
      return { success: true };
    };
  }

  async stop(): Promise<void> {
    console.log('Stopping Cross-Platform Hardware Bridge Server...');
    
    try {
      await this.wsServer.stop();
      await this.dbManager.close();
      console.log('Server stopped successfully');
    } catch (error) {
      console.error('Error stopping server:', error);
    }
  }
}

// Main execution
async function main() {
  const server = new CrossPlatformHardwareBridgeServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();
}

// Run the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CrossPlatformHardwareBridgeServer };