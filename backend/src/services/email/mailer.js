'use strict';

const nodemailer = require('nodemailer');
const env = require('../../config/env');
const logger = require('../../utils/logger');

let transporter = null;
let warned = false;

function isConfigured() {
  return Boolean(env.smtpHost && env.mailFrom);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

// Connection-level failures are worth retrying; a 5xx SMTP reply (bad
// recipient, rejected content) usually isn't.
const TRANSIENT_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET', 'ECONNREFUSED']);

/**
 * Sends one email over SMTP. Same contract as the WhatsApp client: never
 * throws, and only reports `sent: true` when the SMTP server accepted the
 * recipient and returned a message id.
 *
 * Result: `{ sent: true, messageId }` or
 * `{ sent: false, reason: 'not_configured' | 'smtp_error', retryable, error }`.
 */
async function sendMail({ to, subject, html, text, attachments }) {
  if (!isConfigured()) {
    if (!warned) {
      logger.warn('Email is not configured (SMTP_HOST/MAIL_FROM missing) — ticket emails are skipped.');
      warned = true;
    }
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.mailFrom,
      replyTo: env.mailReplyTo || undefined,
      to,
      subject,
      html,
      text,
      attachments,
    });

    const accepted = (info.accepted || []).map(String);
    if (!info.messageId || !accepted.some((addr) => addr.toLowerCase().includes(String(to).toLowerCase()))) {
      return { sent: false, reason: 'smtp_error', retryable: false, error: 'Recipient was not accepted by the mail server' };
    }
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const transient = TRANSIENT_CODES.has(err.code) || (err.responseCode >= 400 && err.responseCode < 500);
    logger.error(`Email send failed (${err.code || err.responseCode || 'error'})`, err.message);
    return {
      sent: false,
      reason: 'smtp_error',
      retryable: transient,
      error: err.response || err.message || 'SMTP error',
    };
  }
}

module.exports = { sendMail, isConfigured };
