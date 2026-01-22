# Web-to-Print Setup Guide

## Overview

This guide explains how to connect a local printer to a publicly hosted website using the Hardware Bridge solution. This enables web applications to print directly to local printers, bypassing browser print dialogs and providing precise control over print formatting.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Public Website (HTTPS)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Web Application                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Hardware Bridge Client                 │  │  │
│  │  │  • TypeScript/JavaScript integration              │  │  │
│  │  │  • WebSocket connection to local bridge            │  │  │
│  │  │  • Print job submission and status monitoring      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              WebSocket Connection (WSS)                   │  │
│  │  • TLS 1.3 encryption                                   │  │
│  │  • Origin-based access control                           │  │
│  │  • JSON-RPC v2 protocol                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Local Network (User's PC)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            Hardware Bridge Service/Server                 │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           WebSocket Server (Port 8443)             │  │  │
│  │  │  • Accepts connections from web applications        │  │  │
│  │  │  • Processes JSON-RPC v2 requests                   │  │  │
│  │  │  • Manages device connections and print jobs        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                              │                            │  │
│  │                              ▼                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            Device Manager Layer                    │  │  │
│  │  │  • Printer discovery and management                │  │  │
│  │  │  • Serial port communication                       │  │  │
│  │  │  • USB HID device handling                         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                              │                            │  │
│  │                              ▼                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           Local Hardware Devices                    │  │  │
│  │  │  • ESC/POS thermal printers                        │  │  │
│  │  │  • ZPL label printers                               │  │  │
│  │  │  • Serial receipt printers                          │  │  │
│  │  │  • USB HID devices                                  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Setup Process

### Step 1: Install Hardware Bridge Locally

#### Option A: Windows (Full Features)
```bash
# Download and install Windows service
curl -O https://releases.hardwarebridge.io/HardwareBridge.msi
msiexec /i HardwareBridge.msi /quiet

# Or use Chocolatey
choco install hardwarebridge
```

#### Option B: Cross-Platform (Windows & macOS)
```bash
# Clone repository
git clone https://github.com/hardwarebridge/bridge.git
cd HardwareBridge/src/CrossPlatformServer

# Install dependencies
npm install

# Start server
npm run dev
```

### Step 2: Configure Local Bridge Service

#### Basic Configuration
Create `config.json` in the installation directory:

```json
{
  "port": 8443,
  "host": "0.0.0.0",
  "useTls": true,
  "certPath": "certs/server.crt",
  "keyPath": "certs/server.key",
  "allowedOrigins": [
    "https://your-website.com",
    "https://app.yourdomain.com"
  ],
  "maxConnections": 50,
  "databasePath": "data/queue.db"
}
```

#### Security Configuration
For production environments, configure proper TLS certificates:

```json
{
  "useTls": true,
  "certPath": "/etc/letsencrypt/live/yourdomain.com/fullchain.pem",
  "keyPath": "/etc/letsencrypt/live/yourdomain.com/privkey.pem",
  "allowedOrigins": ["https://your-website.com"]
}
```

### Step 3: Network Configuration

#### Port Forwarding Setup
Configure your router to forward external requests to the local bridge:

```
External: https://bridge.yourdomain.com:443 → Internal: http://192.168.1.100:8443
```

#### Firewall Configuration
Allow incoming connections on port 8443:

**Windows:**
```powershell
New-NetFirewallRule -DisplayName "Hardware Bridge" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow
```

**macOS/Linux:**
```bash
sudo ufw allow 8443/tcp
```

#### Dynamic DNS Setup (Optional)
For home networks with dynamic IP:
```bash
# Install ddclient
sudo apt-get install ddclient

# Configure with your DNS provider
sudo nano /etc/ddclient.conf
```

### Step 4: Website Integration

#### Install Client Library
```html
<!-- Include in your website -->
<script src="https://unpkg.com/@hardwarebridge/client@latest/dist/index.umd.js"></script>
```

Or via npm:
```bash
npm install @hardwarebridge/client
```

#### Basic Integration
```javascript
// Initialize client
const bridgeClient = new HardwareBridgeClient({
  url: 'wss://bridge.yourdomain.com:8443',
  protocols: ['jsonrpc-2.0'],
  autoReconnect: true,
  maxReconnectAttempts: 10,
  timeout: 30000
});

// Connect to bridge
async function initializeBridge() {
  try {
    await bridgeClient.connect();
    console.log('Connected to Hardware Bridge');
    
    // Discover local printers
    const devices = await bridgeClient.enumerateDevices();
    const printers = devices.filter(d => d.type === 'printer');
    
    // Populate printer selection
    populatePrinterDropdown(printers);
  } catch (error) {
    console.error('Failed to connect to bridge:', error);
    showConnectionError();
  }
}

// Initialize on page load
initializeBridge();
```

#### Print Function Implementation
```javascript
async function printReceipt(orderData) {
  try {
    // Get selected printer
    const selectedPrinter = document.getElementById('printerSelect').value;
    
    if (!selectedPrinter) {
      showError('Please select a printer');
      return;
    }

    // Generate print data based on printer type
    const printData = generatePrintData(orderData, selectedPrinter);
    
    // Submit print job
    const result = await bridgeClient.print(
      selectedPrinter,
      printData.data,
      printData.format
    );

    if (result.success) {
      showSuccess(`Print job submitted: ${result.jobId}`);
      monitorPrintJob(result.jobId);
    } else {
      showError(`Print failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Print error:', error);
    showError('Failed to submit print job');
  }
}

