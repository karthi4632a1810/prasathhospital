'use strict';

const env = require('../config/env');
const { sendWhatsAppTemplate, normalizePhone } = require('../services/whatsapp/client');
const { recordAudit } = require('../services/auditLog');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const logger = require('../utils/logger');

const IMAGE_PRESETS = [
  {
    id: 'poster',
    label: 'Official Thank You Poster Banner',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg',
    type: 'poster',
  },
  {
    id: 'qr_gold',
    label: 'Option 1: Royal Gold Standalone QR Code',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/option1_royal_gold_verified.png',
    type: 'qr',
  },
  {
    id: 'qr_gradient',
    label: 'Theme Gradient + Border-Radius QR Code',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/sample_royal_qr.png',
    type: 'qr',
  },
];

const TEMPLATES = [
  {
    id: 'ciim2026_invite',
    name: 'ciim2026_invite',
    label: 'CIIM 2026 Personal Invitation (Marketing Approved)',
    category: 'Marketing',
    status: 'Approved',
    language: 'English (UK)',
    description: 'Official approved personal invitation from Dr. Geetha Haripriya & Dr. Samhitha Moturi (Dates: 21 & 22 Nov 2026, The Leela Palace, Chennai) with Register & Call buttons.',
    defaultImageType: 'none',
    hasHeaderMedia: false,
    defaultExtra: '',
    params: ['Name'],
    buttons: [
      { type: 'url', text: 'Register Here', url: 'https://ciim.prashanthfertility.com/' },
      { type: 'call', text: 'Call Now', phone: '+919600047646' },
    ],
  },
  {
    id: 'ciim2026_registration_thankyou_02',
    name: 'ciim2026_registration_thankyou_02',
    label: 'Thank You Registration Template (Utility)',
    category: 'Utility',
    status: 'Approved',
    language: 'English (UK)',
    description: 'Header with official conference poster, personalized welcome letter, and extra note.',
    defaultImageType: 'poster',
    hasHeaderMedia: true,
    defaultExtra: '...',
    params: ['DrName', 'extra', 'img'],
  },
  {
    id: 'ciim2026_registration_5',
    name: 'ciim2026_registration_5',
    label: 'Registration 5 (QR Header + Ticket Link - Utility)',
    category: 'Utility',
    status: 'Approved',
    language: 'English (UK)',
    description: 'High-res QR code header with delegate name, dates/venue, and ticket link.',
    defaultImageType: 'qr_gold',
    hasHeaderMedia: true,
    defaultExtra: 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
    params: ['Name', 'extra', 'qr', 'QR'],
  },
  {
    id: 'ciim2026_registration_1',
    name: 'ciim2026_registration_1',
    label: 'Registration 1 (QR Code Header - Utility)',
    category: 'Utility',
    status: 'Approved',
    language: 'English (UK)',
    description: 'Standard confirmed registration template with QR image header.',
    defaultImageType: 'qr_gold',
    hasHeaderMedia: true,
    defaultExtra: '',
    params: ['Name', 'QR'],
  },
];

function resolveImageUrl(imageType, customImageUrl) {
  if (imageType === 'none') return '';
  if (imageType === 'custom' && customImageUrl) {
    return customImageUrl.trim();
  }
  const preset = IMAGE_PRESETS.find((p) => p.id === imageType);
  return preset ? preset.url : IMAGE_PRESETS[0].url;
}

function buildTemplateBodyParams(templateName, { name, extra, imageUrl }) {
  const cleanName = String(name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';

  // ciim2026_invite requires { Name: cleanName }
  if (templateName === 'ciim2026_invite') {
    return [
      { name: 'Name', value: cleanName },
      { name: '1', value: cleanName },
    ];
  }

  let extraParamValue = extra || '';
  if (templateName === 'ciim2026_registration_thankyou_02' || templateName === 'ciim2026_registration_thankyou') {
    extraParamValue = extra ? extra.trim() : '...';
  } else if (extra && extra.startsWith('http')) {
    extraParamValue = `\u2028${extra.trim()}\u2028`;
  }

  if (templateName === 'ciim2026_registration_thankyou_02' || templateName === 'ciim2026_registration_thankyou') {
    return [
      { name: '1', value: cleanName },
      { name: 'DrName', value: cleanName },
      { name: 'img', value: imageUrl },
      { name: '2', value: extraParamValue },
      { name: 'extra', value: extraParamValue },
    ];
  } else if (templateName === 'ciim2026_registration_5' || templateName === 'ciim2026_registration_4') {
    return [
      { name: '1', value: cleanName },
      { name: 'Name', value: cleanName },
      { name: 'qr', value: imageUrl },
      { name: 'QR', value: imageUrl },
      { name: '2', value: extraParamValue },
      { name: 'extra', value: extraParamValue },
    ];
  } else {
    return [
      { name: '1', value: cleanName },
      { name: 'Name', value: cleanName },
      { name: 'qr', value: imageUrl },
      { name: 'QR', value: imageUrl },
      { name: '2', value: extraParamValue },
      { name: 'extra', value: extraParamValue },
    ];
  }
}

/**
 * GET /api/v1/admin/whatsapp-marketing/config
 */
const getMarketingConfig = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    templates: TEMPLATES,
    primaryTemplate: 'ciim2026_invite',
    imagePresets: IMAGE_PRESETS,
    defaultChannel: '919940030935 (PRFC - Blast)',
    configured: Boolean(env.watiAccessToken || env.whatsappAccessToken),
    sampleHeaders: ['Name', 'Phone', 'Extra'],
  });
});

