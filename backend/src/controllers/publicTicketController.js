'use strict';

const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { generateQrPngBuffer } = require('../utils/qrcode');
const { streamTicketPdf } = require('../utils/ticketPdf');
const { streamCertificatePdf } = require('../utils/certificatePdf');
const { generateIdCardPdfBuffer, generateIdCardImageBuffer } = require('../utils/idCardPdf');
const { generateCertificateBuffer } = require('../utils/certificateGenerator');
const { resolveRegistrationBadgeNo } = require('../services/badgeService');
const env = require('../config/env');

/**
 * The ticket can be looked up either by:
 * 1. Unguessable 48-char crypto hex qrToken (standard link sent via WhatsApp/email)
 * 2. Registration Code (e.g. REG-FDD9528D) for direct lookup & admin desk access
 */
async function findTicketOr404(identifier) {
  const raw = String(identifier || '').trim();
  let query = null;
  if (/^[a-f0-9]{48}$/i.test(raw)) {
    query = { qrToken: raw.toLowerCase() };
  } else if (/^REG-[A-Z0-9_-]+$/i.test(raw)) {
    query = { registrationCode: raw.toUpperCase() };
  } else {
    throw ApiError.notFound('Ticket not found');
  }

  const reg = await Registration.findOne(query)
    .populate('event', 'title slug startDate endDate venue mode timezone status')
    .populate('ticketType', 'name admitsCount')
    .populate('company', 'name');
  if (!reg) throw ApiError.notFound('Ticket not found');
  return reg;
}

function checkInUrlFor(qrToken) {
  return `${env.publicSiteUrl}/tickets/${qrToken}`;
}

/** GET /api/v1/tickets/:qrToken */
const getTicket = asyncHandler(async (req, res) => {
  const reg = await findTicketOr404(req.params.qrToken);
  const badgeNo = reg.badgeNo || (await resolveRegistrationBadgeNo(reg));
  return sendSuccess(res, {
    registrationCode: reg.registrationCode,
    badgeNo,
    status: reg.status,
    attendee: {
      name: reg.attendee.name,
      email: reg.attendee.email,
      phone: reg.attendee.phone,
      medicalCouncilRegNo: reg.attendee.medicalCouncilRegNo || '',
      city: reg.attendee.city || '',
      state: reg.attendee.state || '',
      country: reg.attendee.country || '',
      institution: reg.attendee.institution || '',
    },
    company: reg.company ? { name: reg.company.name } : null,
    couponCode: reg.couponCode || '',
    amountPaid: reg.pricing?.totalAmount ?? 0,
    currency: reg.pricing?.currency || 'INR',
    registeredAt: reg.createdAt,
    checkedInAt: reg.checkedInAt,
    certificateIssuedAt: reg.certificateIssuedAt,
    event: reg.event,
    ticketType: reg.ticketType,
  });
});

/** GET /api/v1/tickets/:qrToken/qr.png */
const getTicketQrImage = asyncHandler(async (req, res) => {
  const reg = await findTicketOr404(req.params.qrToken);
  const buffer = await generateQrPngBuffer(checkInUrlFor(reg.qrToken));
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(buffer);
});

/** GET /api/v1/tickets/:qrToken/pdf */
const getTicketPdf = asyncHandler(async (req, res) => {
  const reg = await findTicketOr404(req.params.qrToken);
  if (reg.status !== 'confirmed') throw ApiError.conflict('This registration has been cancelled, so the ticket is no longer valid.');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${reg.registrationCode}.pdf"`);
  await streamTicketPdf(res, {
    event: reg.event,
    ticketType: reg.ticketType,
    registration: reg,
    checkInUrl: checkInUrlFor(reg.qrToken),
    companyName: reg.company?.name || '',
  });
});

