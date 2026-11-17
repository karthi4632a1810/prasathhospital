'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { generateQrPngBuffer } = require('./qrcode');
const env = require('../config/env');

function cleanDoctorName(name) {
  if (!name) return 'Delegate';
  return String(name).trim();
}

/**
 * Resolves the path to ID_CARD.pdf template.
 */
function getTemplatePath() {
  const candidate1 = path.join(__dirname, '../assets/ID_CARD.pdf');
  if (fs.existsSync(candidate1)) return candidate1;

  const candidate2 = path.resolve(__dirname, '../../../ID_CARD.pdf');
  if (fs.existsSync(candidate2)) return candidate2;

  const candidate3 = path.resolve(process.cwd(), 'ID_CARD.pdf');
  if (fs.existsSync(candidate3)) return candidate3;

  throw new Error('ID_CARD.pdf template file not found');
}

function getCheckInUrl(registration) {
  const siteUrl = (env.publicSiteUrl || 'https://ciim.prashanthfertility.com').replace(/\/$/, '');
  const token = registration.qrToken || registration.registrationCode;
  return `${siteUrl}/tickets/${token}`;
}

/**
 * Generates an ID Card / Delegate Badge PDF buffer using the ID_CARD.pdf template.
 * Redesigned in order:
 *   1. Pass Name (e.g. "Delegate — Regular", "PG Student / Resident") on top
 *   2. Delegate Full Name (prominent, bold, centered) below pass name
 *   3. Scannable QR Code (valid for both Main Entry & Lunch Counter check-in)
 *
 * Preserves top logo and bottom footer 100% untouched.
 *
 * @param {Object} registration - Mongoose Registration doc (populated)
 * @returns {Promise<Buffer>} - Generated PDF as binary Buffer
 */
async function generateIdCardPdfBuffer(registration) {
  const templatePath = getTemplatePath();
  const templateBytes = fs.readFileSync(templatePath);
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const { width } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const attendee = registration.attendee || {};
  const name = cleanDoctorName(attendee.name || `${attendee.firstName || ''} ${attendee.lastName || ''}`);
  const maxW = width - 36; // 216 pt safe inner width

  // 1. Pass Name (e.g. "Delegate — Regular", "PG Student / Resident") on top
  let passName = '';
  if (registration.ticketType && typeof registration.ticketType === 'object' && registration.ticketType.name) {
    passName = registration.ticketType.name;
  } else if (registration.ticketTypeName) {
    passName = registration.ticketTypeName;
  }

  if (!passName && registration.ticketType) {
    try {
      const TicketType = require('../models/TicketType');
      const tt = await TicketType.findById(registration.ticketType).select('name').lean();
      if (tt?.name) passName = tt.name;
    } catch {
      // fallback
    }
  }

  if (!passName) {
    passName = 'Delegate — Regular';
  }

  passName = String(passName).trim();

  let passSize = 11.5;
  let passWidth = fontBold.widthOfTextAtSize(passName, passSize);
  while (passWidth > maxW && passSize > 9) {
    passSize -= 0.5;
    passWidth = fontBold.widthOfTextAtSize(passName, passSize);
  }

  const passY = 297;
  page.drawText(passName, {
    x: (width - passWidth) / 2,
    y: passY,
    size: passSize,
    font: fontBold,
    color: rgb(0.76, 0.1, 0.36), // #c2185b Crimson / Rose accent
  });

  // 2. Delegate Full Name (centered, prominent, auto-scaling) below pass name
  let nameSize = 18;
  let nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  while (nameWidth > maxW && nameSize > 12) {
    nameSize -= 0.5;
    nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  }

  const nameY = 272;
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: nameY,
    size: nameSize,
    font: fontBold,
    color: rgb(0.14, 0.07, 0.22), // #231238 Deep Brand Plum
  });

  // 3. QR Code (used for both Main Entry and Lunch Counter check-in)
  const checkInUrl = getCheckInUrl(registration);
  const qrPngBuffer = await generateQrPngBuffer(checkInUrl, { width: 500 });
  const qrImage = await doc.embedPng(qrPngBuffer);

  const qrSize = 116;
  const framePad = 6;
  const frameSize = qrSize + framePad * 2; // 128 pt
  const frameX = (width - frameSize) / 2;
  const frameY = 126;
  const qrX = frameX + framePad;
  const qrY = frameY + framePad;

  // Crisp white rounded container card behind QR code to guarantee 100% scan reliability
  page.drawRectangle({
    x: frameX,
    y: frameY,
    width: frameSize,
    height: frameSize,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.92, 0.82, 0.88),
    borderWidth: 1,
  });

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  const outputBytes = await doc.save();
  return Buffer.from(outputBytes);
}

module.exports = {
  generateIdCardPdfBuffer,
  cleanDoctorName,
  getCheckInUrl,
};
