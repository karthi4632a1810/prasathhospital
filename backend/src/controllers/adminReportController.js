'use strict';

const Registration = require('../models/Registration');
const Coupon = require('../models/Coupon');
const Company = require('../models/Company');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { toCsv } = require('../utils/csv');
const { buildRegistrationFilter, objectId } = require('../services/registrationQuery');
const { couponState } = require('./adminCouponController');
const { recordAudit } = require('../services/auditLog');

/**
 * Everything here is computed from the database at request time — no
 * cached or hand-maintained counters except Coupon.usageCount, which is
 * the authoritative capacity counter.
 *
 * Coupon allocation/usage/remaining are whole-coupon figures; registration
 * counts honour the optional from/to date filter.
 */

const IS_CONFIRMED = { $eq: ['$status', 'confirmed'] };
const IS_CANCELLED = { $in: ['$status', ['cancelled', 'refunded']] };
const EMAIL_STATUS = { $ifNull: ['$delivery.email.status', 'pending'] };
const WHATSAPP_STATUS = { $ifNull: ['$delivery.whatsapp.status', 'pending'] };

function countIf(condition) {
  return { $sum: { $cond: [condition, 1, 0] } };
}

function confirmedWith(condition) {
  return countIf({ $and: [IS_CONFIRMED, condition] });
}

/** Per-group registration counters, shared by the company and coupon breakdowns. */
const GROUP_COUNTERS = {
  total: { $sum: 1 },
  confirmed: countIf(IS_CONFIRMED),
  cancelled: countIf(IS_CANCELLED),
  checkedIn: confirmedWith({ $gt: ['$checkedInAt', null] }),
  emailSent: confirmedWith({ $eq: [EMAIL_STATUS, 'sent'] }),
  emailFailed: confirmedWith({ $in: [EMAIL_STATUS, ['failed', 'retryable']] }),
  whatsappSent: confirmedWith({ $eq: [WHATSAPP_STATUS, 'sent'] }),
  whatsappFailed: confirmedWith({ $in: [WHATSAPP_STATUS, ['failed', 'retryable']] }),
  firstRegistrationAt: { $min: '$createdAt' },
  lastRegistrationAt: { $max: '$createdAt' },
};

const EMPTY_COUNTS = {
  total: 0,
  confirmed: 0,
  cancelled: 0,
  checkedIn: 0,
  emailSent: 0,
  emailFailed: 0,
  whatsappSent: 0,
  whatsappFailed: 0,
  firstRegistrationAt: null,
  lastRegistrationAt: null,
};

function requireEvent(query) {
  if (!query.event) throw ApiError.badRequest('An "event" id is required.');
  return objectId(query.event, 'event');
}

function deliveryCounts(rows) {
  const counts = { pending: 0, sent: 0, failed: 0, retryable: 0, not_configured: 0 };
  for (const row of rows) counts[row._id || 'pending'] = (counts[row._id || 'pending'] || 0) + row.count;
  return counts;
}

/**
 * Builds the company and coupon breakdowns for one event. Coupons with no
 * registrations yet still appear (with zero counts) so allocation is visible
 * from day one.
 */
