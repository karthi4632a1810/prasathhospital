'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const CheckinLocation = require('../models/CheckinLocation');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { serializeRegistrationForAdmin } = require('../services/registrationSerializer');
const { resolveRegistrationBadgeNo, syncEventBadgeNumbers } = require('../services/badgeService');
const { buildRegistrationFilter, buildSort } = require('../services/registrationQuery');
const inventory = require('../services/inventory');
const { releaseCoupon } = require('../services/coupon');
const { deliverTicket, CHANNELS } = require('../services/delivery');
const { cleanAttendee } = require('./publicRegistrationController');
const { recordAudit } = require('../services/auditLog');
const { toCsv } = require('../utils/csv');
const { generateIdCardPdfBuffer, generateIdCardImageBuffer } = require('../utils/idCardPdf');
const { generateCertificateBuffer } = require('../utils/certificateGenerator');

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
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { registrationCode: id };
  const reg = await withRefs(Registration.findOne(query));
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

  // Synchronize badge numbers based on registration order in background
  syncEventBadgeNumbers(filter.event).catch(() => { });

  // For any items missing badgeNo in this batch, resolve based on registration order
  for (const r of registrations) {
    if (!r.badgeNo && r.createdAt) {
      r.badgeNo = await resolveRegistrationBadgeNo(r);
    }
  }

  return sendSuccess(res, registrations.map(serializeRegistrationForAdmin), {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

/** GET /api/v1/admin/registrations/:id — includes the full delivery attempt log. */
const getRegistration = asyncHandler(async (req, res) => {
  const reg = await findOr404(req.params.id);
  if (!reg.badgeNo) {
    reg.badgeNo = await resolveRegistrationBadgeNo(reg);
  }
  return sendSuccess(res, serializeRegistrationForAdmin(reg));
});

/** PATCH /api/v1/admin/registrations/:id — staff notes, attendee details, and badge/ID card number. */
const updateRegistration = asyncHandler(async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) throw ApiError.notFound('Registration not found');
  const body = req.body || {};

  if ('notes' in body) reg.notes = String(body.notes || '').slice(0, 2000);

  // Badge / ID Card Number - once set, it is fixed to this attendee
  if ('badgeNo' in body) {
    const rawBadge = String(body.badgeNo ?? '').trim();
    if (rawBadge && /^\d+$/.test(rawBadge)) {
      reg.badgeNo = rawBadge.padStart(4, '0');
    } else {
      reg.badgeNo = rawBadge;
    }
  }

  // Role / Badge Role
  if ('badgeRole' in body || 'role' in body) {
    const newRole = String(body.badgeRole || body.role || '').trim().toUpperCase();
    if (newRole) {
      reg.badgeRole = newRole;
      reg.role = newRole;
      if (reg.attendee) reg.attendee.category = newRole;
    }
  }

  if (body.attendee) {
    const att = body.attendee;
    if (att.name !== undefined && String(att.name).trim()) {
      reg.attendee.name = String(att.name).replace(/\s+/g, ' ').trim();
    }
    if (att.title !== undefined) reg.attendee.title = String(att.title || '').trim();
    if (att.firstName !== undefined) reg.attendee.firstName = String(att.firstName || '').trim();
    if (att.lastName !== undefined) reg.attendee.lastName = String(att.lastName || '').trim();
    if (att.gender !== undefined) reg.attendee.gender = String(att.gender || '').trim();
    if (att.designation !== undefined) reg.attendee.designation = String(att.designation || '').trim();
    if (att.institution !== undefined) reg.attendee.institution = String(att.institution || '').trim();
    if (att.city !== undefined) reg.attendee.city = String(att.city || '').trim();
    if (att.state !== undefined) reg.attendee.state = String(att.state || '').trim();
    if (att.country !== undefined) reg.attendee.country = String(att.country || 'India').trim();
    if (att.pincode !== undefined) reg.attendee.pincode = String(att.pincode || '').trim();
    if (att.category !== undefined && String(att.category).trim()) {
      const cat = String(att.category).trim().toUpperCase();
      reg.attendee.category = cat;
      reg.badgeRole = cat;
      reg.role = cat;
    }

    if (att.phone !== undefined) {
      const cleanPhone = String(att.phone || '').replace(/[\s()-]/g, '');
      if (cleanPhone && cleanPhone !== reg.attendee.phone) {
        reg.attendee.phone = cleanPhone;
        if (reg.activePhoneKey !== undefined) reg.activePhoneKey = Registration.activePhoneKeyFor(reg.event, cleanPhone);
      }
    }
    if (att.medicalCouncilRegNo !== undefined) {
      const cleanTnmc = String(att.medicalCouncilRegNo || '').trim();
      reg.attendee.medicalCouncilRegNo = cleanTnmc;
      if (reg.activeCouncilKey !== undefined) {
        reg.activeCouncilKey = cleanTnmc && !['NA', 'N/A', 'NIL', 'NONE', '-'].includes(cleanTnmc.toUpperCase())
          ? Registration.activeCouncilKeyFor(reg.event, cleanTnmc)
          : null;
      }
    }
    if (att.email !== undefined) {
      const cleanEmail = String(att.email || '').trim().toLowerCase();
      if (cleanEmail && cleanEmail !== reg.attendee.email) {
        reg.attendee.email = cleanEmail;
        if (reg.activeKey !== undefined) reg.activeKey = Registration.activeKeyFor(reg.event, cleanEmail);
      }
    }
  }

  // Direct top-level attendee shortcuts
  if (body.name && (!body.attendee || !body.attendee.name)) {
    reg.attendee.name = String(body.name).replace(/\s+/g, ' ').trim();
  }
  if (body.phone && (!body.attendee || !body.attendee.phone)) {
    const cleanPhone = String(body.phone).replace(/[\s()-]/g, '');
    if (cleanPhone && cleanPhone !== reg.attendee.phone) {
      reg.attendee.phone = cleanPhone;
      if (reg.activePhoneKey !== undefined) reg.activePhoneKey = Registration.activePhoneKeyFor(reg.event, cleanPhone);
    }
  }
  if (body.email && (!body.attendee || !body.attendee.email)) {
    const cleanEmail = String(body.email).trim().toLowerCase();
    if (cleanEmail && cleanEmail !== reg.attendee.email) {
      reg.attendee.email = cleanEmail;
      if (reg.activeKey !== undefined) reg.activeKey = Registration.activeKeyFor(reg.event, cleanEmail);
    }
  }
  if (body.medicalCouncilRegNo !== undefined && (!body.attendee || body.attendee.medicalCouncilRegNo === undefined)) {
    const cleanTnmc = String(body.medicalCouncilRegNo).trim();
    reg.attendee.medicalCouncilRegNo = cleanTnmc;
    if (reg.activeCouncilKey !== undefined) {
      reg.activeCouncilKey = cleanTnmc && !['NA', 'N/A', 'NIL', 'NONE', '-'].includes(cleanTnmc.toUpperCase())
        ? Registration.activeCouncilKeyFor(reg.event, cleanTnmc)
        : null;
    }
  }
  if (body.institution && (!body.attendee || !body.attendee.institution)) {
    reg.attendee.institution = String(body.institution).trim();
  }
  if (body.city && (!body.attendee || !body.attendee.city)) {
    reg.attendee.city = String(body.city).trim();
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
  return sendSuccess(res, serializeRegistrationForAdmin(await findOr404(reg._id)), { message: 'Registration updated successfully.' });
});

/**
 * DELETE /api/v1/admin/registrations/:id
 * Permanently deletes the registration and releases ticket and coupon holds.
 */
const deleteRegistration = asyncHandler(async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) throw ApiError.notFound('Registration not found');

  const regCode = reg.registrationCode || String(req.params.id);
  const attendeeName = reg.attendee?.name || 'Attendee';

  if (reg.status === 'confirmed') {
    await Promise.allSettled([
      inventory.releaseTicketSale(reg.ticketType),
      inventory.releaseEventSeat(reg.event),
      releaseCoupon(reg.coupon),
    ]);
  } else if (reg.status === 'pending_payment') {
    await inventory.releaseTicketHold(reg.ticketType).catch(() => {});
  }

  await Registration.findByIdAndDelete(reg._id);

  recordAudit(req, {
    action: 'registration.delete',
    entityType: 'Registration',
    entityId: reg._id,
    meta: {
      registrationCode: regCode,
      name: attendeeName,
      badgeNo: reg.badgeNo || '',
      email: reg.attendee?.email || '',
      phone: reg.attendee?.phone || '',
    },
  });

  return sendSuccess(
    res,
    { deleted: true, id: reg._id, registrationCode: regCode },
    { message: `Registration ${regCode} (${attendeeName}) has been deleted.` }
  );
});

