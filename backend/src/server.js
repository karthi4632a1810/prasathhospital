'use strict';

// DEMO_MODE=true serves the read-only, database-free mock (public event page
// only) so a hosted demo works without MongoDB. Must run before ./app loads,
// because ./config/env requires MONGODB_URI in production.
if (process.env.DEMO_MODE === 'true') {
  require('./dev/mockApi');
  return;
}

const app = require('./app');
const env = require('./config/env');
const { connectDatabase, ensureIndexes } = require('./config/database');
const { startMarketingScheduler } = require('./services/marketingCampaignRunner');
const logger = require('./utils/logger');

let server;

async function start() {
  try {
    await connectDatabase();
    await ensureIndexes();
    startMarketingScheduler();

    server = app.listen(env.port, () => {
      logger.info(`API listening on port ${env.port} [${env.nodeEnv}]`);
      logger.info(`Health check: ${env.apiBaseUrl}/api/v1/health`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

/** Drain in-flight requests before exiting so deploys don't drop registrations. */
function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  if (!server) process.exit(0);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  process.exit(1);
});

start();

module.exports = { start };
