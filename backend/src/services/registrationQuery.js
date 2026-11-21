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
  if (query.lunchCheckedIn === 'yes') filter['checkins.locationCode'] = 'LUNCH';
  if (query.lunchCheckedIn === 'no') filter['checkins.locationCode'] = { $ne: 'LUNCH' };
  if (query.locationCheckedIn) filter['checkins.locationCode'] = String(query.locationCheckedIn).trim().toUpperCase();

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = dayStart(query.from, '"From" date');
    if (query.to) filter.createdAt.$lt = new Date(dayStart(query.to, '"To" date').getTime() + 24 * 60 * 60 * 1000);
  }

  const andClauses = [];

  // Filter by Pass / Ticket Type (supports ObjectId, code, or name like "Delegate — Regular", "PG Student / Resident")
  if (query.ticketType || query.pass) {
    const raw = query.ticketType || query.pass;
    const values = Array.isArray(raw)
      ? raw
      : String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const objectIds = values.filter((v) => Types.ObjectId.isValid(v)).map((v) => new Types.ObjectId(v));
    const nonIds = values.filter((v) => !Types.ObjectId.isValid(v));

    const passClauses = [];
    if (objectIds.length === 1) {
      passClauses.push({ ticketType: objectIds[0] });
    } else if (objectIds.length > 1) {
      passClauses.push({ ticketType: { $in: objectIds } });
    }
    if (nonIds.length > 0) {
      for (const name of nonIds) {
        const re = new RegExp(escapeRegex(name), 'i');
        passClauses.push({ 'attendee.category': re });
        passClauses.push({ badgeRole: re });
      }
    }
    if (passClauses.length === 1) {
      andClauses.push(passClauses[0]);
    } else if (passClauses.length > 1) {
      andClauses.push({ $or: passClauses });
    }
  }

  // Filter by Checked-In Locations (Multi-select: attendee must have checked in at ALL selected locations)
  if (query.checkedInLocations || query.checkedInLocation) {
    const raw = query.checkedInLocations || query.checkedInLocation;
    const locs = Array.isArray(raw)
      ? raw
      : String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    for (const loc of locs) {
      const upper = loc.toUpperCase();
      if (upper === 'ENTRY' || upper === 'MAIN') {
        andClauses.push({
          $or: [
            { 'checkins.locationCode': 'ENTRY' },
            { 'checkins.locationCode': 'DAY_2_MAIN_ENTRY' },
            { checkedInAt: { $ne: null } },
          ],
        });
      } else if (Types.ObjectId.isValid(loc)) {
        andClauses.push({
          $or: [
            { 'checkins.location': new Types.ObjectId(loc) },
            { 'checkins.locationCode': upper },
          ],
        });
      } else {
        andClauses.push({ 'checkins.locationCode': upper });
      }
    }
  }

  // Filter by NOT Checked-In Locations (Multi-select: attendee must NOT have checked in at ANY selected locations)
  if (query.notCheckedInLocations || query.notCheckedInLocation) {
    const raw = query.notCheckedInLocations || query.notCheckedInLocation;
    const locs = Array.isArray(raw)
      ? raw
      : String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    for (const loc of locs) {
      const upper = loc.toUpperCase();
      if (upper === 'ENTRY' || upper === 'MAIN') {
        andClauses.push({
          'checkins.locationCode': { $nin: ['ENTRY', 'DAY_2_MAIN_ENTRY'] },
          checkedInAt: null,
        });
      } else if (Types.ObjectId.isValid(loc)) {
        const objId = new Types.ObjectId(loc);
        andClauses.push({
          'checkins.location': { $ne: objId },
          'checkins.locationCode': { $ne: upper },
        });
      } else {
        andClauses.push({ 'checkins.locationCode': { $ne: upper } });
      }
    }
  }

  // Filter by Check-in Date (custom date YYYY-MM-DD or range)
  if (query.checkinDate) {
    const start = dayStart(query.checkinDate, 'Check-in date');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    andClauses.push({
      $or: [
        { checkedInAt: { $gte: start, $lt: end } },
        { 'checkins.checkedInAt': { $gte: start, $lt: end } },
      ],
    });
  } else if (query.checkinFrom || query.checkinTo) {
    const checkinRange = {};
    if (query.checkinFrom) checkinRange.$gte = dayStart(query.checkinFrom, '"Check-in From" date');
    if (query.checkinTo) {
      checkinRange.$lt = new Date(dayStart(query.checkinTo, '"Check-in To" date').getTime() + 24 * 60 * 60 * 1000);
    }
    andClauses.push({
      $or: [
        { checkedInAt: checkinRange },
        { 'checkins.checkedInAt': checkinRange },
      ],
    });
  }

  if (query.tnmc === 'yes') {
    filter['attendee.medicalCouncilRegNo'] = {
      $exists: true,
      $nin: ['', null, 'NA', 'N/A', 'NIL', 'NONE', 'Not Applicable', 'NOT APPLICABLE', '-'],
      $regex: /\S/,
    };
  } else if (query.tnmc === 'no') {
    andClauses.push({
      $or: [
        { 'attendee.medicalCouncilRegNo': { $in: ['', null, 'NA', 'N/A', 'NIL', 'NONE', 'Not Applicable', 'NOT APPLICABLE', '-'] } },
        { 'attendee.medicalCouncilRegNo': { $exists: false } },
        { 'attendee.medicalCouncilRegNo': { $regex: /^\s*$/ } },
      ],
    });
  }

  if (query.q) {
    const q = String(query.q).trim().slice(0, 100);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      andClauses.push({
        $or: [
          { 'attendee.name': re },
          { 'attendee.email': re },
          { 'attendee.phone': re },
          { registrationCode: re },
          { couponCode: re },
        ],
      });
    }
  }

  if (andClauses.length === 1) {
    Object.assign(filter, andClauses[0]);
  } else if (andClauses.length > 1) {
    filter.$and = andClauses;
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
