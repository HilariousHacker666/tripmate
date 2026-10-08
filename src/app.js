const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const { csrfProtection } = require('./middleware/csrf');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route handlers
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const destinationRoutes = require('./routes/destinations');
const itineraryRoutes = require('./routes/itinerary');
const expenseRoutes = require('./routes/expenses');
const auditRoutes = require('./routes/audit');

const app = express();

// Trust proxy for reverse proxy setups (Render, K8s, Minikube, Nginx)
app.set('trust proxy', 1);

// Helmet for security headers and strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow simple inline styles for dynamic b/w UI
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
}));

// CORS configuration
app.use(cors({
  origin: config.allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-Requested-With']
}));

// Body parsing with strict limits to prevent DoS / oversized payloads
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser(config.cookieSecret));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP address. Please try again after 15 minutes.'
  }
});
app.use('/api/', globalLimiter);

// Specific Auth Rate Limiting for Login / Register endpoints
const authLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.'
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Request Logger (Structured, never logs passwords or authorization headers)
app.use((req, res, next) => {
  if (req.path !== '/health') {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }
  next();
});

// Production & K8s Health Check Endpoint (Returns generic, non-sensitive status)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '1.0.0'
  });
});

// Serve frontend static assets (vanilla SPA)
app.use(express.static(path.join(__dirname, '..', 'public')));

// CSRF Protection for state-changing API operations
app.use('/api', csrfProtection);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/trips/:tripId/destinations', destinationRoutes);
app.use('/api/trips/:tripId/itinerary', itineraryRoutes);
app.use('/api/trips/:tripId/expenses', expenseRoutes);
app.use('/api/audit-logs', auditRoutes);

// Fallback for single-page app HTML
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api', notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
