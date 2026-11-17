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
 * Layout order:
 *   1. Fixed Pass Name: DELEGATE (top, bold, centered)
 *   2. Delegate Full Name (prominent, bold, centered, auto-scaled to fit any name)
 *   3. Reg No (TNMC Reg No: <no> or Delegate ID: REG-XXXX)
 *   4. QR Code (small, compact 72x72pt on crisp 82x82pt white card, valid for entry & lunch)
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
  const regCode = (registration.registrationCode || '').trim();
  const councilNo = (attendee.medicalCouncilRegNo || attendee.councilRegistrationNumber || '').trim();
  const hasCouncil =
    councilNo && !['NA', 'N/A', 'NIL', 'NONE', '-', 'NOT APPLICABLE', 'NOTAPPLICABLE'].includes(councilNo.toUpperCase());

  const maxW = width - 36; // 216 pt safe inner width

  // 1. Fixed Pass Name: DELEGATE
  const passText = 'DELEGATE';
  const passSize = 11;
  const passWidth = fontBold.widthOfTextAtSize(passText, passSize);
  const passY = 300;
  page.drawText(passText, {
    x: (width - passWidth) / 2,
    y: passY,
    size: passSize,
    font: fontBold,
    color: rgb(0.76, 0.1, 0.36), // #c2185b Crimson / Rose accent
  });

  // 2. Delegate Full Name (centered, prominent, auto-scaling to fit any name)
  let nameSize = 17;
  let nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  while (nameWidth > maxW && nameSize > 9.5) {
    nameSize -= 0.5;
    nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  }

  const nameY = 277;
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: nameY,
    size: nameSize,
    font: fontBold,
    color: rgb(0.14, 0.07, 0.22), // #231238 Deep Brand Plum
  });

  // 3. Reg No (TNMC Reg No or Delegate ID)
  let regText = '';
  if (hasCouncil) {
    regText =
      councilNo.toUpperCase().includes('TNMC') || councilNo.toUpperCase().includes('COUNCIL')
        ? councilNo
        : 'TNMC Reg No: ' + councilNo;
  } else if (regCode) {
    regText = 'Delegate ID: ' + regCode;
  }

  if (regText) {
    let regSize = 10;
    let regWidth = fontBold.widthOfTextAtSize(regText, regSize);
    while (regWidth > maxW && regSize > 8) {
      regSize -= 0.5;
      regWidth = fontBold.widthOfTextAtSize(regText, regSize);
    }
    const regY = 257;
    page.drawText(regText, {
      x: (width - regWidth) / 2,
      y: regY,
      size: regSize,
      font: fontBold,
      color: rgb(0.42, 0.13, 0.45), // Deep plum / crimson
    });
  }

  // 4. QR Code (compact, small 72x72 pt, valid for both Main Entry and Lunch Counter)
  const checkInUrl = getCheckInUrl(registration);
  const qrPngBuffer = await generateQrPngBuffer(checkInUrl, { width: 350 });
  const qrImage = await doc.embedPng(qrPngBuffer);

  const qrSize = 72;
  const framePad = 5;
  const frameSize = qrSize + framePad * 2; // 82 pt
  const frameX = (width - frameSize) / 2;
  const frameY = 142;
  const qrX = frameX + framePad;
  const qrY = frameY + framePad;

  // Crisp white rounded container card behind QR code to guarantee 100% scan reliability
  page.drawRectangle({
    x: frameX,
    y: frameY,
    width: frameSize,
    height: frameSize,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.90, 0.82, 0.88),
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
