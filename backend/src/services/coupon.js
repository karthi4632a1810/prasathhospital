'use strict';

const Coupon = require('../models/Coupon');

/**
 * Coupon validation and capacity accounting.
 *
 * MongoDB runs standalone here (no transactions), so — like
 * services/inventory.js — redemption is one atomic findOneAndUpdate whose
 * filter re-checks every rule, including `usageCount < max`. Two requests
 * racing for the last slot can't both match: exactly one increment wins and
 * the other gets null back. Callers compensate with releaseCoupon() if a
 * later step of the registration fails.
 */

const REASON_MESSAGES = {
  invalid: 'This coupon code is not valid.',
  inactive: 'This coupon is no longer active.',
  not_started: 'This coupon is not valid yet.',
  expired: 'This coupon has expired.',
  exhausted: 'This coupon has reached its registration limit.',
  wrong_event: 'This coupon code is not valid.',
  company_inactive: 'This coupon is no longer active.',
};

function reasonMessage(reason) {
  return REASON_MESSAGES[reason] || REASON_MESSAGES.invalid;
}

/**
 * Looks a code up and explains why it can't be used, without changing
 * anything. Used by the public "Validate" button and to word the error when
 * an atomic redemption is refused. Unknown codes and codes for another event
 * get the same "not valid" answer, so the response never confirms that a
 * code exists elsewhere.
 */
async function inspectCoupon(rawCode, eventId, now = new Date()) {
  const code = Coupon.normalizeCode(rawCode);
  if (!code || code.length > 32) return { ok: false, reason: 'invalid' };

  const coupon = await Coupon.findOne({ code }).populate('company', 'name isActive');
  if (!coupon || !coupon.event.equals(eventId)) return { ok: false, reason: 'invalid' };
  if (!coupon.company || !coupon.company.isActive) return { ok: false, reason: 'company_inactive', coupon };

  const reason = coupon.unavailableReason(now);
  if (reason) return { ok: false, reason, coupon };
  return { ok: true, coupon };
}

/**
 * Atomically takes one registration slot on the coupon. Returns the updated
 * coupon, or null if any rule failed at the moment of the write.
 */
async function reserveCoupon(couponId, eventId, now = new Date()) {
  return Coupon.findOneAndUpdate(
    {
      _id: couponId,
      event: eventId,
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
      ],
      $expr: { $lt: ['$usageCount', '$maxAllowedRegistrations'] },
    },
    { $inc: { usageCount: 1 } },
    { new: true }
  );
}

/** Gives one slot back (failed registration, or cancellation). Never goes below zero. */
async function releaseCoupon(couponId) {
  if (!couponId) return;
  await Coupon.updateOne({ _id: couponId, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
}

module.exports = { inspectCoupon, reserveCoupon, releaseCoupon, reasonMessage, REASON_MESSAGES };
