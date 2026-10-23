'use strict';

const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { serializeRegistrationForAdmin } = require('../services/registrationSerializer');
const { buildRegistrationFilter, buildSort } = require('../services/registrationQuery');
const inventory = require('../services/inventory');
const { releaseCoupon } = require('../services/coupon');
const { deliverTicket, CHANNELS } = require('../services/delivery');
const { cleanAttendee } = require('./publicRegistrationController');
const { recordAudit } = require('../services/auditLog');
const { toCsv } = require('../utils/csv');

function withRefs(query) {
  return query
    .populate('event', 'title slug')
    .populate('ticketType', 'name code price')
    .populate('company', 'name')
    .populate('coupon', 'code')
    .populate('checkedInBy', 'name')
    .populate('cancelledBy', 'name');
}

async function findOr404(id) {
  const reg = await withRefs(Registration.findById(id));
  if (!reg) throw ApiError.notFound('Registration not found');
  return reg;
}

/** GET /api/v1/admin/registrations?event=&company=&coupon=&status=&emailStatus=&whatsappStatus=&checkedIn=&from=&to=&q=&sort=&page=&limit= */
const listRegistrations = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
  const filter = buildRegistrationFilter(req.query);

  const [registrations, total] = await Promise.all([
    withRefs(Registration.find(filter).select('-deliveryLog'))
      .sort(buildSort(req.query.sort))
      .skip((page - 1) * limit)
      .limit(limit),
    Registration.countDocuments(filter),
  ]);

  return sendSuccess(res, registrations.map(serializeRegistrationForAdmin), {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

/** GET /api/v1/admin/registrations/:id — includes the full delivery attempt log. */
const getRegistration = asyncHandler(async (req, res) => {
  const reg = await findOr404(req.params.id);
  return sendSuccess(res, serializeRegistrationForAdmin(reg));
});

/** PATCH /api/v1/admin/registrations/:id — staff notes and attendee corrections. */
const updateRegistration = asyncHandler(async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) throw ApiError.notFound('Registration not found');
  const body = req.body || {};

  if ('notes' in body) reg.notes = String(body.notes || '').slice(0, 2000);
  if (body.attendee) {
    const next = cleanAttendee({ ...reg.attendee.toObject(), ...body.attendee });
    reg.attendee.name = next.name;
    if (next.phone !== reg.attendee.phone) {
      reg.attendee.phone = next.phone;
      if (reg.activePhoneKey !== undefined) reg.activePhoneKey = Registration.activePhoneKeyFor(reg.event, next.phone);
    }
    if (next.medicalCouncilRegNo !== reg.attendee.medicalCouncilRegNo) {
      reg.attendee.medicalCouncilRegNo = next.medicalCouncilRegNo;
      if (reg.activeCouncilKey !== undefined) reg.activeCouncilKey = Registration.activeCouncilKeyFor(reg.event, next.medicalCouncilRegNo);
    }
    if (next.email !== reg.attendee.email) {
      reg.attendee.email = next.email;
      if (reg.activeKey !== undefined) reg.activeKey = Registration.activeKeyFor(reg.event, next.email);
    }
  }

  try {
    await reg.save();
  } catch (err) {
    if (err && err.code === 11000) {
      const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
      if (field === 'activePhoneKey') throw ApiError.conflict('Another active registration already uses this mobile number.');
      if (field === 'activeCouncilKey') throw ApiError.conflict('Another active registration already uses this Medical Council Registration Number.');
      throw ApiError.conflict('Another active registration already uses this email address.');
    }
    throw err;
  }
  recordAudit(req, { action: 'registration.update', entityType: 'Registration', entityId: reg._id, meta: { fields: Object.keys(body) } });
  return sendSuccess(res, serializeRegistrationForAdmin(await findOr404(reg._id)));
});

/**
 * POST /api/v1/admin/registrations/:id/cancel  { reason }
 *
 * Coupon policy: cancelling gives the slot back to the coupon (usageCount
 * −1), along with the pass unit and event seat, so the sponsoring company
 * can re-issue it. The registration itself is kept, marked cancelled with
 * who/when/why, and its QR stops working at check-in.
 *
 * The status flip is a single guarded update, so two admins cancelling at
 * once can't release capacity twice.
 */
const cancelRegistration = asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 3) throw ApiError.badRequest('Please give a reason for cancelling.');

  const current = await Registration.findById(req.params.id).select('status checkedInAt');
  if (!current) throw ApiError.notFound('Registration not found');
  if (current.status === 'cancelled' || current.status === 'refunded') throw ApiError.conflict('This registration is already cancelled.');
  if (current.checkedInAt) throw ApiError.conflict('This attendee has already checked in, so the registration can’t be cancelled.');

  const before = await Registration.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ['confirmed', 'pending_payment'] }, checkedInAt: null },
    {
      $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: req.user._id, cancellationReason: reason.slice(0, 500) },
      $unset: { activeKey: 1, activePhoneKey: 1, activeCouncilKey: 1 },
    },
    { new: false }
  );
  if (!before) throw ApiError.conflict('This registration was changed by someone else. Refresh and try again.');

  if (before.status === 'confirmed') {
    await Promise.all([
      inventory.releaseTicketSale(before.ticketType),
      inventory.releaseEventSeat(before.event),
      releaseCoupon(before.coupon),
    ]);
  } else {
    await inventory.releaseTicketHold(before.ticketType); // legacy pending_payment
  }

  recordAudit(req, {
    action: 'registration.cancel',
    entityType: 'Registration',
    entityId: before._id,
    meta: { registrationCode: before.registrationCode, reason, couponCode: before.couponCode, couponReleased: Boolean(before.coupon) },
  });
  return sendSuccess(res, serializeRegistrationForAdmin(await findOr404(before._id)), { message: 'Registration cancelled' });
});

