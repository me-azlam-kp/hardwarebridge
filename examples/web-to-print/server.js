/**
 * Hardware Bridge Web-to-Print Server
 * Simple Express server to serve the web-to-print application
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// API endpoint to check if Hardware Bridge server is running
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Web-to-Print server is running',
    hardwareBridgeUrl: 'ws://localhost:8443',
    timestamp: new Date().toISOString()
  });
});

// API endpoint to get server info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Hardware Bridge Web-to-Print',
    version: '1.0.0',
    description: 'Professional web-to-print application using Hardware Bridge Client',
    features: [
      'Multi-format printing (Raw, ESC/POS, ZPL, EPL)',
      'Real-time device discovery',
      'Queue management',
      'Print preview',
      'Comprehensive logging'
    ],
    dependencies: {
      '@hardwarebridge/client': '^1.0.0',
      'express': '^4.18.2',
      'cors': '^2.8.5'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Hardware Bridge Web-to-Print Server');
  console.log('=====================================');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log('🔗 Hardware Bridge URL: ws://localhost:8443');
  console.log('📁 Serving files from:', __dirname);
  console.log('🎯 Open http://localhost:3000 in your browser');
  console.log('=====================================');
});

export default app;