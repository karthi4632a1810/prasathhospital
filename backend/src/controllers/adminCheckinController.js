'use strict';

const Registration = require('../models/Registration');
const CheckinLocation = require('../models/CheckinLocation');
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

const DEFAULT_LOCATIONS = [
  {
    name: 'Main Entry Desk',
    code: 'ENTRY',
    description: 'Main conference hall entrance & delegate badge verification',
    icon: 'door',
    color: '#2563eb',
    isDefault: true,
    order: 1,
  },
  {
    name: 'Lunch Counter',
    code: 'LUNCH',
    description: 'Dining hall & buffet lunch pass verification',
    icon: 'utensils',
    color: '#16a34a',
    isDefault: false,
    order: 2,
  },
];

/**
 * Ensures default locations (Main Entry Desk & Lunch Counter) exist for an event.
 */
async function ensureDefaultLocations(eventId, userId) {
  if (!eventId) return;
  const count = await CheckinLocation.countDocuments({ event: eventId });
  if (count === 0) {
    const docs = DEFAULT_LOCATIONS.map((loc) => ({
      ...loc,
      event: eventId,
      isActive: true,
      createdBy: userId || null,
    }));
    try {
      await CheckinLocation.insertMany(docs, { ordered: false });
    } catch {
      // Ignore parallel insert races
    }
  }
}

/**
 * GET /api/v1/admin/checkin/locations?event=<eventId>
 * Lists all checkpoints for an event with checkin stats per location.
 */
const listLocations = asyncHandler(async (req, res) => {
  if (!req.query.event) throw ApiError.badRequest('An "event" id is required.');
  const eventId = req.query.event;

  await ensureDefaultLocations(eventId, req.user?._id);

  const locations = await CheckinLocation.find({ event: eventId })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  // Compute live check-in counts for each location
  const enriched = await Promise.all(
    locations.map(async (loc) => {
      let count = 0;
      if (loc.code === 'ENTRY' || loc.isDefault) {
        count = await Registration.countDocuments({
          event: eventId,
          status: 'confirmed',
          $or: [{ 'checkins.locationCode': loc.code }, { checkedInAt: { $ne: null } }],
        });
      } else {
        count = await Registration.countDocuments({
          event: eventId,
          status: 'confirmed',
          'checkins.locationCode': loc.code,
        });
      }

      return {
        id: loc._id,
        name: loc.name,
        code: loc.code,
        description: loc.description || '',
        icon: loc.icon || 'door',
        color: loc.color || '#2563eb',
        isDefault: Boolean(loc.isDefault),
        isActive: Boolean(loc.isActive),
        order: loc.order || 0,
        checkedInCount: count,
        createdAt: loc.createdAt,
      };
    })
  );

  return sendSuccess(res, enriched);
});

/**
 * POST /api/v1/admin/checkin/locations
 * Creates a new checkpoint location.
 */
const createLocation = asyncHandler(async (req, res) => {
  const { event, name, code, description, icon, color, isDefault, isActive, order } = req.body || {};
  if (!event) throw ApiError.badRequest('An "event" id is required.');
  if (!name || !String(name).trim()) throw ApiError.badRequest('Location name is required.');

  const cleanCode = CheckinLocation.normalizeCode(code || name);
  if (!cleanCode || cleanCode.length < 2) {
    throw ApiError.badRequest('Location code must be at least 2 alphanumeric characters.');
  }

  const exists = await CheckinLocation.findOne({ event, code: cleanCode });
  if (exists) {
    throw ApiError.conflict(`Location with code "${cleanCode}" already exists for this event.`);
  }

  // If this is set as default, unset other defaults for the same event
  if (isDefault) {
    await CheckinLocation.updateMany({ event }, { $set: { isDefault: false } });
  }

  const location = await CheckinLocation.create({
    event,
    name: String(name).trim(),
    code: cleanCode,
    description: String(description || '').trim(),
    icon: String(icon || 'door').trim(),
    color: String(color || '#2563eb').trim(),
    isDefault: Boolean(isDefault),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    order: Number(order) || 0,
    createdBy: req.user?._id,
  });

  recordAudit(req, {
    action: 'checkin_location.create',
    entityType: 'CheckinLocation',
    entityId: location._id,
    meta: { name: location.name, code: location.code, isDefault: location.isDefault },
  });

  return sendSuccess(
    res,
    {
      id: location._id,
      name: location.name,
      code: location.code,
      description: location.description,
      icon: location.icon,
      color: location.color,
      isDefault: location.isDefault,
      isActive: location.isActive,
      order: location.order,
      checkedInCount: 0,
    },
    { status: 201, message: `Check-in location "${location.name}" created successfully.` }
  );
});