/**
 * POST /api/v1/admin/registrations/:id/checkin-location
 * Body: { locationId, locationCode, checked: true | false }
 * Toggles a checkpoint location check-in for this registration.
 */
const toggleCheckinLocation = asyncHandler(async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) throw ApiError.notFound('Registration not found');

  const { locationId, locationCode, checked } = req.body || {};
  if (!locationId && !locationCode) {
    throw ApiError.badRequest('A locationId or locationCode is required.');
  }

  let loc = null;
  if (locationId) {
    loc = await CheckinLocation.findById(locationId);
  } else if (locationCode) {
    loc = await CheckinLocation.findOne({
      event: reg.event,
      code: String(locationCode).trim().toUpperCase(),
    });
  }

  if (!loc) {
    throw ApiError.notFound('Checkpoint location not found.');
  }

  reg.checkins = reg.checkins || [];
  const targetCode = loc.code;
  const now = new Date();

  if (checked) {
    // Add check-in for this location if not already present
    const existing = reg.checkins.find((c) => c.locationCode === targetCode);
    if (!existing) {
      const newCheckinItem = {
        location: loc._id,
        locationCode: loc.code,
        locationName: loc.name,
        checkedInAt: now,
        checkedInBy: req.user?._id || null,
      };
      await Registration.updateOne(
        { _id: reg._id },
        {
          $push: { checkins: newCheckinItem },
          $set: {
            checkedIn: true,
            ...(reg.checkedInAt ? {} : { checkedInAt: now, checkedInBy: req.user?._id || null }),
          },
        }
      );
    }
  } else {
    // Remove check-in from this location
    const remaining = reg.checkins.filter(
      (c) => c.locationCode !== targetCode && String(c.location) !== String(loc._id)
    );

    const updateOps = {
      $pull: {
        checkins: {
          $or: [{ locationCode: targetCode }, { location: loc._id }],
        },
      },
    };

    if (remaining.length === 0) {
      updateOps.$set = {
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
      };
    } else {
      updateOps.$set = {
        checkedIn: true,
        checkedInAt: remaining[0].checkedInAt || now,
      };
    }

    await Registration.updateOne({ _id: reg._id }, updateOps);
  }

  recordAudit(req, {
    action: checked ? 'registration.checkin_manual_add' : 'registration.checkin_manual_remove',
    entityType: 'Registration',
    entityId: reg._id,
    meta: {
      registrationCode: reg.registrationCode,
      location: loc.name,
      locationCode: loc.code,
      checked: Boolean(checked),
      performedBy: req.user?.name || req.user?.email || 'Admin',
    },
  });

  const updated = serializeRegistrationForAdmin(await findOr404(reg._id));
  return sendSuccess(
    res,
    updated,
    { message: checked ? `Marked checked in at ${loc.name}.` : `Removed check-in from ${loc.name}.` }
  );
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
  { key: 'checkedInAtStr', label: 'Entry Checked In At' },
  { key: 'lunchCheckedInAtStr', label: 'Lunch Checked In At' },
  { key: 'checkinLocationsStr', label: 'All Check-in Checkpoints' },
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

  const rows = registrations.map((r) => {
    const lunchCheckin = (r.checkins || []).find((c) => c.locationCode === 'LUNCH');
    const allLocationsStr = (r.checkins || [])
      .map((c) => `${c.locationName} (${new Date(c.checkedInAt).toLocaleTimeString('en-IN')})`)
      .join('; ');

    return {
      ...r,
      companyName: r.company?.name || '',
      passName: r.ticketType?.name || '',
      registeredAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
      qrStatus: qrStatusOf(r),
      emailStatus: r.delivery?.email?.status || 'pending',
      whatsappStatus: r.delivery?.whatsapp?.status || 'pending',
      checkedInAtStr: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : '',
      lunchCheckedInAtStr: lunchCheckin ? new Date(lunchCheckin.checkedInAt).toISOString() : '',
      checkinLocationsStr: allLocationsStr || (r.checkedInAt ? 'Main Entry Desk' : ''),
      cancelledAtStr: r.cancelledAt ? new Date(r.cancelledAt).toISOString() : '',
    };
  });

  recordAudit(req, { action: 'registration.export', entityType: 'Registration', meta: { count: rows.length, filters: req.query } });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="registrations.csv"');
  res.send(toCsv(rows, CSV_COLUMNS));
});

