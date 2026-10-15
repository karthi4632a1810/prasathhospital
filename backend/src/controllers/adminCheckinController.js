'use strict';

const Registration = require('../models/Registration');
const Event = require('../models/Event');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { recordAudit } = require('../services/auditLog');

/**
 * The scanner reads whatever the QR encodes — a full
 * `{PUBLIC_SITE_URL}/tickets/:qrToken` URL (see Module 7) if scanned by our
 * own admin tool, or possibly a bare token if pasted manually. Either way,
 * the token is just the last path segment.
 */
function extractToken(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  const parts = str.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

const STATUS_MESSAGES = {
  cancelled: 'This registration has been cancelled. The ticket is not valid.',
  refunded: 'This registration was refunded. The ticket is not valid.',
  pending_payment: 'This registration was never confirmed. The ticket is not valid.',
};

/**
 * POST /api/v1/admin/checkin/scan  Body: { qrToken }
 *
 * Unknown tokens → 404, cancelled/unconfirmed → 409, a second scan →
 * `already-checked-in` with the original time. The check-in itself is one
 * guarded update (`checkedInAt: null` in the filter), so two scanners
 * reading the same QR at the same moment can't both record a first entry.
 */
const scanTicket = asyncHandler(async (req, res) => {
  const token = extractToken(req.body.qrToken);
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) throw ApiError.notFound('No ticket found for this code.');

  const reg = await Registration.findOne({ qrToken: token })
    .populate('event', 'title')
    .populate('ticketType', 'name')
    .populate('company', 'name');

  if (!reg) throw ApiError.notFound('No ticket found for this code.');

  if (reg.status !== 'confirmed') {
    throw ApiError.conflict(STATUS_MESSAGES[reg.status] || 'This ticket is not valid.');
  }

  const payload = {
    registrationCode: reg.registrationCode,
    attendee: { name: reg.attendee.name, email: reg.attendee.email, phone: reg.attendee.phone },
    event: reg.event,
    ticketType: reg.ticketType,
    company: reg.company ? { name: reg.company.name } : null,
    couponCode: reg.couponCode || '',
  };

  const now = new Date();
  const updated = await Registration.findOneAndUpdate(
    { _id: reg._id, status: 'confirmed', checkedInAt: null },
    { $set: { checkedInAt: now, checkedInBy: req.user._id } },
    { new: true }
  );

  if (!updated) {
    const latest = await Registration.findById(reg._id).select('checkedInAt status');
    if (latest?.status !== 'confirmed') throw ApiError.conflict(STATUS_MESSAGES[latest?.status] || 'This ticket is not valid.');
    return sendSuccess(res, { result: 'already-checked-in', checkedInAt: latest.checkedInAt, ...payload });
  }

  recordAudit(req, { action: 'registration.checkin', entityType: 'Registration', entityId: reg._id, meta: { registrationCode: reg.registrationCode } });
  return sendSuccess(res, { result: 'success', checkedInAt: updated.checkedInAt, ...payload });
});

/** GET /api/v1/admin/checkin/stats?event=<eventId> */
const getCheckinStats = asyncHandler(async (req, res) => {
  if (!req.query.event) throw ApiError.badRequest('An "event" id is required.');

  const [total, checkedIn] = await Promise.all([
    Registration.countDocuments({ event: req.query.event, status: 'confirmed' }),
    Registration.countDocuments({ event: req.query.event, status: 'confirmed', checkedInAt: { $ne: null } }),
  ]);

  return sendSuccess(res, { total, checkedIn, remaining: total - checkedIn });
});

/**
 * GET /api/v1/admin/checkin/events
 * Minimal event list (id, title, dates) for the role-agnostic screens —
 * the dashboard and the scanner. /admin/events is manager+ (it's the CMS),
 * so check-in staff use this instead.
 */
const listCheckinEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({}).select('title slug startDate endDate status').sort({ startDate: -1 });
  return sendSuccess(
    res,
    events.map((e) => ({ id: e._id, title: e.title, slug: e.slug, startDate: e.startDate, endDate: e.endDate, status: e.status }))
  );
});

module.exports = { scanTicket, getCheckinStats, listCheckinEvents, extractToken };