/**
 * PATCH /api/v1/admin/checkin/locations/:id
 * Updates an existing checkpoint location.
 */
const updateLocation = asyncHandler(async (req, res) => {
  const location = await CheckinLocation.findById(req.params.id);
  if (!location) throw ApiError.notFound('Check-in location not found.');

  const body = req.body || {};
  const updates = {};

  if ('name' in body) {
    const name = String(body.name || '').trim();
    if (!name) throw ApiError.badRequest('Location name cannot be empty.');
    updates.name = name;
  }

  if ('description' in body) updates.description = String(body.description || '').trim();
  if ('icon' in body) updates.icon = String(body.icon || 'door').trim();
  if ('color' in body) updates.color = String(body.color || '#2563eb').trim();
  if ('isActive' in body) updates.isActive = Boolean(body.isActive);
  if ('order' in body) updates.order = Number(body.order) || 0;

  if (body.isDefault) {
    await CheckinLocation.updateMany({ event: location.event }, { $set: { isDefault: false } });
    updates.isDefault = true;
  } else if ('isDefault' in body && !body.isDefault && location.isDefault) {
    // If clearing default, make sure at least one default remains
    updates.isDefault = false;
  }

  if (body.code && body.code !== location.code) {
    const cleanCode = CheckinLocation.normalizeCode(body.code);
    const clash = await CheckinLocation.findOne({
      event: location.event,
      code: cleanCode,
      _id: { $ne: location._id },
    });
    if (clash) throw ApiError.conflict(`Location code "${cleanCode}" already exists.`);
    updates.code = cleanCode;
  }

  const updated = await CheckinLocation.findByIdAndUpdate(location._id, { $set: updates }, { new: true });

  recordAudit(req, {
    action: 'checkin_location.update',
    entityType: 'CheckinLocation',
    entityId: updated._id,
    meta: { name: updated.name, code: updated.code, updates },
  });

  return sendSuccess(res, {
    id: updated._id,
    name: updated.name,
    code: updated.code,
    description: updated.description,
    icon: updated.icon,
    color: updated.color,
    isDefault: updated.isDefault,
    isActive: updated.isActive,
    order: updated.order,
  });
});

/**
 * DELETE /api/v1/admin/checkin/locations/:id
 * Deletes a checkpoint location if no checkins have been recorded there.
 */
const deleteLocation = asyncHandler(async (req, res) => {
  const location = await CheckinLocation.findById(req.params.id);
  if (!location) throw ApiError.notFound('Check-in location not found.');

  // Check if any attendee has checked in here
  const used = await Registration.countDocuments({
    event: location.event,
    'checkins.locationCode': location.code,
  });
  if (used > 0) {
    throw ApiError.conflict(
      `Cannot delete "${location.name}" because ${used} attendee(s) have checked in here. Deactivate it instead.`
    );
  }

  await location.deleteOne();

  recordAudit(req, {
    action: 'checkin_location.delete',
    entityType: 'CheckinLocation',
    entityId: location._id,
    meta: { name: location.name, code: location.code },
  });

  return sendSuccess(res, null, { message: `Check-in location "${location.name}" deleted.` });
});

/**
 * POST /api/v1/admin/checkin/scan
 * Body: { qrToken, locationId, locationCode }
 *
 * Scans a ticket at a specific checkpoint (e.g. Main Entry or Lunch Counter).
 * Duplicate checks are strictly location-specific: an attendee can be checked in
 * at Main Entry and then subsequently at Lunch with the EXACT SAME QR code!
 */
