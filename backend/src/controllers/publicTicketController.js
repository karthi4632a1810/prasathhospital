'use strict';

const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { generateQrPngBuffer } = require('../utils/qrcode');
const { streamTicketPdf } = require('../utils/ticketPdf');
const { streamCertificatePdf } = require('../utils/certificatePdf');
const env = require('../config/env');

/**
 * The qrToken is unguessable (48 hex chars of crypto randomness) and IS the
 * access control for all four routes below — no further auth. Only
 * confirmed registrations ever have one (see Registration.issueQrToken()).
 */
async function findTicketOr404(qrToken) {
  if (!/^[a-f0-9]{48}$/i.test(String(qrToken || ''))) throw ApiError.notFound('Ticket not found');
  const reg = await Registration.findOne({ qrToken })
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
  return sendSuccess(res, {
    registrationCode: reg.registrationCode,
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

/** GET /api/v1/tickets/:qrToken/certificate.pdf — available once the event has concluded. */
const getCertificatePdf = asyncHandler(async (req, res) => {
  const reg = await findTicketOr404(req.params.qrToken);
  if (reg.status !== 'confirmed') throw ApiError.conflict('Certificates are only issued for confirmed registrations.');
  if (reg.event.status !== 'completed') {
    throw ApiError.conflict('Certificates are issued once the event has concluded.');
  }

  if (!reg.certificateIssuedAt) {
    reg.certificateIssuedAt = new Date();
    await reg.save();
  }

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${reg.registrationCode}-certificate.pdf"`);
  streamCertificatePdf(res, { event: reg.event, registration: reg });
});

module.exports = { getTicket, getTicketQrImage, getTicketPdf, getCertificatePdf };