function cleanNameForTnmc(name) {
  if (!name) return '';
  return String(name)
    .replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCouncilAndNumber(rawCouncilNo, state) {
  const raw = String(rawCouncilNo || '').trim();
  if (!raw || ['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', '-'].includes(raw.toUpperCase())) {
    return {
      isTnmc: true,
      councilName: 'Tamil Nadu Medical Council',
      regNumber: '',
    };
  }

  if (/^APMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Andhra Pradesh Medical Council',
      regNumber: raw.replace(/^APMC[\s\/\-FMR]*/i, '').trim(),
    };
  }
  if (/^TSMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Telangana State Medical Council',
      regNumber: raw.replace(/^TSMC[\s\/\-FMR]*/i, '').trim(),
    };
  }
  if (/^KMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Karnataka Medical Council',
      regNumber: raw.replace(/^KMC[\s\/\-]*/i, '').trim(),
    };
  }
  if (/^JKMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Jammu and Kashmir Medical Council',
      regNumber: raw.replace(/^JKMC[\s\/\-]*/i, '').trim(),
    };
  }
  if (/^MMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Maharashtra Medical Council',
      regNumber: raw.replace(/^MMC[\s\/\-]*/i, '').trim(),
    };
  }
  if (/^DMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Delhi Medical Council',
      regNumber: raw.replace(/^DMC[\s\/\-]*/i, '').trim(),
    };
  }
  if (/^SLMC/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: 'Sri Lanka Medical Council',
      regNumber: raw.replace(/^SLMC[\s\/\-]*/i, '').trim(),
    };
  }

  if (state && !/tamil\s*nadu/i.test(state) && !/tnmc|tn/i.test(raw)) {
    return {
      isTnmc: false,
      councilName: `${state} Medical Council`,
      regNumber: raw,
    };
  }

  const cleanTnmcNo = raw.replace(/^(TNMC Reg No|TNMC|Tnmc|TN)[\s\/\-]*/i, '').trim();
  return {
    isTnmc: true,
    councilName: 'Tamil Nadu Medical Council',
    regNumber: cleanTnmcNo || raw,
  };
}

