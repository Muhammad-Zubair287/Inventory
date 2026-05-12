import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/database.js';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { HTTP_STATUS } from './config/constants.js';

/**
 * Main Application Entry Point
 * Following layered architecture and best practices
 */

// Generate unique server instance ID on each restart
global.SERVER_INSTANCE_ID = Date.now().toString();
console.log('🔄 Server Instance ID:', global.SERVER_INSTANCE_ID);

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Database Connection
connectDB();

// Import models to ensure they're registered
import './models/User.js';
import './models/Product.js';
import './models/Supplier.js';
import './models/Transaction.js';
import './models/Warehouse.js';

// CORS configuration - enforces allowed origins from CORS_ORIGIN env variable
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1'];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Middleware
app.options('/{*path}', cors(corsOptions)); // Handle preflight requests for all routes (Express 5 syntax)
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Root route - redirect to login page (MUST be before static files)
app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Welcome to Inventory Management System API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/api-docs (coming soon)',
    },
  });
});

// Serve static files from FrontEnd directory (AFTER specific routes)
app.use(express.static(path.join(__dirname, '../FrontEnd')));

// Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import and use route modules
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import userDashboardRoutes from './routes/userDashboardRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/user-dashboard', userDashboardRoutes);

// Serve frontend pages for non-API routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../FrontEnd/pages/login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../FrontEnd/pages/admin.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../FrontEnd/pages/dashboard.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server is running on http://localhost:${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