function generatePrintData(orderData, printerId) {
  const printer = getPrinterById(printerId);
  
  switch (printer.supportedProtocols[0]) {
    case 'ESC/POS':
      return {
        format: 'escpos',
        data: generateEscPosReceipt(orderData)
      };
    case 'ZPL':
      return {
        format: 'zpl',
        data: generateZplLabel(orderData)
      };
    default:
      return {
        format: 'raw',
        data: generateRawReceipt(orderData)
      };
  }
}
```

#### Receipt Generation Examples

**ESC/POS Receipt:**
```javascript
function generateEscPosReceipt(order) {
  const esc = String.fromCharCode(27);
  const gs = String.fromCharCode(29);
  
  let receipt = '';
  
  // Initialize printer
  receipt += esc + '@'; // Reset
  receipt += esc + '!' + String.fromCharCode(1); // Double height
  receipt += 'RECEIPT\n';
  receipt += esc + '!' + String.fromCharCode(0); // Normal
  
  // Header
  receipt += '=================\n';
  receipt += `Order #: ${order.id}\n`;
  receipt += `Date: ${new Date().toLocaleString()}\n`;
  receipt += '=================\n\n';
  
  // Items
  order.items.forEach(item => {
    receipt += `${item.name.padEnd(20)} ${item.quantity}x $${item.price.toFixed(2)}\n`;
  });
  
  // Total
  receipt += '\n-----------------\n';
  receipt += `TOTAL: $${order.total.toFixed(2)}\n`;
  receipt += '=================\n\n';
  
  // Footer
  receipt += 'Thank you for your business!\n';
  receipt += esc + 'd' + String.fromCharCode(3); // Feed 3 lines
  receipt += esc + 'm'; // Partial cut
  
  return receipt;
}
```

**ZPL Label:**
```javascript
function generateZplLabel(order) {
  return `
^XA
^FO50,50^A0N,50,50^FDOrder #${order.id}^FS
^FO50,120^A0N,30,30^FD${order.customer.name}^FS
^FO50,160^A0N,30,30^FD${order.items.map(i => i.name).join(', ')}^FS
^FO50,200^A0N,40,40^FDTotal: $${order.total.toFixed(2)}^FS
^FO50,260^BQN,2,10^FD${order.qrCode}^FS
^XZ
  `.trim();
}
```

### Step 5: Security Implementation

#### HTTPS Enforcement
```javascript
// Force HTTPS in production
if (window.location.protocol !== 'https:') {
  window.location.href = window.location.href.replace('http:', 'https:');
}
```

#### Connection Authentication
```javascript
// Implement connection authentication
const connectionToken = localStorage.getItem('bridge_token');

