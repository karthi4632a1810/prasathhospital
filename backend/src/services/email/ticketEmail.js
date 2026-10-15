'use strict';

const { sendMail } = require('./mailer');
const { renderTicketPdfBuffer } = require('../../utils/ticketPdf');
const { generateQrPngBuffer } = require('../../utils/qrcode');
const { ticketUrlFor } = require('../whatsapp/sendTicket');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEventDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:150px">${escapeHtml(label)}</td>` +
    `<td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600">${escapeHtml(value)}</td></tr>`;
}

/**
 * Confirmation email: details table, the QR inline, the ticket PDF attached,
 * and the secure ticket link. Plain-text alternative included for clients
 * that block HTML.
 */
async function sendTicketEmail({ event, ticketType, registration, companyName }) {
  const ticketUrl = ticketUrlFor(registration);
  const venue = event.venue?.name ? [event.venue.name, event.venue.city].filter(Boolean).join(', ') : '';

  const [pdf, qr] = await Promise.all([
    renderTicketPdfBuffer({ event, ticketType, registration, checkInUrl: ticketUrl, companyName }),
    generateQrPngBuffer(ticketUrl),
  ]);

  const subject = `Your ticket for ${event.title} — ${registration.registrationCode}`;

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b1220;padding:24px 28px;color:#ffffff">
  <div style="font-size:12px;letter-spacing:2px;color:#e5b45a;text-transform:uppercase">Registration confirmed</div>
  <div style="font-size:22px;font-weight:700;margin-top:6px">${escapeHtml(event.title)}</div>
</td></tr>
<tr><td style="padding:24px 28px">
  <p style="margin:0 0 16px;font-size:15px;color:#111827">Hi ${escapeHtml(registration.attendee.name)},</p>
  <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6">Your registration is confirmed. Show the QR code below (or the attached PDF) at the registration desk.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
    ${row('Registration ID', registration.registrationCode)}
    ${row('Pass', ticketType.name)}
    ${row('Company', companyName)}
    ${row('Date', formatEventDate(event.startDate))}
    ${row('Venue', venue)}
    ${row('Amount', '₹0.00')}
  </table>
  <div style="text-align:center;margin:8px 0 20px"><img src="cid:ticket-qr" width="200" height="200" alt="Ticket QR code" style="border:1px solid #e5e7eb;border-radius:8px"></div>
  <div style="text-align:center"><a href="${escapeHtml(ticketUrl)}" style="display:inline-block;background:#c63f2d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px">View your ticket</a></div>
  <p style="margin:20px 0 0;font-size:12px;color:#6b7280;line-height:1.5">This link is personal to you — please don't share it. Anyone with it can view and present your ticket.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hi ${registration.attendee.name},`,
    '',
    `Your registration for ${event.title} is confirmed.`,
    '',
    `Registration ID: ${registration.registrationCode}`,
    `Pass: ${ticketType.name}`,
    companyName ? `Company: ${companyName}` : null,
    `Date: ${formatEventDate(event.startDate)}`,
    venue ? `Venue: ${venue}` : null,
    '',
    `Your ticket: ${ticketUrl}`,
    'Your ticket PDF is attached. This link is personal to you — please do not share it.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return sendMail({
    to: registration.attendee.email,
    subject,
    html,
    text,
    attachments: [
      { filename: `${registration.registrationCode}.pdf`, content: pdf, contentType: 'application/pdf' },
      { filename: 'ticket-qr.png', content: qr, contentType: 'image/png', cid: 'ticket-qr' },
    ],
  });
}

module.exports = { sendTicketEmail };
