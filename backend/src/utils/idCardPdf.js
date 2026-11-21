'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { ZipArchive } = require('archiver');
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

function getCheckInUrl(registration, fallbackIndex = 1) {
  let siteUrl = (process.env.PUBLIC_SITE_URL || env.publicSiteUrl || '').replace(/\/$/, '');
  if (!siteUrl || siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
    siteUrl = 'https://ciim.prashanthfertility.com';
  }

  const doc = registration && typeof registration.toObject === 'function'
    ? registration.toObject()
    : (registration || {});

  const token =
    doc.qrToken ||
    registration?.qrToken ||
    doc.registrationCode ||
    registration?.registrationCode ||
    doc.code ||
    registration?.code ||
    (doc._id ? String(doc._id) : (registration?._id ? String(registration._id) : null)) ||
    `CIIM-${String(doc.role || registration?.role || 'DELEGATE').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${String(fallbackIndex).padStart(3, '0')}`;

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
 * Internal draw function to render 1 ID badge onto a given PDF page.
 */
async function drawIdCardOnPage(
  doc,
  page,
  item,
  {
    fontBold,
    fontRegular,
    bgImage,
    includeTemplate,
    width,
    height,
    maxW,
    fallbackIndex = 1,
    showQr = true,
    showBadgeNo = true,
    badgeNo = null,
  }
) {
  if (includeTemplate && bgImage) {
    page.drawImage(bgImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const shouldDrawQr = showQr !== false && item.showQr !== false && !item.noQr;

  // Resolve 4-digit badge number (between name and QR code)
  const shouldDrawBadgeNo =
    showBadgeNo !== false &&
    item.showBadgeNo !== false &&
    !item.noBadgeNo &&
    item.showBadgeNumber !== false &&
    !item.noBadgeNumber;

  let rawBadgeNo = item.badgeNo || item.badgeNumber || badgeNo;
  let formattedBadgeNo = '';
  if (shouldDrawBadgeNo) {
    if (rawBadgeNo !== undefined && rawBadgeNo !== null && String(rawBadgeNo).trim() !== '') {
      const s = String(rawBadgeNo).trim();
      formattedBadgeNo = /^\d+$/.test(s) ? s.padStart(4, '0') : s;
    } else if (fallbackIndex) {
      formattedBadgeNo = String(fallbackIndex).padStart(4, '0');
    }
  }

  // 1. Role Header (DELEGATE / FACULTY / ORGANISING TEAM / Custom)
  const roleText = resolveBadgeRole(item, item.role);
  let roleSize = shouldDrawQr
    ? (roleText.length > 12 ? 12.5 : 13.5)
    : (roleText.length > 12 ? 13.5 : 14.5);
  let roleWidth = fontBold.widthOfTextAtSize(roleText, roleSize);
  while (roleWidth > maxW && roleSize > 9) {
    roleSize -= 0.5;
    roleWidth = fontBold.widthOfTextAtSize(roleText, roleSize);
  }

  // 2. Delegate Name (supports manual newline or auto 1-line/2-line balancing)
  const attendee = item.attendee || {};
  const rawName = item.name ? String(item.name).trim() : cleanDoctorName(attendee.name || `${attendee.firstName || ''} ${attendee.lastName || ''}`);
  const lines = splitNameToLines(rawName, fontBold, maxW);

  if (shouldDrawQr) {
    // Standard layout with QR Code positioned at y = 172-176
    const roleY = 338;
    page.drawText(roleText, {
      x: (width - roleWidth) / 2,
      y: roleY,
      size: roleSize,
      font: fontBold,
      color: rgb(0.761, 0.094, 0.357), // #c2185b
    });

    if (lines.length === 2) {
      let nameSize = formattedBadgeNo ? 15.5 : 16.5;
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
        y: formattedBadgeNo ? 288 : 286,
        size: nameSize,
        font: fontBold,
        color: rgb(0.137, 0.071, 0.220),
      });
    } else {
      let nameSize = formattedBadgeNo ? 18.5 : 19;
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

    // 2.5 4-Digit Badge Number (centered between Name and QR Code)
    if (formattedBadgeNo) {
      const numSize = 13.5;
      const numW = fontBold.widthOfTextAtSize(formattedBadgeNo, numSize);
      const numY = lines.length === 2 ? 266 : 267;
      page.drawText(formattedBadgeNo, {
        x: (width - numW) / 2,
        y: numY,
        size: numSize,
        font: fontBold,
        color: rgb(0.137, 0.071, 0.220),
      });
    }

    // 3. QR Code (76x76 pt clean themed QR, no box, no corner curves, centered medallion)
    const checkInUrl = item.qrUrl || getCheckInUrl(item, fallbackIndex);
    const qrPngBuffer = await generateQrPngBuffer(checkInUrl, { width: 600, noBorder: true });
    const qrImage = await doc.embedPng(qrPngBuffer);

    const qrSize = 76;
    const qrX = (width - qrSize) / 2;
    const qrY = formattedBadgeNo ? 172 : 176;

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });
  } else {
    // Clean layout WITHOUT QR Code (Role & Doctor Name optically centered in 7.5 cm white zone)
    const roleY = formattedBadgeNo ? (lines.length === 2 ? 310 : 300) : (lines.length === 2 ? 305 : 295);
    page.drawText(roleText, {
      x: (width - roleWidth) / 2,
      y: roleY,
      size: roleSize,
      font: fontBold,
      color: rgb(0.761, 0.094, 0.357), // #c2185b
    });

    if (lines.length === 2) {
      let nameSize = formattedBadgeNo ? 17.5 : 18;
      let l1W = fontBold.widthOfTextAtSize(lines[0], nameSize);
      let l2W = fontBold.widthOfTextAtSize(lines[1], nameSize);
      while ((l1W > maxW || l2W > maxW) && nameSize > 10) {
        nameSize -= 0.5;
        l1W = fontBold.widthOfTextAtSize(lines[0], nameSize);
        l2W = fontBold.widthOfTextAtSize(lines[1], nameSize);
      }
      page.drawText(lines[0], {
        x: (width - l1W) / 2,
        y: formattedBadgeNo ? 268 : 262,
        size: nameSize,
        font: fontBold,
        color: rgb(0.137, 0.071, 0.220),
      });
      page.drawText(lines[1], {
        x: (width - l2W) / 2,
        y: formattedBadgeNo ? 244 : 236,
        size: nameSize,
        font: fontBold,
        color: rgb(0.137, 0.071, 0.220),
      });
    } else {
      let nameSize = formattedBadgeNo ? 21 : 22;
      let nameWidth = fontBold.widthOfTextAtSize(lines[0], nameSize);
      while (nameWidth > maxW && nameSize > 10) {
        nameSize -= 0.5;
        nameWidth = fontBold.widthOfTextAtSize(lines[0], nameSize);
      }
      page.drawText(lines[0], {
        x: (width - nameWidth) / 2,
        y: formattedBadgeNo ? 256 : 248,
        size: nameSize,
        font: fontBold,
        color: rgb(0.137, 0.071, 0.220),
      });
    }

    // 4-Digit Badge Number without QR (optically balanced below name)
    if (formattedBadgeNo) {
      const numSize = 15;
      const numW = fontBold.widthOfTextAtSize(formattedBadgeNo, numSize);
      const numY = lines.length === 2 ? 214 : 222;
      page.drawText(formattedBadgeNo, {
        x: (width - numW) / 2,
        y: numY,
        size: numSize,
        font: fontBold,
        color: rgb(0.137, 0.071, 0.220),
      });
    }
  }
}

