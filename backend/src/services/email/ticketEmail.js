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

  const subject = `You're In! Welcome to CIIM 2026 — ${registration.registrationCode}`;

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b1220;padding:24px 28px;color:#ffffff">
  <div style="font-size:12px;letter-spacing:2px;color:#e5b45a;text-transform:uppercase">Registration confirmed</div>
  <div style="font-size:22px;font-weight:700;margin-top:6px">${escapeHtml(event.title)}</div>
</td></tr>
<tr><td style="padding:24px 28px">
  <p style="margin:0 0 14px;font-size:16px;color:#111827;font-weight:700">Dear Dr. ${escapeHtml(registration.attendee.name)},</p>
  <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6">A historic first. A new surgical era. An extraordinary scientific journey.</p>
  <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6">Your registration is confirmed! At CIIM 2026, innovation meets expertise as we explore the future of reproductive medicine through scientific discussions, advanced surgical approaches, and real-time tele-transmission of robotic surgery.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
    ${row('Registration ID', registration.registrationCode)}
    ${row('Pass', ticketType.name)}
    ${row('Company', companyName)}
    ${row('Dates', '21st & 22nd November 2026')}
    ${row('Venue', venue || 'The Leela Palace, Chennai')}
    ${row('Conference Highlights', 'In-Person & Live Tele-Robotic Surgery Session')}
    ${row('Amount', '₹0.00 (Confirmed)')}
  </table>
  <div style="text-align:center;margin:8px 0 20px"><img src="cid:ticket-qr" width="200" height="200" alt="Ticket QR code" style="border:1px solid #e5e7eb;border-radius:8px"></div>
  <div style="text-align:center"><a href="${escapeHtml(ticketUrl)}" style="display:inline-block;background:#c63f2d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px">View your digital pass</a></div>
  <p style="margin:20px 0 0;font-size:12px;color:#6b7280;line-height:1.5">Show this QR pass or the attached ticket PDF at the registration desk upon arrival. Official conference brochure is attached for your reference.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Dear Dr. ${registration.attendee.name},`,
    '',
    `A historic first. A new surgical era. An extraordinary scientific journey.`,
    `Your registration for ${event.title} is confirmed.`,
    '',
    `At CIIM 2026, innovation meets expertise as we explore the future of reproductive medicine through scientific discussions, advanced surgical approaches, and real-time tele-transmission of robotic surgery.`,
    '',
    `Registration ID: ${registration.registrationCode}`,
    `Pass: ${ticketType.name}`,
    companyName ? `Company: ${companyName}` : null,
    `Dates: 21st & 22nd November 2026`,
    `Venue: ${venue || 'The Leela Palace, Chennai'}`,
    `Conference Highlights: In-Person & Live Tele-Robotic Surgery Session`,
    '',
    `Your digital pass: ${ticketUrl}`,
    'Your ticket PDF and official brochure are attached.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const fs = require('fs');
  const path = require('path');
  const attachments = [
    { filename: `${registration.registrationCode}.pdf`, content: pdf, contentType: 'application/pdf' },
    { filename: 'ticket-qr.png', content: qr, contentType: 'image/png', cid: 'ticket-qr' },
  ];

  // Attach official brochure if available
  const brochurePath = path.join(__dirname, '../../../assets/CIIM_2026_Brochure.pdf');
  if (fs.existsSync(brochurePath)) {
    attachments.push({
      filename: 'CIIM_2026_Scientific_Brochure.pdf',
      path: brochurePath,
      contentType: 'application/pdf',
    });
  }

  // Attach Chennai to Apex Hospital, Moradabad Tele-Robotic link creative if available
  const mapCandidates = [
    path.join(__dirname, '../../../assets/Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link.pdf'),
    path.join(__dirname, '../../../assets/Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link.png'),
    path.join(__dirname, '../../../../temp/Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link.png'),
  ];
  for (const candidate of mapCandidates) {
    if (fs.existsSync(candidate)) {
      attachments.push({
        filename: 'Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link' + path.extname(candidate),
        path: candidate,
      });
      break;
    }
  }

  return sendMail({
    to: registration.attendee.email,
    subject,
    html,
    text,
    attachments,
  });
}

module.exports = { sendTicketEmail };