/**
 * POST /api/v1/admin/whatsapp-marketing/test-single
 * Test send 1 message to admin phone to verify template and parameter display
 */
const sendTestSingle = asyncHandler(async (req, res) => {
  const {
    phone,
    templateName = 'ciim2026_invite',
    name = 'Dr. Karthikeyan',
    extra = '',
    imageType = 'none',
    customImageUrl = '',
  } = req.body;

  if (!phone) {
    throw ApiError.badRequest('Phone number is required.');
  }

  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    throw ApiError.badRequest('Please enter a valid 10-digit mobile number.');
  }

  const finalImageUrl = resolveImageUrl(imageType, customImageUrl);
  const bodyParams = buildTemplateBodyParams(templateName, {
    name,
    extra,
    imageUrl: finalImageUrl,
  });

  const result = await sendWhatsAppTemplate({
    to: normalized,
    name: templateName,
    language: env.whatsappTemplateLanguage || 'en_GB',
    bodyParams,
  });

  if (!result.sent) {
    throw ApiError.badRequest(`WhatsApp delivery failed: ${result.error || result.reason || 'Unknown error'}`);
  }

  return sendSuccess(res, {
    phone: normalized,
    templateName,
    messageId: result.messageId,
    status: 'SENT',
  }, { message: 'WhatsApp test message delivered successfully.' });
});

/**
 * POST /api/v1/admin/whatsapp-marketing/resend-single
 * Retries sending template to 1 recipient immediately
 */
const resendSingle = asyncHandler(async (req, res) => {
  const {
    phone,
    name,
    templateName = 'ciim2026_invite',
    extra = '',
    imageType = 'none',
    customImageUrl = '',
  } = req.body;

  if (!phone) {
    throw ApiError.badRequest('Phone number is required.');
  }

  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    return sendSuccess(res, {
      sent: false,
      status: 'FAILED',
      phone,
      error: 'Invalid or missing phone number',
    });
  }

  const finalImageUrl = resolveImageUrl(imageType, customImageUrl);
  const bodyParams = buildTemplateBodyParams(templateName, {
    name,
    extra,
    imageUrl: finalImageUrl,
  });

  try {
    const result = await sendWhatsAppTemplate({
      to: normalized,
      name: templateName,
      language: env.whatsappTemplateLanguage || 'en_GB',
      bodyParams,
    });

    if (result.sent) {
      return sendSuccess(res, {
        sent: true,
        status: 'SENT',
        phone: normalized,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
      }, { message: 'Message resent successfully.' });
    }

    return sendSuccess(res, {
      sent: false,
      status: 'FAILED',
      phone: normalized,
      error: result.error || result.reason || 'Send failed',
    });
  } catch (err) {
    return sendSuccess(res, {
      sent: false,
      status: 'FAILED',
      phone: normalized,
      error: err.message || 'Exception during resend',
    });
  }
});

/**
 * POST /api/v1/admin/whatsapp-marketing/send-batch
 * Broadcasts WhatsApp template to selected recipients with live audit tracking
 */