/**
 * Generates an ID Card PDF buffer for a single attendee.
 */
async function generateIdCardPdfBuffer(registration, options = {}) {
  const width = 10.2 * PT_PER_CM;   // 289.13 pt
  const height = 15.2 * PT_PER_CM; // 430.87 pt
  const maxW = width - 36; // 253.13 pt safe printable width

  const doc = await PDFDocument.create();
  const page = doc.addPage([width, height]);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  let bgImage = null;
  if (options.includeTemplate) {
    const bgPath = getSimulationBgPath();
    if (bgPath && fs.existsSync(bgPath)) {
      const bgBytes = fs.readFileSync(bgPath);
      bgImage = await doc.embedJpg(bgBytes);
    }
  }

  const docObj = registration && typeof registration.toObject === 'function'
    ? registration.toObject()
    : (registration || {});

  const mergedItem = {
    ...docObj,
    _id: docObj._id || registration?._id,
    qrToken: docObj.qrToken || registration?.qrToken,
    registrationCode: docObj.registrationCode || registration?.registrationCode || docObj.code || registration?.code,
    role: options.role || docObj.role || registration?.role || docObj.badgeRole || registration?.badgeRole,
    name: options.name || docObj.name || registration?.name || docObj.attendee?.name || registration?.attendee?.name,
    showQr: options.showQr !== undefined ? options.showQr : (docObj.showQr !== undefined ? docObj.showQr : registration?.showQr),
    showBadgeNo: options.showBadgeNo !== undefined ? options.showBadgeNo : (options.showBadgeNumber !== undefined ? options.showBadgeNumber : (docObj.showBadgeNo !== undefined ? docObj.showBadgeNo : registration?.showBadgeNo)),
    badgeNo: options.badgeNo || options.badgeNumber || docObj.badgeNo || registration?.badgeNo || registration?.badgeNumber,
  };

  const showQr = options.showQr !== false && !options.noQr && mergedItem.showQr !== false;
  const showBadgeNo = options.showBadgeNo !== false && !options.noBadgeNo && mergedItem.showBadgeNo !== false;

  await drawIdCardOnPage(doc, page, mergedItem, {
    fontBold,
    fontRegular,
    bgImage,
    includeTemplate: options.includeTemplate,
    width,
    height,
    maxW,
    showQr,
    showBadgeNo,
    badgeNo: mergedItem.badgeNo,
  });

  const outputBytes = await doc.save();
  return Buffer.from(outputBytes);
}

