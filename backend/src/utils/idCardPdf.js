'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

function cleanDoctorName(name) {
  if (!name) return 'Delegate';
  return String(name).trim();
}

function normalizeCategory(categoryName, ticketTypeName) {
  const cat = (ticketTypeName || categoryName || 'Delegate').toUpperCase();
  if (cat.includes('PG') || cat.includes('STUDENT') || cat.includes('RESIDENT')) return 'PG STUDENT / RESIDENT';
  if (cat.includes('FACULTY')) return 'FACULTY';
  if (cat.includes('INHOUSE') || cat.includes('IN-HOUSE')) return 'IN-HOUSE DELEGATE';
  if (cat.includes('COMPLIMENTARY')) return 'COMPLIMENTARY DELEGATE';
  if (cat.includes('VIP')) return 'VIP DELEGATE';
  if (cat.includes('ORGANIZING') || cat.includes('COMMITTEE')) return 'ORGANIZING COMMITTEE';
  return 'CONFERENCE DELEGATE';
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

/**
 * Generates an ID Card / Delegate Badge PDF buffer using the ID_CARD.pdf template.
 * Fills attendee details in the empty middle space with zero QR code, preserving
 * the exact top logo and bottom footer.
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
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const attendee = registration.attendee || {};
  const ticketType = registration.ticketType || {};
  const company = registration.company || {};

  const name = cleanDoctorName(attendee.name || `${attendee.firstName || ''} ${attendee.lastName || ''}`);
  const category = normalizeCategory(attendee.category, ticketType.name);
  const institution = (attendee.institution || company.name || '').trim();
  const city = (attendee.city || attendee.address || attendee.state || '').trim();
  const regCode = (registration.registrationCode || '').trim();
  const councilNo = (attendee.medicalCouncilRegNo || attendee.councilRegistrationNumber || '').trim();
  const hasCouncil = councilNo && !['NA', 'N/A', 'NIL', 'NONE', '-', 'NOT APPLICABLE', 'NOTAPPLICABLE'].includes(councilNo.toUpperCase());

  // Available Y range in points from bottom:
  // Top logo ends at ~325
  // Bottom banner starts at ~118
  // Space is ~200 points. Center of space is y = 220

  // 1. Category Badge Pill (around y = 278)
  const catSize = 8.5;
  const catWidth = fontBold.widthOfTextAtSize(category, catSize);
  const catPadX = 10;
  const catPadY = 3.5;
  const catX = (width - catWidth) / 2;
  const catY = 278;

  page.drawRectangle({
    x: catX - catPadX,
    y: catY - catPadY,
    width: catWidth + (catPadX * 2),
    height: catSize + (catPadY * 2),
    color: rgb(0.99, 0.94, 0.96), // #fff0f5 soft blush
    borderColor: rgb(0.92, 0.25, 0.40), // #eb3f67 signature rose
    borderWidth: 1,
  });
  page.drawText(category, {
    x: catX,
    y: catY,
    size: catSize,
    font: fontBold,
    color: rgb(0.76, 0.10, 0.36), // #c2185b crimson
  });

  // 2. Delegate Full Name (centered, prominent, auto-scaling)
  let nameSize = 17;
  let nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  const maxW = width - 36; // 216 pt safe inner width
  while (nameWidth > maxW && nameSize > 11) {
    nameSize -= 0.5;
    nameWidth = fontBold.widthOfTextAtSize(name, nameSize);
  }

  const nameY = 236;
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: nameY,
    size: nameSize,
    font: fontBold,
    color: rgb(0.14, 0.07, 0.22), // #231238 deep plum
  });

  // 3. Institution / Hospital / Org (if present)
  let currentY = 214;
  if (institution) {
    let instSize = 9.5;
    let instWidth = fontRegular.widthOfTextAtSize(institution, instSize);
    while (instWidth > maxW && instSize > 8) {
      instSize -= 0.5;
      instWidth = fontRegular.widthOfTextAtSize(institution, instSize);
    }
    page.drawText(institution, {
      x: (width - instWidth) / 2,
      y: currentY,
      size: instSize,
      font: fontRegular,
      color: rgb(0.31, 0.18, 0.40), // #4e2f66
    });
    currentY -= 14;
  }

  // City / Location (if present)
  if (city) {
    const cityText = city.toUpperCase();
    const citySize = 8.5;
    const cityWidth = fontBold.widthOfTextAtSize(cityText, citySize);
    page.drawText(cityText, {
      x: (width - cityWidth) / 2,
      y: currentY,
      size: citySize,
      font: fontBold,
      color: rgb(0.53, 0.43, 0.61), // #886e9c
    });
    currentY -= 16;
  } else {
    currentY -= 6;
  }

  // Subtle decorative divider
  page.drawLine({
    start: { x: width / 2 - 25, y: currentY },
    end: { x: width / 2 + 25, y: currentY },
    thickness: 0.75,
    color: rgb(0.92, 0.82, 0.88),
  });
  currentY -= 18;

  // 4. Delegate Registration ID
  if (regCode) {
    const regText = 'ID: ' + regCode;
    const regSize = 9.5;
    const regWidth = fontBold.widthOfTextAtSize(regText, regSize);
    page.drawText(regText, {
      x: (width - regWidth) / 2,
      y: currentY,
      size: regSize,
      font: fontBold,
      color: rgb(0.14, 0.07, 0.22),
    });
    currentY -= 14;
  }

  // 5. Medical Council Reg No (if applicable)
  if (hasCouncil) {
    const councilText = (councilNo.toUpperCase().includes('TNMC') || councilNo.toUpperCase().includes('COUNCIL'))
      ? councilNo
      : 'TNMC Reg No: ' + councilNo;
    const councilSize = 8;
    const councilWidth = fontRegular.widthOfTextAtSize(councilText, councilSize);
    page.drawText(councilText, {
      x: (width - councilWidth) / 2,
      y: currentY,
      size: councilSize,
      font: fontRegular,
      color: rgb(0.48, 0.43, 0.47),
    });
    currentY -= 16;
  } else {
    currentY -= 8;
  }

  // 6. Both Locations Indicators (Main Entry Desk + Lunch Counter)
  const loc1 = 'ENTRY PASS';
  const loc2 = 'LUNCH PASS';
  const badgeSize = 7.5;
  const b1W = fontBold.widthOfTextAtSize(loc1, badgeSize);
  const b2W = fontBold.widthOfTextAtSize(loc2, badgeSize);
  const padX = 6;
  const padY = 2.5;
  const b1TotalW = b1W + padX * 2;
  const b2TotalW = b2W + padX * 2;
  const gap = 8;
  const totalBarW = b1TotalW + gap + b2TotalW;
  const startX = (width - totalBarW) / 2;
  const locY = Math.max(currentY, 132);

  // Draw Entry Badge
  page.drawRectangle({
    x: startX,
    y: locY - padY,
    width: b1TotalW,
    height: badgeSize + padY * 2,
    color: rgb(0.93, 0.96, 1.0), // soft ice blue
    borderColor: rgb(0.15, 0.39, 0.92), // royal blue
    borderWidth: 0.75,
  });
  page.drawText(loc1, {
    x: startX + padX,
    y: locY,
    size: badgeSize,
    font: fontBold,
    color: rgb(0.12, 0.32, 0.76),
  });

  // Draw Lunch Badge
  const b2X = startX + b1TotalW + gap;
  page.drawRectangle({
    x: b2X,
    y: locY - padY,
    width: b2TotalW,
    height: badgeSize + padY * 2,
    color: rgb(0.93, 0.98, 0.94), // soft mint green
    borderColor: rgb(0.09, 0.64, 0.29), // emerald green
    borderWidth: 0.75,
  });
  page.drawText(loc2, {
    x: b2X + padX,
    y: locY,
    size: badgeSize,
    font: fontBold,
    color: rgb(0.07, 0.52, 0.23),
  });

  const outputBytes = await doc.save();
  return Buffer.from(outputBytes);
}

module.exports = {
  generateIdCardPdfBuffer,
  cleanDoctorName,
  normalizeCategory,
};