/** GET /api/v1/tickets/:qrToken/certificate (or .pdf, .png, .jpg) */
const getCertificatePdf = asyncHandler(async (req, res) => {
  const reg = await findTicketOr404(req.params.qrToken);
  if (reg.status !== 'confirmed') throw ApiError.conflict('Certificates are only issued for confirmed registrations.');

  if (!reg.certificateIssuedAt) {
    reg.certificateIssuedAt = new Date();
    await reg.save().catch(() => { });
  }

  const requestedFormat = (req.params.ext || req.query.format || 'pdf').toLowerCase().replace(/^\./, '');
  const name = req.query.name || reg.attendee?.name || 'Delegate';
  const isPreview = req.query.preview === 'true';

  const { buffer, contentType, ext } = await generateCertificateBuffer({
    name,
    registrationCode: reg.registrationCode,
    format: requestedFormat,
  });

  const safeName = String(name).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `CIIM2026-CERTIFICATE-${reg.registrationCode}-${safeName}.${ext}`;

  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `${isPreview ? 'inline' : 'attachment'}; filename="${filename}"`);
  res.set('Cache-Control', 'public, max-age=60');
  return res.send(buffer);
});

/** GET /api/v1/tickets/:qrToken/badge.pdf — Official Delegate ID Card / Badge in PDF, PNG, or JPG */
const getBadgePdf = asyncHandler(async (req, res) => {
  const reg = await findTicketOr404(req.params.qrToken);
  if (reg.status !== 'confirmed') {
    throw ApiError.conflict('ID cards are only available for confirmed registrations.');
  }
  const role = req.query.role || null;
  const name = req.query.name || null;
  const format = String(req.params.ext || req.query.format || 'pdf').toLowerCase().replace(/^\./, '');
  const includeTemplate = req.query.template === 'true' || req.query.preview === 'true';
  const showQr = req.query.showQr !== 'false' && req.query.noQr !== 'true';
  const showBadgeNo = req.query.showBadgeNo !== 'false' && req.query.noBadgeNo !== 'true';
  let badgeNo = req.query.badgeNo || req.query.badgeNumber;
  if (!badgeNo) {
    badgeNo = await resolveRegistrationBadgeNo(reg);
  } else if (/^\d+$/.test(String(badgeNo).trim())) {
    badgeNo = String(badgeNo).trim().padStart(4, '0');
  }

  const safeName = (name || reg.attendee?.name || reg.registrationCode).replace(/[^a-zA-Z0-9_-]/g, '_');
  const qrSuffix = !showQr ? '-NO-QR' : '';
  const numPrefix = showBadgeNo && badgeNo ? `${badgeNo}-` : '';

  if (format === 'png') {
    const buffer = await generateIdCardImageBuffer(reg, {
      role,
      name,
      includeTemplate,
      showQr,
      showBadgeNo,
      badgeNo,
      format: 'png',
    });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${numPrefix}${reg.registrationCode}-${safeName}-ID-CARD${qrSuffix}.png"`);
    res.set('Cache-Control', 'public, max-age=60');
    return res.send(buffer);
  }

  if (format === 'jpg' || format === 'jpeg') {
    const buffer = await generateIdCardImageBuffer(reg, {
      role,
      name,
      includeTemplate,
      showQr,
      showBadgeNo,
      badgeNo,
      format: 'jpg',
    });
    res.set('Content-Type', 'image/jpeg');
    res.set('Content-Disposition', `inline; filename="${numPrefix}${reg.registrationCode}-${safeName}-ID-CARD${qrSuffix}.jpg"`);
    res.set('Cache-Control', 'public, max-age=60');
    return res.send(buffer);
  }

  const buffer = await generateIdCardPdfBuffer(reg, {
    role,
    name,
    includeTemplate,
    showQr,
    showBadgeNo,
    badgeNo,
  });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${numPrefix}${reg.registrationCode}-${safeName}-ID-CARD${qrSuffix}.pdf"`);
  res.set('Cache-Control', 'public, max-age=60');
  return res.send(buffer);
});

module.exports = { getTicket, getTicketQrImage, getTicketPdf, getCertificatePdf, getBadgePdf };
