/**
 * Server Manager for Hardware Bridge Control Center
 * Handles actual server process startup and shutdown
 */

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ServerManager {
  constructor() {
    this.serverProcess = null;
    this.serverPort = 9443;
  }

  /**
   * Start the Hardware Bridge server
   */
  async startServer(options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.serverProcess) {
          return reject(new Error('Server is already running'));
        }

        let port = options.port || this.serverPort;
        
        // Check if default port is in use, find alternative if needed
        const portInUse = await this.checkPort(port);
        if (portInUse) {
          console.log(`⚠️ Port ${port} is in use, finding alternative...`);
          port = await this.findAvailablePort(port + 1);
          console.log(`✅ Found available port: ${port}`);
        }
        
        console.log(`🔄 Starting Hardware Bridge server on port ${port}...`);

        // Try to start the server using tsx (TypeScript executor)
        // Pass the port as an environment variable or command line argument
        this.serverProcess = spawn('npx', ['tsx', 'src/server.ts'], {
          cwd: join(__dirname, '../../src/CrossPlatformServer'),
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
          env: { ...process.env, SERVER_PORT: port.toString() }
        });

        let startupComplete = false;

        this.serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log('Server output:', output);
          
          // Check for successful startup indicators
          if (output.includes('WebSocket server started') || 
              output.includes('Server started') || 
              output.includes('listening')) {
            startupComplete = true;
            console.log('✅ Server started successfully');
            resolve({
              success: true,
              pid: this.serverProcess.pid,
              port: port
            });
          }
        });

        this.serverProcess.stderr.on('data', (data) => {
          const error = data.toString();
          console.error('Server error:', error);
          
          if (!startupComplete && error.includes('EADDRINUSE')) {
            reject(new Error(`Port ${port} is already in use`));
          } else if (!startupComplete && error.includes('error')) {
            reject(new Error(`Server startup failed: ${error}`));
          }
        });

        this.serverProcess.on('error', (error) => {
          console.error('❌ Server process error:', error);
          reject(new Error(`Failed to start server: ${error.message}`));
        });

        this.serverProcess.on('exit', (code, signal) => {
          console.log(`Server process exited with code ${code} and signal ${signal}`);
          this.serverProcess = null;
          
          if (!startupComplete && code !== 0) {
            reject(new Error(`Server exited with code ${code}`));
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!startupComplete) {
            this.stopServer();
            reject(new Error('Server startup timeout - took too long to start'));
          }
        }, 30000);

      } catch (error) {
        reject(new Error(`Server startup error: ${error.message}`));
      }
    });
  }

  /**
   * Stop the Hardware Bridge server
   */
  async stopServer() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.serverProcess) {
          return resolve({ success: true, message: 'Server is not running' });
        }

        console.log('🔄 Stopping Hardware Bridge server...');

        // Try graceful shutdown first
        this.serverProcess.kill('SIGTERM');

        // Force kill after 5 seconds if not stopped
        const forceKillTimeout = setTimeout(() => {
          if (this.serverProcess) {
            console.log('⚠️ Force killing server process...');
            this.serverProcess.kill('SIGKILL');
          }
        }, 5000);

        this.serverProcess.on('exit', (code, signal) => {
          clearTimeout(forceKillTimeout);
          this.serverProcess = null;
          console.log('✅ Server stopped successfully');
          resolve({
            success: true,
            message: 'Server stopped successfully',
            exitCode: code,
            signal: signal
          });
        });

      } catch (error) {
        reject(new Error(`Server stop error: ${error.message}`));
      }
    });
  }

  /**
   * Check if server is running
   */
  isRunning() {
    return this.serverProcess !== null;
  }

  /**
   * Get server process ID
   */
  getProcessId() {
    return this.serverProcess ? this.serverProcess.pid : null;
  }

  /**
   * Check if port is in use
   */
  async checkPort(port = this.serverPort) {
    return new Promise((resolve) => {
      import('net').then(net => {
        const server = net.createServer();
        
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(true); // Port is in use
          } else {
            resolve(false);
          }
        });
        
        server.once('listening', () => {
          server.close();
          resolve(false); // Port is available
        });
        
        server.listen(port);
      }).catch(() => {
        resolve(false); // Assume port is available if net module fails
      });
    });
  }

  /**
   * Find available port
   */
  async findAvailablePort(startPort = this.serverPort) {
    let port = startPort;
    
    while (port < startPort + 100) { // Check up to 100 ports
      const inUse = await this.checkPort(port);
      if (!inUse) {
        return port;
      }
      port++;
    }
    
    throw new Error(`No available ports found between ${startPort} and ${port - 1}`);
  }

  /**
   * Get server status
   */
  async getServerStatus() {
    const isRunning = this.isRunning();
    const pid = this.getProcessId();
    const portInUse = isRunning ? await this.checkPort() : false;
    
    return {
      running: isRunning,
      pid: pid,
      port: this.serverPort,
      portInUse: portInUse,
      serverPath: join(__dirname, '../../src/CrossPlatformServer/src/server.ts')
    };
  }
}

export default ServerManager;