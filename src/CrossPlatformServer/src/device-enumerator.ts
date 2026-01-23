import { exec } from 'child_process';
import * as os from 'os';
import { PrinterDevice, SerialPortDevice } from './types.js';
import { EnumerationResult } from './network-types.js';

export class DeviceEnumerator {
  private platform: NodeJS.Platform;
  private cachedResult: EnumerationResult | null = null;
  private lastEnumeration = 0;
  private cacheExpiryMs: number;

  constructor(cacheExpiryMs = 10000) {
    this.platform = os.platform();
    this.cacheExpiryMs = cacheExpiryMs;
  }

  async enumerate(options?: { forceRefresh?: boolean }): Promise<EnumerationResult> {
    if (!options?.forceRefresh && this.isCacheValid()) {
      return this.cachedResult!;
    }

    const [printers, serialPorts] = await Promise.all([
      this.enumeratePrinters(),
      this.enumerateSerialPorts(),
    ]);

    const result: EnumerationResult = {
      printers,
      serialPorts,
      timestamp: new Date(),
      platform: this.platform,
    };

    this.cachedResult = result;
    this.lastEnumeration = Date.now();
    return result;
  }

  async enumeratePrinters(): Promise<PrinterDevice[]> {
    try {
      switch (this.platform) {
        case 'darwin':
          return await this.enumeratePrintersMacOS();
        case 'linux':
          return await this.enumeratePrintersLinux();
        case 'win32':
          return await this.enumeratePrintersWindows();
        default:
          console.warn(`[DeviceEnumerator] Unsupported platform for printer enumeration: ${this.platform}`);
          return [];
      }
    } catch (error) {
      console.warn('[DeviceEnumerator] Printer enumeration failed:', error);
      return [];
    }
  }

  async enumerateSerialPorts(): Promise<SerialPortDevice[]> {
    try {
      switch (this.platform) {
        case 'darwin':
          return await this.enumerateSerialPortsMacOS();
        case 'linux':
          return await this.enumerateSerialPortsLinux();
        case 'win32':
          return await this.enumerateSerialPortsWindows();
        default:
          console.warn(`[DeviceEnumerator] Unsupported platform for serial enumeration: ${this.platform}`);
          return [];
      }
    } catch (error) {
      console.warn('[DeviceEnumerator] Serial port enumeration failed:', error);
      return [];
    }
  }

  // --- macOS Printers ---

  private async enumeratePrintersMacOS(): Promise<PrinterDevice[]> {
    const [statusOutput, uriOutput] = await Promise.all([
      this.execCommand('lpstat -p 2>/dev/null || true'),
      this.execCommand('lpstat -v 2>/dev/null || true'),
    ]);
    if (!statusOutput.trim()) return [];
    const printers = this.parseLpstatOutput(statusOutput);
    if (uriOutput.trim()) {
      this.enrichWithConnectionInfo(printers, uriOutput);
      await this.resolveNetworkPrinters(printers);
    }
    return printers;
  }

  // --- Linux Printers ---

  private async enumeratePrintersLinux(): Promise<PrinterDevice[]> {
    const [statusOutput, uriOutput] = await Promise.all([
      this.execCommand('lpstat -p 2>/dev/null || true'),
      this.execCommand('lpstat -v 2>/dev/null || true'),
    ]);
    if (!statusOutput.trim()) return [];
    const printers = this.parseLpstatOutput(statusOutput);
    if (uriOutput.trim()) {
      this.enrichWithConnectionInfo(printers, uriOutput);
      await this.resolveNetworkPrinters(printers);
    }
    return printers;
  }

  // --- Windows Printers ---

  private async enumeratePrintersWindows(): Promise<PrinterDevice[]> {
    try {
      const output = await this.execCommand(
        'powershell -Command "Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | ConvertTo-Json"'
      );
      if (!output.trim()) return [];
      return this.parsePowershellPrinterOutput(output);
    } catch {
      // Fallback to wmic
      try {
        const output = await this.execCommand(
          'wmic printer get Name,DriverName,PortName,PrinterStatus /format:csv 2>nul'
        );
        if (!output.trim()) return [];
        return this.parseWmicPrinterOutput(output);
      } catch {
        return [];
      }
    }
  }

