'use strict';

const env = require('../config/env');
const { sendMail, isConfigured: isSmtpConfigured } = require('../services/email/mailer');
const { buildCiimInviteEmail } = require('../services/email/ciimInviteEmail');
const { sendWhatsAppTemplate, normalizePhone } = require('../services/whatsapp/client');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');

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
    id: 'ciim2026_registration_thankyou',
    name: 'ciim2026_registration_thankyou',
    label: 'Thank You Registration Template',
    description: 'Header with conference poster, welcome letter, and optional custom extra note.',
    defaultImageType: 'poster',
    defaultExtra: '...',
    params: ['DrName', 'extra', 'img'],
  },
  {
    id: 'ciim2026_registration_4',
    name: 'ciim2026_registration_4',
    label: 'Registration 4 (QR Header + Ticket Link)',
    description: 'High-res QR code header with delegate name, dates/venue, and ticket link.',
    defaultImageType: 'qr_gold',
    defaultExtra: 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
    params: ['Name', 'extra', 'QR'],
  },
  {
    id: 'ciim2026_registration_1',
    name: 'ciim2026_registration_1',
    label: 'Registration 1 (QR Code Header)',
    description: 'Standard confirmed registration template with QR image header.',
    defaultImageType: 'qr_gold',
    defaultExtra: '',
    params: ['Name', 'QR'],
  },
];

/**
 * GET /api/v1/admin/communications/config
 */
const getCommunicationsConfig = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    whatsapp: {
      provider: env.whatsappProvider,
      baseUrl: env.watiBaseUrl,
      configured: Boolean(env.watiAccessToken || env.whatsappAccessToken),
      currentTemplate: env.whatsappTemplateName || 'ciim2026_registration_4',
      templates: TEMPLATES,
      imagePresets: IMAGE_PRESETS,
      defaultPhone: '9962460782',
    },
    email: {
      smtpHost: env.smtpHost,
      smtpPort: env.smtpPort,
      smtpUser: env.smtpUser,
      mailFrom: env.mailFrom,
      configured: isSmtpConfigured(),
      defaultSubject: "You're In! Welcome to CIIM 2026 | A New Era in Infertility Care",
      defaultTicketLink: 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
    },
  });
});

/**
 * POST /api/v1/admin/communications/whatsapp/test
 */
const sendTestWhatsAppMessage = asyncHandler(async (req, res) => {
  const {
    phone,
    templateName = 'ciim2026_registration_4',
    name = 'Dr. Karthikeyan',
    extra = '',
    imageType = 'qr_gold',
    customImageUrl = '',
  } = req.body;

  if (!phone) {
    throw ApiError.badRequest('Phone number is required.');
  }

  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    throw ApiError.badRequest('Please enter a valid 10-digit mobile number.');
  }

  // Determine Image URL
  let finalImageUrl = '';
  if (imageType === 'custom' && customImageUrl) {
    finalImageUrl = customImageUrl.trim();
  } else {
    const preset = IMAGE_PRESETS.find((p) => p.id === imageType);
    finalImageUrl = preset ? preset.url : IMAGE_PRESETS[1].url;
  }

  // Clean Delegate Name
  const cleanName = String(name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';

  // Format extra parameter
  let extraParamValue = extra || '';
  if (templateName === 'ciim2026_registration_thankyou') {
    extraParamValue = extra ? extra.trim() : '...';
  } else if (extra && extra.startsWith('http')) {
    // Add Unicode line break above and below for clean paragraph isolation
    extraParamValue = `\u2028${extra.trim()}\u2028`;
  }

  // Construct clean parameter array matching exact WATI template bindings
  let bodyParams = [];
  if (templateName === 'ciim2026_registration_thankyou') {
    bodyParams = [
      { name: '1', value: cleanName },
      { name: 'DrName', value: cleanName },
      { name: 'img', value: finalImageUrl },
      { name: '2', value: extraParamValue },
      { name: 'extra', value: extraParamValue },
    ];
  } else if (templateName === 'ciim2026_registration_4') {
    bodyParams = [
      { name: '1', value: cleanName },
      { name: 'Name', value: cleanName },
      { name: 'QR', value: finalImageUrl },
      { name: '2', value: extraParamValue },
      { name: 'extra', value: extraParamValue },
    ];
  } else {
    bodyParams = [
      { name: '1', value: cleanName },
      { name: 'Name', value: cleanName },
      { name: 'QR', value: finalImageUrl },
    ];
  }

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
    messageId: result.messageId,
    phone: normalized,
    templateName,
    imageUrl: finalImageUrl,
    extra: extraParamValue,
  }, { message: 'WhatsApp test template delivered successfully.' });
});

/**
 * POST /api/v1/admin/communications/email/test
 */
const sendTestEmail = asyncHandler(async (req, res) => {
  const {
    to,
    name = 'Dr. Karthikeyan',
    ticketLink = 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
    subject,
  } = req.body;

  if (!to || !to.includes('@')) {
    throw ApiError.badRequest('Please provide a valid recipient email address.');
  }

  const emailData = buildCiimInviteEmail({
    name,
    ticketLink: ticketLink ? ticketLink.trim() : undefined,
  });

  const finalSubject = subject && subject.trim() ? subject.trim() : emailData.subject;

  const result = await sendMail({
    to: to.trim(),
    subject: finalSubject,
    html: emailData.html,
    text: emailData.text,
  });

  if (!result.sent) {
    throw ApiError.badRequest(`Email dispatch failed: ${result.error || result.reason || 'SMTP error'}`);
  }

  return sendSuccess(res, {
    messageId: result.messageId,
    to: to.trim(),
    subject: finalSubject,
  }, { message: 'Test invitation email sent successfully.' });
});

/**
 * POST /api/v1/admin/communications/email/preview
 */
const previewEmail = asyncHandler(async (req, res) => {
  const {
    name = 'Dr. Karthikeyan',
    ticketLink = 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
  } = req.body;

  const emailData = buildCiimInviteEmail({
    name,
    ticketLink: ticketLink ? ticketLink.trim() : undefined,
  });

  return sendSuccess(res, {
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
  });
});

module.exports = {
  getCommunicationsConfig,
  sendTestWhatsAppMessage,
  sendTestEmail,
  previewEmail,
};
