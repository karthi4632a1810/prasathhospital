'use strict';

const env = require('../../config/env');
const logger = require('../../utils/logger');

let warned = false;
const REQUEST_TIMEOUT_MS = 12000;

/** Indian-first normalization: bare 10-digit numbers get a 91 country code. */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function getWatiToken() {
  const raw = env.watiAccessToken || env.whatsappAccessToken || '';
  if (!raw) return '';
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
}

function getProvider() {
  const token = env.watiAccessToken || env.whatsappAccessToken || '';
  if (env.whatsappProvider === 'wati' || (token && token.includes('eyJ') && !env.whatsappPhoneNumberId)) {
    return 'wati';
  }
  return 'meta';
}

function isConfigured() {
  const provider = getProvider();
  if (provider === 'wati') {
    return Boolean(getWatiToken() && env.watiBaseUrl);
  }
  return Boolean(env.whatsappPhoneNumberId && env.whatsappAccessToken);
}

/**
 * Sends a message via Meta Cloud API.
 */
async function postMetaMessage(to, message) {
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
      logger.error(`Meta WhatsApp send failed (${response.status}): ${error}`);
      return { sent: false, reason: 'api_error', httpStatus: response.status, error };
    }

    const messageId = body.messages?.[0]?.id;
    if (!messageId) return { sent: false, reason: 'api_error', httpStatus: response.status, error: 'No message id returned' };
    return { sent: true, messageId };
  } catch (err) {
    logger.error('Meta WhatsApp send threw', err);
    return { sent: false, reason: 'network_error', error: err.name === 'TimeoutError' ? 'Request timed out' : err.message };
  }
}

/**
 * Sends an approved template message via WATI.
 * Routes to the configured channel (e.g. PRFC - Blast: 919940030935) via WATI v3,
 * falling back gracefully to v1.
 */
async function postWatiTemplate(to, name, bodyParams = []) {
  const phone = normalizePhone(to);
  const baseUrl = env.watiBaseUrl.replace(/\/$/, '');
  const channelNumber = env.watiChannelNumber ? normalizePhone(env.watiChannelNumber) : '919940030935';

  const customParams = bodyParams.map((item, idx) => {
    if (typeof item === 'object' && item !== null && 'name' in item) {
      return { name: String(item.name), value: String(item.value ?? '') };
    }
    return {
      name: String(idx + 1),
      value: String(item ?? ''),
    };
  });

  // Strategy 1: WATI v3 API (supports explicit channel routing: PRFC - Blast)
  try {
    const v3Url = 'https://live-mt-server.wati.io/api/ext/v3/messageTemplates/send';
    const v3Payload = {
      template_name: name,
      broadcast_name: 'CIIM_Ticket_Dispatch',
      channel_number: channelNumber,
      recipients: [
        {
          phone_number: phone,
          custom_params: customParams,
        },
      ],
    };

    const response = await fetch(v3Url, {
      method: 'POST',
      headers: {
        Authorization: getWatiToken(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(v3Payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => ({}));

    if (response.ok && body.success !== false) {
      const recipient = body.recipients?.[0];
      const messageId = recipient?.local_message_id || body.broadcast_id || 'wati_v3_sent';
      return { sent: true, messageId, broadcastId: body.broadcast_id };
    }

    const v3Error = body.message || (Array.isArray(body.errors) ? body.errors.join('; ') : '') || `HTTP ${response.status}`;
    logger.warn(`WATI v3 send failed (${response.status}): ${v3Error}, trying v1 fallback...`);
  } catch (err) {
    logger.warn('WATI v3 send threw, falling back to v1:', err);
  }

  // Strategy 2: Fallback to WATI v1 API
  const url = `${baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;
  const payload = {
    template_name: name,
    broadcast_name: 'CIIM_Ticket_Dispatch',
    channel_number: channelNumber,
    parameters: customParams,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getWatiToken(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.result === false) {
      const error =
        body.info ||
        (Array.isArray(body.items) ? body.items.map((i) => i.description || i.code).join('; ') : '') ||
        `HTTP ${response.status}`;
      logger.error(`WATI WhatsApp template send failed: ${error}`);
      return { sent: false, reason: 'api_error', httpStatus: response.status, error };
    }

    const messageId = body.local_message_id || body.phone_number || 'wati_sent';
    return { sent: true, messageId };
  } catch (err) {
    logger.error('WATI WhatsApp send threw', err);
    return { sent: false, reason: 'network_error', error: err.name === 'TimeoutError' ? 'Request timed out' : err.message };
  }
}

/**
 * Sends a session message via WATI (requires 24hr window or contact session).
 */
async function postWatiSessionMessage(to, text) {
  const phone = normalizePhone(to);
  const baseUrl = env.watiBaseUrl.replace(/\/$/, '');

  // 1. Ensure contact is registered in WATI
  try {
    await fetch(`${baseUrl}/api/v1/addContact/${phone}`, {
      method: 'POST',
      headers: { Authorization: getWatiToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CIIM Delegate' }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Non-fatal if contact already exists
  }

  // 2. Dispatch session message
  try {
    const url = `${baseUrl}/api/v1/sendSessionMessage/${phone}?messageText=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: getWatiToken() },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.result === false) {
      const info = body.info || `HTTP ${response.status}`;
      if (String(info).toLowerCase().includes('conversation') || String(info).toLowerCase().includes('not found')) {
        logger.warn(`WATI session message failed (24h window closed): ${info}. An approved template is required for business-initiated messages.`);
        return {
          sent: false,
          reason: 'api_error',
          error: 'WhatsApp 24-hr session closed. Meta requires an approved template (set WHATSAPP_TEMPLATE_NAME).',
        };
      }
      return { sent: false, reason: 'api_error', error: info };
    }

    return { sent: true, messageId: 'wati_session_sent' };
  } catch (err) {
    logger.error('WATI session message threw', err);
    return { sent: false, reason: 'network_error', error: err.name === 'TimeoutError' ? 'Request timed out' : err.message };
  }
}

/**
 * Dispatches a free-form message.
 */
function sendWhatsAppMessage({ to, text }) {
  if (!isConfigured()) {
    if (!warned) {
      logger.warn('WhatsApp is not configured — ticket messages are skipped.');
      warned = true;
    }
    return Promise.resolve({ sent: false, reason: 'not_configured' });
  }

  if (getProvider() === 'wati') {
    return postWatiSessionMessage(to, text);
  }

  return postMetaMessage(to, { type: 'text', text: { body: text, preview_url: true } });
}

/**
 * Dispatches an approved template message.
 */
function sendWhatsAppTemplate({ to, name, language, bodyParams = [] }) {
  if (!isConfigured()) {
    if (!warned) {
      logger.warn('WhatsApp is not configured — ticket messages are skipped.');
      warned = true;
    }
    return Promise.resolve({ sent: false, reason: 'not_configured' });
  }

  if (getProvider() === 'wati') {
    return postWatiTemplate(to, name, bodyParams);
  }

  return postMetaMessage(to, {
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

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  isConfigured,
  normalizePhone,
  getProvider,
};
