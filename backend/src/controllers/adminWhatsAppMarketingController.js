'use strict';

const env = require('../config/env');
const WhatsAppCampaign = require('../models/WhatsAppCampaign');
const { sendWhatsAppTemplate, normalizePhone } = require('../services/whatsapp/client');
const { recordAudit } = require('../services/auditLog');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const logger = require('../utils/logger');

// Clean default poster preset (QR code options removed as requested)
const IMAGE_PRESETS = [
  {
    id: 'poster',
    label: 'Official Thank You Poster Banner',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg',
    type: 'poster',
  },
];

// Fallback core templates in case of offline/network issues with WATI
const FALLBACK_CORE_TEMPLATES = [
  {
    id: 'ciim2026_invite',
    name: 'ciim2026_invite',
    label: 'CIIM 2026 Personal Invitation',
    category: 'MARKETING',
    status: 'APPROVED',
    language: 'English (UK)',
    body: 'A Personal Invitation from Dr. Geetha Haripriya & Dr. Samhitha Moturi\n\nDear Dr. {{Name}},\n\nI am delighted to invite you to CIIM 2026 – Controversies in Infertility Management! ✨\n\n📅 21st & 22nd November 2026\n📍 The Leela Palace, Chennai\n\nJoin us for an inspiring exchange of knowledge and advancements in infertility care.\n\n🤝 Your presence would mean a lot!\n\n🔗 Register here: https://ciim.prashanthfertility.com/\n\n🎟️ Coupon Code Enquiries & Assistance\n📞 Call or WhatsApp: +91 96000 47646\n\nWarm regards,\nOrganising committee, CIIM 2026',
    hasHeaderMedia: false,
    imageParam: null,
    params: ['Name'],
    buttons: ['Register Here', 'Call Now (+91 96000 47646)'],
  },
  {
    id: 'ciim2026_registration_thankyou_02',
    name: 'ciim2026_registration_thankyou_02',
    label: 'Thank You Registration Template',
    category: 'UTILITY',
    status: 'APPROVED',
    language: 'English (UK)',
    body: 'Thank you for confirming your presence at CIIM 2026.\n\nDear Dr. {{DrName}},\n\nDate: 06 - 08 February 2026\nVenue: ITC Grand Chola, Guindy, Chennai\n{{extra}}',
    hasHeaderMedia: true,
    imageParam: 'img',
    params: ['DrName', 'extra'],
    buttons: [],
  },
  {
    id: 'ciim2026_registration_5',
    name: 'ciim2026_registration_5',
    label: 'Registration 5 (Ticket Link)',
    category: 'UTILITY',
    status: 'APPROVED',
    language: 'English (UK)',
    body: 'Your registration for CIIM 2026 is confirmed!\n\nDear Dr. {{Name}},\n\nDates: 06 - 08 February 2026\nVenue: ITC Grand Chola, Chennai\n{{extra}}',
    hasHeaderMedia: true,
    imageParam: 'qr',
    params: ['Name', 'extra'],
    buttons: [],
  },
  {
    id: 'ciim2026_registration_thankyou',
    name: 'ciim2026_registration_thankyou',
    label: 'Registration Thank You (Marketing)',
    category: 'MARKETING',
    status: 'APPROVED',
    language: 'English (UK)',
    body: 'Thank you for registering for CIIM 2026.\n\nDear Dr. {{DrName}},\n{{extra}}',
    hasHeaderMedia: true,
    imageParam: 'img',
    params: ['DrName', 'extra'],
    buttons: [],
  },
  {
    id: 'ciim2026_registration_4',
    name: 'ciim2026_registration_4',
    label: 'Registration 4 (Marketing)',
    category: 'MARKETING',
    status: 'APPROVED',
    language: 'English (UK)',
    body: 'CIIM 2026 Registration Confirmation.\n\nDear Dr. {{Name}},\n{{extra}}',
    hasHeaderMedia: true,
    imageParam: 'QR',
    params: ['Name', 'extra'],
    buttons: [],
  },
  {
    id: 'ciim2026_registration_1',
    name: 'ciim2026_registration_1',
    label: 'Registration 1 (Utility)',
    category: 'UTILITY',
    status: 'APPROVED',
    language: 'English (UK)',
    body: 'Your registration for CIIM 2026 is confirmed.\n\nDear Dr. {{Name}}',
    hasHeaderMedia: true,
    imageParam: 'QR',
    params: ['Name'],
    buttons: [],
  },
];