const scanTicket = asyncHandler(async (req, res) => {
  const token = extractToken(req.body.qrToken);
  if (!token) throw ApiError.badRequest('No QR token provided.');
  if (!/^[a-f0-9]{16,64}$/i.test(token)) throw ApiError.notFound('No ticket found for this code.');

  const reg = await Registration.findOne({ qrToken: token })
    .populate('event', 'title slug')
    .populate('ticketType', 'name')
    .populate('company', 'name');

  if (!reg) throw ApiError.notFound('No ticket found for this code.');

  if (reg.status !== 'confirmed') {
    throw ApiError.conflict(STATUS_MESSAGES[reg.status] || 'This ticket is not valid.');
  }

  // Ensure default locations exist for this event
  await ensureDefaultLocations(reg.event?._id, req.user?._id);

  // Resolve target location
  let location = null;
  if (req.body.locationId) {
    location = await CheckinLocation.findById(req.body.locationId);
  } else if (req.body.locationCode) {
    const code = String(req.body.locationCode).trim().toUpperCase();
    location = await CheckinLocation.findOne({ event: reg.event._id, code });
  }

  if (!location) {
    // Fall back to default location for this event (or first active location)
    location =
      (await CheckinLocation.findOne({ event: reg.event._id, isDefault: true, isActive: true })) ||
      (await CheckinLocation.findOne({ event: reg.event._id, isActive: true }));
  }

  // Fallback descriptor if none configured in DB
  const locationDoc = location || {
    _id: null,
    name: 'Main Entry Desk',
    code: 'ENTRY',
    isDefault: true,
    isActive: true,
    icon: 'door',
    color: '#2563eb',
  };

  if (!locationDoc.isActive) {
    throw ApiError.badRequest(`Checkpoint "${locationDoc.name}" is currently deactivated.`);
  }

  const locCode = locationDoc.code;
  const locName = locationDoc.name;

  // Format existing checkins history
  const checkinsList = (reg.checkins || []).map((c) => ({
    locationCode: c.locationCode,
    locationName: c.locationName,
    checkedInAt: c.checkedInAt,
  }));

  // If legacy entry checkin exists without array entry, represent it
  if (reg.checkedInAt && !checkinsList.some((c) => c.locationCode === 'ENTRY')) {
    checkinsList.unshift({
      locationCode: 'ENTRY',
      locationName: 'Main Entry Desk',
      checkedInAt: reg.checkedInAt,
    });
  }

  const payload = {
    registrationCode: reg.registrationCode,
    attendee: { name: reg.attendee.name, email: reg.attendee.email, phone: reg.attendee.phone },
    event: reg.event,
    ticketType: reg.ticketType,
    company: reg.company ? { name: reg.company.name } : null,
    couponCode: reg.couponCode || '',
    activeLocation: {
      id: locationDoc._id,
      name: locName,
      code: locCode,
      icon: locationDoc.icon || 'door',
      color: locationDoc.color || '#2563eb',
    },
    checkins: checkinsList,
  };

  // Check if ALREADY checked in at THIS specific location
  const existingForThisLoc = reg.checkins?.find((c) => c.locationCode === locCode);
  const alreadyCheckedInLegacy = (locCode === 'ENTRY' || locationDoc.isDefault) && reg.checkedInAt;

  if (existingForThisLoc || alreadyCheckedInLegacy) {
    const priorTime = existingForThisLoc ? existingForThisLoc.checkedInAt : reg.checkedInAt;
    return sendSuccess(res, {
      result: 'already-checked-in',
      checkedInAt: priorTime,
      message: `Already checked in at ${locName}!`,
      ...payload,
    });
  }

  // Record check-in at this location atomically
  const now = new Date();
  const newCheckinItem = {
    location: locationDoc._id || null,
    locationCode: locCode,
    locationName: locName,
    checkedInAt: now,
    checkedInBy: req.user?._id || null,
  };

  const updateOps = {
    $push: { checkins: newCheckinItem },
  };

  // If this is default entry location, also maintain top-level checkedInAt for legacy compatibility
  if (locationDoc.isDefault || locCode === 'ENTRY') {
    updateOps.$set = {
      checkedInAt: now,
      checkedInBy: req.user?._id || null,
    };
  }

  const updated = await Registration.findOneAndUpdate(
    {
      _id: reg._id,
      status: 'confirmed',
      'checkins.locationCode': { $ne: locCode },
    },
    updateOps,
    { new: true }
  );

  if (!updated) {
    // Concurrent scan detected
    const latest = await Registration.findById(reg._id);
    const concurrentLoc = latest?.checkins?.find((c) => c.locationCode === locCode);
    return sendSuccess(res, {
      result: 'already-checked-in',
      checkedInAt: concurrentLoc?.checkedInAt || now,
      message: `Already checked in at ${locName}!`,
      ...payload,
    });
  }

  // Record audit trail
  recordAudit(req, {
    action: 'registration.checkin',
    entityType: 'Registration',
    entityId: reg._id,
    meta: {
      registrationCode: reg.registrationCode,
      location: locName,
      locationCode: locCode,
    },
  });

  const updatedCheckinsList = (updated.checkins || []).map((c) => ({
    locationCode: c.locationCode,
    locationName: c.locationName,
    checkedInAt: c.checkedInAt,
  }));

  return sendSuccess(res, {
    result: 'success',
    checkedInAt: now,
    message: `Checked in successfully at ${locName}!`,
    ...payload,
    checkins: updatedCheckinsList,
  });
});

