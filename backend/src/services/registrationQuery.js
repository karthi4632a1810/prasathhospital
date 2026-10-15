'use strict';

const { Types } = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Turns admin query-string filters into a Mongo filter. Shared by the
 * registrations table, its CSV export and the reports, so "filtered export"
 * always matches what's on screen.
 *
 * Supported: event, company, coupon, status, emailStatus, whatsappStatus,
 * checkedIn (yes|no), from, to (YYYY-MM-DD, inclusive, IST), q.
 */

const STATUSES = ['confirmed', 'cancelled', 'pending_payment', 'refunded'];
const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'retryable', 'not_configured'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function objectId(value, label) {
  if (!Types.ObjectId.isValid(String(value))) throw ApiError.badRequest(`Invalid ${label} id.`);
  return new Types.ObjectId(String(value));
}

/** Day boundaries in India time, since that's the organiser's calendar. */
function dayStart(value, label) {
  const date = new Date(`${value}T00:00:00+05:30`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${label} must be a date (YYYY-MM-DD).`);
  }
  return date;
}

function deliveryFilter(status) {
  if (!DELIVERY_STATUSES.includes(status)) throw ApiError.badRequest('Unknown delivery status filter.');
  // Registrations from before delivery tracking existed have no status at all.
  return status === 'pending' ? { $in: ['pending', null] } : status;
}

function buildRegistrationFilter(query = {}) {
  const filter = {};
  if (query.event) filter.event = objectId(query.event, 'event');
  if (query.company) filter.company = objectId(query.company, 'company');
  if (query.coupon) filter.coupon = objectId(query.coupon, 'coupon');
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw ApiError.badRequest('Unknown status filter.');
    filter.status = query.status;
  }
  if (query.emailStatus) filter['delivery.email.status'] = deliveryFilter(query.emailStatus);
  if (query.whatsappStatus) filter['delivery.whatsapp.status'] = deliveryFilter(query.whatsappStatus);
  if (query.checkedIn === 'yes') filter.checkedInAt = { $ne: null };
  if (query.checkedIn === 'no') filter.checkedInAt = null;

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = dayStart(query.from, '"From" date');
    if (query.to) filter.createdAt.$lt = new Date(dayStart(query.to, '"To" date').getTime() + 24 * 60 * 60 * 1000);
  }

  if (query.q) {
    const q = String(query.q).trim().slice(0, 100);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { 'attendee.name': re },
        { 'attendee.email': re },
        { 'attendee.phone': re },
        { registrationCode: re },
        { couponCode: re },
      ];
    }
  }
  return filter;
}

const SORTABLE = {
  createdAt: 'createdAt',
  name: 'attendee.name',
  registrationCode: 'registrationCode',
  status: 'status',
  checkedInAt: 'checkedInAt',
  couponCode: 'couponCode',
};

/** "-createdAt" → { createdAt: -1 }. Unknown keys fall back to newest first. */
function buildSort(raw) {
  const str = String(raw || '-createdAt');
  const desc = str.startsWith('-');
  const field = SORTABLE[desc ? str.slice(1) : str];
  if (!field) return { createdAt: -1 };
  return { [field]: desc ? -1 : 1, _id: 1 };
}

module.exports = { buildRegistrationFilter, buildSort, objectId, dayStart, DELIVERY_STATUSES };
