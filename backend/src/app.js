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
const { serveStoredUpload } = require('./controllers/adminUploadController');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind reverse proxies: trust them so rate limiting and logging see real client IPs.
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');
// Plain key=value query parsing: the default "extended" parser turns
// ?event[$ne]=x into an object, which would reach Mongo filters as an
// operator. Every admin/public filter here only ever needs strings.
app.set('query parser', 'simple');

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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      Boolean(
        req.originalUrl?.includes('/admin/whatsapp-marketing') ||
        req.path?.includes('/admin/whatsapp-marketing')
      ),
    message: { success: false, error: { message: 'Too many requests. Please try again shortly.' } },
  })
);

// Event/speaker/sponsor imagery uploaded via the CMS. Long-cached since
// filenames are random and never reused.
// CMS images live in MongoDB (/uploads/<id>.<ext>); older files uploaded
// before that still come from the disk mount below.
app.use('/uploads', serveStoredUpload);
app.use(
  '/uploads',
  express.static(uploadDir, {
    maxAge: '30d',
    immutable: true,
    // Uploaded files are images only, but an SVG can carry script. Serve
    // everything here as an inert, sandboxed document so a hostile upload
    // can never run in the site's or admin's origin.
    setHeaders(res) {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    },
  })
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
