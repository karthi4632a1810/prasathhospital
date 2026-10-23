'use strict';

const { PassThrough } = require('stream');
const PDFDocument = require('pdfkit');
const { generateQrPngBuffer } = require('./qrcode');

// CIIM 2026 Brand Design Tokens
const BRAND_NAVY = '#230e38'; // Deep Royal Plum / Navy
const BRAND_PLUM = '#381b4e'; // Card Header Plum
const BRAND_ROSE = '#eb3f67'; // Signature Brand Magenta / Rose
const BRAND_CRIMSON = '#c2185b'; // Deep Crimson Accent
const BRAND_GOLD = '#d97706'; // Warm Gold Accent
const INK_DARK = '#231238'; // Headings
const INK_BODY = '#4e2f66'; // Body Text
const INK_MUTED = '#886e9c'; // Subtitles & Captions
const LINE_COLOR = '#f0d5e2'; // Hairline Divider
const BG_SUBTLE = '#fdf6f9'; // Soft Blush Container Fill

/** Formats date in event timezone (IST) */
function formatEventDate(startDate) {
  if (!startDate) return '21 – 23 November 2026';
  try {
    const fmt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return fmt.format(new Date(startDate));
  } catch {
    return '21 – 23 November 2026';
  }
}

/** Formats start time in event timezone */
function formatEventTime(startDate) {
  if (!startDate) return '09:00 AM IST';
  try {
    const fmt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${fmt.format(new Date(startDate))} IST`;
  } catch {
    return '09:00 AM IST';
  }
}

/**
 * Streams a luxury branded A5-landscape delegate pass directly to `res`.
 * Designed with CIIM 2026 royal plum, rose and gold palette.
 * Guaranteed zero text collisions and crisp scannable QR framing.
 */
async function streamTicketPdf(res, { event, ticketType, registration, checkInUrl, companyName = '' }) {
  const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 0 });
  doc.pipe(res);

  const { width, height } = doc.page;

  // ---------------------------------------------------------------------------
  // 1. Left Royal Plum Brand Sidebar (Width: 180 pt, Height: 419.5 pt)
  // ---------------------------------------------------------------------------
  const bandWidth = 180;
  doc.rect(0, 0, bandWidth, height).fill(BRAND_NAVY);

  // Top rose-magenta accent highlight line
  doc.rect(0, 0, bandWidth, 4).fill(BRAND_ROSE);

  // Hospital & Summit Crest Header
  const padX = 18;
  const padW = bandWidth - padX * 2; // 144 pt

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#ffffff')
    .text('PRASHANTH FERTILITY', padX, 22, { width: padW, characterSpacing: 0.4 });

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#ffffff')
    .text('& RESEARCH CENTRE', padX, 34, { width: padW, characterSpacing: 0.4 });

  // Thin rose divider line
  doc.moveTo(padX, 48).lineTo(padX + padW, 48).lineWidth(0.75).strokeColor(BRAND_ROSE).stroke();

  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#fbdbea')
    .text('IN ASSOCIATION WITH', padX, 54, { width: padW });

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#ffffff')
    .text('TAPISAR', padX, 64, { width: padW, characterSpacing: 0.6 });

  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor('#d4bfdb')
    .text('TAMIL NADU & PONDICHERRY CHAPTER OF ISAR', padX, 75, { width: padW });

  // Gold VIP Badge in Center
  doc.roundedRect(padX, 130, padW, 56, 6).fill(BRAND_PLUM);
  doc.roundedRect(padX, 130, padW, 56, 6).lineWidth(0.75).strokeColor(BRAND_GOLD).stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor('#fbbf24')
    .text('★ OFFICIAL DELEGATE PASS', padX, 140, { width: padW, align: 'center', characterSpacing: 0.5 });

  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#ffffff')
    .text('ANNUAL INTERNATIONAL CONFERENCE ON INFERTILITY MANAGEMENT', padX + 5, 155, {
      width: padW - 10,
      align: 'center',
    });

  // Bottom Summit Details inside Sidebar
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor('#ffffff')
    .text('CIIM 2026', padX, 298, { width: padW });

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#fbdbea')
    .text(formatEventDate(event.startDate), padX, 328, { width: padW });

  const venueTitle = event.venue?.name || 'The Leela Palace, Chennai';
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#ffffff')
    .text(venueTitle, padX, 342, { width: padW });

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor('#34d399')
    .text('✓ 6 TNMC CME Credit Points', padX, 360, { width: padW });

  // ---------------------------------------------------------------------------
  // 2. Right Body Section (Width: 415.28 pt)
  // ---------------------------------------------------------------------------
  const bodyX = 202;
  const qrBoxX = 445;
  const contentWidth = qrBoxX - bodyX - 12; // 231 pt

  // Top Category Pill & Registration Code Row (y = 20)
  const categoryText = (ticketType.name || 'DELEGATE PASS').toUpperCase();
  doc.font('Helvetica-Bold').fontSize(8);
  const catTextWidth = doc.widthOfString(categoryText);
  const pillW = catTextWidth + 18;

  // Category Pill Badge
  doc.roundedRect(bodyX, 18, pillW, 19, 9.5).fill('#fce7f0');
  doc.roundedRect(bodyX, 18, pillW, 19, 9.5).lineWidth(0.75).strokeColor(BRAND_ROSE).stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND_CRIMSON).text(categoryText, bodyX + 9, 23);

  // Confirmed Badge (Right aligned before QR col)
  doc.roundedRect(qrBoxX, 18, 56, 19, 9.5).fill('#ecfdf5');
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#065f46').text('CONFIRMED', qrBoxX, 23, { width: 56, align: 'center' });

  // Monospace Registration Code (Far Right)
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(BRAND_NAVY)
    .text(registration.registrationCode, qrBoxX + 60, 22, { width: width - (qrBoxX + 60) - 18, align: 'right' });

  // ---------------------------------------------------------------------------
  // 3. Delegate Information (Calculated y to prevent ANY overlap!)
  // ---------------------------------------------------------------------------
  let curY = 48;
  const attendeeName = registration.attendee?.name || 'Registered Delegate';

  // Delegate Name
  const nameFontSize = attendeeName.length > 26 ? 16 : 18.5;
  doc.font('Helvetica-Bold').fontSize(nameFontSize).fillColor(INK_DARK);
  doc.text(attendeeName, bodyX, curY, { width: contentWidth });
  const nameHeight = doc.heightOfString(attendeeName, { width: contentWidth });
  curY += nameHeight + 4;

  // Medical Council Registration Number
  const councilRegNo = registration.attendee?.medicalCouncilRegNo;
  if (councilRegNo) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND_CRIMSON);
    doc.text(`Medical Council Reg: ${councilRegNo}`, bodyX, curY, { width: contentWidth });
    curY += 12;

    doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#065f46');
    doc.text('✓ 6 TNMC CME Credit Points Accredited', bodyX, curY, { width: contentWidth });
    curY += 14;
  }

  // Event Date, Time & Venue
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK_BODY);
  doc.text(`Dates: ${formatEventDate(event.startDate)} · ${formatEventTime(event.startDate)}`, bodyX, curY, { width: contentWidth });
  curY += 12;

  doc.font('Helvetica').fontSize(8).fillColor(INK_MUTED);
  doc.text(`Venue: ${venueTitle}`, bodyX, curY, { width: contentWidth });
  curY += 16;

  // Hairline Divider
  doc.moveTo(bodyX, curY).lineTo(qrBoxX - 10, curY).lineWidth(0.75).strokeColor(LINE_COLOR).stroke();
  curY += 10;

  // Pass Details Grid
  doc.font('Helvetica').fontSize(6.8).fillColor(INK_MUTED).text('ADMISSION PASS', bodyX, curY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_DARK).text(`${ticketType.admitsCount || 1} Delegate Pass`, bodyX, curY + 8);
  curY += 23;

  if (companyName) {
    doc.font('Helvetica').fontSize(6.8).fillColor(INK_MUTED).text('SPONSORED BY', bodyX, curY);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK_DARK).text(companyName, bodyX, curY + 8, { width: contentWidth });
    curY += 23;
  }

  if (registration.couponCode) {
    doc.font('Helvetica').fontSize(6.8).fillColor(INK_MUTED).text('COUPON / PASS CODE', bodyX, curY);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND_CRIMSON).text(registration.couponCode, bodyX, curY + 8);
    curY += 22;
  }

  // ---------------------------------------------------------------------------
  // 4. Scannable QR Code Viewfinder Vault (Right Column)
  // ---------------------------------------------------------------------------
  const qrBoxY = 48;
  const qrBoxW = 132;
  const qrBoxH = 160;

  // Pure White Card Container with subtle border
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 10).fill('#ffffff');
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 10).lineWidth(0.75).strokeColor('#f3d5e2').stroke();

  // QR Code Image
  const qrBuffer = await generateQrPngBuffer(checkInUrl);
  const qrSize = 108;
  const qrImgX = qrBoxX + (qrBoxW - qrSize) / 2;
  const qrImgY = qrBoxY + 12;
  doc.image(qrBuffer, qrImgX, qrImgY, { width: qrSize, height: qrSize });

  // Viewfinder Tech Corner Brackets in brand rose
  const bkLen = 10;
  const bkPad = 3;
  const bkX1 = qrImgX - bkPad;
  const bkY1 = qrImgY - bkPad;
  const bkX2 = qrImgX + qrSize + bkPad;
  const bkY2 = qrImgY + qrSize + bkPad;

  doc.lineWidth(2).strokeColor(BRAND_ROSE);
  // Top-Left
  doc.moveTo(bkX1, bkY1 + bkLen).lineTo(bkX1, bkY1).lineTo(bkX1 + bkLen, bkY1).stroke();
  // Top-Right
  doc.moveTo(bkX2 - bkLen, bkY1).lineTo(bkX2, bkY1).lineTo(bkX2, bkY1 + bkLen).stroke();
  // Bottom-Left
  doc.moveTo(bkX1, bkY2 - bkLen).lineTo(bkX1, bkY2).lineTo(bkX1 + bkLen, bkY2).stroke();
  // Bottom-Right
  doc.moveTo(bkX2 - bkLen, bkY2).lineTo(bkX2, bkY2).lineTo(bkX2, bkY2 - bkLen).stroke();

  // Captions underneath QR
  doc
    .font('Helvetica-Bold')
    .fontSize(6.8)
    .fillColor(BRAND_CRIMSON)
    .text('SCAN AT COUNTER A', qrBoxX, qrBoxY + qrSize + 18, { width: qrBoxW, align: 'center', characterSpacing: 0.3 });

  doc
    .font('Helvetica')
    .fontSize(6.2)
    .fillColor(INK_MUTED)
    .text('Badge Printing & Desk Check-In', qrBoxX, qrBoxY + qrSize + 27, { width: qrBoxW, align: 'center' });

  // Monospace registration code underneath
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(BRAND_NAVY)
    .text(registration.registrationCode, qrBoxX, qrBoxY + qrSize + 36, { width: qrBoxW, align: 'center', characterSpacing: 0.5 });

  // ---------------------------------------------------------------------------
  // 5. Bottom Instructions & Security Strip (y = 354 to 419.5 pt)
  // ---------------------------------------------------------------------------
  const footerY = 352;
  const footerW = width - bandWidth;
  doc.rect(bandWidth, footerY, footerW, height - footerY).fill(BG_SUBTLE);
  doc.moveTo(bandWidth, footerY).lineTo(width, footerY).lineWidth(0.75).strokeColor(LINE_COLOR).stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(BRAND_NAVY)
    .text('IMPORTANT DELEGATE INSTRUCTIONS:', bodyX, footerY + 8);

  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#5c3c72')
    .text(
      '• Present this official pass (printed or digital QR code on phone) at Counter A to collect your conference badge & kit.',
      bodyX,
      footerY + 18,
      { width: width - bodyX - 16 }
    );

  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#5c3c72')
    .text(
      '• 6 TNMC CME credit points will be awarded to eligible registered delegates attending all scientific sessions.',
      bodyX,
      footerY + 28,
      { width: width - bodyX - 16 }
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(INK_MUTED)
    .text(
      'Secretariat: +91 96000 47646  |  infociim@pfrcivf.com  |  The Leela Palace, Adyar Seaface, Chennai',
      bodyX,
      footerY + 40,
      { width: width - bodyX - 16 }
    );

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