function getAttendanceTemplateWorkbook() {
  const possiblePaths = [
    path.resolve(__dirname, '../assets/tnmc_attendance_template.xlsx'),
    path.resolve(process.cwd(), 'Bulk Upload Attendance Template(1).xlsx'),
    path.resolve(process.cwd(), 'backend/src/assets/tnmc_attendance_template.xlsx'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return XLSX.readFile(p);
    }
  }
  const wb = XLSX.utils.book_new();
  wb.SheetNames = [
    'Sessions Details (Read only)',
    'TNMC Speakers',
    'Other than TNMC speakers',
    'TNMC Participants',
    'Other than TNMC participants',
  ];
  wb.Sheets['Sessions Details (Read only)'] = XLSX.utils.aoa_to_sheet([
    ['Session Number', 'Session Name', 'Topic Details', 'Date (DD/MM/YYYY)', 'Start to End Time'],
  ]);
  wb.Sheets['TNMC Speakers'] = XLSX.utils.aoa_to_sheet([
    ['Serial Number', 'Name of the council (in which they have registered)', 'TNMC Register Number', 'Full Name\nPlease do not include inital or symbols or dots as part of the name', 'Email Id', 'Mobile Number (Optional)', 'Session Name'],
  ]);
  wb.Sheets['Other than TNMC speakers'] = XLSX.utils.aoa_to_sheet([
    ['Serial Number', 'Name of the council (in which they have registered)', 'State Medical Council', 'State Medical Register Number (Optional)', 'Full Name\n(Please do not include inital or symbols or dots as part of the name)', 'Email Id', 'Mobile Number (Optional)', 'Session Name'],
  ]);
  return wb;
}

const TNMC_PARTICIPANT_HEADERS = [
  'Serial Number',
  'Name of the council',
  'TNMC Register Number',
  'Full Name\n(Please do not include inital or symbols or dots as part of the name)',
  'Email Id\n',
  'Mobile Number (Optional)',
];

const OTHER_PARTICIPANT_HEADERS = [
  'Serial Number',
  'Name of the council (in which they have registered)',
  'Council Register Number (Optional)',
  'Full Name\n(Please do not include inital or symbols or dots as part of the name)',
  'Email Id\n',
  'Mobile Number (Optional)',
];

