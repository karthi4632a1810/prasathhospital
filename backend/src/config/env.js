'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Reads an env var, falling back to a default. Throws in production when a
 * required value is missing so misconfiguration fails loudly at boot instead
 * of silently at request time.
 */
function read(key, fallback, { required = false } = {}) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (required && process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return fallback;
  }
  return value;
}

function readList(key, fallback = []) {
  const raw = read(key, '');
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readInt(key, fallback) {
  const parsed = Number.parseInt(read(key, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  nodeEnv: read('NODE_ENV', 'development'),
  port: readInt('PORT', 5000),
  mongoUri: read('MONGODB_URI', 'mongodb://127.0.0.1:27017/prashanth_events', {
    required: true,
  }),
  // Number of reverse proxies in front of the API whose X-Forwarded-For entry
  // is trusted: 1 for NGINX/compose, 2 for Vercel rewrite -> Render.
  trustProxy: readInt('TRUST_PROXY', 1),
  publicSiteUrl: read('PUBLIC_SITE_URL', 'http://localhost:5173'),
  apiBaseUrl: read('API_BASE_URL', 'http://localhost:5000'),
  corsOrigins: readList('CORS_ORIGINS', [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:8082',
  ]),
  rateLimit: {
    windowMs: readInt('RATE_LIMIT_WINDOW_MINUTES', 15) * 60 * 1000,
    max: readInt('RATE_LIMIT_MAX', 300),
  },

  // --- Auth (Foundation) ---
  jwtSecret: read('JWT_SECRET', 'dev-only-insecure-secret-change-me', { required: true }),
  jwtExpiresIn: read('JWT_EXPIRES_IN', '7d'),
  adminBootstrapEmail: read('ADMIN_BOOTSTRAP_EMAIL', 'admin@prashanthhospitals.com'),
  adminBootstrapPassword: read('ADMIN_BOOTSTRAP_PASSWORD', 'ChangeMe123!'),
  adminBootstrapName: read('ADMIN_BOOTSTRAP_NAME', 'Platform Admin'),

  // --- Uploads (Module 2) ---
  uploadDir: read('UPLOAD_DIR', 'uploads'),

  // --- Public coupon/registration abuse limits (per IP, per window) ---
  publicLimitWindowMs: readInt('PUBLIC_LIMIT_WINDOW_MINUTES', 10) * 60 * 1000,
  couponValidateLimitMax: readInt('COUPON_VALIDATE_LIMIT_MAX', 20),
  registrationLimitMax: readInt('REGISTRATION_LIMIT_MAX', 10),
  loginLimitMax: readInt('LOGIN_LIMIT_MAX', 20), // admin login attempts per IP per 15 min

  // --- Email (SMTP) — optional; unset means email delivery is "not_configured" ---
  smtpHost: read('SMTP_HOST', ''),
  smtpPort: readInt('SMTP_PORT', 587),
  smtpSecure: read('SMTP_SECURE', 'false') === 'true', // true for port 465
  smtpUser: read('SMTP_USER', ''),
  smtpPass: read('SMTP_PASS', ''),
  mailFrom: read('MAIL_FROM', ''), // e.g. "CIIM 2026 <tickets@ciim2026.com>"
  mailReplyTo: read('MAIL_REPLY_TO', ''),

  // --- WhatsApp (WATI or Meta Cloud API) ---
  whatsappProvider: read('WHATSAPP_PROVIDER', 'wati'),
  watiBaseUrl: read('WATI_BASE_URL', 'https://live-mt-server.wati.io/1080787'),
  watiAccessToken: read('WATI_ACCESS_TOKEN', ''),
  whatsappPhoneNumberId: read('WHATSAPP_PHONE_NUMBER_ID', ''),
  whatsappAccessToken: read('WHATSAPP_ACCESS_TOKEN', ''),
  whatsappApiVersion: read('WHATSAPP_API_VERSION', 'v20.0'),
  // Approved Meta / WATI template for business-initiated messages. Body params, in
  // order: {{1}} name, {{2}} event, {{3}} registration ID, {{4}} ticket link, {{5}} pass name.
  whatsappTemplateName: read('WHATSAPP_TEMPLATE_NAME', ''),
  whatsappTemplateLanguage: read('WHATSAPP_TEMPLATE_LANGUAGE', 'en'),
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

// A production container can never reach a database on its own loopback, so a
// localhost URI there means MONGODB_URI was left unset or copied from a dev .env.
if (env.isProduction && /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(env.mongoUri)) {
  throw new Error(
    'MONGODB_URI points at localhost in production. Set it to your Atlas connection string ' +
      '(mongodb+srv://USER:PASS@cluster.mongodb.net/prashanth_events).'
  );
}

module.exports = env;