/**
 * GET /api/v1/admin/checkin/stats?event=<eventId>&location=<locationCodeOrId>
 * Returns stats for total confirmed, and breakdown per checkpoint.
 */
const getCheckinStats = asyncHandler(async (req, res) => {
  if (!req.query.event) throw ApiError.badRequest('An "event" id is required.');
  const eventId = req.query.event;

  await ensureDefaultLocations(eventId, req.user?._id);

  const [total, locations] = await Promise.all([
    Registration.countDocuments({ event: eventId, status: 'confirmed' }),
    CheckinLocation.find({ event: eventId, isActive: true }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);

  // Determine active location
  let selectedLoc = null;
  if (req.query.location) {
    selectedLoc =
      locations.find((l) => String(l._id) === req.query.location || l.code === req.query.location.toUpperCase()) ||
      null;
  }
  if (!selectedLoc) {
    selectedLoc = locations.find((l) => l.isDefault) || locations[0] || null;
  }

  // Calculate breakdown for all locations
  const locationBreakdown = await Promise.all(
    locations.map(async (loc) => {
      let count = 0;
      if (loc.code === 'ENTRY' || loc.isDefault) {
        count = await Registration.countDocuments({
          event: eventId,
          status: 'confirmed',
          $or: [{ 'checkins.locationCode': loc.code }, { checkedInAt: { $ne: null } }],
        });
      } else {
        count = await Registration.countDocuments({
          event: eventId,
          status: 'confirmed',
          'checkins.locationCode': loc.code,
        });
      }

      return {
        id: loc._id,
        name: loc.name,
        code: loc.code,
        icon: loc.icon || 'door',
        color: loc.color || '#2563eb',
        isDefault: Boolean(loc.isDefault),
        checkedIn: count,
        remaining: Math.max(total - count, 0),
      };
    })
  );

  const activeLocStats = locationBreakdown.find((l) => String(l.id) === String(selectedLoc?._id));
  const checkedIn = activeLocStats ? activeLocStats.checkedIn : 0;

  return sendSuccess(res, {
    total,
    checkedIn,
    remaining: Math.max(total - checkedIn, 0),
    selectedLocation: selectedLoc
      ? {
          id: selectedLoc._id,
          name: selectedLoc.name,
          code: selectedLoc.code,
          icon: selectedLoc.icon,
          color: selectedLoc.color,
          isDefault: selectedLoc.isDefault,
        }
      : null,
    locations: locationBreakdown,
  });
});

/**
 * GET /api/v1/admin/checkin/events
 * Minimal event list (id, title, dates) for role-agnostic check-in desk.
 */
const listCheckinEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({}).select('title slug startDate endDate status').sort({ startDate: -1 });
  return sendSuccess(
    res,
    events.map((e) => ({
      id: e._id,
      title: e.title,
      slug: e.slug,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
    }))
  );
});

module.exports = {
  scanTicket,
  getCheckinStats,
  listCheckinEvents,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  extractToken,
};
