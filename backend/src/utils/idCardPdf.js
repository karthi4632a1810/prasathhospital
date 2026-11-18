'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { generateQrPngBuffer } = require('./qrcode');
const env = require('../config/env');

const PT_PER_CM = 72 / 2.54; // 28.3464566929 pt/cm

function getSimulationBgPath() {
  const candidate1 = path.join(__dirname, '../assets/PRINT_CARD_BG.jpg');
  if (fs.existsSync(candidate1)) return candidate1;

  const candidate2 = path.resolve(process.cwd(), 'Print.jpg.jpeg');
  if (fs.existsSync(candidate2)) return candidate2;

  const candidate3 = path.resolve(__dirname, '../../../Print.jpg.jpeg');
  if (fs.existsSync(candidate3)) return candidate3;

  return null;
}

function cleanDoctorName(name) {
  if (!name) return 'Delegate';
  return String(name).trim();
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
 * Splits a long attendee name across 2 visually balanced lines.
 * If name contains explicit '\n', splits on that.
 */
function splitNameToLines(name, font, maxW) {
  const raw = String(name || '').trim().replace(/\r\n/g, '\n');
  if (raw.includes('\n')) {
    const manualLines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (manualLines.length > 0) return manualLines.slice(0, 2);
  }

  const words = raw.replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length <= 1) return [raw];

  const singleLineW = font.widthOfTextAtSize(raw, 18);
  if (raw.length <= 22 && singleLineW <= maxW - 20) {
    return [raw];
  }

  // Find balanced 2-line split
  let bestSplit = 1;
  let minDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const w1 = font.widthOfTextAtSize(l1, 16.5);
    const w2 = font.widthOfTextAtSize(l2, 16.5);
    const diff = Math.abs(w1 - w2);
    if (diff < minDiff) {
      minDiff = diff;
      bestSplit = i;
    }
  }

  return [
    words.slice(0, bestSplit).join(' '),
    words.slice(bestSplit).join(' '),
  ];
}

/**
 * Generates an ID Card / Delegate Badge PDF buffer for printing on pre-printed card stock.
 *
 * Physical Dimensions:
 *   - Width: 10.2 cm (289.13 pt)
 *   - Height: 15.2 cm (430.87 pt)
 *   - Header Height: 2.2 cm (62.36 pt) -> Pre-printed top logo
 *   - Footer Height: 5.2 cm (147.40 pt) -> Pre-printed bottom details
 *   - Center Space: ~7.5 - 7.8 cm (147.40 pt - 368.51 pt) -> Active printable area
 *
 * By default (includeTemplate: false), generates a blank card with NO header and NO footer,
 * perfectly positioned to print directly into the 7.5 cm center window:
 *   1. Role: DELEGATE / FACULTY / ORGANISING TEAM (y = 338 pt)
 *   2. Delegate Full Name (centered, 1-line or 2-line for long names, y = 297 or 308/286 pt)
 *   3. QR Code (76x76 pt clean themed QR, no box, no corner curves, centered medallion, y = 176 pt)
 *
 * @param {Object} registration - Mongoose Registration doc (populated)
 * @param {Object} [options] - Generation options
 * @param {string} [options.role] - Force specific badge role ("DELEGATE" | "FACULTY" | "ORGANISING TEAM" | custom)
 * @param {string} [options.name] - Override attendee name on the spot
 * @param {boolean} [options.includeTemplate=false] - Whether to include background template (for digital preview)
 * @returns {Promise<Buffer>} - Generated PDF as binary Buffer
 */
async function generateIdCardPdfBuffer(registration, options = {}) {
  const width = 10.2 * PT_PER_CM;   // 289.13 pt
  const height = 15.2 * PT_PER_CM; // 430.87 pt
  const headerHeight = 2.2 * PT_PER_CM; // 62.36 pt (y: 368.51 - 430.87)
  const footerHeight = 5.2 * PT_PER_CM; // 147.40 pt (y: 0 - 147.40)
  const maxW = width - 36; // 253.13 pt safe printable width

  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  if (options.includeTemplate) {
    const bgPath = getSimulationBgPath();
    if (bgPath && fs.existsSync(bgPath)) {
      const bgBytes = fs.readFileSync(bgPath);
      const bgImage = await doc.embedJpg(bgBytes);
      page.drawImage(bgImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }
  }

  // 1. Role Header (DELEGATE / FACULTY / ORGANISING TEAM / Custom)
  const roleText = resolveBadgeRole(registration, options.role);
  let roleSize = roleText.length > 12 ? 12.5 : 13.5;
  let roleWidth = fontBold.widthOfTextAtSize(roleText, roleSize);
  while (roleWidth > maxW && roleSize > 9) {
    roleSize -= 0.5;
    roleWidth = fontBold.widthOfTextAtSize(roleText, roleSize);
  }
  const roleY = 338;
  page.drawText(roleText, {
    x: (width - roleWidth) / 2,
    y: roleY,
    size: roleSize,
    font: fontBold,
    color: rgb(0.761, 0.094, 0.357), // #c2185b
  });

  // 2. Delegate Name (supports options.name override, auto 1-line or 2-line)
  const attendee = registration.attendee || {};
  const rawName = options.name ? String(options.name).trim() : cleanDoctorName(attendee.name || `${attendee.firstName || ''} ${attendee.lastName || ''}`);
  const lines = splitNameToLines(rawName, fontBold, maxW);

  if (lines.length === 2) {
    let nameSize = 16.5;
    let l1W = fontBold.widthOfTextAtSize(lines[0], nameSize);
    let l2W = fontBold.widthOfTextAtSize(lines[1], nameSize);
    while ((l1W > maxW || l2W > maxW) && nameSize > 10) {
      nameSize -= 0.5;
      l1W = fontBold.widthOfTextAtSize(lines[0], nameSize);
      l2W = fontBold.widthOfTextAtSize(lines[1], nameSize);
    }
    page.drawText(lines[0], {
      x: (width - l1W) / 2,
      y: 308,
      size: nameSize,
      font: fontBold,
      color: rgb(0.137, 0.071, 0.220), // #231238
    });
    page.drawText(lines[1], {
      x: (width - l2W) / 2,
      y: 286,
      size: nameSize,
      font: fontBold,
      color: rgb(0.137, 0.071, 0.220),
    });
  } else {
    let nameSize = 19;
    let nameWidth = fontBold.widthOfTextAtSize(lines[0], nameSize);
    while (nameWidth > maxW && nameSize > 10) {
      nameSize -= 0.5;
      nameWidth = fontBold.widthOfTextAtSize(lines[0], nameSize);
    }
    page.drawText(lines[0], {
      x: (width - nameWidth) / 2,
      y: 297,
      size: nameSize,
      font: fontBold,
      color: rgb(0.137, 0.071, 0.220),
    });
  }

  // 3. QR Code (76x76 pt clean themed QR, no box, no corner curves, centered medallion)
  const checkInUrl = getCheckInUrl(registration);
  const qrPngBuffer = await generateQrPngBuffer(checkInUrl, { width: 600, noBorder: true });
  const qrImage = await doc.embedPng(qrPngBuffer);

  const qrSize = 76;
  const qrX = (width - qrSize) / 2;
  const qrY = 176;

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
  resolveBadgeRole,
  PT_PER_CM,
};
