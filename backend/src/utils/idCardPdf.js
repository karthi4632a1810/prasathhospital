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
 * Resolves the role/badge category:
 * - DELEGATE (default for attending doctors/delegates)
 * - FACULTY (for guest faculty / speakers)
 * - ORGANISING TEAM (for organizing committee / hospital team)
 */
function resolveBadgeRole(registration, overrideRole) {
  if (overrideRole) {
    const raw = String(overrideRole).trim().toUpperCase();
    if (raw.includes('FACULTY') && (raw.includes('ORGANIS') || raw.includes('ORGANIZ'))) {
      return 'FACULTY / ORGANISING TEAM';
    }
    if (raw.includes('FACULTY')) return 'FACULTY';
    if (raw.includes('ORGANIS') || raw.includes('ORGANIZ') || raw.includes('TEAM')) return 'ORGANISING TEAM';
    if (raw.includes('DELEGATE')) return 'DELEGATE';
    return raw;
  }

  const regRole = String(registration.badgeRole || registration.role || '').trim().toUpperCase();
  if (regRole) return regRole;

  const ticketName = String(registration.ticketType?.name || registration.ticketTypeName || '').toUpperCase();
  if (ticketName.includes('FACULTY')) return 'FACULTY';

  const cat = String(
    registration.attendee?.category ||
    registration.attendee?.registrationCategory ||
    registration.attendee?.designation ||
    ''
  ).toUpperCase();
  if (cat.includes('ORGANIS') || cat.includes('ORGANIZ')) return 'ORGANISING TEAM';
  if (cat.includes('FACULTY')) return 'FACULTY';

  return 'DELEGATE';
}

/**
 * Generates an ID Card / Delegate Badge PDF buffer for printing on pre-printed card stock.
 *
 * NOTE: The physical cards are already pre-printed with the top logo and bottom footer!
 * Therefore, by default (includeTemplate: false) this generates a blank card canvas with
 * NO header/logo and NO footer, containing ONLY:
 *   1. Role: DELEGATE / FACULTY / ORGANISING TEAM
 *   2. Delegate Full Name (prominent, bold, centered, auto-scaled to fit any length)
 *   3. QR Code (compact, small 72x72pt on 82x82pt card, valid for entry & lunch)
 *
 * @param {Object} registration - Mongoose Registration doc (populated)
 * @param {Object} [options] - Generation options
 * @param {string} [options.role] - Force specific badge role ("DELEGATE" | "FACULTY" | "ORGANISING TEAM")
 * @param {boolean} [options.includeTemplate=false] - Whether to include background template (for digital preview)
 * @returns {Promise<Buffer>} - Generated PDF as binary Buffer
 */
async function generateIdCardPdfBuffer(registration, options = {}) {
  const width = 252;
  const height = 396;
  const includeTemplate = Boolean(options.includeTemplate);

  let doc;
  let page;

  if (includeTemplate) {
    const templatePath = getTemplatePath();
    const templateBytes = fs.readFileSync(templatePath);
    doc = await PDFDocument.load(templateBytes);
    page = doc.getPages()[0];
  } else {
    // Blank card matching exact pre-printed badge dimensions (252 x 396 pt).
    // NO header logo and NO footer — prints cleanly onto pre-printed card stock!
    doc = await PDFDocument.create();
    page = doc.addPage([width, height]);
  }

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const attendee = registration.attendee || {};
  const name = cleanDoctorName(attendee.name || `${attendee.firstName || ''} ${attendee.lastName || ''}`);
  const maxW = width - 36; // 216 pt safe inner width

  // 1. Role: DELEGATE / FACULTY / ORGANISING TEAM
  const roleText = resolveBadgeRole(registration, options.role);
  let roleSize = 12.5;
  let roleWidth = fontBold.widthOfTextAtSize(roleText, roleSize);
  while (roleWidth > maxW && roleSize > 9) {
    roleSize -= 0.5;
    roleWidth = fontBold.widthOfTextAtSize(roleText, roleSize);
  }

  const roleY = 290;
  page.drawText(roleText, {
    x: (width - roleWidth) / 2,
    y: roleY,
    size: roleSize,
    font: fontBold,
    color: rgb(0.76, 0.1, 0.36), // #c2185b Crimson / Rose accent
  });

  // 2. Delegate Full Name (centered, prominent, auto-scaling to fit even 35+ char names)
  let nameSize = 18;
  let nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  while (nameWidth > maxW && nameSize > 9.5) {
    nameSize -= 0.5;
    nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  }

  const nameY = 265;
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: nameY,
    size: nameSize,
    font: fontBold,
    color: rgb(0.14, 0.07, 0.22), // #231238 Deep Brand Plum
  });

  // 3. QR Code (compact, small 72x72 pt on 82x82 pt card, valid for both Main Entry and Lunch Counter)
  const checkInUrl = getCheckInUrl(registration);
  const qrPngBuffer = await generateQrPngBuffer(checkInUrl, { width: 350 });
  const qrImage = await doc.embedPng(qrPngBuffer);

  const qrSize = 72;
  const framePad = 5;
  const frameSize = qrSize + framePad * 2; // 82 pt
  const frameX = (width - frameSize) / 2;
  const frameY = 145;
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
