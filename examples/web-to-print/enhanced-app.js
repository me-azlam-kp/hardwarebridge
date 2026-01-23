/**
 * Enhanced Hardware Bridge Control Center
 * Browser-compatible WebSocket client using JSON-RPC 2.0
 * Connects to an already-running Hardware Bridge server
 */

class HardwareBridgeControlCenter {
  constructor() {
    this.ws = null;
    this.devices = [];
    this.deviceSource = 'unknown';
    this.isConnected = false;
    this.refreshInterval = null;
    this.pendingRequests = new Map();
    this.requestId = 0;

    this.initializeApp();
  }

  /**
   * Initialize the application
   */
  initializeApp() {
    this.log('Hardware Bridge Control Center initialized', 'info');
    this.setupEventListeners();
    this.updateServerStatus(false);
    this.updateStatistics();
    this.log('Application ready - click "Connect" to connect to server', 'success');
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    document.getElementById('startServerBtn').addEventListener('click', () => this.connectToServer());
    document.getElementById('stopServerBtn').addEventListener('click', () => this.disconnectFromServer());
    document.getElementById('refreshDevicesBtn').addEventListener('click', () => this.refreshDevices());
    document.getElementById('discoverNetworkBtn').addEventListener('click', () => this.discoverNetworkDevices());
    document.getElementById('serverUrl').addEventListener('change', () => this.updateServerUrl());
  }

  /**
   * Connect to the Hardware Bridge WebSocket server
   */
  async connectToServer() {
    try {
      const serverUrl = document.getElementById('serverUrl').value;
      this.log(`Connecting to ${serverUrl}...`, 'info');
      this.updateServerStatus('starting');

      this.ws = new WebSocket(serverUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.updateServerStatus(true);
        this.log('Connected to server successfully', 'success');
        this.startAutoRefresh();
        this.refreshDevices();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        this.log('WebSocket error occurred', 'error');
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.updateServerStatus(false);
        this.stopAutoRefresh();
        this.rejectAllPending('Connection closed');
        if (event.wasClean) {
          this.log(`Disconnected (code: ${event.code})`, 'info');
        } else {
          this.log('Connection lost unexpectedly', 'error');
        }
      };

    } catch (error) {
      this.log(`Connection failed: ${error.message}`, 'error');
      this.updateServerStatus(false);
    }
  }

  /**
   * Disconnect from the server
   */
  disconnectFromServer() {
    this.stopAutoRefresh();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
    this.updateServerStatus(false);
    this.clearDevices();
    this.log('Disconnected from server', 'info');
  }

  /**
   * Send a JSON-RPC 2.0 request and return a promise for the response
   */
  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to server'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };

