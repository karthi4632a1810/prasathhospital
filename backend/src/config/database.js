'use strict';

const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

// If using MongoDB Atlas SRV URI on Windows systems with local ISP DNS issues, fallback to Google & Cloudflare DNS
if (process.platform === 'win32' && env.mongoUri && env.mongoUri.startsWith('mongodb+srv')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // ignore
  }
}

mongoose.set('strictQuery', true);

let connectionPromise = null;

/**
 * Connects to MongoDB once per process. Repeated calls reuse the same promise,
 * which keeps the seed script and the HTTP server from opening rival pools.
 */
async function connectDatabase(uri = env.mongoUri) {
  if (process.platform === 'win32' && uri && uri.startsWith('mongodb+srv')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // ignore
    }
  }
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20,
      autoIndex: !env.isProduction,
    })
    .then((conn) => {
      logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    })
    .catch((err) => {
      connectionPromise = null;
      throw err;
    });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', err);
  });

  return connectionPromise;
}

/**
 * autoIndex is off in production, so nothing else builds the schema indexes.
 * Without this, every `unique: true` (user email, promo code, qrToken,
 * feedback per registration, event slug) is silently unenforced.
 * createIndexes() is idempotent and non-destructive.
 */
async function ensureIndexes() {
  const results = await Promise.allSettled(
    Object.values(mongoose.models).map((model) => model.createIndexes())
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const name = Object.keys(mongoose.models)[i];
      logger.error(`Index build failed for ${name} (existing duplicate data?)`, result.reason);
    }
  });
}

async function disconnectDatabase() {
  connectionPromise = null;
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

module.exports = { connectDatabase, disconnectDatabase, ensureIndexes };
