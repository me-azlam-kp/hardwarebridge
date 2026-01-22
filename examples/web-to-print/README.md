# 🖨️ Hardware Bridge Web-to-Print Application

A modern, professional web-to-print application that demonstrates how to use the **@hardwarebridge/client** npm package to create a complete printing solution with hardware device support.

## 🌟 Features

- ✅ **Modern ES6+ JavaScript** with ES modules
- ✅ **Professional UI/UX** with Bootstrap 5 and custom styling
- ✅ **Multi-format printing** (Raw, ESC/POS, ZPL, EPL)
- ✅ **Real-time device discovery** and management
- ✅ **Queue management** with live status updates
- ✅ **Print preview** with character counting
- ✅ **Responsive design** for all devices
- ✅ **Comprehensive error handling** and logging
- ✅ **Accessibility features** and keyboard navigation
- ✅ **Professional styling** with gradients and animations

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ installed
- Hardware Bridge server running on `ws://localhost:8443`
- Modern web browser with ES modules support

### Installation
```bash
cd examples/web-to-print
npm install
```

### Start the Application
```bash
npm start
# or
npm run dev
```

### Open in Browser
Navigate to: `http://localhost:3001`

## 📋 Application Structure

```
examples/web-to-print/
├── package.json          # Dependencies and scripts
├── server.js            # Express server to serve the app
├── index.html           # Modern HTML interface
├── app.js              # Main application logic (ES modules)
└── README.md           # This documentation
```

## 🎯 How to Use

### 1. Connect to Hardware Bridge
- Click **"Connect"** to establish WebSocket connection
- The app will automatically discover available devices
- Select a printer from the dropdown

### 2. Create an Order
- Enter customer name
- Items are automatically added (start with one item)
- Add more items using the **"Add Item"** button
- Set quantities and prices for each item

### 3. Choose Print Format
- **Raw Text**: Universal format, works with most printers
- **ESC/POS**: For receipt printers and POS systems
- **ZPL**: For Zebra label printers
- **EPL**: For Eltron label printers

### 4. Print Preview
- Preview updates automatically as you type
- Shows character count for optimization
- Displays exactly what will be printed

### 5. Print Order
- Click **"Print Order"** to send to printer
- View real-time queue status
- Get confirmation with job ID

## 🖨️ Print Format Examples

### Raw Text Format
```
RECEIPT #20240122001
================
Date: 1/22/2024, 12:30:45 PM
Customer: John Doe

ITEMS:
- Coffee: 2 x $5.00 = $10.00
- Sandwich: 1 x $8.50 = $8.50

----------------
TOTAL: $18.50

Thank you!
================
```

### ESC/POS Format (Receipt)
```
RECEIPT #20240122001
================
Date: 1/22/2024, 12:30:45 PM
Customer: John Doe

Coffee         2   $5.00
Sandwich       1   $8.50
----------------
TOTAL:                $18.50

Thank you!
================
```

### ZPL Format (Label)
```
^XA
^FO50,30^ADN,36,20^FDRECEIPT #20240122001^FS
^FO50,80^ADN,18,10^FDDate: 1/22/2024, 12:30:45 PM^FS
^FO50,120^BCN,80,Y,N,N^FD20240122001^FS
^XZ
```

### EPL Format (Label)
```
N
q609
Q203,26
A5,26,0,2,1,1,N,"RECEIPT #20240122001"
A5,56,0,2,1,1,N,"Date: 1/22/2024, 12:30:45 PM"
B5,86,0,1,2,2,100,B,"20240122001"
P1
```

## 🔧 Technical Implementation

### Using the Hardware Bridge Client

```javascript
import { HardwareBridgeClient } from '@hardwarebridge/client';

const client = new HardwareBridgeClient({
  url: 'ws://localhost:8443',
  autoReconnect: true,
  reconnectInterval: 5000
});

await client.connect();
```

### Device Discovery
```javascript
const devices = await client.enumerateDevices();
const printer = devices.find(d => d.type === 'printer');
```

### Multi-Format Printing
```javascript
// Raw text format
await client.print(printer.id, content, 'raw');

// ESC/POS format
await client.print(printer.id, receiptContent, 'escpos');

// ZPL format
await client.print(printer.id, labelContent, 'zpl');

// EPL format
await client.print(printer.id, labelContent, 'epl');
```

### Queue Management
```javascript
const status = await client.getQueueStatus();
const jobs = await client.getQueueJobs();
```

## 🎨 UI/UX Features

- **Modern Design**: Gradient backgrounds, rounded corners, smooth animations
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Live preview, instant feedback
- **Professional Styling**: Bootstrap 5 with custom CSS
- **Accessibility**: Proper ARIA labels, keyboard navigation
- **Loading States**: Visual feedback during operations

## 📊 Queue Management

The application includes comprehensive queue management:

- **Real-time Status**: Live updates of queue statistics
- **Job Tracking**: Monitor pending, processing, and completed jobs
- **Queue Control**: Refresh and clear queue functionality
- **Statistics**: Total, pending, processing, completed job counts

## 🔒 Security Features

- **Input Validation**: All user inputs are validated
- **Error Handling**: Comprehensive error handling and user feedback
- **Connection Security**: WebSocket connection with proper error handling
- **Data Sanitization**: Safe handling of user data

## 🧪 Testing

### Manual Testing
1. Start the Hardware Bridge server
2. Run `npm start` in this directory
3. Open http://localhost:3001 in browser
4. Connect to Hardware Bridge
5. Test all features:
   - Device discovery
   - Multi-format printing
   - Queue management
   - Error scenarios

### Automated Testing
```bash
# Run basic functionality test
node test.js
```

## 🚀 Advanced Features

### Real-time Device Events
```javascript
client.onDeviceEvent((event) => {
  switch (event.type) {
    case 'connected':
      console.log('Device connected:', event.deviceId);
      break;
    case 'disconnected':
      console.log('Device disconnected:', event.deviceId);
      break;
    case 'error':
      console.log('Device error:', event.error);
      break;
  }
});
```

### Connection State Management
```javascript
client.onConnectionStateChange((connected) => {
  if (connected) {
    console.log('Connected to Hardware Bridge');
  } else {
    console.log('Disconnected from Hardware Bridge');
  }
});
```

### Error Handling
```javascript
try {
  await client.print(printerId, content, format);
} catch (error) {
  console.error('Print failed:', error.message);
  // Handle specific error types
  if (error.code === 'DEVICE_NOT_FOUND') {
    // Handle device not found
  } else if (error.code === 'PRINTER_OFFLINE') {
    // Handle printer offline
  }
}
```

## 📚 Additional Resources

- **Full API Documentation**: See the main README in the package
- **Examples**: Check out the test applications in `src/TestApp/`
- **Hardware Bridge Server**: Ensure server is running on port 8443
- **TypeScript Support**: Full type definitions included

## 🎯 Next Steps

1. **Customize the UI** - Modify colors, layout, branding
2. **Add more features** - Barcode generation, QR codes, images
3. **Integrate with backend** - Database, user management, analytics
4. **Deploy to production** - Cloud hosting, CDN, monitoring
5. **Extend functionality** - Mobile app, API integrations

## 🤝 Contributing

We welcome contributions! Please see the main repository for contribution guidelines.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built with **@hardwarebridge/client** npm package
- Styled with **Bootstrap 5** and custom CSS
- Powered by **WebSocket** technology
- Inspired by modern web development practices

---

**Happy Printing!** 🖨️✨

**Developed by Azlam**