/**
 * Generates a single multi-page PDF with 1 page per attendee card.
 */
async function generateMultiPageIdCardPdfBuffer(items, options = {}) {
  const width = 10.2 * PT_PER_CM;
  const height = 15.2 * PT_PER_CM;
  const maxW = width - 36;

  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  let bgImage = null;
  if (options.includeTemplate) {
    const bgPath = getSimulationBgPath();
    if (bgPath && fs.existsSync(bgPath)) {
      const bgBytes = fs.readFileSync(bgPath);
      bgImage = await doc.embedJpg(bgBytes);
    }
  }

  const globalShowQr = options.showQr !== false && !options.noQr;
  const globalShowBadgeNo = options.showBadgeNo !== false && !options.noBadgeNo;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const docObj = item && typeof item.toObject === 'function' ? item.toObject() : (item || {});
    const page = doc.addPage([width, height]);
    const mergedItem = {
      ...docObj,
      _id: docObj._id || item?._id,
      qrToken: docObj.qrToken || item?.qrToken,
      registrationCode: docObj.registrationCode || item?.registrationCode || docObj.code || item?.code,
      role: options.role || docObj.role || item?.role || docObj.badgeRole || item?.badgeRole,
      name: options.name || docObj.name || item?.name || docObj.attendee?.name || item?.attendee?.name,
      badgeNo: options.badgeNo || options.badgeNumber || docObj.badgeNo || item?.badgeNo || item?.badgeNumber || String(i + 1).padStart(4, '0'),
    };
    const itemShowQr = item.showQr !== undefined ? (item.showQr !== false && !item.noQr) : globalShowQr;
    const itemShowBadgeNo = item.showBadgeNo !== undefined ? (item.showBadgeNo !== false && !item.noBadgeNo) : globalShowBadgeNo;

    await drawIdCardOnPage(doc, page, mergedItem, {
      fontBold,
      fontRegular,
      bgImage,
      includeTemplate: options.includeTemplate,
      width,
      height,
      maxW,
      fallbackIndex: i + 1,
      showQr: itemShowQr,
      showBadgeNo: itemShowBadgeNo,
      badgeNo: mergedItem.badgeNo,
    });
  }

  const outputBytes = await doc.save();
  return Buffer.from(outputBytes);
}

/**
 * Generates a ZIP archive Buffer containing individual PDF files for all items.
 */
