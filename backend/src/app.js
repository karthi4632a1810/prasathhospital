'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { uploadDir } = require('./config/uploadPath');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind reverse proxies: trust them so rate limiting and logging see real client IPs.
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // The SPA is served by NGINX, which owns CSP.
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/server-to-server calls (curl, health checks) with no Origin header.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      // Withhold the CORS header rather than throwing: the browser blocks the
      // response anyway, and a rejected origin shouldn't log as a 500.
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests. Please try again shortly.' } },
  })
);

// Event/speaker/sponsor imagery uploaded via the CMS. Long-cached since
// filenames are random and never reused.
app.use(
  '/uploads',
  express.static(uploadDir, { maxAge: '30d', immutable: true })
);

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Prashanth Hospitals - Event Management Platform API',
      version: 'v1',
      health: '/api/v1/health',
    },
  });
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