async function buildBreakdown(eventId, query) {
  const match = buildRegistrationFilter({ event: eventId, from: query.from, to: query.to });

  const [coupons, couponRows, companyRows, daily] = await Promise.all([
    Coupon.find({ event: eventId }).populate('company', 'name isActive').sort({ code: 1 }),
    Registration.aggregate([{ $match: match }, { $group: { _id: '$coupon', ...GROUP_COUNTERS } }]),
    Registration.aggregate([{ $match: match }, { $group: { _id: '$company', ...GROUP_COUNTERS } }]),
    Registration.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          registrations: { $sum: 1 },
          confirmed: countIf(IS_CONFIRMED),
          cancelled: countIf(IS_CANCELLED),
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const couponStats = new Map(couponRows.map((r) => [String(r._id), r]));
  const couponList = coupons.map((c) => {
    const stats = couponStats.get(String(c._id)) || {};
    const state = couponState(c);
    const isUsable = state === 'active' || state === 'scheduled';
    const allocated = isUsable ? c.maxAllowedRegistrations : c.usageCount;
    const remaining = isUsable ? Math.max(c.maxAllowedRegistrations - c.usageCount, 0) : 0;
    return {
      id: c._id,
      code: c.code,
      companyId: c.company?._id || null,
      companyName: c.company?.name || '—',
      state,
      isActive: c.isActive,
      maxAllowedRegistrations: c.maxAllowedRegistrations,
      allocated,
      used: c.usageCount,
      remaining,
      ...EMPTY_COUNTS,
      ...stats,
      _id: undefined,
    };
  });

  // Companies: anyone with a coupon for this event or a registration in it.
  const companyIds = new Set([
    ...coupons.map((c) => String(c.company?._id || c.company)),
    ...companyRows.filter((r) => r._id).map((r) => String(r._id)),
  ]);
  const companies = await Company.find({ _id: { $in: [...companyIds] } }).sort({ name: 1 });
  const companyStats = new Map(companyRows.map((r) => [String(r._id), r]));

  const companyList = companies.map((company) => {
    const own = couponList.filter((c) => String(c.companyId) === String(company._id));
    const activeOwn = own.filter((c) => c.state === 'active' || c.state === 'scheduled');
    const allocated = activeOwn.reduce((sum, c) => sum + c.allocated, 0);
    const used = own.reduce((sum, c) => sum + c.used, 0);
    const remaining = activeOwn.reduce((sum, c) => sum + c.remaining, 0);
    return {
      id: company._id,
      name: company.name,
      isActive: company.isActive,
      couponCount: own.length,
      activeCouponCount: activeOwn.length,
      allocated,
      used,
      remaining,
      ...EMPTY_COUNTS,
      ...(companyStats.get(String(company._id)) || {}),
      _id: undefined,
    };
  });

  // Registrations made under the old paid flow have no company.
  const legacy = companyStats.get('null');
  if (legacy) {
    companyList.push({ id: null, name: 'No company (legacy)', isActive: false, couponCount: 0, allocated: 0, used: 0, remaining: 0, ...legacy, _id: undefined });
  }

  return {
    companies: companyList,
    coupons: couponList,
    daily: daily.map((d) => ({ date: d._id, registrations: d.registrations, confirmed: d.confirmed, cancelled: d.cancelled })),
  };
}

/**
 * GET /api/v1/admin/reports/overview?event=<eventId>
 * Dashboard stats — readable by every admin role, including check-in staff.
 * Aggregates only; no attendee details.
 */
const getOverview = asyncHandler(async (req, res) => {
  const eventId = requireEvent(req.query);
  const match = { event: eventId };

  const [byStatus, checkedIn, emailRows, whatsappRows, breakdown] = await Promise.all([
    Registration.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Registration.countDocuments({ ...match, status: 'confirmed', checkedInAt: { $ne: null } }),
    Registration.aggregate([{ $match: { ...match, status: 'confirmed' } }, { $group: { _id: EMAIL_STATUS, count: { $sum: 1 } } }]),
    Registration.aggregate([{ $match: { ...match, status: 'confirmed' } }, { $group: { _id: WHATSAPP_STATUS, count: { $sum: 1 } } }]),
    buildBreakdown(eventId, {}),
  ]);

  const statusCounts = { pending_payment: 0, confirmed: 0, cancelled: 0, refunded: 0 };
  for (const row of byStatus) statusCounts[row._id] = row.count;
  const confirmed = statusCounts.confirmed;

  const activeCoupons = breakdown.coupons.filter((c) => c.state === 'active' || c.state === 'scheduled');
  const allocated = activeCoupons.reduce((sum, c) => sum + c.allocated, 0);
  const remaining = activeCoupons.reduce((sum, c) => sum + c.remaining, 0);
  const used = breakdown.coupons.reduce((sum, c) => sum + c.used, 0);

  return sendSuccess(res, {
    registrations: {
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      confirmed,
      cancelled: statusCounts.cancelled + statusCounts.refunded,
      legacyPending: statusCounts.pending_payment,
    },
    checkIn: {
      checkedIn,
      remaining: confirmed - checkedIn,
      total: confirmed,
      rate: confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0,
    },
    delivery: { email: deliveryCounts(emailRows), whatsapp: deliveryCounts(whatsappRows) },
    coupons: {
      count: activeCoupons.length,
      totalCount: breakdown.coupons.length,
      inactiveCount: breakdown.coupons.length - activeCoupons.length,
      allocated,
      used,
      remaining,
    },
    byCompany: breakdown.companies.map((c) => ({ id: c.id, name: c.name, confirmed: c.confirmed, checkedIn: c.checkedIn, allocated: c.allocated, used: c.used })),
    byCoupon: breakdown.coupons.map((c) => ({
      id: c.id,
      code: c.code,
      companyName: c.companyName,
      state: c.state,
      allocated: c.allocated,
      used: c.used,
      remaining: c.remaining,
      confirmed: c.confirmed,
    })),
    daily: breakdown.daily,
  });
});

/** GET /api/v1/admin/reports/breakdown?event=&from=&to= — company-wise and coupon-wise report. */
const getBreakdown = asyncHandler(async (req, res) => {
  const eventId = requireEvent(req.query);
  return sendSuccess(res, await buildBreakdown(eventId, req.query));
});

function isoOrBlank(date) {
  return date ? new Date(date).toISOString() : '';
}

const COMPANY_COLUMNS = [
  { key: 'name', label: 'Company' },
  { key: 'couponCount', label: 'Coupons' },
  { key: 'allocated', label: 'Allocated' },
  { key: 'used', label: 'Used' },
  { key: 'remaining', label: 'Remaining' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'checkedIn', label: 'Checked In' },
  { key: 'emailSent', label: 'Email Sent' },
  { key: 'emailFailed', label: 'Email Failed' },
  { key: 'whatsappSent', label: 'WhatsApp Sent' },
  { key: 'whatsappFailed', label: 'WhatsApp Failed' },
  { key: 'first', label: 'First Registration' },
  { key: 'last', label: 'Last Registration' },
];

const COUPON_COLUMNS = [
  { key: 'code', label: 'Coupon' },
  { key: 'companyName', label: 'Company' },
  { key: 'state', label: 'State' },
  ...COMPANY_COLUMNS.slice(2),
];

function sendCsv(res, filename, rows, columns) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows, columns));
}

