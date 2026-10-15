'use strict';

const env = require('../../config/env');
const logger = require('../../utils/logger');

let warned = false;
const REQUEST_TIMEOUT_MS = 10000;

function isConfigured() {
  return Boolean(env.whatsappPhoneNumberId && env.whatsappAccessToken);
}

/** Indian-first normalization: bare 10-digit numbers get a 91 country code. */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Posts one message to Meta's WhatsApp Cloud API. Real integration,
 * dev-safe: with no WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN this logs and
 * returns `not_configured` instead of throwing, so a registration never
 * fails because WhatsApp is off.
 *
 * Result: `{ sent: true, messageId }` only when Meta accepted the message,
 * otherwise `{ sent: false, reason, httpStatus?, error? }` where reason is
 * not_configured | api_error | network_error.
 */
async function postMessage(to, message) {
  if (!isConfigured()) {
    if (!warned) {
      logger.warn('WhatsApp is not configured (WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN missing) — messages are skipped.');
      warned = true;
    }
    return { sent: false, reason: 'not_configured' };
  }

  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizePhone(to), ...message }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = body?.error?.message || `HTTP ${response.status}`;
      logger.error(`WhatsApp send failed (${response.status}): ${error}`);
      return { sent: false, reason: 'api_error', httpStatus: response.status, error };
    }

    const messageId = body.messages?.[0]?.id;
    if (!messageId) return { sent: false, reason: 'api_error', httpStatus: response.status, error: 'No message id returned' };
    return { sent: true, messageId };
  } catch (err) {
    logger.error('WhatsApp send threw', err);
    return { sent: false, reason: 'network_error', error: err.name === 'TimeoutError' ? 'Request timed out' : err.message };
  }
}

/** Free-form text. Only delivered inside a 24h customer-service window (or to test numbers). */
function sendWhatsAppMessage({ to, text }) {
  return postMessage(to, { type: 'text', text: { body: text, preview_url: true } });
}

/** Approved template — required for the first business-initiated message to a number. */
function sendWhatsAppTemplate({ to, name, language, bodyParams = [] }) {
  return postMessage(to, {
    type: 'template',
    template: {
      name,
      language: { code: language },
      components: [
        { type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) })) },
      ],
    },
  });
}

module.exports = { sendWhatsAppMessage, sendWhatsAppTemplate, isConfigured, normalizePhone };
