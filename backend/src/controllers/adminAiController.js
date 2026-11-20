'use strict';

const {
  processUserPrompt,
  getFileFromStore,
} = require('../services/aiAssistantService');
const { generateCertificateBuffer } = require('../utils/certificateGenerator');
const {
  generateIdCardPdfBuffer,
  generateIdCardImageBuffer,
} = require('../utils/idCardPdf');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');

/**
 * POST /api/v1/admin/ai/chat
 */
const chat = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) {
    throw ApiError.badRequest('Message prompt is required.');
  }

  const result = await processUserPrompt(message, req.user);
  return sendSuccess(res, result);
});

/**
 * GET /api/v1/admin/ai/download/certificate
 */
const downloadCertificate = asyncHandler(async (req, res) => {
  const name = String(req.query.name || 'Delegate').trim();
  const registrationCode = String(req.query.registrationCode || '').trim();
  const format = String(req.query.format || 'pdf').toLowerCase();

  const cert = await generateCertificateBuffer({ name, registrationCode, format });
  const filename = `CIIM2026_Certificate_${name.replace(/\s+/g, '_')}.${cert.ext}`;

  res.setHeader('Content-Type', cert.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(cert.buffer);
});

/**
 * GET /api/v1/admin/ai/download/id-card
 */
const downloadIdCard = asyncHandler(async (req, res) => {
  const name = String(req.query.name || 'Delegate').trim();
  const role = String(req.query.role || 'DELEGATE').trim();
  const badgeNo = String(req.query.badgeNo || '0001').trim();
  const format = String(req.query.format || 'pdf').toLowerCase();
  const includeTemplate = req.query.includeTemplate !== 'false';

  const mockItem = {
    name,
    role,
    badgeNo,
    attendee: { name },
    showQr: true,
    showBadgeNo: true,
  };

  if (format === 'pdf') {
    const buffer = await generateIdCardPdfBuffer(mockItem, {
      name,
      role,
      badgeNo,
      includeTemplate,
      showQr: true,
      showBadgeNo: true,
    });
    const filename = `CIIM2026_IDCard_${name.replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  // PNG or JPG
  const isJpg = format === 'jpg' || format === 'jpeg';
  const buffer = await generateIdCardImageBuffer(mockItem, {
    name,
    role,
    badgeNo,
    format: isJpg ? 'jpg' : 'png',
    includeTemplate,
    showQr: true,
    showBadgeNo: true,
  });

  const ext = isJpg ? 'jpg' : 'png';
  const filename = `CIIM2026_IDCard_${name.replace(/\s+/g, '_')}.${ext}`;
  res.setHeader('Content-Type', isJpg ? 'image/jpeg' : 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

/**
 * GET /api/v1/admin/ai/download/excel/:fileId
 */
const downloadExcel = asyncHandler(async (req, res) => {
  const file = getFileFromStore(req.params.fileId);
  if (!file || !file.buffer) {
    throw ApiError.notFound('Export file expired or not found. Please re-run the query.');
  }

  res.setHeader('Content-Type', file.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename || 'export.xlsx'}"`);
  return res.send(file.buffer);
});

module.exports = {
  chat,
  downloadCertificate,
  downloadIdCard,
  downloadExcel,
};