/** GET /api/v1/admin/reports/export/companies.csv?event=&from=&to= */
const exportCompaniesCsv = asyncHandler(async (req, res) => {
  const { companies } = await buildBreakdown(requireEvent(req.query), req.query);
  const rows = companies.map((c) => ({ ...c, first: isoOrBlank(c.firstRegistrationAt), last: isoOrBlank(c.lastRegistrationAt) }));
  recordAudit(req, { action: 'report.export', entityType: 'Report', meta: { report: 'companies', filters: req.query } });
  sendCsv(res, 'companies.csv', rows, COMPANY_COLUMNS);
});

/** GET /api/v1/admin/reports/export/coupons.csv?event=&from=&to= */
const exportCouponsCsv = asyncHandler(async (req, res) => {
  const { coupons } = await buildBreakdown(requireEvent(req.query), req.query);
  const rows = coupons.map((c) => ({ ...c, first: isoOrBlank(c.firstRegistrationAt), last: isoOrBlank(c.lastRegistrationAt) }));
  recordAudit(req, { action: 'report.export', entityType: 'Report', meta: { report: 'coupons', filters: req.query } });
  sendCsv(res, 'coupons.csv', rows, COUPON_COLUMNS);
});

module.exports = { getOverview, getBreakdown, exportCompaniesCsv, exportCouponsCsv, buildBreakdown };
