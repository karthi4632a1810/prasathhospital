'use strict';

const Registration = require('../models/Registration');

/**
 * Resolves the 4-digit badge number for a given registration.
 *
 * Rules:
 * 1. If reg.badgeNo is already stored, returns it. Once set, a user's badgeNo
 *    is PERMANENTLY FIXED to that user and never overwritten.
 * 2. Instant (on-spot desk) registrations start from the 2001 series (2001, 2002, 2003, ...).
 * 3. Regular online registrations count sequentially from the highest existing badge number < 2000
 *    (strictly incremental; never backfills previous holes/gaps in the sequence).
 */
async function resolveRegistrationBadgeNo(reg, { isInstant = false } = {}) {
  if (!reg) return isInstant ? '2001' : '0001';

  if (reg.badgeNo && /^\d+$/.test(String(reg.badgeNo).trim())) {
    return String(reg.badgeNo).trim().padStart(4, '0');
  }

  // Double check DB if this registration already has a fixed badgeNo
  if (reg._id) {
    const existing = await Registration.findById(reg._id).select('badgeNo isInstant checkins');
    if (existing?.badgeNo && /^\d+$/.test(String(existing.badgeNo).trim())) {
      return String(existing.badgeNo).trim().padStart(4, '0');
    }
    if (existing?.isInstant) {
      isInstant = true;
    }
  }

  isInstant = Boolean(
    isInstant ||
    reg.isInstant ||
    reg.checkins?.some((c) => c.method === 'instant_registration')
  );

  const eventId = reg.event?._id || reg.event;
  const eventFilter = eventId ? { event: eventId } : {};

  // Find all used badge numbers for this event
  const assignedDocs = await Registration.find({
    ...eventFilter,
    badgeNo: { $nin: ['', null] },
  }).select('badgeNo');

  const allNumbers = assignedDocs
    .map((d) => String(d.badgeNo).trim())
    .filter((num) => /^\d+$/.test(num))
    .map((num) => parseInt(num, 10));

  let nextNum;
  if (isInstant) {
    // Instant registrations series starts from 2001
    const instantNumbers = allNumbers.filter((n) => n >= 2001);
    const maxInstant = instantNumbers.length > 0 ? Math.max(...instantNumbers) : 2000;
    nextNum = maxInstant + 1;
  } else {
    // Regular registrations series strictly increments from highest < 2000 (never filling gaps)
    const regularNumbers = allNumbers.filter((n) => n < 2000);
    const maxRegular = regularNumbers.length > 0 ? Math.max(...regularNumbers) : 0;
    nextNum = maxRegular + 1;
  }

  const badgeNo = String(nextNum).padStart(4, '0');

  // Fix and cache to document asynchronously without blocking
  if (reg._id) {
    Registration.updateOne(
      { _id: reg._id, $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }] },
      { $set: { badgeNo, ...(isInstant ? { isInstant: true } : {}) } }
    ).catch(() => {});
  }

  return badgeNo;
}

/**
 * Ensures all registrations for an event have their sequential 4-digit badge numbers.
 *
 * CRITICAL RULE: Once a badge number is set or assigned to an attendee, it is
 * PERMANENTLY FIXED to that attendee. This function NEVER overwrites or reshuffles
 * any existing badge numbers. It ONLY assigns numbers to documents where badgeNo
 * is missing or empty.
 */
async function syncEventBadgeNumbers(eventId = null) {
  try {
    const query = eventId ? { event: eventId } : {};

    // Find ONLY registrations that lack a badgeNo
    const unassigned = await Registration.find({
      ...query,
      $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }],
    })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id createdAt isInstant checkins');

    if (!unassigned || unassigned.length === 0) return;

    // Collect all existing badge numbers
    const assignedDocs = await Registration.find({
      ...query,
      badgeNo: { $nin: ['', null] },
    }).select('badgeNo');

    const allNumbers = assignedDocs
      .map((d) => String(d.badgeNo).trim())
      .filter((num) => /^\d+$/.test(num))
      .map((num) => parseInt(num, 10));

    let maxRegular = 0;
    let maxInstant = 2000;
    for (const num of allNumbers) {
      if (num >= 2001 && num > maxInstant) maxInstant = num;
      if (num < 2000 && num > maxRegular) maxRegular = num;
    }

    const ops = [];
    for (const doc of unassigned) {
      const isInstant = Boolean(
        doc.isInstant ||
        doc.checkins?.some((c) => c.method === 'instant_registration')
      );
      let num;
      if (isInstant) {
        maxInstant += 1;
        num = maxInstant;
      } else {
        maxRegular += 1;
        num = maxRegular;
      }
      const expected = String(num).padStart(4, '0');
      ops.push({
        updateOne: {
          filter: {
            _id: doc._id,
            $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }],
          },
          update: { $set: { badgeNo: expected, ...(isInstant ? { isInstant: true } : {}) } },
        },
      });
    }

    if (ops.length > 0) {
      await Registration.bulkWrite(ops);
    }
  } catch (err) {
    // Non-fatal background sync
  }
}

module.exports = {
  resolveRegistrationBadgeNo,
  syncEventBadgeNumbers,
};