const sendBatch = asyncHandler(async (req, res) => {
  const {
    templateName = 'ciim2026_invite',
    recipients = [],
    imageType = 'none',
    customImageUrl = '',
    globalExtra = '',
    throttleMs = 120,
  } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw ApiError.badRequest('At least 1 recipient is required.');
  }

  if (recipients.length > 1000) {
    throw ApiError.badRequest('Maximum 1,000 recipients per batch upload.');
  }

  const finalImageUrl = resolveImageUrl(imageType, customImageUrl);
  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  logger.info(`Starting WhatsApp marketing broadcast: ${recipients.length} recipients with template ${templateName}`);

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const originalRowIndex = item.rowIndex !== undefined ? item.rowIndex : i + 1;
    const recipientName = item.name ? String(item.name).trim() : 'Delegate';
    const rawPhone = item.phone ? String(item.phone).trim() : '';
    const normalizedPhone = normalizePhone(rawPhone);
    const extraVal = item.extra !== undefined && item.extra !== null && item.extra !== '' ? String(item.extra).trim() : globalExtra;

    if (!normalizedPhone || normalizedPhone.length < 10) {
      failedCount++;
      results.push({
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone: '',
        sent: false,
        status: 'FAILED',
        error: 'Invalid or missing phone number',
        sentAt: new Date().toISOString(),
      });
      continue;
    }

    const bodyParams = buildTemplateBodyParams(templateName, {
      name: recipientName,
      extra: extraVal,
      imageUrl: finalImageUrl,
    });

    try {
      const resSend = await sendWhatsAppTemplate({
        to: normalizedPhone,
        name: templateName,
        language: env.whatsappTemplateLanguage || 'en_GB',
        bodyParams,
      });

      if (resSend.sent) {
        sentCount++;
        results.push({
          rowIndex: originalRowIndex,
          name: recipientName,
          phone: rawPhone,
          normalizedPhone,
          sent: true,
          status: 'SENT',
          messageId: resSend.messageId,
          error: null,
          sentAt: new Date().toISOString(),
        });
      } else {
        failedCount++;
        results.push({
          rowIndex: originalRowIndex,
          name: recipientName,
          phone: rawPhone,
          normalizedPhone,
          sent: false,
          status: 'FAILED',
          error: resSend.error || resSend.reason || 'WATI API rejected message',
          sentAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      failedCount++;
      results.push({
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone,
        sent: false,
        status: 'FAILED',
        error: err.message || 'Network exception during send',
        sentAt: new Date().toISOString(),
      });
    }

    // Politeness throttle between sequential messages
    if (i < recipients.length - 1 && throttleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(throttleMs, 2000)));
    }
  }

  // Record audit log
  recordAudit(req, {
    action: 'whatsapp_marketing.broadcast',
    entityType: 'whatsapp_marketing',
    entityId: templateName,
    meta: {
      templateName,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      sampleRecipients: recipients.slice(0, 3).map((r) => r.phone),
    },
  }).catch(() => {});

  logger.info(`Finished WhatsApp marketing broadcast: ${sentCount} sent, ${failedCount} failed of ${recipients.length}`);

  return sendSuccess(res, {
    templateName,
    total: recipients.length,
    sentCount,
    failedCount,
    results,
  }, {
    message: `WhatsApp broadcast completed: ${sentCount} sent, ${failedCount} failed.`,
  });
});

/**
 * POST /api/v1/admin/whatsapp-marketing/check-statuses
 * Queries WATI /api/v1/getMessages/{phone} to retrieve live message delivery and read statuses
 */
const checkStatuses = asyncHandler(async (req, res) => {
  const { phones = [] } = req.body;
  if (!Array.isArray(phones) || !phones.length) {
    return sendSuccess(res, { statuses: {} });
  }

  const baseUrl = (env.watiBaseUrl || '').replace(/\/$/, '');
  const token = env.watiAccessToken
    ? (env.watiAccessToken.startsWith('Bearer ') ? env.watiAccessToken : `Bearer ${env.watiAccessToken}`)
    : '';

  if (!baseUrl || !token) {
    throw ApiError.badRequest('WATI credentials not configured.');
  }

  const statuses = {};
  const targetPhones = phones.slice(0, 100);

  // Parallel batches of 5 to respect WATI API rate limits
  const batchSize = 5;
  for (let i = 0; i < targetPhones.length; i += batchSize) {
    const chunk = targetPhones.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (rawPhone) => {
        const normalized = normalizePhone(rawPhone);
        if (!normalized) return;

        try {
          const resp = await fetch(`${baseUrl}/api/v1/getMessages/${normalized}?pageSize=2`, {
            headers: { Authorization: token },
            signal: AbortSignal.timeout(6000),
          });
          if (resp.ok) {
            const data = await resp.json();
            const msgs = data.messages?.items || data.messages || [];
            const latestMsg = msgs[0];
            if (latestMsg) {
              const rawStatus = (latestMsg.statusString || '').toUpperCase();
              let mappedStatus = 'SENT';
              if (rawStatus === 'READ') mappedStatus = 'READ';
              else if (rawStatus === 'DELIVERED') mappedStatus = 'DELIVERED';
              else if (rawStatus === 'FAILED' || latestMsg.failedDetail) mappedStatus = 'FAILED';
              else mappedStatus = 'SENT';

              statuses[normalized] = {
                status: mappedStatus,
                rawStatus: latestMsg.statusString,
                messageId: latestMsg.id,
                created: latestMsg.created,
                failedDetail: latestMsg.failedDetail || null,
              };
            }
          }
        } catch (err) {
          logger.warn(`Failed checking WATI status for ${normalized}: ${err.message}`);
        }
      })
    );
  }

  return sendSuccess(res, { statuses });
});

module.exports = {
  getMarketingConfig,
  sendTestSingle,
  resendSingle,
  sendBatch,
  checkStatuses,
};
