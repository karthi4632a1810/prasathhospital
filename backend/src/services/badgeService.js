'use strict';

const Registration = require('../models/Registration');

/**
 * Resolves the 4-digit badge number for a given registration based on who registered first
 * (chronological createdAt ascending, tie-breaker _id ascending).
 * 1st registered = 0001, 2nd = 0002, etc.
 *
 * If reg.badgeNo is already stored, returns it.
 * Otherwise, computes the 1-based order index by counting how many registrations
 * were created before/at this registration, and caches it on the document.
 */
async function resolveRegistrationBadgeNo(reg) {
  if (!reg) return '0001';

  if (reg.badgeNo && /^\d+$/.test(String(reg.badgeNo).trim())) {
    return String(reg.badgeNo).trim().padStart(4, '0');
  }

  if (reg.createdAt) {
    const eventId = reg.event?._id || reg.event;
    const eventFilter = eventId ? { event: eventId } : {};

    const countBefore = await Registration.countDocuments({
      ...eventFilter,
      $or: [
        { createdAt: { $lt: reg.createdAt } },
        { createdAt: reg.createdAt, _id: { $lte: reg._id } },
      ],
    });

    const badgeNo = String(Math.max(countBefore, 1)).padStart(4, '0');

    // Cache to document asynchronously without blocking
    if (reg._id) {
      Registration.updateOne(
        { _id: reg._id, $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }] },
        { $set: { badgeNo } }
      ).catch(() => {});
    }

    return badgeNo;
  }

  return '0001';
}

/**
 * Ensures all registrations for an event have their sequential 4-digit badge numbers
 * assigned according to who registered first (createdAt ascending).
 */
async function syncEventBadgeNumbers(eventId = null) {
  try {
    const query = eventId ? { event: eventId } : {};
    const unassigned = await Registration.countDocuments({
      ...query,
      $or: [{ badgeNo: '' }, { badgeNo: null }, { badgeNo: { $exists: false } }],
    });

    if (unassigned === 0) return;

    // Fetch all registrations in chronological order
    const all = await Registration.find(query)
      .sort({ createdAt: 1, _id: 1 })
      .select('_id badgeNo createdAt');

    const ops = [];
    for (let i = 0; i < all.length; i++) {
      const expected = String(i + 1).padStart(4, '0');
      if (all[i].badgeNo !== expected) {
        ops.push({
          updateOne: {
            filter: { _id: all[i]._id },
            update: { $set: { badgeNo: expected } },
          },
        });
      }
    }

    if (ops.length > 0) {
      await Registration.bulkWrite(ops);
    }
  } catch (err) {
    // Non-fatal logging
  }
}

module.exports = {
  resolveRegistrationBadgeNo,
  syncEventBadgeNumbers,
};
