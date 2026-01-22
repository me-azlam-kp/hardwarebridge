/**
 * Modern Web-to-Print Application
 * Uses @hardwarebridge/client npm package
 * 
 * This application demonstrates how to use the Hardware Bridge Client
 * to create a professional web-to-print solution with modern JavaScript
 * and comprehensive hardware device support.
 */

import { HardwareBridgeClient } from '@hardwarebridge/client';

class ModernWebToPrintApp {
  constructor() {
    this.client = null;
    this.devices = [];
    this.selectedPrinter = null;
    this.isConnected = false;
    this.currentOrder = {
      items: [],
      customerName: '',
      orderNumber: this.generateOrderNumber()
    };
    
    this.initializeApp();
  }

  /**
   * Initialize the application
   */
  async initializeApp() {
    try {
      this.log('🚀 Modern Web-to-Print App initialized', 'info');
      this.setupEventListeners();
      this.updateConnectionStatus(false);
      this.initializeOrderForm();
      this.log('✅ Application ready', 'success');
    } catch (error) {
      this.log(`❌ Initialization failed: ${error.message}`, 'error');
    }
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Connection controls
    document.getElementById('connectBtn').addEventListener('click', () => this.toggleConnection());
    document.getElementById('refreshDevicesBtn').addEventListener('click', () => this.refreshDevices());
    
    // Order form
    document.getElementById('orderForm').addEventListener('submit', (e) => this.handlePrintOrder(e));
    document.getElementById('addItemBtn').addEventListener('click', () => this.addItem());
    document.getElementById('printFormat').addEventListener('change', () => this.updatePrintPreview());
    
    // Real-time updates
    this.setupRealTimeUpdates();
    
    // Advanced features
    this.setupAdvancedFeatures();
  }

