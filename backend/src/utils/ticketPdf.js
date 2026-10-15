'use strict';

const { PassThrough } = require('stream');
const PDFDocument = require('pdfkit');
const { generateQrPngBuffer } = require('./qrcode');

const BRAND_DARK = '#073a57';
const BRAND = '#0e5c8a';
const ACCENT = '#d26a84';
const INK = '#1c2b38';
const INK_MUTED = '#6b8196';

function formatDateRange(startDate, endDate) {
  const fmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${fmt.format(new Date(startDate))}`;
}

/**
 * Streams a branded A5-landscape ticket directly to `res` (or any writable
 * stream). Kept intentionally simple — no external image assets — so it
 * works the same in every environment without shipping a template file.
 */
async function streamTicketPdf(res, { event, ticketType, registration, checkInUrl, companyName = '' }) {
  const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 0 });
  doc.pipe(res);

  const { width, height } = doc.page;

  // Left brand band
  const bandWidth = 200;
  const bandTextWidth = bandWidth - 44;
  doc.rect(0, 0, bandWidth, height).fill(BRAND_DARK);
  doc
    .fillColor('#ffffff')
    .fontSize(9)
    .text('PRASHANTH HOSPITALS', 22, 26, { width: bandTextWidth, characterSpacing: 0.4 });
  doc
    .fontSize(8)
    .fillColor('#8fc9e4')
    .text('DIGITAL TICKET', 22, 42, { width: bandTextWidth, characterSpacing: 0.4 });

  const titleFontSize = event.title.length > 32 ? 15 : 18;
  doc.fontSize(titleFontSize);
  const titleHeight = doc.heightOfString(event.title, { width: bandTextWidth });
  doc
    .fillColor('#ffffff')
    .text(event.title, 22, height - 24 - titleHeight, { width: bandTextWidth });

  // Body
  const bodyX = bandWidth + 28;
  doc
    .fillColor(INK)
    .fontSize(9)
    .text(ticketType.name.toUpperCase(), bodyX, 26, { characterSpacing: 1 });

  doc
    .fillColor(ACCENT)
    .fontSize(9)
    .text(registration.registrationCode, bodyX, 26, { width: width - bodyX - 24, align: 'right' });

  const bodyTextWidth = width - bandWidth - 220; // leaves clearance for the QR block on the right

  doc
    .fillColor(INK)
    .fontSize(20)
    .text(registration.attendee.name, bodyX, 44, { width: bodyTextWidth });

  doc
    .fillColor(INK_MUTED)
    .fontSize(11)
    .text(formatDateRange(event.startDate), bodyX, 78, { width: bodyTextWidth });

  if (event.venue?.name) {
    doc.text(event.venue.name, bodyX, 96, { width: bodyTextWidth });
  } else if (event.mode === 'virtual') {
    doc.text('Virtual event — join link on your confirmation email', bodyX, 96, {
      width: bodyTextWidth,
    });
  }

  doc
    .moveTo(bodyX, 130)
    .lineTo(width - 200, 130)
    .strokeColor('#e0e7ed')
    .stroke();

  doc
    .fillColor(INK_MUTED)
    .fontSize(9)
    .text('Admits', bodyX, 145)
    .fillColor(INK)
    .fontSize(11)
    .text(`${ticketType.admitsCount} ${ticketType.admitsCount > 1 ? 'delegates' : 'delegate'}`, bodyX, 158);

  if (companyName) {
    doc
      .fillColor(INK_MUTED)
      .fontSize(9)
      .text('Sponsored by', bodyX, 185)
      .fillColor(INK)
      .fontSize(11)
      .text(companyName, bodyX, 198, { width: bodyTextWidth });
  }

  doc
    .fillColor(INK_MUTED)
    .fontSize(9)
    .text('Present this QR code at check-in', bodyX, height - 40, { width: 250 });

  // QR
  const qrBuffer = await generateQrPngBuffer(checkInUrl);
  const qrSize = 150;
  doc.image(qrBuffer, width - qrSize - 30, height / 2 - qrSize / 2, { width: qrSize, height: qrSize });

  doc.end();
}

/** Same ticket, collected into a Buffer — used for the email attachment. */
async function renderTicketPdfBuffer(options) {
  const sink = new PassThrough();
  const chunks = [];
  sink.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    sink.on('end', resolve);
    sink.on('error', reject);
  });
  await streamTicketPdf(sink, options);
  await done;
  return Buffer.concat(chunks);
}

module.exports = { streamTicketPdf, renderTicketPdfBuffer };
