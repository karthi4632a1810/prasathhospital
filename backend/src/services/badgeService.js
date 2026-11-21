'use strict';

const Registration = require('../models/Registration');

/**
 * Resolves the 4-digit badge number for a given registration.
 *
 * If reg.badgeNo is already stored, returns it. Once set, a user's badgeNo
 * is PERMANENTLY FIXED to that user and never overwritten.
 *
 * Otherwise, computes the next available sequential number and stores it.
 */
async function resolveRegistrationBadgeNo(reg) {
  if (!reg) return '0001';

  if (reg.badgeNo && /^\d+$/.test(String(reg.badgeNo).trim())) {
    return String(reg.badgeNo).trim().padStart(4, '0');
  }

  // Double check DB if this registration already has a fixed badgeNo
  if (reg._id) {
    const existing = await Registration.findById(reg._id).select('badgeNo');
    if (existing?.badgeNo && /^\d+$/.test(String(existing.badgeNo).trim())) {
      return String(existing.badgeNo).trim().padStart(4, '0');
    }
  }

  const eventId = reg.event?._id || reg.event;
  const eventFilter = eventId ? { event: eventId } : {};

  // Find all used badge numbers for this event
  const assignedDocs = await Registration.find({
    ...eventFilter,
    badgeNo: { $nin: ['', null] },
  }).select('badgeNo');

  const usedNumbers = new Set(
    assignedDocs
      .map((d) => String(d.badgeNo).trim())
      .filter((num) => /^\d+$/.test(num))
      .map((num) => parseInt(num, 10))
  );

  let nextNum = 1;
  while (usedNumbers.has(nextNum)) {
    nextNum++;
  }
  const badgeNo = String(nextNum).padStart(4, '0');

  // Fix and cache to document asynchronously without blocking
  if (reg._id) {
    Registration.updateOne(
      { _id: reg._id, $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }] },
      { $set: { badgeNo } }
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
      .select('_id createdAt');

    if (!unassigned || unassigned.length === 0) return;

    // Collect all existing badge numbers to prevent any duplicates
    const assignedDocs = await Registration.find({
      ...query,
      badgeNo: { $nin: ['', null] },
    }).select('badgeNo');

    const usedNumbers = new Set(
      assignedDocs
        .map((d) => String(d.badgeNo).trim())
        .filter((num) => /^\d+$/.test(num))
        .map((num) => parseInt(num, 10))
    );

    let nextNum = 1;
    const ops = [];
    for (const doc of unassigned) {
      while (usedNumbers.has(nextNum)) {
        nextNum++;
      }
      const expected = String(nextNum).padStart(4, '0');
      usedNumbers.add(nextNum);
      nextNum++;

      ops.push({
        updateOne: {
          filter: {
            _id: doc._id,
            $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }],
          },
          update: { $set: { badgeNo: expected } },
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
