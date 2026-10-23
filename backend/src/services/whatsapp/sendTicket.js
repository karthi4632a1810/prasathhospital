'use strict';

const { sendWhatsAppMessage, sendWhatsAppTemplate } = require('./client');
const env = require('../../config/env');
const logger = require('../../utils/logger');

function getPublicApiBaseUrl() {
  const url = (env.apiBaseUrl || '').replace(/\/$/, '');
  if (!url || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('ciimapi.')) {
    return 'https://ciim.prashanthfertility.com';
  }
  return url;
}

function getPublicSiteUrl() {
  const url = (env.publicSiteUrl || '').replace(/\/$/, '');
  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
    return 'https://ciim.prashanthfertility.com';
  }
  return url;
}

function ticketUrlFor(registration) {
  return `${getPublicSiteUrl()}/tickets/${registration.qrToken}`;
}

/**
 * Strips leading title prefixes (Dr., Doctor, Prof, Mr., Mrs., Ms.)
 * to avoid "Dear Dr. Dr Karthikeyan" duplicate prefix in WATI templates.
 */
function cleanDoctorName(name) {
  if (!name) return 'Delegate';
  return String(name).replace(/^(?:dr\.?|doctor|prof\.?|mr\.?|mrs\.?|ms\.?)\s+/i, '').trim() || 'Delegate';
}

/**
 * Sends the confirmation on WhatsApp.
 * Dispatches BOTH approved templates sequentially:
 *   1. "ciim2026_registration_thankyou" (Poster image header + Welcome letter)
 *   2. "ciim2026_registration_4" (Scannable QR code image header + Ticket Link)
 *
 * Never throws — see client.js for the result shape.
 */
async function sendTicketConfirmation({ event, ticketType, registration, companyName }) {
  const ticketUrl = ticketUrlFor(registration);
  const cleanName = cleanDoctorName(registration.attendee?.name);
  const phone = registration.attendee?.phone;
  const lang = env.whatsappTemplateLanguage || 'en_GB';

  if (!phone) {
    return { sent: false, reason: 'missing_phone' };
  }

  const isTemplateConfigured = Boolean(env.watiAccessToken || env.whatsappAccessToken || env.whatsappTemplateName);

  if (isTemplateConfigured) {
    const qrImageUrl = `${getPublicApiBaseUrl()}/api/v1/tickets/${registration.qrToken}/qr.png`;
    const thankYouImageUrl = 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg';

    // Link formatted with Unicode line breaks for clean paragraph isolation in WhatsApp
    const linkParam = `\u2028${ticketUrl}\u2028`;

    let firstResult = { sent: false };
    let secondResult = { sent: false };

    // --- Template 1: Thank You Poster Template (UTILITY: ciim2026_registration_thankyou_02) ---
    try {
      logger.info(`Dispatching Template 1 (ciim2026_registration_thankyou_02) to ${phone}`);
      firstResult = await sendWhatsAppTemplate({
        to: phone,
        name: 'ciim2026_registration_thankyou_02',
        language: lang,
        bodyParams: [
          { name: '1', value: cleanName },
          { name: 'DrName', value: cleanName },
          { name: 'img', value: thankYouImageUrl },
          { name: '2', value: '...' },
          { name: 'extra', value: '...' },
        ],
      });
      logger.info(`Template 1 result for ${registration.registrationCode}:`, firstResult);
    } catch (err) {
      logger.error('Failed sending WhatsApp thank-you template', err);
    }

    // Brief pause to ensure WhatsApp delivers in sequential order
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // --- Template 2: QR Pass with Link Template (UTILITY: ciim2026_registration_5) ---
    try {
      logger.info(`Dispatching Template 2 (ciim2026_registration_5) to ${phone}`);
      secondResult = await sendWhatsAppTemplate({
        to: phone,
        name: 'ciim2026_registration_5',
        language: lang,
        bodyParams: [
          { name: '1', value: cleanName },
          { name: 'Name', value: cleanName },
          { name: 'qr', value: qrImageUrl },
          { name: 'QR', value: qrImageUrl },
          { name: '2', value: linkParam },
          { name: 'extra', value: linkParam },
        ],
      });

      // If ciim2026_registration_5 is still PENDING Meta review, gracefully fallback to ciim2026_registration_4
      if (!secondResult.sent) {
        logger.warn(`ciim2026_registration_5 not ready (${secondResult.error}), falling back to ciim2026_registration_4 for ${phone}`);
        secondResult = await sendWhatsAppTemplate({
          to: phone,
          name: 'ciim2026_registration_4',
          language: lang,
          bodyParams: [
            { name: '1', value: cleanName },
            { name: 'Name', value: cleanName },
            { name: 'QR', value: qrImageUrl },
            { name: '2', value: linkParam },
            { name: 'extra', value: linkParam },
          ],
        });
      }

      logger.info(`Template 2 result for ${registration.registrationCode}:`, secondResult);
    } catch (err) {
      logger.error('Failed sending WhatsApp QR + link template', err);
    }

    // Return the successful message result (preferring the QR ticket pass message)
    if (secondResult.sent) {
      return secondResult;
    }
    if (firstResult.sent) {
      return firstResult;
    }
    return secondResult || firstResult;
  }

  // Fallback plain-text if no templates are active
  const text =
    `Dear Dr. ${cleanName}! 🎉\n\n` +
    `Your registration for *${event.title}* is confirmed.\n\n` +
    `Registration ID: ${registration.registrationCode}\n` +
    `Pass: ${ticketType.name}\n` +
    (companyName ? `Sponsored by: ${companyName}\n` : '') +
    `\nYour digital QR ticket:\n${ticketUrl}`;

  return sendWhatsAppMessage({ to: phone, text });
}

module.exports = { sendTicketConfirmation, ticketUrlFor, cleanDoctorName };