  // --- macOS Serial Ports ---

  private async enumerateSerialPortsMacOS(): Promise<SerialPortDevice[]> {
    const output = await this.execCommand('ls /dev/tty.* /dev/cu.* 2>/dev/null || true');
    if (!output.trim()) return [];
    const paths = output.trim().split('\n').filter(p => p.length > 0);
    return this.parseDevList(paths);
  }

  // --- Linux Serial Ports ---

  private async enumerateSerialPortsLinux(): Promise<SerialPortDevice[]> {
    const output = await this.execCommand(
      'ls /dev/ttyS* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true'
    );
    if (!output.trim()) return [];
    const paths = output.trim().split('\n').filter(p => p.length > 0);
    return this.parseDevList(paths);
  }

  // --- Windows Serial Ports ---

  private async enumerateSerialPortsWindows(): Promise<SerialPortDevice[]> {
    try {
      const output = await this.execCommand(
        'powershell -Command "Get-WMIObject Win32_SerialPort | Select-Object DeviceID,Caption,PNPDeviceID | ConvertTo-Json"'
      );
      if (!output.trim()) return [];
      return this.parseWindowsSerialOutput(output);
    } catch {
      // Fallback: check common COM port names
      const output = await this.execCommand(
        'powershell -Command "[System.IO.Ports.SerialPort]::GetPortNames() | ConvertTo-Json"'
      );
      if (!output.trim()) return [];
      try {
        const ports = JSON.parse(output);
        const portList = Array.isArray(ports) ? ports : [ports];
        return portList.map(port => this.buildSerialDevice(port, port));
      } catch {
        return [];
      }
    }
  }

  // --- Parsers ---

  private parseLpstatOutput(output: string): PrinterDevice[] {
    const printers: PrinterDevice[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      // Format: "printer <name> is <status>. enabled since ..."
      // or: "printer <name> disabled since ..."
      const match = line.match(/^printer\s+(\S+)\s+(?:is\s+)?(\w+)/);
      if (!match) continue;

      const name = match[1];
      const statusStr = match[2].toLowerCase();

      let currentStatus: string;
      if (statusStr === 'idle' || statusStr === 'enabled') {
        currentStatus = 'idle';
      } else if (statusStr === 'printing') {
        currentStatus = 'printing';
      } else if (statusStr === 'disabled') {
        currentStatus = 'offline';
      } else {
        currentStatus = statusStr;
      }

      printers.push({
        id: this.buildPrinterId(name),
        name: name.replace(/_/g, ' '),
        type: 'printer',
        status: currentStatus === 'offline' ? 'error' : 'available',
        manufacturer: 'Unknown',
        model: name,
        serialNumber: '',
        properties: { source: 'os' },
        lastSeen: new Date(),
        isConnected: currentStatus !== 'offline',
        supportedProtocols: ['RAW'],
        maxPrintWidth: 0,
        supportsColor: false,
        supportsDuplex: false,
        maxResolution: 0,
        currentStatus,
        jobsInQueue: 0,
      });
    }

    return printers;
  }

  private parsePowershellPrinterOutput(output: string): PrinterDevice[] {
    try {
      const data = JSON.parse(output);
      const items = Array.isArray(data) ? data : [data];

      return items.map(item => ({
        id: this.buildPrinterId(item.Name),
        name: item.Name,
        type: 'printer' as const,
        status: item.PrinterStatus === 0 ? 'available' as const : 'error' as const,
        manufacturer: 'Unknown',
        model: item.DriverName || 'Unknown',
        serialNumber: '',
        properties: { portName: item.PortName, driverName: item.DriverName, source: 'os' },
        lastSeen: new Date(),
        isConnected: item.PrinterStatus === 0,
        supportedProtocols: ['RAW'],
        maxPrintWidth: 0,
        supportsColor: false,
        supportsDuplex: false,
        maxResolution: 0,
        currentStatus: item.PrinterStatus === 0 ? 'idle' : 'error',
        jobsInQueue: 0,
      }));
    } catch {
      return [];
    }
  }