const DELIVERY_MESSAGES = {
  sent: (channel) => `${channel === 'email' ? 'Email' : 'WhatsApp message'} accepted by the provider.`,
  not_configured: (channel) =>
    channel === 'email'
      ? 'Email is not configured. Add SMTP settings to the server to enable sending.'
      : 'WhatsApp is not configured. Add the WhatsApp API credentials to the server to enable sending.',
  failed: () => 'Sending failed. See the delivery log for the provider’s error.',
  retryable: () => 'Sending failed with a temporary error. Try again shortly.',
};

/** POST /api/v1/admin/registrations/:id/deliveries/:channel — resend email / retry WhatsApp. */
const retryDelivery = asyncHandler(async (req, res) => {
  const { channel } = req.params;
  if (!CHANNELS.includes(channel)) throw ApiError.badRequest('Channel must be "email" or "whatsapp".');

  const reg = await Registration.findById(req.params.id).select('status qrToken registrationCode');
  if (!reg) throw ApiError.notFound('Registration not found');
  if (reg.status !== 'confirmed' || !reg.qrToken) throw ApiError.conflict('Tickets can only be sent for confirmed registrations.');

  const outcomes = await deliverTicket(reg._id, { channels: [channel], trigger: 'admin', actorName: req.user.name });
  const outcome = outcomes[channel] || { status: 'failed', error: 'Delivery could not be attempted.' };

  recordAudit(req, {
    action: `registration.delivery.${channel}`,
    entityType: 'Registration',
    entityId: reg._id,
    meta: { registrationCode: reg.registrationCode, status: outcome.status },
  });

  const updated = serializeRegistrationForAdmin(await findOr404(reg._id));
  const message = (DELIVERY_MESSAGES[outcome.status] || DELIVERY_MESSAGES.failed)(channel);
  return sendSuccess(res, { outcome: { channel, status: outcome.status, error: outcome.error }, registration: updated }, { message });
});

const CSV_COLUMNS = [
  { key: 'registrationCode', label: 'Registration ID' },
  { key: 'attendee.name', label: 'Name' },
  { key: 'attendee.gender', label: 'Gender' },
  { key: 'attendee.phone', label: 'Mobile' },
  { key: 'attendee.email', label: 'Email' },
  { key: 'attendee.institution', label: 'Institution/Hospital' },
  { key: 'attendee.designation', label: 'Designation' },
  { key: 'attendee.city', label: 'City' },
  { key: 'attendee.state', label: 'State' },
  { key: 'attendee.country', label: 'Country' },
  { key: 'attendee.pincode', label: 'PIN Code' },
  { key: 'attendee.registrationCategory', label: 'Registration Category' },
  { key: 'attendee.workshop', label: 'Workshop' },
  { key: 'companyName', label: 'Company' },
  { key: 'couponCode', label: 'Coupon' },
  { key: 'passName', label: 'Pass' },
  { key: 'status', label: 'Status' },
  { key: 'registeredAt', label: 'Registered At' },
  { key: 'qrStatus', label: 'QR Status' },
  { key: 'emailStatus', label: 'Email Status' },
  { key: 'whatsappStatus', label: 'WhatsApp Status' },
  { key: 'checkedInAtStr', label: 'Checked In At' },
  { key: 'cancelledAtStr', label: 'Cancelled At' },
  { key: 'cancellationReason', label: 'Cancellation Reason' },
  { key: 'pricing.totalAmount', label: 'Amount Paid' },
];

function qrStatusOf(reg) {
  if (!reg.qrToken) return 'not issued';
  return reg.status === 'confirmed' ? 'active' : 'void';
}

/** GET /api/v1/admin/registrations/export.csv — same filters as the list. */
const exportRegistrationsCsv = asyncHandler(async (req, res) => {
  const filter = buildRegistrationFilter(req.query);
  const registrations = await Registration.find(filter)
    .select('-deliveryLog')
    .populate('ticketType', 'name')
    .populate('company', 'name')
    .sort(buildSort(req.query.sort))
    .limit(50000)
    .lean();

  const rows = registrations.map((r) => ({
    ...r,
    companyName: r.company?.name || '',
    passName: r.ticketType?.name || '',
    registeredAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
    qrStatus: qrStatusOf(r),
    emailStatus: r.delivery?.email?.status || 'pending',
    whatsappStatus: r.delivery?.whatsapp?.status || 'pending',
    checkedInAtStr: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : '',
    cancelledAtStr: r.cancelledAt ? new Date(r.cancelledAt).toISOString() : '',
  }));

  recordAudit(req, { action: 'registration.export', entityType: 'Registration', meta: { count: rows.length, filters: req.query } });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="registrations.csv"');
  res.send(toCsv(rows, CSV_COLUMNS));
});

module.exports = {
  listRegistrations,
  getRegistration,
  updateRegistration,
  cancelRegistration,
  retryDelivery,
  exportRegistrationsCsv,
  qrStatusOf,
  CSV_COLUMNS,
};