/** GET /api/v1/admin/registrations/export-attendance.xlsx — TNMC bulk upload format for scanned attendees */
const exportScannedAttendanceXlsx = asyncHandler(async (req, res) => {
  const filter = buildRegistrationFilter(req.query);
  filter.status = 'confirmed';
  filter.$or = [
    { checkedInAt: { $ne: null } },
    { 'checkins.0': { $exists: true } },
  ];

  const registrations = await Registration.find(filter)
    .sort({ checkedInAt: 1, createdAt: 1 })
    .lean();

  const wb = getAttendanceTemplateWorkbook();
  const tnmcRows = [];
  const otherRows = [];

  for (const reg of registrations) {
    const attendee = reg.attendee || {};
    const { isTnmc, councilName, regNumber } = resolveCouncilAndNumber(attendee.medicalCouncilRegNo, attendee.state);
    const cleanedName = cleanNameForTnmc(attendee.name);
    const email = attendee.email || '';
    const mobile = String(attendee.phone || '').replace(/[^\d]/g, '').slice(-10);

    if (isTnmc) {
      tnmcRows.push([
        tnmcRows.length + 1,
        councilName,
        regNumber,
        cleanedName,
        email,
        mobile,
      ]);
    } else {
      otherRows.push([
        otherRows.length + 1,
        councilName,
        regNumber,
        cleanedName,
        email,
        mobile,
      ]);
    }
  }

  wb.Sheets['TNMC Participants'] = XLSX.utils.aoa_to_sheet([
    TNMC_PARTICIPANT_HEADERS,
    ...tnmcRows,
  ]);
  wb.Sheets['TNMC Participants']['!cols'] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 25 },
    { wch: 40 },
    { wch: 35 },
    { wch: 25 },
  ];

  wb.Sheets['Other than TNMC participants'] = XLSX.utils.aoa_to_sheet([
    OTHER_PARTICIPANT_HEADERS,
    ...otherRows,
  ]);
  wb.Sheets['Other than TNMC participants']['!cols'] = [
    { wch: 15 },
    { wch: 35 },
    { wch: 25 },
    { wch: 40 },
    { wch: 35 },
    { wch: 25 },
  ];

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  recordAudit(req, {
    action: 'registration.export_attendance_xlsx',
    entityType: 'Registration',
    meta: {
      totalScanned: registrations.length,
      tnmcCount: tnmcRows.length,
      otherCount: otherRows.length,
      filters: req.query,
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="TNMC_Attendance_Scanned_${dateStr}.xlsx"`);
  res.send(buffer);
});

/**
 * POST /api/v1/admin/registrations
 * Instant registration created by admin desk (supports TMNC or no TMNC).
 */
const createRegistration = asyncHandler(async (req, res) => {
  const {
    eventId,
    name,
    phone,
    email,
    title = 'Dr.',
    medicalCouncilRegNo,
    hasTnmc,
    category,
    role,
    institution,
    city = 'Chennai',
    state = 'Tamil Nadu',
    country = 'India',
    autoCheckIn = true,
    sendNotifications = false,
  } = req.body;

  const cleanName = (name && String(name).trim()) || 'Delegate';
  const cleanPhone = (phone && String(phone).replace(/[\s()-]/g, '')) || `999${Date.now().toString().slice(-7)}`;

  // Find event - always allow registration regardless of event dates/status
  let event = null;
  if (eventId && mongoose.isValidObjectId(eventId)) {
    event = await Event.findById(eventId);
  }
  if (!event) {
    event = await Event.findOne({ status: { $in: ['published', 'active', 'registration-closed', 'completed'] } }).sort({ startDate: -1 });
  }
  if (!event) {
    event = await Event.findOne().sort({ createdAt: -1 });
  }
  if (!event) {
    throw ApiError.badRequest('No event found to register attendee.');
  }

  // Find ticket type
  let ticketType = null;
  const requestedCat = String(role || category || 'Delegate').trim();
  if (requestedCat.toLowerCase().includes('faculty')) {
    ticketType = await TicketType.findOne({ event: event._id, name: /faculty/i });
  } else if (requestedCat.toLowerCase().includes('pg') || requestedCat.toLowerCase().includes('resident')) {
    ticketType = await TicketType.findOne({ event: event._id, name: /pg|resident|student/i });
  }
  if (!ticketType) {
    ticketType = await TicketType.findOne({ event: event._id }).sort({ price: 1 });
  }
  if (!ticketType) {
    ticketType = await TicketType.findOne().sort({ createdAt: -1 });
  }

  // Generate unique codes
  const qrToken = crypto.randomBytes(24).toString('hex');
  const codeSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const registrationCode = `REG-${codeSuffix}`;

  // Clean email - fallback to desk email if omitted
  const cleanEmail = email && String(email).trim().includes('@')
    ? String(email).trim().toLowerCase()
    : `desk-${cleanPhone.slice(-6)}@ciim.prashanthfertility.com`;

  // TMNC handling
  const isTnmc = hasTnmc !== false && medicalCouncilRegNo && String(medicalCouncilRegNo).trim() !== '' && String(medicalCouncilRegNo).toUpperCase() !== 'NONE';
  const cleanTnmc = isTnmc ? String(medicalCouncilRegNo).trim() : '';

  const assignedRole = requestedCat.toLowerCase().includes('faculty')
    ? 'FACULTY'
    : (requestedCat.toLowerCase().includes('organis') ? 'ORGANISING TEAM' : 'DELEGATE');

  const registration = new Registration({
    event: event._id,
    ticketType: ticketType?._id,
    registrationCode,
    qrToken,
    status: 'confirmed',
    attendee: {
      name: cleanName,
      title: title || 'Dr.',
      email: cleanEmail,
      phone: cleanPhone,
      medicalCouncilRegNo: cleanTnmc,
      category: assignedRole,
      institution: institution ? String(institution).trim() : '',
      city: String(city).trim(),
      state: String(state).trim(),
      country: String(country).trim(),
    },
    badgeRole: assignedRole,
    pricing: {
      basePrice: ticketType?.price || 0,
      discountAmount: ticketType?.price || 0,
      taxAmount: 0,
      totalAmount: 0,
      currency: 'INR',
    },
    payment: null,
  });

  // Assign badge number
  registration.badgeNo = await resolveRegistrationBadgeNo(registration);

  // Auto check-in if requested
  if (autoCheckIn) {
    registration.checkedInAt = new Date();
    registration.checkedInBy = req.user?._id || null;
    registration.checkins = [
      {
        locationId: 'registration_desk',
        locationCode: 'DESK',
        locationName: 'Registration Desk',
        timestamp: new Date(),
        scannedBy: req.user?._id || null,
        method: 'instant_registration',
      },
    ];
  }

  await registration.save();

  // Audit log
  recordAudit(req, {
    action: 'registration.create_instant',
    entityType: 'Registration',
    entityId: registration._id,
    meta: {
      registrationCode: registration.registrationCode,
      name: cleanName,
      phone: cleanPhone,
      hasTnmc: isTnmc,
      tnmc: cleanTnmc,
      badgeNo: registration.badgeNo,
      role: assignedRole,
      autoCheckIn,
    },
  });

  // Notifications if requested
  if (sendNotifications) {
    deliverTicket(registration, 'whatsapp').catch(() => { });
  }

  const populated = await withRefs(Registration.findById(registration._id));
  return sendSuccess(res, serializeRegistrationForAdmin(populated), { status: 201 });
});

/** GET /api/v1/admin/registrations/:id/badge — staff download/print ID card in PDF, PNG, or JPG */
const getRegistrationBadge = asyncHandler(async (req, res) => {
  const reg = await findOr404(req.params.id);
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
    return res.send(buffer);
  }

  // Default PDF
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
  return res.send(buffer);
});

const getRegistrationBadgePdf = getRegistrationBadge;

/**
 * GET /api/v1/admin/registrations/:id/certificate
 * GET /api/v1/admin/registrations/:id/certificate.:ext
 * Download / preview attendee certificate in PDF, PNG, or JPG format.
 */
const getRegistrationCertificate = asyncHandler(async (req, res) => {
  const reg = await findOr404(req.params.id);
  if (reg.status !== 'confirmed') {
    throw ApiError.conflict('Certificates are only available for confirmed registrations.');
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
  res.set('Cache-Control', 'private, max-age=60');
  return res.send(buffer);
});

module.exports = {
  listRegistrations,
  getRegistration,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  toggleCheckinLocation,
  cancelRegistration,
  retryDelivery,
  exportRegistrationsCsv,
  exportScannedAttendanceXlsx,
  getRegistrationBadge,
  getRegistrationBadgePdf,
  getRegistrationCertificate,
  qrStatusOf,
  CSV_COLUMNS,
};
