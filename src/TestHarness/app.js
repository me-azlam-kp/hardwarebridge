// Hardware Bridge Test Harness Application
class HardwareBridgeTestHarness {
    constructor() {
        this.client = null;
        this.devices = [];
        this.selectedDevice = null;
        this.queueJobs = [];
        this.throughputData = [];
        this.throughputChart = null;
        this.startTime = Date.now();
        this.messageCount = 0;
        
        this.initializeChart();
        this.bindEvents();
        this.startUptimeTimer();
    }

    initializeChart() {
        const ctx = document.getElementById('throughputChart').getContext('2d');
        this.throughputChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Messages/sec',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Errors/sec',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    bindEvents() {
        // Connection events
        document.getElementById('connectBtn').addEventListener('click', () => this.toggleConnection());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        
        // Device events
        document.getElementById('refreshDevicesBtn').addEventListener('click', () => this.refreshDevices());
        document.getElementById('watchDevicesBtn').addEventListener('click', () => this.toggleDeviceWatch());
        document.getElementById('deviceTypeFilter').addEventListener('change', () => this.filterDevices());
        
        // Queue events
        document.getElementById('refreshQueueBtn').addEventListener('click', () => this.refreshQueue());
        document.getElementById('processNextBtn').addEventListener('click', () => this.processNextJob());
        document.getElementById('cancelJobBtn').addEventListener('click', () => this.cancelSelectedJob());
        
        // Print job events
        document.getElementById('printJobForm').addEventListener('submit', (e) => this.submitPrintJob(e));
        
        // Serial communication events
        document.getElementById('openSerialBtn').addEventListener('click', () => this.openSerialPort());
        document.getElementById('closeSerialBtn').addEventListener('click', () => this.closeSerialPort());
        document.getElementById('sendSerialBtn').addEventListener('click', () => this.sendSerialData());
        document.getElementById('receiveSerialBtn').addEventListener('click', () => this.receiveSerialData());
        
        // USB HID events
        document.getElementById('openUsbBtn').addEventListener('click', () => this.openUsbDevice());
        document.getElementById('closeUsbBtn').addEventListener('click', () => this.closeUsbDevice());
        document.getElementById('sendUsbReportBtn').addEventListener('click', () => this.sendUsbReport());
        document.getElementById('receiveUsbReportBtn').addEventListener('click', () => this.receiveUsbReport());
    }

    startUptimeTimer() {
        setInterval(() => {
            const uptime = Date.now() - this.startTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            document.getElementById('uptime').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        
        if (connected) {
            statusElement.innerHTML = '<span class="status-indicator status-connected"></span>Connected';
            connectBtn.innerHTML = '<i class="fas fa-unlink me-1"></i>Disconnect';
            connectBtn.classList.remove('btn-outline-light');
            connectBtn.classList.add('btn-light');
        } else {
            statusElement.innerHTML = '<span class="status-indicator status-disconnected"></span>Disconnected';
            connectBtn.innerHTML = '<i class="fas fa-plug me-1"></i>Connect';
            connectBtn.classList.remove('btn-light');
            connectBtn.classList.add('btn-outline-light');
        }
    }

    async toggleConnection() {
        if (this.client && this.client.isConnected) {
            this.client.disconnect();
            this.updateConnectionStatus(false);
            this.log('Disconnected from Hardware Bridge service', 'info');
        } else {
            await this.connect();
        }
    }

    async connect() {
        try {
            const url = document.getElementById('serverUrl').value;
            this.log(`Connecting to ${url}...`, 'info');
            
            // Import the client library (in a real implementation, this would be bundled)
            // For now, we'll simulate the client
            this.client = {
                isConnected: true,
                connect: async () => {},
                disconnect: () => {},
                enumerateDevices: async () => this.simulateDevices(),
                watchDevices: async () => {},
                unwatchDevices: async () => {},
                print: async (deviceId, data, format) => this.simulatePrint(deviceId, data, format),
                getQueueStatus: async () => this.simulateQueueStatus(),
                getQueueJobs: async () => this.simulateQueueJobs()
            };
            
            await this.client.connect();
            this.updateConnectionStatus(true);
            this.log('Connected to Hardware Bridge service', 'success');
            
            // Set up event listeners
            this.client.onConnectionStateChange = (connected) => {
                this.updateConnectionStatus(connected);
            };
            
            // Initial data load
            await this.refreshDevices();
            await this.refreshQueue();
            
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
            this.updateConnectionStatus(false);
        }
    }

    async testConnection() {
        this.log('Testing connection...', 'info');
        // Simulate connection test
        setTimeout(() => {
            this.log('Connection test completed', 'success');
        }, 1000);
    }

    simulateDevices() {
        return [
            {
                id: 'printer_test1',
                name: 'Test Printer 1',
                type: 'printer',
                status: 'available',
                manufacturer: 'Test Manufacturer',
                model: 'Model X1',
                isConnected: false,
                lastSeen: new Date()
            },
            {
                id: 'serial_com1',
                name: 'COM1',
                type: 'serial',
                status: 'available',
                manufacturer: 'Microsoft',
                model: 'Serial Port',
                isConnected: false,
                lastSeen: new Date()
            },
            {
                id: 'usbhid_1234_5678',
                name: 'USB HID Device',
                type: 'usbhid',
                status: 'available',
                manufacturer: 'USB Vendor',
                model: 'HID Device',
                isConnected: false,
                lastSeen: new Date()
            }
        ];
    }

    async refreshDevices() {
        if (!this.client) {
            this.log('Not connected to Hardware Bridge service', 'warning');
            return;
        }

        try {
            this.log('Refreshing devices...', 'info');
            this.devices = await this.client.enumerateDevices();
            this.renderDevices();
            this.log(`Found ${this.devices.length} devices`, 'success');
        } catch (error) {
            this.log(`Error refreshing devices: ${error.message}`, 'error');
        }
    }

    renderDevices() {
        const container = document.getElementById('devicesList');
        const filter = document.getElementById('deviceTypeFilter').value;
        
        const filteredDevices = filter ? this.devices.filter(d => d.type === filter) : this.devices;
        
        if (filteredDevices.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">No devices found</div>';
            return;
        }

        container.innerHTML = filteredDevices.map(device => `
            <div class="card device-card mb-2" onclick="testHarness.selectDevice('${device.id}')">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${device.name}</h6>
                            <small class="text-muted">${device.manufacturer} - ${device.model}</small>
                        </div>
                        <div class="text-end">
                            <span class="device-type-badge ${device.type}-badge">${device.type.toUpperCase()}</span>
                            <div class="mt-1">
                                <span class="badge ${device.isConnected ? 'bg-success' : 'bg-secondary'}">
                                    ${device.isConnected ? 'Connected' : 'Available'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    selectDevice(deviceId) {
        this.selectedDevice = this.devices.find(d => d.id === deviceId);
        this.renderDeviceOperations();
        this.log(`Selected device: ${this.selectedDevice?.name}`, 'info');
    }

    renderDeviceOperations() {
        const container = document.getElementById('deviceOperations');
        if (!this.selectedDevice) {
            container.innerHTML = '<div class="text-center text-muted py-4">Select a device to view operations</div>';
            return;
        }

        const device = this.selectedDevice;
        let operationsHtml = `
            <div class="mb-3">
                <h6>${device.name}</h6>
                <small class="text-muted">${device.manufacturer} - ${device.model}</small>
            </div>
        `;

        switch (device.type) {
            case 'printer':
                operationsHtml += this.renderPrinterOperations(device);
                break;
            case 'serial':
                operationsHtml += this.renderSerialOperations(device);
                break;
            case 'usbhid':
                operationsHtml += this.renderUsbHidOperations(device);
                break;
        }

        container.innerHTML = operationsHtml;
    }

    renderPrinterOperations(device) {
        return `
            <div class="mb-3">
                <button class="btn btn-primary btn-sm me-2" onclick="testHarness.getPrinterStatus('${device.id}')">
                    <i class="fas fa-info-circle me-1"></i>Get Status
                </button>
                <button class="btn btn-secondary btn-sm" onclick="testHarness.getPrinterCapabilities('${device.id}')">
                    <i class="fas fa-cog me-1"></i>Capabilities
                </button>
            </div>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Use the Print Job Submission panel below to send print jobs to this device.
            </div>
        `;
    }

    renderSerialOperations(device) {
        return `
            <div class="mb-3">
                <button class="btn btn-success btn-sm me-2" onclick="testHarness.openSerialPort('${device.id}')">
                    <i class="fas fa-door-open me-1"></i>Open Port
                </button>
                <button class="btn btn-warning btn-sm me-2" onclick="testHarness.closeSerialPort('${device.id}')">
                    <i class="fas fa-door-closed me-1"></i>Close Port
                </button>
                <button class="btn btn-info btn-sm" onclick="testHarness.getSerialStatus('${device.id}')">
                    <i class="fas fa-info-circle me-1"></i>Get Status
                </button>
            </div>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Use the Serial Port Communication panel below to send and receive data.
            </div>
        `;
    }

    renderUsbHidOperations(device) {
        return `
            <div class="mb-3">
                <button class="btn btn-success btn-sm me-2" onclick="testHarness.openUsbDevice('${device.id}')">
                    <i class="fas fa-plug me-1"></i>Open Device
                </button>
                <button class="btn btn-warning btn-sm me-2" onclick="testHarness.closeUsbDevice('${device.id}')">
                    <i class="fas fa-eject me-1"></i>Close Device
                </button>
                <button class="btn btn-info btn-sm" onclick="testHarness.getUsbStatus('${device.id}')">
                    <i class="fas fa-info-circle me-1"></i>Get Status
                </button>
            </div>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Use the USB HID Device Communication panel below to send and receive reports.
            </div>
        `;
    }

    filterDevices() {
        this.renderDevices();
    }

    async toggleDeviceWatch() {
        if (!this.client) {
            this.log('Not connected to Hardware Bridge service', 'warning');
            return;
        }

        try {
            const btn = document.getElementById('watchDevicesBtn');
            if (btn.classList.contains('active')) {
                await this.client.unwatchDevices();
                btn.classList.remove('active', 'btn-primary');
                btn.classList.add('btn-outline-secondary');
                btn.innerHTML = '<i class="fas fa-eye me-1"></i>Watch';
                this.log('Stopped watching devices', 'info');
            } else {
                await this.client.watchDevices();
                btn.classList.add('active', 'btn-primary');
                btn.classList.remove('btn-outline-secondary');
                btn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Stop Watching';
                this.log('Started watching devices', 'info');
            }
        } catch (error) {
            this.log(`Error toggling device watch: ${error.message}`, 'error');
        }
    }

    // Device-specific operations
    async getPrinterStatus(deviceId) {
        try {
            this.log(`Getting printer status for ${deviceId}...`, 'info');
            const status = await this.client.getPrinterStatus(deviceId);
            this.log(`Printer status: ${JSON.stringify(status, null, 2)}`, 'success');
        } catch (error) {
            this.log(`Error getting printer status: ${error.message}`, 'error');
        }
    }

    async getPrinterCapabilities(deviceId) {
        try {
            this.log(`Getting printer capabilities for ${deviceId}...`, 'info');
            const capabilities = await this.client.getPrinterCapabilities(deviceId);
            this.log(`Printer capabilities: ${JSON.stringify(capabilities, null, 2)}`, 'success');
        } catch (error) {
            this.log(`Error getting printer capabilities: ${error.message}`, 'error');
        }
    }

    async openSerialPort(deviceId) {
        try {
            const config = {
                baudRate: parseInt(document.getElementById('baudRate').value),
                parity: 'None',
                dataBits: parseInt(document.getElementById('dataBits').value),
                stopBits: '1',
                flowControl: 'None'
            };
            
            this.log(`Opening serial port ${deviceId}...`, 'info');
            const result = await this.client.openSerialPort(deviceId, config);
            
            if (result.success) {
                this.log('Serial port opened successfully', 'success');
                document.getElementById('openSerialBtn').disabled = true;
                document.getElementById('closeSerialBtn').disabled = false;
                document.getElementById('sendSerialBtn').disabled = false;
                document.getElementById('receiveSerialBtn').disabled = false;
            } else {
                this.log(`Failed to open serial port: ${result.error}`, 'error');
            }
        } catch (error) {
            this.log(`Error opening serial port: ${error.message}`, 'error');
        }
    }

    async closeSerialPort(deviceId) {
        try {
            this.log(`Closing serial port ${deviceId}...`, 'info');
            const result = await this.client.closeSerialPort(deviceId);
            
            if (result.success) {
                this.log('Serial port closed successfully', 'success');
                document.getElementById('openSerialBtn').disabled = false;
                document.getElementById('closeSerialBtn').disabled = true;
                document.getElementById('sendSerialBtn').disabled = true;
                document.getElementById('receiveSerialBtn').disabled = true;
            } else {
                this.log(`Failed to close serial port: ${result.error}`, 'error');
            }
        } catch (error) {
            this.log(`Error closing serial port: ${error.message}`, 'error');
        }
    }

    async sendSerialData() {
        const deviceId = document.getElementById('serialPortSelect').value;
        const data = document.getElementById('serialData').value;
        
        if (!deviceId || !data) {
            this.log('Please select a serial port and enter data to send', 'warning');
            return;
        }

        try {
            this.log(`Sending serial data to ${deviceId}...`, 'info');
            const result = await this.client.sendSerialData(deviceId, data);
            
            if (result.success) {
                this.log(`Sent ${result.bytesTransferred} bytes successfully`, 'success');
            } else {
                this.log(`Failed to send data: ${result.error}`, 'error');
            }
        } catch (error) {
            this.log(`Error sending serial data: ${error.message}`, 'error');
        }
    }

    async receiveSerialData() {
        const deviceId = document.getElementById('serialPortSelect').value;
        
        if (!deviceId) {
            this.log('Please select a serial port', 'warning');
            return;
        }

        try {
            this.log(`Receiving serial data from ${deviceId}...`, 'info');
            const result = await this.client.receiveSerialData(deviceId);
            
            if (result.success) {
                this.log(`Received ${result.bytesTransferred} bytes: ${result.data}`, 'success');
                document.getElementById('serialData').value = result.data;
            } else {
                this.log(`Failed to receive data: ${result.error}`, 'error');
            }
        } catch (error) {
            this.log(`Error receiving serial data: ${error.message}`, 'error');
        }
    }

    async getSerialStatus(deviceId) {
        try {
            this.log(`Getting serial port status for ${deviceId}...`, 'info');
            const status = await this.client.getSerialPortStatus(deviceId);
            this.log(`Serial port status: ${JSON.stringify(status, null, 2)}`, 'success');
        } catch (error) {
            this.log(`Error getting serial port status: ${error.message}`, 'error');
        }
    }

    // Queue operations
    async refreshQueue() {
        if (!this.client) {
            this.log('Not connected to Hardware Bridge service', 'warning');
            return;
        }

        try {
            this.log('Refreshing queue...', 'info');
            const status = await this.client.getQueueStatus();
            const jobs = await this.client.getQueueJobs();
            
            this.queueJobs = jobs;
            this.renderQueue();
            this.updateQueueStats(status);
            
            this.log(`Queue refreshed: ${jobs.length} jobs`, 'success');
        } catch (error) {
            this.log(`Error refreshing queue: ${error.message}`, 'error');
        }
    }

    renderQueue() {
        const tbody = document.getElementById('queueTableBody');
        
        if (this.queueJobs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <i class="fas fa-info-circle me-2"></i>
                        No jobs in queue
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.queueJobs.map(job => `
            <tr data-job-id="${job.id}">
                <td>${job.id}</td>
                <td>${job.deviceId}</td>
                <td>${job.operation}</td>
                <td>
                    <span class="badge bg-${this.getJobStatusColor(job.status)}">
                        ${job.status}
                    </span>
                </td>
                <td>${new Date(job.createdAt).toLocaleString()}</td>
                <td>${job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}</td>
                <td>${job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}</td>
                <td>${job.retryCount}</td>
            </tr>
        `).join('');
    }

    getJobStatusColor(status) {
        switch (status) {
            case 'pending': return 'warning';
            case 'processing': return 'primary';
            case 'completed': return 'success';
            case 'failed': return 'danger';
            case 'cancelled': return 'secondary';
            default: return 'secondary';
        }
    }

    updateQueueStats(status) {
        document.getElementById('queueStats').textContent = 
            `${status.totalJobs} total, ${status.pendingJobs} pending, ${status.processingJobs} processing`;
    }

    async processNextJob() {
        if (!this.client) {
            this.log('Not connected to Hardware Bridge service', 'warning');
            return;
        }

        try {
            this.log('Processing next job...', 'info');
            const processed = await this.client.processNextJob();
            
            if (processed) {
                this.log('Job processed successfully', 'success');
            } else {
                this.log('No jobs to process', 'info');
            }
            
            await this.refreshQueue();
        } catch (error) {
            this.log(`Error processing next job: ${error.message}`, 'error');
        }
    }

    async cancelSelectedJob() {
        const selectedRow = document.querySelector('#queueTableBody tr.table-active');
        if (!selectedRow) {
            this.log('Please select a job to cancel', 'warning');
            return;
        }

        const jobId = selectedRow.dataset.jobId;
        
        try {
            this.log(`Cancelling job ${jobId}...`, 'info');
            const cancelled = await this.client.cancelQueueJob(jobId);
            
            if (cancelled) {
                this.log(`Job ${jobId} cancelled successfully`, 'success');
            } else {
                this.log(`Failed to cancel job ${jobId}`, 'error');
            }
            
            await this.refreshQueue();
        } catch (error) {
            this.log(`Error cancelling job: ${error.message}`, 'error');
        }
    }

    // Print job submission
    async submitPrintJob(e) {
        e.preventDefault();
        
        if (!this.client) {
            this.log('Not connected to Hardware Bridge service', 'warning');
            return;
        }

        const deviceId = document.getElementById('printerDeviceSelect').value;
        const format = document.getElementById('printFormat').value;
        const data = document.getElementById('printData').value;

        if (!deviceId || !data) {
            this.log('Please select a printer and enter print data', 'warning');
            return;
        }

        try {
            this.log(`Submitting print job to ${deviceId}...`, 'info');
            const result = await this.client.print(deviceId, data, format);
            
            if (result.success) {
                this.log(`Print job submitted successfully: ${result.jobId}`, 'success');
                document.getElementById('printJobForm').reset();
            } else {
                this.log(`Print job failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.log(`Error submitting print job: ${error.message}`, 'error');
        }
    }

    // USB HID operations (simulated)
    async openUsbDevice(deviceId) {
        this.log(`Opening USB device ${deviceId}...`, 'info');
        // Simulate operation
        setTimeout(() => {
            this.log('USB device opened successfully', 'success');
            document.getElementById('openUsbBtn').disabled = true;
            document.getElementById('closeUsbBtn').disabled = false;
            document.getElementById('sendUsbReportBtn').disabled = false;
            document.getElementById('receiveUsbReportBtn').disabled = false;
        }, 500);
    }

    async closeUsbDevice(deviceId) {
        this.log(`Closing USB device ${deviceId}...`, 'info');
        // Simulate operation
        setTimeout(() => {
            this.log('USB device closed successfully', 'success');
            document.getElementById('openUsbBtn').disabled = false;
            document.getElementById('closeUsbBtn').disabled = true;
            document.getElementById('sendUsbReportBtn').disabled = true;
            document.getElementById('receiveUsbReportBtn').disabled = true;
        }, 500);
    }

    async sendUsbReport() {
        const deviceId = document.getElementById('usbDeviceSelect').value;
        const reportId = parseInt(document.getElementById('usbReportId').value);
        const data = document.getElementById('usbSendData').value;

        if (!deviceId || !data) {
            this.log('Please select a USB device and enter data to send', 'warning');
            return;
        }

        this.log(`Sending USB report ${reportId} to ${deviceId}...`, 'info');
        // Simulate operation
        setTimeout(() => {
            this.log(`USB report sent successfully`, 'success');
        }, 500);
    }

    async receiveUsbReport() {
        const deviceId = document.getElementById('usbDeviceSelect').value;
        const reportId = parseInt(document.getElementById('usbReportId').value);

        if (!deviceId) {
            this.log('Please select a USB device', 'warning');
            return;
        }

        this.log(`Receiving USB report ${reportId} from ${deviceId}...`, 'info');
        // Simulate operation
        setTimeout(() => {
            const mockData = '01 02 03 04 05 06 07 08';
            document.getElementById('usbReceiveData').value = mockData;
            this.log(`USB report received: ${mockData}`, 'success');
        }, 1000);
    }

    // Utility methods
    log(message, level = 'info') {
        this.messageCount++;
        document.getElementById('messageCount').textContent = this.messageCount;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        logEntry.innerHTML = `<small>[${timestamp}] ${message}</small>`;
        
        const logContainer = document.getElementById('eventLog');
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Update chart with mock data
        this.updateThroughputChart(level === 'error' ? 1 : 0, level === 'info' ? 1 : 0);
    }

    updateThroughputChart(errors, messages) {
        const now = new Date().toLocaleTimeString();
        this.throughputData.push({ time: now, errors, messages });
        
        if (this.throughputData.length > 20) {
            this.throughputData.shift();
        }
        
        this.throughputChart.data.labels = this.throughputData.map(d => d.time);
        this.throughputChart.data.datasets[0].data = this.throughputData.map(d => d.messages);
        this.throughputChart.data.datasets[1].data = this.throughputData.map(d => d.errors);
        this.throughputChart.update();
    }

    // Simulate operations
    simulatePrint(deviceId, data, format) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    jobId: 'job_' + Date.now(),
                    bytesPrinted: data.length,
                    timestamp: new Date()
                });
            }, 2000);
        });
    }

    simulateQueueStatus() {
        return {
            totalJobs: Math.floor(Math.random() * 10),
            pendingJobs: Math.floor(Math.random() * 5),
            processingJobs: Math.floor(Math.random() * 2),
            completedJobs: Math.floor(Math.random() * 20),
            failedJobs: Math.floor(Math.random() * 3),
            lastProcessed: new Date(),
            averageProcessingTime: Math.random() * 1000
        };
    }

    simulateQueueJobs() {
        const jobs = [];
        const statuses = ['pending', 'processing', 'completed', 'failed'];
        const operations = ['print', 'serial.send', 'usb.sendReport'];
        
        for (let i = 0; i < 5; i++) {
            jobs.push({
                id: 'job_' + (Date.now() + i),
                deviceId: 'device_' + i,
                deviceType: ['printer', 'serial', 'usbhid'][Math.floor(Math.random() * 3)],
                operation: operations[Math.floor(Math.random() * operations.length)],
                status: statuses[Math.floor(Math.random() * statuses.length)],
                createdAt: new Date(Date.now() - Math.random() * 3600000),
                startedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 1800000) : null,
                completedAt: Math.random() > 0.6 ? new Date(Date.now() - Math.random() * 900000) : null,
                retryCount: Math.floor(Math.random() * 3)
            });
        }
        
        return jobs;
    }

    onDeviceEvent(event) {
        this.log(`Device event: ${event.eventType} - ${event.deviceId}`, 'info');
        // Refresh devices on certain events
        if (['connected', 'disconnected', 'discovered', 'removed'].includes(event.eventType)) {
            this.refreshDevices();
        }
    }
}

// Global functions for HTML onclick handlers
function showAbout() {
    alert('Hardware Bridge Test Harness v1.0.0\n\nA comprehensive testing tool for the Hardware Bridge WebSocket service.\n\nFeatures:\n- Device discovery and enumeration\n- Real-time device monitoring\n- Print job submission and management\n- Serial port communication\n- USB HID device interaction\n- Queue management and monitoring\n- Performance metrics and visualization');
}

function showHelp() {
    alert('Help:\n\n1. Connect to the Hardware Bridge service using the WebSocket URL\n2. Discover devices using the Refresh button\n3. Select a device to view available operations\n4. Use the appropriate panels to interact with devices\n5. Monitor real-time events and performance metrics\n\nFor more information, see the documentation.');
}

// Initialize the test harness
const testHarness = new HardwareBridgeTestHarness();

// Make it globally available for HTML onclick handlers
window.testHarness = testHarness;