      this.pendingRequests.set(id, { resolve, reject, method });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);

      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      // Handle JSON-RPC response
      if (message.id !== undefined && message.id !== null) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error.message || 'Unknown error'));
          } else {
            pending.resolve(message.result);
          }
        }
        return;
      }

      // Handle JSON-RPC notification (device events)
      if (message.method === 'device.event' && message.params) {
        this.handleDeviceEvent(message.params);
      }

    } catch (error) {
      this.log(`Failed to parse message: ${error.message}`, 'error');
    }
  }

  /**
   * Handle device event notifications from server
   */
  handleDeviceEvent(event) {
    const { eventType, deviceId, deviceType } = event;
    switch (eventType) {
      case 'connected':
        this.log(`Device connected: ${deviceId} (${deviceType})`, 'success');
        this.refreshDevices();
        break;
      case 'disconnected':
        this.log(`Device disconnected: ${deviceId} (${deviceType})`, 'warning');
        this.refreshDevices();
        break;
      case 'error':
        this.log(`Device error: ${deviceId} - ${event.data?.error || 'Unknown'}`, 'error');
        break;
    }
  }

  /**
   * Reject all pending requests
   */
  rejectAllPending(reason) {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  /**
   * Refresh device list from server
   */
  async refreshDevices() {
    if (!this.isConnected) {
      this.log('Cannot refresh devices - not connected', 'warning');
      return;
    }

    try {
      this.log('Refreshing device list...', 'info');
      const result = await this.sendRequest('devices.enumerate');
      this.devices = result.devices || [];
      this.deviceSource = result.source || 'unknown';
      this.renderDevices();
      this.updateStatistics();

      if (this.deviceSource === 'simulated') {
        this.log(`Found ${this.devices.length} simulated devices (no real hardware detected)`, 'warning');
      } else {
        this.log(`Found ${this.devices.length} real devices`, 'success');
      }
    } catch (error) {
      this.log(`Device refresh failed: ${error.message}`, 'error');
    }
  }

  /**
   * Discover network devices via subnet scan
   */
  async discoverNetworkDevices() {
    if (!this.isConnected) {
      this.log('Cannot discover network devices - not connected', 'warning');
      return;
    }

    try {
      this.log('Discovering network devices (scanning subnet)...', 'info');
      const result = await this.sendRequest('network.discover', {
        ports: [9100, 631, 515, 4370],
        timeout: 2000
      });

      if (result.success) {
        const networkDevices = result.devices || [];
        this.log(`Found ${networkDevices.length} network devices`, 'success');

        if (networkDevices.length > 0) {
          // Merge discovered devices avoiding duplicates
          const existingIds = new Set(this.devices.map(d => d.id));
          const newDevices = networkDevices.filter(d => !existingIds.has(d.id));
          this.devices = [...this.devices, ...newDevices];
          this.renderDevices();
          this.updateStatistics();
        }
      } else {
        this.log('Network discovery returned no results', 'warning');
      }
    } catch (error) {
      this.log(`Network discovery failed: ${error.message}`, 'error');
    }
  }

  /**
   * Render devices in the grid
   */
  renderDevices() {
    const container = document.getElementById('devicesContainer');

    if (this.devices.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-inbox"></i>
          <h4>No Devices Found</h4>
          <p>Click "Refresh Devices" to discover connected hardware</p>
        </div>
      `;
      return;
    }

    const simulatedBanner = this.deviceSource === 'simulated'
      ? `<div class="simulated-banner">
          <i class="bi bi-info-circle"></i>
          Showing simulated devices — no real hardware detected on this system.
          Try "Discover Network" to find network printers/devices.
        </div>`
      : '';

    container.innerHTML = simulatedBanner + this.devices.map(device => this.createDeviceCard(device)).join('');

    // Add event listeners to device buttons
    this.devices.forEach(device => {
      const connectBtn = document.getElementById(`connect-${device.id}`);
      const disconnectBtn = document.getElementById(`disconnect-${device.id}`);
      const testBtn = document.getElementById(`test-${device.id}`);
      const detailsBtn = document.getElementById(`details-${device.id}`);

      if (connectBtn) connectBtn.addEventListener('click', () => this.connectDevice(device));
      if (disconnectBtn) disconnectBtn.addEventListener('click', () => this.disconnectDevice(device));
      if (testBtn) testBtn.addEventListener('click', () => this.testDevice(device));
      if (detailsBtn) detailsBtn.addEventListener('click', () => this.showDeviceDetails(device));
    });
  }

  /**
   * Create device card HTML
   */
  createDeviceCard(device) {
    const icon = this.getDeviceIcon(device.type);
    const statusClass = device.status || 'available';
    const statusIcon = this.getStatusIcon(device.status);
    const host = device.properties?.host || device.host;
    const port = device.properties?.port || device.port;
    const portName = device.properties?.portName || device.portName;
    const connectionBadge = this.getConnectionBadge(device, host);

    return `
      <div class="device-card ${device.type}">
        <div class="device-icon ${device.type}">
          <i class="bi ${icon}"></i>
        </div>
        <div class="device-name">${device.name} ${connectionBadge}</div>
        <div class="device-model">${device.manufacturer || 'Unknown'} ${device.model || ''}</div>
        <div class="device-status ${statusClass}">
          <i class="bi ${statusIcon}"></i>
          ${statusClass}
        </div>
        <div class="device-details">
          <div><strong>Type:</strong> ${device.type}</div>
          ${device.serialNumber ? `<div><strong>Serial:</strong> ${device.serialNumber}</div>` : ''}
          ${host ? `<div><strong>Host:</strong> ${host}${port ? ':' + port : ''}</div>` : ''}
          ${portName ? `<div><strong>Port:</strong> ${portName}</div>` : ''}
        </div>
        <div class="device-actions">
          ${!device.isConnected ?
            `<button id="connect-${device.id}" class="btn-device btn-device-connect">
              <i class="bi bi-plug"></i> Connect
            </button>` :
            `<button id="disconnect-${device.id}" class="btn-device btn-device-disconnect">
              <i class="bi bi-plug-fill"></i> Disconnect
            </button>`
          }
          <button id="test-${device.id}" class="btn-device btn-device-test">
            <i class="bi bi-check-circle"></i> Test
          </button>
          <button id="details-${device.id}" class="btn-device btn-outline-secondary">
            <i class="bi bi-info-circle"></i> Details
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get device icon based on type
   */
  getDeviceIcon(type) {
    const icons = {
      printer: 'bi-printer',
      network: 'bi-wifi',
      usbhid: 'bi-usb',
      serial: 'bi-cpu',
      biometric: 'bi-fingerprint'
    };
    return icons[type] || 'bi-device-ssd';
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      connected: 'bi-check-circle-fill',
      available: 'bi-circle',
      error: 'bi-exclamation-triangle-fill'
    };
    return icons[status] || 'bi-question-circle';
  }

  /**
   * Get connection type badge (network/wifi/usb/local)
   */
  getConnectionBadge(device, host) {
    const connType = device.properties?.connectionType;
    if (host || device.type === 'network' || connType === 'network') {
      return '<span class="connection-badge network-badge" title="Network/WiFi Connected"><i class="bi bi-wifi"></i></span>';
    }
    if (device.type === 'usbhid' || connType === 'usb') {
      return '<span class="connection-badge usb-badge" title="USB Connected"><i class="bi bi-usb-symbol"></i></span>';
    }
    if (device.type === 'serial') {
      return '<span class="connection-badge serial-badge" title="Serial/Wired"><i class="bi bi-diagram-3"></i></span>';
    }
    return '<span class="connection-badge local-badge" title="Local Device"><i class="bi bi-pc-display"></i></span>';
  }

  /**
   * Connect to a device using the appropriate server method
   */
  async connectDevice(device) {
    try {
      this.log(`Connecting to ${device.name}...`, 'info');
      const host = device.properties?.ipAddress || device.properties?.host || device.host;
      const port = device.properties?.port || device.port;

      let result;

      switch (device.type) {
        case 'network':
          if (!host || !port) {
            this.log(`Cannot connect: missing host/port for ${device.name}`, 'error');
            return;
          }
          result = await this.sendRequest('network.connect', {
            deviceId: device.id,
            config: {
              host,
              port: parseInt(port),
              protocol: device.properties?.protocol || 'tcp'
            }
          });
          break;

        case 'serial':
          result = await this.sendRequest('serial.open', {
            deviceId: device.id,
            baudRate: device.properties?.baudRate || 9600,
            parity: 'None',
            dataBits: 8,
            stopBits: '1',
            flowControl: 'None'
          });
          break;

        case 'usbhid':
          result = await this.sendRequest('usb.open', { deviceId: device.id });
          break;

        case 'printer':
          // For printers with network info, connect via network
          if (host && port) {
            result = await this.sendRequest('network.connect', {
              deviceId: device.id,
              config: { host, port: parseInt(port), protocol: 'tcp' }
            });
          } else {
            this.log(`Printer ${device.name} is available (OS-managed)`, 'info');
            result = { success: true, status: 'available' };
          }
          break;

        default:
          this.log(`Unsupported device type: ${device.type}`, 'error');
          return;
      }

      if (result.success) {
        this.log(`Connected to ${device.name}`, 'success');
        device.isConnected = true;
        device.status = 'connected';
        this.renderDevices();
        this.updateStatistics();
      } else {
        this.log(`Failed to connect: ${result.error || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      this.log(`Connection failed: ${error.message}`, 'error');
    }
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(device) {
    try {
      this.log(`Disconnecting from ${device.name}...`, 'info');

      let result;

      switch (device.type) {
        case 'network':
        case 'printer':
          result = await this.sendRequest('network.disconnect', { deviceId: device.id });
          break;
        case 'serial':
          result = await this.sendRequest('serial.close', { deviceId: device.id });
          break;
        case 'usbhid':
          result = await this.sendRequest('usb.close', { deviceId: device.id });
          break;
        default:
          this.log(`Unsupported device type: ${device.type}`, 'error');
          return;
      }

      if (result.success) {
        this.log(`Disconnected from ${device.name}`, 'success');
        device.isConnected = false;
        device.status = 'available';
        this.renderDevices();
        this.updateStatistics();
      } else {
        this.log(`Disconnect failed: ${result.error || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      this.log(`Disconnection failed: ${error.message}`, 'error');
    }
  }

  /**
   * Test a device (ping for network, print test for printers)
   */
  async testDevice(device) {
    try {
      this.log(`Testing ${device.name}...`, 'info');
      const host = device.properties?.ipAddress || device.properties?.host || device.host;
      const port = device.properties?.port || device.port;

      let result;

      switch (device.type) {
        case 'network':
          if (!host || !port) {
            this.log(`Cannot test: missing host/port`, 'error');
            return;
          }
          result = await this.sendRequest('network.ping', {
            deviceId: device.id,
            host,
            port: Number(port)
          });
          if (result.success) {
            this.log(`${device.name} responded in ${result.responseTime}ms`, 'success');
          }
          break;

        case 'printer':
          // Ping first if network printer
          if (host && port) {
            try {
              const pingResult = await this.sendRequest('network.ping', {
                deviceId: device.id,
                host,
                port: Number(port)
              });
              if (pingResult.success) {
                this.log(`${device.name} reachable (${pingResult.responseTime}ms)`, 'success');
              } else {
                this.log(`${device.name} ping failed: ${pingResult.error || 'unreachable'}`, 'warning');
              }
            } catch (pingErr) {
              this.log(`Ping failed: ${pingErr.message}`, 'warning');
            }
          }
          // Send test print via CUPS/OS printer driver
          result = await this.sendRequest('printer.print', {
            deviceId: device.id,
            data: 'Hardware Bridge Test Print\n',
            format: 'raw'
          });
          if (result.success) {
            this.log(`Test print sent to ${device.name} (Job: ${result.jobId || 'unknown'})`, 'success');
          }
          break;

        case 'serial':
          // Test by getting status
          result = await this.sendRequest('serial.getStatus', { deviceId: device.id });
          this.log(`${device.name} status: ${result.status || 'available'}`, 'success');
          break;

        case 'usbhid':
          result = await this.sendRequest('usb.getStatus', { deviceId: device.id });
          this.log(`${device.name} status: ${result.status || 'available'}`, 'success');
          break;

        default:
          this.log(`No test available for ${device.type}`, 'warning');
          return;
      }

      if (result && !result.success && result.error) {
        this.log(`Test failed: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Test failed: ${error.message}`, 'error');
    }
  }

  /**
   * Show device details in modal
   */
  showDeviceDetails(device) {
    const modal = new bootstrap.Modal(document.getElementById('deviceDetailsModal'));
    const title = document.getElementById('deviceDetailsTitle');
    const body = document.getElementById('deviceDetailsBody');

    title.textContent = `${device.name} - Details`;

    const host = device.properties?.host || device.host;
    const port = device.properties?.port || device.port;
    const protocol = device.properties?.protocol || device.protocol;
    const portName = device.properties?.portName || device.portName;

    const details = `
      <div class="row">
        <div class="col-md-6">
          <h6>Basic Information</h6>
          <table class="table table-sm">
            <tr><td><strong>ID:</strong></td><td><code>${device.id}</code></td></tr>
            <tr><td><strong>Name:</strong></td><td>${device.name}</td></tr>
            <tr><td><strong>Type:</strong></td><td>${device.type}</td></tr>
            <tr><td><strong>Manufacturer:</strong></td><td>${device.manufacturer || 'Unknown'}</td></tr>
            <tr><td><strong>Model:</strong></td><td>${device.model || 'Unknown'}</td></tr>
            <tr><td><strong>Serial:</strong></td><td>${device.serialNumber || 'N/A'}</td></tr>
            <tr><td><strong>Status:</strong></td><td>${device.status || 'Unknown'}</td></tr>
            <tr><td><strong>Connected:</strong></td><td>${device.isConnected ? 'Yes' : 'No'}</td></tr>
          </table>
        </div>
        <div class="col-md-6">
          <h6>Connection Details</h6>
          <table class="table table-sm">
            ${host ? `<tr><td><strong>Host:</strong></td><td>${host}</td></tr>` : ''}
            ${port ? `<tr><td><strong>Port:</strong></td><td>${port}</td></tr>` : ''}
            ${protocol ? `<tr><td><strong>Protocol:</strong></td><td>${protocol}</td></tr>` : ''}
            ${portName ? `<tr><td><strong>Port Name:</strong></td><td>${portName}</td></tr>` : ''}
            ${device.connectionId ? `<tr><td><strong>Connection ID:</strong></td><td><code>${device.connectionId}</code></td></tr>` : ''}
            ${device.lastSeen ? `<tr><td><strong>Last Seen:</strong></td><td>${new Date(device.lastSeen).toLocaleString()}</td></tr>` : ''}
          </table>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-12">
          <h6>Properties</h6>
          <pre class="bg-light p-3 rounded" style="max-height:200px;overflow:auto">${JSON.stringify(device.properties || {}, null, 2)}</pre>
        </div>
      </div>
    `;

    body.innerHTML = details;
    modal.show();
  }

  /**
   * Update server status UI
   */
  updateServerStatus(running) {
    const statusElement = document.getElementById('serverStatus');
    const startBtn = document.getElementById('startServerBtn');
    const stopBtn = document.getElementById('stopServerBtn');

    // Update button labels for connect/disconnect
    startBtn.innerHTML = '<i class="bi bi-plug-fill"></i> Connect';
    stopBtn.innerHTML = '<i class="bi bi-x-circle"></i> Disconnect';

    if (running === 'starting') {
      statusElement.className = 'server-status starting';
      statusElement.innerHTML = '<i class="bi bi-circle-fill"></i><span>Connecting...</span>';
      startBtn.disabled = true;
      stopBtn.disabled = true;
    } else if (running) {
      statusElement.className = 'server-status running';
      statusElement.innerHTML = '<i class="bi bi-circle-fill"></i><span>Connected</span>';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusElement.className = 'server-status stopped';
      statusElement.innerHTML = '<i class="bi bi-circle-fill"></i><span>Disconnected</span>';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  /**
   * Update statistics
   */
  updateStatistics() {
    const total = this.devices.length;
    const connected = this.devices.filter(d => d.isConnected || d.status === 'connected').length;
    const available = this.devices.filter(d => d.status === 'available').length;
    const errors = this.devices.filter(d => d.status === 'error').length;

    document.getElementById('totalDevices').textContent = total;
    document.getElementById('connectedDevices').textContent = connected;
    document.getElementById('availableDevices').textContent = available;
    document.getElementById('errorDevices').textContent = errors;
  }

  /**
   * Clear device display
   */
  clearDevices() {
    this.devices = [];
    this.renderDevices();
    this.updateStatistics();
  }

  /**
   * Start automatic refresh (every 10 seconds)
   */
  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => {
      if (this.isConnected) {
        this.refreshDevices();
      }
    }, 10000);
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Update server URL
   */
  updateServerUrl() {
    const newUrl = document.getElementById('serverUrl').value;
    this.log(`Server URL updated to: ${newUrl}`, 'info');
  }

  /**
   * Log message to panel
   */
  log(message, type = 'info') {
    const logPanel = document.getElementById('logPanel');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    logPanel.appendChild(logEntry);
    logPanel.scrollTop = logPanel.scrollHeight;

    // Keep only last 100 entries
    const entries = logPanel.querySelectorAll('.log-entry');
    if (entries.length > 100) {
      entries[0].remove();
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.controlCenter = new HardwareBridgeControlCenter();
});
