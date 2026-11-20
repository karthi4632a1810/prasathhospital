'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const {
  generateIdCardPdfBuffer,
  generateMultiPageIdCardPdfBuffer,
  generateIdCardsZipBuffer,
} = require('../utils/idCardPdf');

function getFacultyExcelPath() {
  const candidates = [
    path.resolve(process.cwd(), 'Faculty list for ID.xlsx'),
    path.resolve(__dirname, '../../Faculty list for ID.xlsx'),
    path.resolve(__dirname, '../../../Faculty list for ID.xlsx'),
    '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/Faculty list for ID.xlsx',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * GET /api/v1/admin/id-cards/faculty-seed
 * Reads and returns the default faculty list from "Faculty list for ID.xlsx".
 */
const getFacultySeed = asyncHandler(async (req, res) => {
  const filePath = getFacultyExcelPath();
  if (!filePath) {
    return sendSuccess(res, []);
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const items = rawRows
    .map((row, idx) => {
      // Find name from column 'Speaker', 'Name', etc.
      const name = String(row.Speaker || row.speaker || row.Name || row.name || Object.values(row)[0] || '').trim();
      if (!name) return null;
      const badgeNo = String(idx + 1).padStart(4, '0');
      return {
        id: `FAC-${String(idx + 1).padStart(2, '0')}`,
        name,
        role: 'FACULTY',
        code: `FAC-${String(idx + 1).padStart(2, '0')}`,
        badgeNo,
      };
    })
    .filter(Boolean);

  return sendSuccess(res, items);
});

/**
 * POST /api/v1/admin/id-cards/bulk-pdf
 * Generates a single combined multi-page PDF containing all requested badges.
 * Body: { items: Array<{ id?, name, role?, code?, badgeNo?, showQr? }>, template: boolean, showQr: boolean, showBadgeNo: boolean }
 */
const generateBulkPdf = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (items.length === 0) {
    throw ApiError.badRequest('No items provided for ID card generation.');
  }

  const includeTemplate = req.body.template === true || req.body.template === 'true';
  const showQr = req.body.showQr !== false && req.body.noQr !== true && req.query.showQr !== 'false';
  const showBadgeNo = req.body.showBadgeNo !== false && req.body.noBadgeNo !== true && req.query.showBadgeNo !== 'false';
  const buffer = await generateMultiPageIdCardPdfBuffer(items, { includeTemplate, showQr, showBadgeNo });

  const qrSuffix = !showQr ? '-NO-QR' : '';
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="CIIM2026-ID-CARDS-COMBINED${qrSuffix}.pdf"`);
  return res.send(buffer);
});

/**
 * POST /api/v1/admin/id-cards/bulk-zip
 * Generates and streams a ZIP file containing individual PDF cards.
 * Body: { items: Array<{ id?, name, role?, code?, badgeNo?, showQr? }>, template: boolean, showQr: boolean, showBadgeNo: boolean }
 */
const generateBulkZip = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (items.length === 0) {
    throw ApiError.badRequest('No items provided for ID card generation.');
  }

  const includeTemplate = req.body.template === true || req.body.template === 'true';
  const showQr = req.body.showQr !== false && req.body.noQr !== true && req.query.showQr !== 'false';
  const showBadgeNo = req.body.showBadgeNo !== false && req.body.noBadgeNo !== true && req.query.showBadgeNo !== 'false';
  const buffer = await generateIdCardsZipBuffer(items, { includeTemplate, showQr, showBadgeNo });

  const qrSuffix = !showQr ? '-NO-QR' : '';
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="CIIM2026-ID-CARDS${qrSuffix}.zip"`);
  return res.send(buffer);
});

/**
 * GET or POST /api/v1/admin/id-cards/single-pdf
 * Generates an ID card PDF for a single custom attendee.
 */
const generateSinglePdf = asyncHandler(async (req, res) => {
  const name = req.body?.name || req.query?.name || 'Delegate';
  const role = req.body?.role || req.query?.role || 'FACULTY';
  const code = req.body?.code || req.query?.code || 'BADGE-01';
  const includeTemplate =
    req.body?.template === true ||
    req.body?.template === 'true' ||
    req.query?.template === 'true' ||
    req.query?.preview === 'true';
  const showQr =
    req.body?.showQr !== false &&
    req.body?.noQr !== true &&
    req.query?.showQr !== 'false' &&
    req.query?.noQr !== 'true';
  const showBadgeNo =
    req.body?.showBadgeNo !== false &&
    req.body?.noBadgeNo !== true &&
    req.query?.showBadgeNo !== 'false' &&
    req.query?.noBadgeNo !== 'true';
  const badgeNo =
    req.body?.badgeNo ||
    req.query?.badgeNo ||
    req.body?.badgeNumber ||
    req.query?.badgeNumber ||
    '0001';

  const buffer = await generateIdCardPdfBuffer(
    { name, role, code, registrationCode: code, badgeNo },
    { role, name, includeTemplate, showQr, showBadgeNo, badgeNo }
  );

  const safeName = String(name).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
  const qrSuffix = !showQr ? '-NO-QR' : '';
  const numPrefix = showBadgeNo && badgeNo ? `${badgeNo}-` : '';
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${numPrefix}${code}-${safeName}-ID-CARD${qrSuffix}.pdf"`);
  return res.send(buffer);
});

module.exports = {
  getFacultySeed,
  generateBulkPdf,
  generateBulkZip,
  generateSinglePdf,
};
