'use strict';

const { sendWhatsAppMessage, sendWhatsAppTemplate } = require('./client');
const env = require('../../config/env');

function ticketUrlFor(registration) {
  return `${env.publicSiteUrl.replace(/\/$/, '')}/tickets/${registration.qrToken}`;
}

/**
 * Sends the confirmation + ticket link on WhatsApp. Uses the approved
 * template named in WHATSAPP_TEMPLATE_NAME when set (required by Meta for
 * business-initiated messages), and a plain text message otherwise.
 * Never throws — see client.js for the result shape.
 */
function sendTicketConfirmation({ event, ticketType, registration, companyName }) {
  const ticketUrl = ticketUrlFor(registration);

  if (env.whatsappTemplateName) {
    const qrImageUrl = `${env.apiBaseUrl.replace(/\/$/, '')}/api/v1/tickets/${registration.qrToken}/qr.png`;
    return sendWhatsAppTemplate({
      to: registration.attendee.phone,
      name: env.whatsappTemplateName,
      language: env.whatsappTemplateLanguage || 'en_GB',
      bodyParams: [
        { name: '1', value: registration.attendee.name },
        { name: 'Name', value: registration.attendee.name },
        { name: 'QR', value: qrImageUrl },
        { name: '2', value: event.title },
        { name: '3', value: registration.registrationCode },
        { name: '4', value: ticketUrl },
      ],
    });
  }

  const text =
    `Hi ${registration.attendee.name}! 🎉\n\n` +
    `Your registration for *${event.title}* is confirmed.\n\n` +
    `Registration ID: ${registration.registrationCode}\n` +
    `Pass: ${ticketType.name}\n` +
    (companyName ? `Sponsored by: ${companyName}\n` : '') +
    `\nYour QR ticket:\n${ticketUrl}`;

  return sendWhatsAppMessage({ to: registration.attendee.phone, text });
}

module.exports = { sendTicketConfirmation, ticketUrlFor };