const bridgeClient = new HardwareBridgeClient({
  url: 'wss://bridge.yourdomain.com:8443',
  headers: {
    'Authorization': `Bearer ${connectionToken}`,
    'X-Origin': window.location.origin
  }
});
```

#### Origin Validation
```javascript
// Validate bridge connection origin
bridgeClient.onConnectionStateChange((connected) => {
  if (connected) {
    // Verify connection is to expected bridge
    bridgeClient.getSystemInfo().then(info => {
      if (info.platform !== 'win32' && info.platform !== 'darwin') {
        console.warn('Unexpected bridge platform:', info.platform);
      }
    });
  }
});
```

### Step 6: Error Handling & User Experience

#### Connection Status Monitoring
```javascript
// Monitor connection status
bridgeClient.onConnectionStateChange((connected) => {
  updateConnectionStatus(connected);
  
  if (!connected) {
    showConnectionError('Lost connection to local printer');
    // Attempt reconnection
    setTimeout(() => bridgeClient.connect(), 5000);
  }
});

function updateConnectionStatus(connected) {
  const statusElement = document.getElementById('bridgeStatus');
  if (connected) {
    statusElement.innerHTML = '<span class="status-connected">●</span> Connected to local printer';
    statusElement.className = 'text-success';
  } else {
    statusElement.innerHTML = '<span class="status-disconnected">●</span> Not connected to local printer';
    statusElement.className = 'text-danger';
  }
}
```

#### Print Job Monitoring
```javascript
// Monitor print job status
async function monitorPrintJob(jobId) {
  const checkInterval = setInterval(async () => {
    try {
      const jobs = await bridgeClient.getQueueJobs(null, null, 10);
      const job = jobs.find(j => j.id === jobId);
      
      if (job) {
        updatePrintStatus(job.status);
        
        if (job.status === 'completed') {
          clearInterval(checkInterval);
          showSuccess('Print completed successfully');
        } else if (job.status === 'failed') {
          clearInterval(checkInterval);
          showError(`Print failed: ${job.error}`);
        }
      }
    } catch (error) {
      console.error('Job monitoring error:', error);
      clearInterval(checkInterval);
    }
  }, 1000);
}

function updatePrintStatus(status) {
  const statusElement = document.getElementById('printStatus');
  statusElement.textContent = `Print status: ${status}`;
  statusElement.className = `badge bg-${getStatusColor(status)}`;
}

function getStatusColor(status) {
  switch (status) {
    case 'pending': return 'warning';
    case 'processing': return 'primary';
    case 'completed': return 'success';
    case 'failed': return 'danger';
    default: return 'secondary';
  }
}
```

## Deployment Scenarios

### Scenario 1: Single Location (Restaurant/Store)
```
Local Network:
┌─────────────────┐    ┌─────────────────┐
│   Web Server    │    │   Local PC      │
│   (Cloud)       │◄──►│   Hardware      │
│                 │    │   Bridge        │
└─────────────────┘    └─────────────────┘
       │                       │
       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Customers     │    │   Local Printer │
│   (Internet)    │    │   (ESC/POS)     │
└─────────────────┘    └─────────────────┘
```

### Scenario 2: Multiple Locations (Chain Stores)
```
Cloud Infrastructure:
┌─────────────────────────────────────────┐
│           Load Balancer                 │
└───────────┬───────────┬─────────┬───────┘
            │           │         │
    ┌───────▼───────┐ ┌─▼─────────▼─┐ ┌───▼─────────┐
│   Web Server 1  │ │ Web Server 2 │ │ Web Server 3 │
└─────────────────┘ └──────────────┘ └──────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Store 1       │ │   Store 2       │ │   Store 3       │
│   Hardware      │ │   Hardware      │ │   Hardware      │
│   Bridge        │ │   Bridge        │ │   Bridge        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Printer 1     │ │   Printer 2     │ │   Printer 3     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Security Considerations