async function generateIdCardsZipBuffer(items, options = {}) {
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const chunks = [];
  zip.on('data', (c) => chunks.push(c));

  const completionPromise = new Promise((resolve, reject) => {
    zip.on('end', () => resolve(Buffer.concat(chunks)));
    zip.on('error', reject);
  });

  const globalShowQr = options.showQr !== false && !options.noQr;
  const globalShowBadgeNo = options.showBadgeNo !== false && !options.noBadgeNo;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemShowQr = item.showQr !== undefined ? (item.showQr !== false && !item.noQr) : globalShowQr;
    const itemShowBadgeNo = item.showBadgeNo !== undefined ? (item.showBadgeNo !== false && !item.noBadgeNo) : globalShowBadgeNo;
    const itemBadgeNo = item.badgeNo || item.badgeNumber || String(i + 1).padStart(4, '0');

    const singlePdf = await generateIdCardPdfBuffer(item, {
      role: item.role || options.role,
      name: item.name || item.attendee?.name,
      includeTemplate: options.includeTemplate,
      showQr: itemShowQr,
      showBadgeNo: itemShowBadgeNo,
      badgeNo: itemBadgeNo,
    });
    const safeRole = String(item.role || options.role || 'BADGE').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = String(item.name || item.attendee?.name || `Attendee_${i + 1}`)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const qrSuffix = !itemShowQr ? '-NO-QR' : '';
    const numPrefix = itemShowBadgeNo ? `${itemBadgeNo}-` : `${String(i + 1).padStart(2, '0')}-`;
    const filename = `${numPrefix}${safeRole}-${safeName}${qrSuffix}.pdf`;
    zip.append(singlePdf, { name: filename });
  }

  await zip.finalize();
  return completionPromise;
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an ID Card raster image (PNG or JPG) using sharp and SVG text overlay.
 */