  private parseWmicPrinterOutput(output: string): PrinterDevice[] {
    const lines = output.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // First line is headers
    const printers: PrinterDevice[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 4) continue;

      const name = parts[1]?.trim();
      if (!name) continue;

      printers.push({
        id: this.buildPrinterId(name),
        name,
        type: 'printer',
        status: 'available',
        manufacturer: 'Unknown',
        model: parts[0]?.trim() || 'Unknown',
        serialNumber: '',
        properties: { portName: parts[2]?.trim(), source: 'os' },
        lastSeen: new Date(),
        isConnected: true,
        supportedProtocols: ['RAW'],
        maxPrintWidth: 0,
        supportsColor: false,
        supportsDuplex: false,
        maxResolution: 0,
        currentStatus: 'idle',
        jobsInQueue: 0,
      });
    }

    return printers;
  }

  private parseDevList(paths: string[]): SerialPortDevice[] {
    // Filter out Bluetooth and other non-serial entries, keep unique base ports
    const seen = new Set<string>();
    const devices: SerialPortDevice[] = [];

    for (const fullPath of paths) {
      const basename = fullPath.split('/').pop() || '';

      // Skip Bluetooth entries
      if (basename.toLowerCase().includes('bluetooth')) continue;

      // Normalize: /dev/cu.xxx and /dev/tty.xxx are the same port
      const normalizedName = basename.replace(/^(cu|tty)\./, '');
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);

      devices.push(this.buildSerialDevice(fullPath, basename));
    }

    return devices;
  }

  private parseWindowsSerialOutput(output: string): SerialPortDevice[] {
    try {
      const data = JSON.parse(output);
      const items = Array.isArray(data) ? data : [data];

      return items.map(item => ({
        id: this.buildSerialId(item.DeviceID),
        name: item.Caption || item.DeviceID,
        type: 'serial' as const,
        status: 'available' as const,
        manufacturer: 'Unknown',
        model: item.Caption || 'Serial Port',
        serialNumber: '',
        properties: { pnpDeviceId: item.PNPDeviceID, source: 'os' },
        lastSeen: new Date(),
        isConnected: false,
        portName: item.DeviceID,
        baudRate: 9600,
        parity: 'None',
        dataBits: 8,
        stopBits: '1',
        flowControl: 'None',
        isOpen: false,
        bytesToRead: 0,
        bytesToWrite: 0,
      }));
    } catch {
      return [];
    }
  }

  // --- Network Printer Resolution ---

  private async resolveNetworkPrinters(printers: PrinterDevice[]): Promise<void> {
    const networkPrinters = printers.filter(p =>
      p.properties.connectionType === 'network' && p.properties.uri?.startsWith('dnssd://')
    );

    await Promise.all(networkPrinters.map(async (printer) => {
      try {
        const uri = printer.properties.uri as string;
        // Parse dnssd URI: dnssd://SERVICE_NAME._type._tcp.domain./?...
        const decoded = decodeURIComponent(uri.replace('dnssd://', ''));
        // e.g. "EPSON WF-2820 Series._ipps._tcp.local./?uuid=..."
        const serviceMatch = decoded.match(/^(.+?)\.(_.+?\._(?:tcp|udp))\.(.+?)\.?\//);
        if (!serviceMatch) return;

        const [, instanceName, serviceType, domain] = serviceMatch;

        // Run dns-sd -L to resolve actual hostname and port (macOS/Linux)
        const cmd = this.platform === 'darwin'
          ? `dns-sd -L "${instanceName}" ${serviceType} ${domain}`
          : `avahi-resolve-service-name "${instanceName}" ${serviceType} ${domain} 2>/dev/null || true`;

        const output = await this.execWithKill(cmd, 3000);
        if (!output) return;

        // Parse output: "... can be reached at HOSTNAME:PORT ..."
        const reachMatch = output.match(/can be reached at\s+(\S+?):(\d+)/);
        if (reachMatch) {
          const resolvedHost = reachMatch[1];
          const resolvedPort = parseInt(reachMatch[2], 10);
          printer.properties.host = resolvedHost;
          printer.properties.port = resolvedPort;

          // Try to resolve .local hostname to IP
          try {
            const dns = await import('dns');
            const ip = await new Promise<string>((resolve) => {
              dns.lookup(resolvedHost, 4, (err, addr) => {
                resolve(err ? resolvedHost : addr);
              });
            });
            if (ip && ip !== resolvedHost) {
              printer.properties.ipAddress = ip;
            }
          } catch {
            // DNS resolution optional
          }
        }
      } catch {
        // Resolution is best-effort, don't fail enumeration
      }
    }));
  }

  private execWithKill(command: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      const child = exec(command, { timeout: timeoutMs + 500 }, () => {
        // Ignore exit errors from killed process
      });

      let output = '';
      child.stdout?.on('data', (data) => { output += data; });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        resolve(output);
      }, timeoutMs);

      child.on('exit', () => {
        clearTimeout(timer);
        resolve(output);
      });
    });
  }

  // --- Connection Enrichment ---

  private enrichWithConnectionInfo(printers: PrinterDevice[], lpstatVOutput: string): void {
    const networkProtocols = ['dnssd://', 'ipp://', 'ipps://', 'socket://', 'http://', 'https://'];
    const lines = lpstatVOutput.trim().split('\n');

    for (const line of lines) {
      // Format: "device for PRINTER_NAME: URI"
      const match = line.match(/^device\s+for\s+(\S+):\s+(.+)$/);
      if (!match) continue;

      const printerName = match[1];
      const uri = match[2].trim();

      const printer = printers.find(p =>
        p.model === printerName || p.id === this.buildPrinterId(printerName)
      );
      if (!printer) continue;

      printer.properties.uri = uri;

      const isNetwork = networkProtocols.some(proto => uri.toLowerCase().startsWith(proto));
      if (isNetwork) {
        printer.properties.connectionType = 'network';

        // Try to extract host from URI
        try {
          const hostMatch = uri.match(/\/\/([^/?]+)/);
          if (hostMatch) {
            const decoded = decodeURIComponent(hostMatch[1]);
            printer.properties.host = decoded;
          }
        } catch {
          // Ignore decode errors
        }
      } else if (uri.startsWith('usb://')) {
        printer.properties.connectionType = 'usb';
      } else {
        printer.properties.connectionType = 'local';
      }
    }
  }

  // --- Helpers ---

  private buildSerialDevice(fullPath: string, name: string): SerialPortDevice {
    return {
      id: this.buildSerialId(name),
      name,
      type: 'serial',
      status: 'available',
      manufacturer: 'Unknown',
      model: 'Serial Port',
      serialNumber: '',
      properties: { path: fullPath, source: 'os' },
      lastSeen: new Date(),
      isConnected: false,
      portName: fullPath,
      baudRate: 9600,
      parity: 'None',
      dataBits: 8,
      stopBits: '1',
      flowControl: 'None',
      isOpen: false,
      bytesToRead: 0,
      bytesToWrite: 0,
    };
  }

  private buildPrinterId(name: string): string {
    return `printer_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }

  private buildSerialId(name: string): string {
    return `serial_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }

  private isCacheValid(): boolean {
    return this.cachedResult !== null && (Date.now() - this.lastEnumeration) < this.cacheExpiryMs;
  }

  private execCommand(command: string, timeout = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { timeout }, (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(new Error(`Command timed out: ${command}`));
          return;
        }
        // Some commands may "fail" but still produce useful output
        resolve(stdout || '');
      });
    });
  }
}