let cachedTemplates = null;
let lastTemplatesFetch = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Fetches all approved templates directly from WATI API, categorized by MARKETING and UTILITY
 */
async function fetchWatiTemplates() {
  const now = Date.now();
  if (cachedTemplates && now - lastTemplatesFetch < CACHE_TTL_MS) {
    return cachedTemplates;
  }

  const baseUrl = (env.watiBaseUrl || '').replace(/\/$/, '');
  const token = env.watiAccessToken
    ? (env.watiAccessToken.startsWith('Bearer ') ? env.watiAccessToken : `Bearer ${env.watiAccessToken}`)
    : '';

  if (!baseUrl || !token) {
    return FALLBACK_CORE_TEMPLATES;
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/getMessageTemplates`, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn(`WATI getMessageTemplates returned HTTP ${res.status}`);
      return cachedTemplates || FALLBACK_CORE_TEMPLATES;
    }

    const data = await res.json();
    const rawTemplates = data.messageTemplates || [];

    const approved = rawTemplates.filter((t) => (t.status || '').toUpperCase() === 'APPROVED');

    const parsed = approved.map((t) => {
      const templateName = t.elementName || t.name;
      const customParams = t.customParams || [];
      const hasHeaderImage =
        t.header === 2 ||
        (t.header && t.header.type === 2) ||
        customParams.some((p) => ['img', 'qr', 'QR'].includes(p.paramName));

      const imageParam =
        customParams.find((p) => ['img', 'qr', 'QR'].includes(p.paramName))?.paramName ||
        (hasHeaderImage ? 'img' : null);

      const nonImageParams = customParams
        .filter((p) => !['img', 'qr', 'QR'].includes(p.paramName))
        .map((p) => p.paramName);

      if (!nonImageParams.length && t.body) {
        const matches = t.body.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
        if (matches) {
          matches.forEach((m) => {
            const clean = m.replace(/[{}]/g, '');
            if (!['img', 'qr', 'QR'].includes(clean) && !nonImageParams.includes(clean)) {
              nonImageParams.push(clean);
            }
          });
        }
      }

      const buttons = (t.buttons || []).map((b) => b.parameter?.text || b.text || 'Button');

      let label = templateName
        .replace(/^ciim2026_/, 'CIIM 2026: ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (templateName === 'ciim2026_invite') {
        label = 'CIIM 2026 Personal Invitation (Dr. Geetha Haripriya & Dr. Samhitha Moturi)';
      }

      return {
        id: templateName,
        name: templateName,
        label,
        category: (t.category || 'MARKETING').toUpperCase(),
        status: 'APPROVED',
        language: t.language?.text || t.language?.key || 'English (UK)',
        body: t.body || '',
        hasHeaderMedia: hasHeaderImage,
        imageParam,
        params: nonImageParams.length ? nonImageParams : ['Name'],
        buttons,
      };
    });

    const priorityOrder = [
      'ciim2026_invite',
      'ciim2026_registration_thankyou_02',
      'ciim2026_registration_5',
      'ciim2026_registration_thankyou',
      'ciim2026_registration_4',
      'ciim2026_registration_1',
    ];

    parsed.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.name);
      const idxB = priorityOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      if (a.category !== b.category) return a.category === 'MARKETING' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    cachedTemplates = parsed;
    lastTemplatesFetch = now;
    return parsed;
  } catch (err) {
    logger.warn('Failed to fetch templates from WATI:', err.message);
    return cachedTemplates || FALLBACK_CORE_TEMPLATES;
  }
}

function resolveImageUrl(imageType, customImageUrl) {
  if (imageType === 'none') return '';
  if (imageType === 'custom' && customImageUrl) {
    return customImageUrl.trim();
  }
  if (imageType && (imageType.startsWith('http://') || imageType.startsWith('https://'))) {
    return imageType.trim();
  }
  const preset = IMAGE_PRESETS.find((p) => p.id === imageType);
  return preset ? preset.url : IMAGE_PRESETS[0].url;
}

/**
 * Builds WATI body parameters dynamically for ANY template.
 */
function buildTemplateBodyParams(templateName, { name, extra, customParamsValues = {}, imageUrl, templateObj }) {
  const cleanName = String(name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';
  let extraParamValue = extra || '';
  if (extraParamValue && extraParamValue.startsWith('http')) {
    extraParamValue = `\u2028${extraParamValue.trim()}\u2028`;
  }

  if (templateName === 'ciim2026_invite') {
    return [
      { name: 'Name', value: cleanName },
      { name: '1', value: cleanName },
    ];
  }

  const paramsList = [];
  const addedKeys = new Set();

  const addParam = (k, v) => {
    if (!addedKeys.has(k)) {
      addedKeys.add(k);
      paramsList.push({ name: String(k), value: String(v ?? '') });
    }
  };

  if (templateObj?.hasHeaderMedia || ['ciim2026_registration_thankyou_02', 'ciim2026_registration_5', 'ciim2026_registration_thankyou', 'ciim2026_registration_4', 'ciim2026_registration_1'].includes(templateName)) {
    const finalImg = imageUrl || IMAGE_PRESETS[0].url;
    addParam('img', finalImg);
    addParam('qr', finalImg);
    addParam('QR', finalImg);
  }

  const declaredParams = templateObj?.params || ['Name', 'extra'];
  declaredParams.forEach((paramKey, idx) => {
    const lower = paramKey.toLowerCase();
    let val = '';

    if (customParamsValues[paramKey] !== undefined && customParamsValues[paramKey] !== '') {
      val = customParamsValues[paramKey];
    } else if (lower.includes('name') || lower === 'drname' || lower === 'delegate') {
      val = cleanName;
    } else if (lower.includes('extra') || lower.includes('ticket') || lower.includes('link') || lower.includes('notes')) {
      val = extraParamValue || '...';
    } else {
      val = customParamsValues[paramKey] || '';
    }

    addParam(paramKey, val);
    addParam(String(idx + 1), val);
  });

  addParam('Name', cleanName);
  addParam('DrName', cleanName);
  addParam('1', cleanName);
  if (extraParamValue) {
    addParam('extra', extraParamValue);
    addParam('2', extraParamValue);
  }

  return paramsList;
}

/**
 * GET /api/v1/admin/whatsapp-marketing/config
 */
const getMarketingConfig = asyncHandler(async (req, res) => {
  const templates = await fetchWatiTemplates();

  return sendSuccess(res, {
    templates,
    primaryTemplate: 'ciim2026_invite',
    imagePresets: IMAGE_PRESETS,
    defaultChannel: '919940030935 (PRFC - Blast)',
    configured: Boolean(env.watiAccessToken || env.whatsappAccessToken),
    marketingCount: templates.filter((t) => t.category === 'MARKETING').length,
    utilityCount: templates.filter((t) => t.category === 'UTILITY').length,
  });
});

/**
 * GET /api/v1/admin/whatsapp-marketing/campaigns
 * Retrieves persistent campaign history from MongoDB Atlas
 */
const getCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await WhatsAppCampaign.find({}, '-recipients')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return sendSuccess(res, { campaigns });
});

/**
 * GET /api/v1/admin/whatsapp-marketing/campaigns/:id
 * Retrieves full campaign details and all recipient items
 */
const getCampaignById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const campaign = await WhatsAppCampaign.findById(id).lean();

  if (!campaign) {
    throw ApiError.notFound('Campaign not found.');
  }

  return sendSuccess(res, { campaign });
});

/**
 * DELETE /api/v1/admin/whatsapp-marketing/campaigns/:id
 */
const deleteCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await WhatsAppCampaign.findByIdAndDelete(id);

  return sendSuccess(res, { deleted: true }, { message: 'Campaign deleted.' });
});

/**
 * POST /api/v1/admin/whatsapp-marketing/test-single
 */
const sendTestSingle = asyncHandler(async (req, res) => {
  const {
    phone,
    templateName = 'ciim2026_invite',
    name = 'Dr. Karthikeyan',
    extra = '',
    customParamsValues = {},
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

  const templates = await fetchWatiTemplates();
  const templateObj = templates.find((t) => t.name === templateName);

  const finalImageUrl = resolveImageUrl(imageType, customImageUrl);
  const bodyParams = buildTemplateBodyParams(templateName, {
    name,
    extra,
    customParamsValues,
    imageUrl: finalImageUrl,
    templateObj,
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

  return sendSuccess(
    res,
    {
      phone: normalized,
      templateName,
      messageId: result.messageId,
      status: 'SENT',
    },
    { message: 'WhatsApp test message delivered successfully.' }
  );
});

/**
 * POST /api/v1/admin/whatsapp-marketing/resend-single
 * Retries sending to 1 recipient and updates the campaign document in MongoDB
 */
const resendSingle = asyncHandler(async (req, res) => {
  const {
    campaignId,
    recipientId,
    phone,
    name,
    templateName = 'ciim2026_invite',
    extra = '',
    customParamsValues = {},
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

  const templates = await fetchWatiTemplates();
  const templateObj = templates.find((t) => t.name === templateName);

  const finalImageUrl = resolveImageUrl(imageType, customImageUrl);
  const bodyParams = buildTemplateBodyParams(templateName, {
    name,
    extra,
    customParamsValues,
    imageUrl: finalImageUrl,
    templateObj,
  });

  let sendResult = { sent: false, error: 'Unknown' };
  try {
    sendResult = await sendWhatsAppTemplate({
      to: normalized,
      name: templateName,
      language: env.whatsappTemplateLanguage || 'en_GB',
      bodyParams,
    });
  } catch (err) {
    sendResult = { sent: false, error: err.message || 'Exception during resend' };
  }

  const finalStatus = sendResult.sent ? 'SENT' : 'FAILED';
  const sentTime = new Date();

  // If a campaignId is provided, update the persistent campaign record in MongoDB
  let updatedCampaign = null;
  if (campaignId) {
    try {
      const camp = await WhatsAppCampaign.findById(campaignId);
      if (camp) {
        const item = camp.recipients.id(recipientId) || camp.recipients.find((r) => r.phone === phone || r.normalizedPhone === normalized);
        if (item) {
          item.status = finalStatus;
          item.messageId = sendResult.messageId || item.messageId;
          item.error = sendResult.sent ? null : (sendResult.error || 'Resend failed');
          item.sentAt = sentTime;
        }

        // Recalculate stats
        camp.sentCount = camp.recipients.filter((r) => ['SENT', 'DELIVERED', 'READ'].includes(r.status)).length;
        camp.deliveredCount = camp.recipients.filter((r) => ['DELIVERED', 'READ'].includes(r.status)).length;
        camp.readCount = camp.recipients.filter((r) => r.status === 'READ').length;
        camp.failedCount = camp.recipients.filter((r) => r.status === 'FAILED').length;
        await camp.save();
        updatedCampaign = camp.toObject();
      }
    } catch (dbErr) {
      logger.warn('Failed to update campaign in DB on resend:', dbErr.message);
    }
  }

  return sendSuccess(
    res,
    {
      sent: sendResult.sent,
      status: finalStatus,
      phone: normalized,
      messageId: sendResult.messageId,
      error: sendResult.sent ? null : (sendResult.error || 'Resend failed'),
      sentAt: sentTime.toISOString(),
      campaign: updatedCampaign,
    },
    { message: sendResult.sent ? 'Message resent successfully.' : 'Message resend failed.' }
  );
});

/**
 * POST /api/v1/admin/whatsapp-marketing/send-batch
 * Dispatches batch messages and saves campaign persistently in MongoDB
 */
const sendBatch = asyncHandler(async (req, res) => {
  const {
    title,
    templateName = 'ciim2026_invite',
    recipients = [],
    imageType = 'none',
    customImageUrl = '',
    globalExtra = '',
    globalParams = {},
    throttleMs = 120,
  } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw ApiError.badRequest('At least 1 recipient is required.');
  }

  if (recipients.length > 1000) {
    throw ApiError.badRequest('Maximum 1,000 recipients per batch upload.');
  }

  const templates = await fetchWatiTemplates();
  const templateObj = templates.find((t) => t.name === templateName);

  const finalImageUrl = resolveImageUrl(imageType, customImageUrl);
  const results = [];
  const recipientsDataForDb = [];
  let sentCount = 0;
  let failedCount = 0;

  logger.info(`Starting WhatsApp marketing broadcast: ${recipients.length} recipients with template ${templateName}`);

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const originalRowIndex = item.rowIndex !== undefined ? item.rowIndex : i + 1;
    const recipientName = item.name ? String(item.name).trim() : 'Delegate';
    const rawPhone = item.phone ? String(item.phone).trim() : '';
    const normalizedPhone = normalizePhone(rawPhone);
    const extraVal =
      item.extra !== undefined && item.extra !== null && item.extra !== '' ? String(item.extra).trim() : globalExtra;

    if (!normalizedPhone || normalizedPhone.length < 10) {
      failedCount++;
      const failItem = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone: '',
        sent: false,
        status: 'FAILED',
        error: 'Invalid or missing phone number',
        sentAt: new Date(),
        params: item.params || {},
      };
      results.push(failItem);
      recipientsDataForDb.push(failItem);
      continue;
    }

    const customParamsValues = {
      ...(globalParams || {}),
      ...(item.params || {}),
      ...(item.originalData || {}),
    };

    const bodyParams = buildTemplateBodyParams(templateName, {
      name: recipientName,
      extra: extraVal,
      customParamsValues,
      imageUrl: finalImageUrl,
      templateObj,
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
        const successItem = {
          rowIndex: originalRowIndex,
          name: recipientName,
          phone: rawPhone,
          normalizedPhone,
          sent: true,
          status: 'SENT',
          messageId: resSend.messageId,
          broadcastId: resSend.broadcastId || null,
          error: null,
          sentAt: new Date(),
          params: customParamsValues,
        };
        results.push(successItem);
        recipientsDataForDb.push(successItem);
      } else {
        failedCount++;
        const failItem = {
          rowIndex: originalRowIndex,
          name: recipientName,
          phone: rawPhone,
          normalizedPhone,
          sent: false,
          status: 'FAILED',
          error: resSend.error || resSend.reason || 'WATI API rejected message',
          sentAt: new Date(),
          params: customParamsValues,
        };
        results.push(failItem);
        recipientsDataForDb.push(failItem);
      }
    } catch (err) {
      failedCount++;
      const errorItem = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone,
        sent: false,
        status: 'FAILED',
        error: err.message || 'Network exception during send',
        sentAt: new Date(),
        params: customParamsValues,
      };
      results.push(errorItem);
      recipientsDataForDb.push(errorItem);
    }

    if (i < recipients.length - 1 && throttleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(throttleMs, 2000)));
    }
  }

  // Create persistent WhatsAppCampaign document in MongoDB Atlas
  let savedCampaign = null;
  try {
    const defaultTitle = `${templateName} Broadcast (${recipients.length} recipients)`;
    savedCampaign = await WhatsAppCampaign.create({
      title: title || defaultTitle,
      templateName,
      channelNumber: '919940030935',
      headerImageUrl: finalImageUrl,
      total: recipients.length,
      sentCount,
      deliveredCount: 0,
      readCount: 0,
      failedCount,
      recipients: recipientsDataForDb,
      dispatchedBy: req.user?._id || null,
      dispatcherName: req.user?.name || 'Platform Admin',
    });
  } catch (dbErr) {
    logger.error('Failed to save WhatsAppCampaign to database:', dbErr);
  }

  // Audit log
  recordAudit(req, {
    action: 'whatsapp_marketing.broadcast',
    entityType: 'whatsapp_marketing',
    entityId: templateName,
    meta: {
      campaignId: savedCampaign?._id,
      templateName,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      sampleRecipients: recipients.slice(0, 3).map((r) => r.phone),
    },
  }).catch(() => {});

  logger.info(`Finished WhatsApp marketing broadcast: ${sentCount} sent, ${failedCount} failed of ${recipients.length}`);

  return sendSuccess(
    res,
    {
      campaign: savedCampaign,
      templateName,
      total: recipients.length,
      sentCount,
      failedCount,
      results,
    },
    {
      message: `WhatsApp broadcast completed: ${sentCount} sent, ${failedCount} failed.`,
    }
  );
});

/**
 * POST /api/v1/admin/whatsapp-marketing/check-statuses
 * Syncs real-time DELIVERED and READ statuses from WATI and persists to MongoDB Atlas
 */
const checkStatuses = asyncHandler(async (req, res) => {
  const { campaignId, phones = [] } = req.body;

  let targetPhones = [...phones];
  let campaignDoc = null;

  if (campaignId) {
    campaignDoc = await WhatsAppCampaign.findById(campaignId);
    if (campaignDoc && !targetPhones.length) {
      targetPhones = campaignDoc.recipients
        .filter((r) => r.status !== 'FAILED')
        .map((r) => r.normalizedPhone || r.phone);
    }
  }

  if (!targetPhones.length) {
    return sendSuccess(res, { statuses: {}, campaign: campaignDoc });
  }

  const baseUrl = (env.watiBaseUrl || '').replace(/\/$/, '');
  const token = env.watiAccessToken
    ? (env.watiAccessToken.startsWith('Bearer ') ? env.watiAccessToken : `Bearer ${env.watiAccessToken}`)
    : '';

  if (!baseUrl || !token) {
    throw ApiError.badRequest('WATI credentials not configured.');
  }

  const statuses = {};
  const limitedPhones = targetPhones.slice(0, 100);

  const batchSize = 5;
  for (let i = 0; i < limitedPhones.length; i += batchSize) {
    const chunk = limitedPhones.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (rawPhone) => {
        const normalized = normalizePhone(rawPhone);
        if (!normalized) return;

        try {
          const resp = await fetch(`${baseUrl}/api/v1/getMessages/${normalized}?pageSize=5`, {
            headers: { Authorization: token },
            signal: AbortSignal.timeout(6000),
          });
          if (resp.ok) {
            const data = await resp.json();
            const msgs = data.messages?.items || data.messages || [];
            // Find latest relevant message (prioritize broadcast/template messages or statusString)
            const latestMsg =
              msgs.find(
                (m) =>
                  m.statusString &&
                  (m.eventType === 'broadcastMessage' || m.eventType === 'templateMessage' || !m.eventType)
              ) || msgs[0];

            if (latestMsg) {
              const rawStatus = (latestMsg.statusString || '').toUpperCase();
              let mappedStatus = 'SENT';
              if (rawStatus === 'READ') mappedStatus = 'READ';
              else if (rawStatus === 'DELIVERED') mappedStatus = 'DELIVERED';
              else if (rawStatus === 'FAILED' || latestMsg.failedDetail) mappedStatus = 'FAILED';
              else mappedStatus = 'SENT';

              const statusObj = {
                status: mappedStatus,
                rawStatus: latestMsg.statusString,
                messageId: latestMsg.id,
                created: latestMsg.created,
                failedDetail: latestMsg.failedDetail || null,
              };

              statuses[normalized] = statusObj;
              const bare = String(normalized).replace(/^91/, '');
              statuses[bare] = statusObj;
            }
          }
        } catch (err) {
          logger.warn(`Failed checking WATI status for ${normalized}: ${err.message}`);
        }
      })
    );
  }

  // Update persistent MongoDB campaign document if campaignId was supplied
  if (campaignDoc) {
    campaignDoc.recipients.forEach((rec) => {
      const norm = normalizePhone(rec.normalizedPhone || rec.phone);
      const bare = String(norm).replace(/^91/, '');
      const s = statuses[norm] || statuses[bare] || statuses[rec.phone] || statuses[rec.normalizedPhone];
      if (s && s.status) {
        rec.status = s.status;
        if (s.messageId && (!rec.messageId || rec.messageId.startsWith('wati_') || rec.messageId.length < 20)) {
          rec.messageId = s.messageId;
        }
        if (s.status === 'READ') {
          if (!rec.readAt) rec.readAt = s.created ? new Date(s.created) : new Date();
          if (!rec.deliveredAt) rec.deliveredAt = rec.readAt;
        } else if (s.status === 'DELIVERED') {
          if (!rec.deliveredAt) rec.deliveredAt = s.created ? new Date(s.created) : new Date();
        }
        if (s.failedDetail) rec.error = s.failedDetail;
      }
    });

    campaignDoc.deliveredCount = campaignDoc.recipients.filter((r) => ['DELIVERED', 'READ'].includes(r.status)).length;
    campaignDoc.readCount = campaignDoc.recipients.filter((r) => r.status === 'READ').length;
    campaignDoc.sentCount = campaignDoc.recipients.filter((r) => ['SENT', 'DELIVERED', 'READ'].includes(r.status)).length;
    campaignDoc.failedCount = campaignDoc.recipients.filter((r) => r.status === 'FAILED').length;
    await campaignDoc.save();
  }

  return sendSuccess(res, {
    statuses,
    campaign: campaignDoc ? campaignDoc.toObject() : null,
  });
});

module.exports = {
  getMarketingConfig,
  getCampaigns,
  getCampaignById,
  deleteCampaign,
  sendTestSingle,
  resendSingle,
  sendBatch,
  checkStatuses,
};