### Network Security
- **TLS Encryption**: Always use WSS (WebSocket Secure) in production
- **Origin Validation**: Restrict allowed origins to your domains only
- **Certificate Management**: Use valid SSL certificates from trusted CAs
- **Firewall Rules**: Restrict access to necessary ports only

### Application Security
- **Authentication**: Implement user authentication for print operations
- **Authorization**: Control which users can access which printers
- **Input Validation**: Validate all print data before submission
- **Rate Limiting**: Prevent abuse with connection and request limits

### Data Security
- **Local Data**: Print jobs are processed locally, no sensitive data leaves the local network
- **Queue Encryption**: SQLite database can be encrypted for sensitive environments
- **Audit Logging**: Maintain logs of all print operations for compliance

## Troubleshooting

### Common Issues

#### Connection Failed
```javascript
// Debug connection issues
bridgeClient.onConnectionStateChange((connected, error) => {
  if (!connected) {
    console.error('Connection failed:', error);
    
    // Check common issues
    if (error.message.includes('ECONNREFUSED')) {
      showError('Local bridge service is not running');
    } else if (error.message.includes('ETIMEDOUT')) {
      showError('Cannot reach local bridge service');
    } else if (error.message.includes('CERT')) {
      showError('SSL certificate issue - check certificate configuration');
    }
  }
});
```

#### Print Job Failed
```javascript
// Handle print failures
async function handlePrintError(error, orderData) {
  if (error.code === -32601) {
    showError('Printer not found - check device connection');
  } else if (error.code === -32603) {
    showError('Printer error - check printer status');
  } else if (error.message.includes('timeout')) {
    showError('Print timeout - printer may be offline');
  } else {
    showError(`Print failed: ${error.message}`);
  }
  
  // Offer alternatives
  offerBrowserPrintFallback(orderData);
}
```

#### Certificate Issues
```bash
# Check certificate validity
openssl x509 -in server.crt -text -noout

# Test connection with curl
curl -v https://bridge.yourdomain.com:8443
```

### Performance Optimization

#### Connection Pooling
```javascript
// Reuse connections for multiple operations
const bridgeClient = new HardwareBridgeClient({
  url: 'wss://bridge.yourdomain.com:8443',
  maxReconnectAttempts: 10,
  reconnectInterval: 5000
});

// Keep connection alive
setInterval(() => {
  if (bridgeClient.isConnected) {
    bridgeClient.sendNotification('ping');
  }
}, 30000);
```

#### Batch Operations
```javascript
// Process multiple print jobs efficiently
async function batchPrintOrders(orders) {
  const results = await Promise.all(
    orders.map(order => bridgeClient.print(
      selectedPrinter,
      generatePrintData(order),
      'raw'
    ))
  );
  
  return results.filter(r => r.success).length;
}
```

## Monitoring and Analytics

### Health Monitoring
```javascript
// Monitor bridge health
setInterval(async () => {
  try {
    const health = await bridgeClient.getSystemHealth();
    
    // Send metrics to analytics
    analytics.track('bridge_health', {
      status: health.status,
      connectedDevices: health.connectedDevices,
      activeConnections: health.activeConnections,
      jobsInQueue: health.jobsInQueue
    });
  } catch (error) {
    analytics.track('bridge_health_error', { error: error.message });
  }
}, 60000); // Every minute
```

### Print Analytics
```javascript
// Track print operations
async function trackPrintOperation(order, result) {
  analytics.track('print_completed', {
    orderId: order.id,
    printerId: selectedPrinter,
    format: printData.format,
    bytesPrinted: result.bytesPrinted,
    success: result.success,
    timestamp: new Date()
  });
}
```

## Conclusion

This setup enables secure, reliable printing from publicly hosted websites to local printers by:

1. **Establishing secure WebSocket connections** between web applications and local bridge services
2. **Implementing proper security measures** including TLS encryption and origin validation
3. **Providing comprehensive error handling** and user feedback mechanisms
4. **Supporting multiple printer protocols** for maximum compatibility
5. **Offering monitoring and analytics** for operational insights

The solution maintains security while providing the convenience of web-based printing to local hardware devices.