  /**
   * Set up real-time preview updates
   */
  setupRealTimeUpdates() {
    const inputs = [
      'customerName',
      'orderNumber',
      'printFormat'
    ];
    
    inputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => this.updatePrintPreview());
      }
    });
    
    // Item inputs
    document.addEventListener('input', (e) => {
      if (e.target.matches('.item-name, .item-quantity, .item-price')) {
        this.updatePrintPreview();
      }
    });
  }

  /**
   * Set up advanced features
   */
  setupAdvancedFeatures() {
    // Queue management
    document.getElementById('refreshQueueBtn').addEventListener('click', () => this.refreshQueue());
    document.getElementById('clearQueueBtn').addEventListener('click', () => this.clearQueue());
    
    // Device management
    document.getElementById('deviceRefreshBtn').addEventListener('click', () => this.refreshDevices());
    document.getElementById('deviceDetailsBtn').addEventListener('click', () => this.showDeviceDetails());
    
    // Print management
    document.getElementById('printTestBtn').addEventListener('click', () => this.printTestPage());
    document.getElementById('printFormatsBtn').addEventListener('click', () => this.showPrintFormats());
  }

  /**
   * Initialize the order form
   */
  initializeOrderForm() {
    this.addItem(); // Add first item
    this.updatePrintPreview();
    this.log('📋 Order form initialized', 'info');
  }

  /**
   * Toggle connection to Hardware Bridge server
   */
  async toggleConnection() {
    try {
      if (this.isConnected) {
        await this.disconnect();
      } else {
        await this.connect();
      }
    } catch (error) {
      this.log(`❌ Connection error: ${error.message}`, 'error');
    }
  }

  /**
   * Connect to Hardware Bridge server
   */
  async connect() {
    try {
      this.log('🔗 Connecting to Hardware Bridge server...', 'info');
      this.updateConnectionStatus(false, 'connecting');

      // Create client instance
      this.client = new HardwareBridgeClient({
        url: 'ws://localhost:8443',
        autoReconnect: true,
        reconnectInterval: 5000
      });

      // Set up event listeners
      this.setupClientEventListeners();

      // Connect to server
      await this.client.connect();
      
      this.isConnected = true;
      this.updateConnectionStatus(true);
      this.log('✅ Connected to Hardware Bridge server', 'success');
      
      // Auto-discover devices
      await this.discoverDevices();
      
    } catch (error) {
      this.isConnected = false;
      this.updateConnectionStatus(false);
      this.log(`❌ Connection failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Disconnect from Hardware Bridge server
   */
  async disconnect() {
    try {
      this.log('🔌 Disconnecting from Hardware Bridge server...', 'info');
      this.updateConnectionStatus(false, 'disconnecting');

      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }

      this.isConnected = false;
      this.devices = [];
      this.selectedPrinter = null;
      this.updateConnectionStatus(false);
      this.updateDeviceList([]);
      this.log('✅ Disconnected from Hardware Bridge server', 'success');
      
    } catch (error) {
      this.log(`❌ Disconnect error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Set up client event listeners
   */
  setupClientEventListeners() {
    if (!this.client) return;

    // Connection state changes
    this.client.onConnectionStateChange((connected) => {
      this.log(`Connection state: ${connected ? 'Connected' : 'Disconnected'}`, connected ? 'success' : 'warning');
      this.updateConnectionStatus(connected);
    });

    // Device events
    this.client.onDeviceEvent((event) => {
      this.log(`📡 Device event: ${event.type} on ${event.deviceId}`, 'info');
      this.handleDeviceEvent(event);
    });
  }

  /**
   * Discover and list all available devices
   */
  async discoverDevices() {
    try {
      this.log('🔍 Discovering devices...', 'info');
      
      const result = await this.client.enumerateDevices();
      this.devices = result.devices || [];
      
      this.log(`✅ Found ${this.devices.length} devices`, 'success');
      this.updateDeviceList(this.devices);
      
      // Auto-select first printer
      const printer = this.devices.find(d => d.type === 'printer');
      if (printer) {
        this.selectPrinter(printer.id);
      }
      
    } catch (error) {
      this.log(`❌ Device discovery failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Refresh device list
   */
  async refreshDevices() {
    if (!this.isConnected) {
      this.log('❌ Not connected - cannot refresh devices', 'warning');
      return;
    }
    
    try {
      this.log('🔄 Refreshing device list...', 'info');
      await this.discoverDevices();
    } catch (error) {
      this.log(`❌ Device refresh failed: ${error.message}`, 'error');
    }
  }

  /**
   * Select a printer device
   */
  selectPrinter(deviceId) {
    const printer = this.devices.find(d => d.id === deviceId && d.type === 'printer');
    
    if (printer) {
      this.selectedPrinter = printer;
      this.log(`✅ Selected printer: ${printer.name}`, 'success');
      this.updatePrinterSelection(printer);
    } else {
      this.log('❌ Invalid printer selection', 'error');
    }
  }

  /**
   * Handle print order submission
   */
  async handlePrintOrder(event) {
    event.preventDefault();
    
    if (!this.isConnected) {
      this.log('❌ Not connected - cannot print', 'error');
      alert('Please connect to the Hardware Bridge server first.');
      return;
    }
    
    if (!this.selectedPrinter) {
      this.log('❌ No printer selected', 'error');
      alert('Please select a printer first.');
      return;
    }
    
    try {
      this.log('🖨️ Processing print order...', 'info');
      
      const orderData = this.collectOrderData();
      const printContent = this.generatePrintContent(orderData);
      const printFormat = document.getElementById('printFormat').value;
      
      this.log(`📄 Printing in ${printFormat} format...`, 'info');
      
      const result = await this.client.print(
        this.selectedPrinter.id,
        printContent,
        printFormat
      );
      
      this.log(`✅ Print job completed: ${result.jobId}`, 'success');
      this.log(`📊 Bytes printed: ${result.bytesPrinted}`, 'info');
      
      // Update queue status
      await this.refreshQueue();
      
      // Show success message
      this.showSuccessMessage(`Order printed successfully! Job ID: ${result.jobId}`);
      
    } catch (error) {
      this.log(`❌ Print failed: ${error.message}`, 'error');
      this.showErrorMessage(`Print failed: ${error.message}`);
    }
  }

  /**
   * Collect order data from form
   */
  collectOrderData() {
    const customerName = document.getElementById('customerName').value;
    const orderNumber = document.getElementById('orderNumber').value;
    const printFormat = document.getElementById('printFormat').value;
    
    const items = [];
    const itemGroups = document.querySelectorAll('.item-group');
    
    itemGroups.forEach(group => {
      const name = group.querySelector('.item-name').value;
      const quantity = parseInt(group.querySelector('.item-quantity').value) || 0;
      const price = parseFloat(group.querySelector('.item-price').value) || 0;
      
      if (name && quantity > 0) {
        items.push({
          name,
          quantity,
          price,
          total: quantity * price
        });
      }
    });
    
    return {
      customerName,
      orderNumber,
      printFormat,
      items,
      total: items.reduce((sum, item) => sum + item.total, 0),
      timestamp: new Date().toLocaleString()
    };
  }

  /**
   * Generate print content based on format
   */
  generatePrintContent(orderData) {
    const format = orderData.printFormat;
    
    switch (format) {
      case 'escpos':
        return this.generateESCPosContent(orderData);
      case 'zpl':
        return this.generateZPLContent(orderData);
      case 'epl':
        return this.generateEPLContent(orderData);
      default:
        return this.generateRawContent(orderData);
    }
  }

  /**
   * Generate ESC/POS format content
   */
  generateESCPosContent(orderData) {
    return `
RECEIPT #${orderData.orderNumber}
================
Date: ${orderData.timestamp}
Customer: ${orderData.customerName}

ITEMS:
${orderData.items.map(item => 
  `${item.name.padEnd(20)} ${item.quantity.toString().padStart(3)} ${('$' + item.price.toFixed(2)).padStart(8)} ${('$' + item.total.toFixed(2)).padStart(8)}`
).join('\n')}
----------------
TOTAL: ${'$' + orderData.total.toFixed(2).padStart(30)}

Thank you for your business!
================
Hardware Bridge Web-to-Print System
`;
  }

  /**
   * Generate ZPL format content
   */
  generateZPLContent(orderData) {
    return `
^XA
^FO50,30^ADN,36,20^FDRECEIPT #${orderData.orderNumber}^FS
^FO50,80^ADN,18,10^FDDate: ${orderData.timestamp}^FS
^FO50,120^ADN,18,10^FDCustomer: ${orderData.customerName}^FS
^FO50,160^ADN,18,10^FDTotal: $${orderData.total.toFixed(2)}^FS
^FO50,200^BCN,80,Y,N,N^FD${orderData.orderNumber}^FS
^FO50,300^ADN,18,10^FDHardware Bridge Web-to-Print^FS
^XZ
`;
  }

  /**
   * Generate EPL format content
   */
  generateEPLContent(orderData) {
    return `
N
q609
Q203,26
A5,26,0,2,1,1,N,"RECEIPT #${orderData.orderNumber}"
A5,56,0,2,1,1,N,"Date: ${orderData.timestamp}"
A5,86,0,2,1,1,N,"Customer: ${orderData.customerName}"
A5,116,0,2,1,1,N,"Total: $${orderData.total.toFixed(2)}"
B5,146,0,1,2,2,100,B,"${orderData.orderNumber}"
A5,256,0,2,1,1,N,"Hardware Bridge Web-to-Print"
P1
`;
  }

  /**
   * Generate raw format content
   */
  generateRawContent(orderData) {
    return `
=====================================
    HARDWARE BRIDGE WEB-TO-PRINT
=====================================

Receipt #: ${orderData.orderNumber}
Date: ${orderData.timestamp}
Customer: ${orderData.customerName}

ITEMS:
${orderData.items.map(item => 
  `- ${item.name}: ${item.quantity} x $${item.price.toFixed(2)} = $${item.total.toFixed(2)}`
).join('\n')}

----------------
TOTAL: $${orderData.total.toFixed(2)}

=====================================
    END OF RECEIPT
=====================================
`;
  }

  /**
   * Add a new item to the order
   */
  addItem() {
    const itemsContainer = document.getElementById('itemsContainer');
    const itemGroup = document.createElement('div');
    itemGroup.className = 'input-group item-group';
    itemGroup.innerHTML = `
      <input type="text" class="form-control item-name" placeholder="Item name" required>
      <input type="number" class="form-control item-quantity" placeholder="Qty" min="1" value="1" required>
      <input type="number" class="form-control item-price" placeholder="Price" min="0" step="0.01" required>
      <button type="button" class="btn btn-outline-danger remove-item-btn">×</button>
    `;
    itemsContainer.appendChild(itemGroup);
    this.updatePrintPreview();
  }

  /**
   * Remove an item from the order
   */
  removeItem(itemGroup) {
    if (document.querySelectorAll('.item-group').length > 1) {
      itemGroup.remove();
      this.updatePrintPreview();
    }
  }

  /**
   * Update print preview
   */
  updatePrintPreview() {
    try {
      const orderData = this.collectOrderData();
      const printContent = this.generatePrintContent(orderData);
      
      document.getElementById('printPreview').textContent = printContent;
      
      // Update character count
      const charCount = printContent.length;
      document.getElementById('charCount').textContent = `${charCount} characters`;
      
    } catch (error) {
      this.log(`❌ Preview update error: ${error.message}`, 'error');
    }
  }

  /**
   * Refresh queue status
   */
  async refreshQueue() {
    if (!this.isConnected) return;
    
    try {
      const status = await this.client.getQueueStatus();
      this.updateQueueDisplay(status);
    } catch (error) {
      this.log(`❌ Queue refresh error: ${error.message}`, 'error');
    }
  }

  /**
   * Print test page
   */
  async printTestPage() {
    if (!this.isConnected || !this.selectedPrinter) {
      this.log('❌ Cannot print test page - no connection or printer', 'error');
      return;
    }
    
    try {
      this.log('🧪 Printing test page...', 'info');
      
      const testContent = this.generateTestPageContent();
      const result = await this.client.print(this.selectedPrinter.id, testContent, 'raw');
      
      this.log(`✅ Test page printed: ${result.jobId}`, 'success');
      
    } catch (error) {
      this.log(`❌ Test page failed: ${error.message}`, 'error');
    }
  }

  /**
   * Generate test page content
   */
  generateTestPageContent() {
    return `
=====================================
    HARDWARE BRIDGE TEST PAGE
=====================================

Printer: ${this.selectedPrinter?.name || 'Unknown'}
Date: ${new Date().toLocaleString()}
Connection: WebSocket
Client: Modern Web-to-Print App

Test Patterns:
- Line 1: ABCDEFGHIJKLMNOPQRSTUVWXYZ
- Line 2: 1234567890!@#$%^&*()
- Line 3: Test pattern complete

=====================================
    END OF TEST PAGE
=====================================
`;
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(connected, status = 'idle') {
    const statusElement = document.getElementById('connectionStatus');
    const connectBtn = document.getElementById('connectBtn');
    
    if (connected) {
      statusElement.textContent = 'Connected';
      statusElement.className = 'status connected';
      connectBtn.textContent = 'Disconnect';
      connectBtn.className = 'btn btn-danger';
    } else {
      switch (status) {
        case 'connecting':
          statusElement.textContent = 'Connecting...';
          statusElement.className = 'status connecting';
          connectBtn.textContent = 'Connecting...';
          connectBtn.className = 'btn btn-warning';
          break;
        case 'disconnecting':
          statusElement.textContent = 'Disconnecting...';
          statusElement.className = 'status disconnecting';
          connectBtn.textContent = 'Disconnecting...';
          connectBtn.className = 'btn btn-warning';
          break;
        default:
          statusElement.textContent = 'Disconnected';
          statusElement.className = 'status disconnected';
          connectBtn.textContent = 'Connect';
          connectBtn.className = 'btn btn-success';
      }
    }
  }

  /**
   * Update device list display
   */
  updateDeviceList(devices) {
    const deviceList = document.getElementById('deviceList');
    const deviceSelect = document.getElementById('printerSelect');
    
    // Clear existing options
    deviceSelect.innerHTML = '<option value="">Select a printer...</option>';
    
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.name} (${device.type}) - ${device.status}`;
      deviceSelect.appendChild(option);
    });
    
    deviceSelect.addEventListener('change', (e) => {
      this.selectPrinter(e.target.value);
    });
  }

  /**
   * Update printer selection
   */
  updatePrinterSelection(printer) {
    const printerInfo = document.getElementById('printerInfo');
    if (printer) {
      printerInfo.innerHTML = `
        <h6>${printer.name}</h6>
        <p class="mb-1">Type: ${printer.type}</p>
        <p class="mb-1">Status: ${printer.status}</p>
        <p class="mb-0">Protocols: ${printer.supportedProtocols?.join(', ') || 'N/A'}</p>
      `;
    } else {
      printerInfo.innerHTML = '<p class="text-muted">No printer selected</p>';
    }
  }

  /**
   * Update queue display
   */
  updateQueueDisplay(status) {
    const queueInfo = document.getElementById('queueInfo');
    queueInfo.innerHTML = `
      <div class="queue-stats">
        <div class="queue-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value">${status.totalJobs}</span>
        </div>
        <div class="queue-stat">
          <span class="stat-label">Pending:</span>
          <span class="stat-value">${status.pendingJobs}</span>
        </div>
        <div class="queue-stat">
          <span class="stat-label">Processing:</span>
          <span class="stat-value">${status.processingJobs}</span>
        </div>
        <div class="queue-stat">
          <span class="stat-label">Completed:</span>
          <span class="stat-value">${status.completedJobs}</span>
        </div>
      </div>
    `;
  }

  /**
   * Handle device events
   */
  handleDeviceEvent(event) {
    switch (event.type) {
      case 'connected':
        this.log(`📡 Device connected: ${event.deviceId}`, 'success');
        break;
      case 'disconnected':
        this.log(`📡 Device disconnected: ${event.deviceId}`, 'warning');
        break;
      case 'error':
        this.log(`📡 Device error: ${event.deviceId} - ${event.error}`, 'error');
        break;
      default:
        this.log(`📡 Device event: ${event.type} on ${event.deviceId}`, 'info');
    }
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show message to user
   */
  showMessage(message, type) {
    const messageDiv = document.getElementById('messageArea');
    messageDiv.innerHTML = `
      <div class="alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageDiv.innerHTML = '';
    }, 5000);
  }

  /**
   * Log messages to console and UI
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    console.log(logEntry);
    
    // Add to UI log if element exists
    const logElement = document.getElementById('logArea');
    if (logElement) {
      const logEntryElement = document.createElement('div');
      logEntryElement.className = `log-entry log-${type}`;
      logEntryElement.textContent = logEntry;
      logElement.appendChild(logEntryElement);
      logElement.scrollTop = logElement.scrollHeight;
    }
  }

  /**
   * Generate order number
   */
  generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${year}${month}${day}${random}`;
  }

  /**
   * Show print formats information
   */
  showPrintFormats() {
    const formats = [
      {
        name: 'Raw Text',
        description: 'Plain text format, works with most printers',
        useCase: 'General printing, receipts, simple documents'
      },
      {
        name: 'ESC/POS',
        description: 'Epson Standard Code for Point of Sale',
        useCase: 'Receipts, thermal printers, point-of-sale systems'
      },
      {
        name: 'ZPL',
        description: 'Zebra Programming Language',
        useCase: 'Label printers, barcodes, industrial printing'
      },
      {
        name: 'EPL',
        description: 'Eltron Programming Language',
        useCase: 'Label printers, shipping labels, inventory tags'
      }
    ];
    
    let content = '<h6>Print Formats</h6>';
    formats.forEach(format => {
      content += `
        <div class="format-info">
          <strong>${format.name}</strong>
          <p>${format.description}</p>
          <small>Use case: ${format.useCase}</small>
        </div>
      `;
    });
    
    this.showModal('Print Formats', content);
  }

  /**
   * Show modal dialog
   */
  showModal(title, content) {
    // Simple modal implementation
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h5>${title}</h5>
          <button type="button" class="btn-close" onclick="this.parentElement.parentElement.parentElement.remove()"></button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Generate test page content
   */
  generateTestPageContent() {
    return `
=====================================
    HARDWARE BRIDGE TEST PAGE
=====================================

Printer: ${this.selectedPrinter?.name || 'Unknown'}
Date: ${new Date().toLocaleString()}
Connection: WebSocket
Client: Modern Web-to-Print App
Format: Multi-format support

Test Patterns:
- Line 1: ABCDEFGHIJKLMNOPQRSTUVWXYZ
- Line 2: 1234567890!@#$%^&*()
- Line 3: Test pattern complete

=====================================
    END OF TEST PAGE
=====================================
`;
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.webToPrintApp = new ModernWebToPrintApp();
});