async function generateIdCardImageBuffer(registration, options = {}) {
  const widthPx = 1050;
  const heightPx = 1500;
  const format = String(options.format || 'png').toLowerCase().replace(/^\./, '');

  const docObj = registration && typeof registration.toObject === 'function'
    ? registration.toObject()
    : (registration || {});

  const mergedItem = {
    ...docObj,
    _id: docObj._id || registration?._id,
    qrToken: docObj.qrToken || registration?.qrToken,
    registrationCode: docObj.registrationCode || registration?.registrationCode || docObj.code || registration?.code,
    role: options.role || docObj.role || registration?.role || docObj.badgeRole || registration?.badgeRole,
    name: options.name || docObj.name || registration?.name || docObj.attendee?.name || registration?.attendee?.name,
    showQr: options.showQr !== undefined ? options.showQr : (docObj.showQr !== undefined ? docObj.showQr : registration?.showQr),
    showBadgeNo: options.showBadgeNo !== undefined ? options.showBadgeNo : (options.showBadgeNumber !== undefined ? options.showBadgeNumber : (docObj.showBadgeNo !== undefined ? docObj.showBadgeNo : registration?.showBadgeNo)),
    badgeNo: options.badgeNo || options.badgeNumber || docObj.badgeNo || registration?.badgeNo || registration?.badgeNumber,
  };

  const shouldDrawQr = options.showQr !== false && !options.noQr && mergedItem.showQr !== false;
  const shouldDrawBadgeNo = options.showBadgeNo !== false && !options.noBadgeNo && mergedItem.showBadgeNo !== false;

  let rawBadgeNo = mergedItem.badgeNo;
  let formattedBadgeNo = '';
  if (shouldDrawBadgeNo) {
    if (rawBadgeNo !== undefined && rawBadgeNo !== null && String(rawBadgeNo).trim() !== '') {
      const s = String(rawBadgeNo).trim();
      formattedBadgeNo = /^\d+$/.test(s) ? s.padStart(4, '0') : s;
    } else {
      formattedBadgeNo = '0001';
    }
  }

  const roleText = resolveBadgeRole(mergedItem, mergedItem.role);
  const rawName = mergedItem.name ? String(mergedItem.name).trim() : cleanDoctorName(mergedItem.attendee?.name);

  // Split name lines
  let lines = [rawName];
  if (rawName.includes('\n')) {
    lines = rawName.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
  } else if (rawName.length > 22 && rawName.includes(' ')) {
    const words = rawName.split(' ');
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }

  let textSvg = '';
  if (shouldDrawQr) {
    const roleY = 325;
    textSvg += `<text x="525" y="${roleY}" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="46" fill="#c2185b" text-anchor="middle" letter-spacing="2">${escapeXml(roleText)}</text>`;

    if (lines.length === 2) {
      textSvg += `<text x="525" y="440" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="52" fill="#231238" text-anchor="middle">${escapeXml(lines[0])}</text>`;
      textSvg += `<text x="525" y="505" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="52" fill="#231238" text-anchor="middle">${escapeXml(lines[1])}</text>`;
    } else {
      textSvg += `<text x="525" y="470" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="62" fill="#231238" text-anchor="middle">${escapeXml(lines[0])}</text>`;
    }

    if (formattedBadgeNo) {
      const badgeY = lines.length === 2 ? 570 : 565;
      textSvg += `<text x="525" y="${badgeY}" font-family="'Liberation Sans', Arial, monospace" font-weight="bold" font-size="46" fill="#231238" text-anchor="middle" letter-spacing="4">${escapeXml(formattedBadgeNo)}</text>`;
    }
  } else {
    // No QR Code layout: vertically balanced
    const roleY = formattedBadgeNo ? (lines.length === 2 ? 430 : 460) : (lines.length === 2 ? 450 : 480);
    textSvg += `<text x="525" y="${roleY}" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="48" fill="#c2185b" text-anchor="middle" letter-spacing="2">${escapeXml(roleText)}</text>`;

    if (lines.length === 2) {
      textSvg += `<text x="525" y="${roleY + 130}" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="58" fill="#231238" text-anchor="middle">${escapeXml(lines[0])}</text>`;
      textSvg += `<text x="525" y="${roleY + 210}" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="58" fill="#231238" text-anchor="middle">${escapeXml(lines[1])}</text>`;
    } else {
      textSvg += `<text x="525" y="${roleY + 160}" font-family="'Liberation Sans', Arial, sans-serif" font-weight="bold" font-size="70" fill="#231238" text-anchor="middle">${escapeXml(lines[0])}</text>`;
    }

    if (formattedBadgeNo) {
      const badgeY = lines.length === 2 ? roleY + 310 : roleY + 270;
      textSvg += `<text x="525" y="${badgeY}" font-family="'Liberation Sans', Arial, monospace" font-weight="bold" font-size="52" fill="#231238" text-anchor="middle" letter-spacing="4">${escapeXml(formattedBadgeNo)}</text>`;
    }
  }

  const svgBuffer = Buffer.from(`
    <svg width="${widthPx}" height="${heightPx}" xmlns="http://www.w3.org/2000/svg">
      ${textSvg}
    </svg>
  `);

  const composites = [{ input: svgBuffer, top: 0, left: 0 }];

  if (shouldDrawQr) {
    const checkInUrl = mergedItem.qrUrl || getCheckInUrl(mergedItem);
    const qrPngBuffer = await generateQrPngBuffer(checkInUrl, { width: 600, noBorder: true });
    const qrSizePx = 265;
    const qrResized = await sharp(qrPngBuffer).resize(qrSizePx, qrSizePx).toBuffer();
    const qrTop = formattedBadgeNo ? 625 : 610;
    composites.push({
      input: qrResized,
      top: qrTop,
      left: Math.round((widthPx - qrSizePx) / 2),
    });
  }

  let basePipeline;
  if (options.includeTemplate) {
    const bgPath = getSimulationBgPath();
    if (bgPath && fs.existsSync(bgPath)) {
      basePipeline = sharp(bgPath).resize(widthPx, heightPx);
    } else {
      basePipeline = sharp({
        create: { width: widthPx, height: heightPx, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      });
    }
  } else {
    // Clean overlay for pre-printed card stock
    const isJpg = format === 'jpg' || format === 'jpeg';
    basePipeline = sharp({
      create: {
        width: widthPx,
        height: heightPx,
        channels: 4,
        background: isJpg
          ? { r: 255, g: 255, b: 255, alpha: 1 }
          : { r: 255, g: 255, b: 255, alpha: 0 },
      },
    });
  }

  basePipeline.composite(composites);

  if (format === 'jpg' || format === 'jpeg') {
    return await basePipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  }
  return await basePipeline.png().toBuffer();
}

module.exports = {
  generateIdCardPdfBuffer,
  generateMultiPageIdCardPdfBuffer,
  generateIdCardsZipBuffer,
  generateIdCardImageBuffer,
  cleanDoctorName,
  getCheckInUrl,
  resolveBadgeRole,
  PT_PER_CM,
};
