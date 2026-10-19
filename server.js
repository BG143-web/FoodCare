const path = require('path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware with Helmet
// contentSecurityPolicy is disabled to allow the existing frontend's styles, fonts, and inline elements
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// CORS configuration supporting credentials (cookies/authorization headers)
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Body parsing middleware with safety limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// Serve static frontend assets from public/ and workspace root (where existing HTML, CSS, JS live)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const authRoutes = require('./routes/authRoutes');
const foodRoutes = require('./routes/foodRoutes');
const requestRoutes = require('./routes/requestRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', statsRoutes);
app.use('/api', dashboardRoutes);

// Health check route: tests both Express server and MySQL database connectivity
app.get('/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS db_check');
    const isDbConnected = rows && rows[0] && rows[0].db_check === 2;

    return res.status(200).json({
      status: 'ok',
      message: 'FoodCare backend server is running',
      database: {
        status: isDbConnected ? 'connected' : 'warning',
        name: process.env.DB_NAME || 'foodcare_db',
        check: isDbConnected ? 'passed' : 'unexpected_result'
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Database health check failed',
      database: {
        status: 'disconnected',
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Root route serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload provided.'
    });
  }
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

// Initialize database connection test and start Express server
async function startServer() {
  try {
    const connection = await db.getConnection();
    console.log(`✓ Successfully connected to MySQL database: ${process.env.DB_NAME || 'foodcare_db'}`);
    connection.release();
  } catch (err) {
    console.error('✗ Warning: Could not connect to MySQL database on startup:', err.message);
    console.warn('  Ensure MySQL service is running and schema.sql has been imported.');
  }

  app.listen(PORT, () => {
    console.log(`✓ FoodCare backend running on http://localhost:${PORT}`);
    console.log(`✓ Health check available at: http://localhost:${PORT}/health`);
  });
}

startServer();

module.exports = app;
