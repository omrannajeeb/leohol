import recipientRoutes from './routes/recipientRoutes.js';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { errorHandler } from './middleware/errorHandler.js';

// Route Imports
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import authRoutes from './routes/authRoutes.js';
import heroRoutes from './routes/heroRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import navigationCategoryRoutes from './routes/navigationCategoryRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import footerRoutes from './routes/footerRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import backgroundRoutes from './routes/backgroundRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import giftCardRoutes from './routes/giftCardRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js'; // Added Shipping Routes
import revenueRoutes from './routes/revenueRoutes.js'; // Added Revenue Routes
import pushRoutes from './routes/pushRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import layoutRoutes from './routes/layoutRoutes.js';
import dbRoutes from './routes/dbRoutes.js';
import dbManager from './services/dbManager.js';
import brandRoutes from './routes/brandRoutes.js';
import cloudinaryRoutes from './routes/cloudinaryRoutes.js';
import paypalRoutes from './routes/paypalRoutes.js';

// Path Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment Variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Serve static for service worker if behind express (especially in production)
app.use(express.static(path.resolve(__dirname, '../public')));
// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// MongoDB connection handled by dbManager service

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/navigation', navigationCategoryRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/backgrounds', backgroundRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/shipping', shippingRoutes); // Added Shipping Routes
app.use('/api/revenue', revenueRoutes); // Added Revenue Routes
app.use('/api/push', pushRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/layout', layoutRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/db', dbRoutes);

// Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// WebSocket setup
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, request) => {
  console.log('New WebSocket connection established');
  clients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection_established',
    data: { message: 'Connected to real-time updates' },
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data);
      
      // Handle different message types if needed
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Function to broadcast to all connected clients
export function broadcastToClients(data) {
  const message = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  });
  
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending message to client:', error);
        clients.delete(client);
      }
    }
  });
}

// Make broadcaster accessible to routes/controllers without creating import cycles
// Routes can access it via req.app.get('broadcastToClients')
app.set('broadcastToClients', broadcastToClients);

// Initialize server
const startServer = async () => {
  if (process.env.SKIP_DB === '1') {
    console.warn('Starting server with SKIP_DB=1 (database connection skipped).');
    server.listen(PORT, () => {
      console.log(`Server running (no DB) on port ${PORT}`);
      console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
    });
    return;
  }

  // Use dbManager for connection with retry
  let conn = null;
  try {
    conn = await dbManager.connectWithRetry();
  } catch (e) {
    console.error('Database connection failed after retries:', e.message);
  }
  if (!conn) {
    console.error('Database connection failed; server not started. Set SKIP_DB=1 to bypass during development.');
    return;
  }

  // Initialize default data after database connection is established
  try {
    // Import and run data initialization
    const User = (await import('./models/User.js')).default;
    const Settings = (await import('./models/Settings.js')).default;
    const FooterSettings = (await import('./models/FooterSettings.js')).default;
    const Background = (await import('./models/Background.js')).default;

    // Create default admin user
    await User.createDefaultAdmin();

    // Create default settings
    await Settings.createDefaultSettings();

    // Create default footer settings
    await FooterSettings.createDefaultSettings();

    // Create default background
    await Background.createDefaultBackground();

    // Ensure a test delivery company exists
    try {
      const { createTestDeliveryCompany } = await import('./utils/createTestData.js');
      await createTestDeliveryCompany();
    } catch (e) {
      console.warn('Delivery company seeding skipped:', e.message);
    }
    
    

    console.log('✅ Default data initialization completed');
  } catch (error) {
    console.error('❌ Error during data initialization:', error.message);
  }

  // Start real-time services after everything is initialized
  import('./services/realTimeEventService.js');

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
  });
};

// Start server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});
