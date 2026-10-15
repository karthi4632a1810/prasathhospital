'use strict';

const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { serializeRegistrationForPublic } = require('../services/registrationSerializer');
const { inspectCoupon, reserveCoupon, releaseCoupon, reasonMessage } = require('../services/coupon');
const inventory = require('../services/inventory');
const { dispatchTicketDelivery } = require('../services/delivery');
const logger = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{10,15}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9-]{16,64}$/;

const REGISTRATION_STATE_MESSAGES = {
  'not-yet-open': 'Registration has not opened yet.',
  closed: 'Registration for this event is closed.',
  'sold-out': 'This event is sold out.',
  completed: 'This event has already taken place.',
  cancelled: 'This event has been cancelled.',
  unavailable: 'Registration is not available for this event.',
};

/** Trims and validates the three attendee fields; returns the cleaned values. */
function cleanAttendee(attendee) {
  const name = String(attendee?.name || '').trim().replace(/\s+/g, ' ');
  const email = String(attendee?.email || '').trim().toLowerCase();
  const phone = String(attendee?.phone || '').replace(/[\s()-]/g, '');

  if (name.length < 2 || name.length > 120) throw ApiError.badRequest('Please enter your full name.');
  if (email.length > 160 || !EMAIL_RE.test(email)) throw ApiError.badRequest('Please enter a valid email address.');
  if (!PHONE_RE.test(phone)) throw ApiError.badRequest('Please enter a valid mobile number (10–15 digits).');
  return { name, email, phone };
}

function couponError(reason) {
  const err = reason === 'exhausted' ? ApiError.conflict(reasonMessage(reason)) : ApiError.badRequest(reasonMessage(reason));
  err.code = `COUPON_${String(reason).toUpperCase()}`;
  return err;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * The coupon covers the full pass price including GST, so the attendee
 * always pays ₹0. Stored as base + tax − discount = 0 so the numbers
 * reconcile in reports.
 */
function couponPricing(ticketType) {
  const basePrice = ticketType.price || 0;
  const originalAmount = round2(ticketType.priceWithTax || basePrice);
  return {
    basePrice,
    taxAmount: round2(originalAmount - basePrice),
    discountAmount: originalAmount,
    totalAmount: 0,
    currency: ticketType.currency || 'INR',
  };
}

/** Event + pass lookups shared by validate and register. */
async function loadEventAndPass(eventSlug, ticketTypeId) {
  if (!eventSlug || !ticketTypeId) throw ApiError.badRequest('Please choose a pass.');

  const event = await Event.findPublishedBySlug(eventSlug);
  if (!event) throw ApiError.notFound('Event not found');
  if (event.registrationState !== 'open') {
    throw ApiError.conflict(REGISTRATION_STATE_MESSAGES[event.registrationState] || 'Registration is not open.');
  }

  const ticketType = await TicketType.findById(ticketTypeId).catch(() => null);
  if (!ticketType || !ticketType.event.equals(event._id) || !ticketType.isPubliclyVisible) {
    throw ApiError.notFound('Pass not found for this event.');
  }
  if (ticketType.saleState !== 'on-sale') throw ApiError.conflict('This pass is not currently available.');
  return { event, ticketType };
}

/**
 * POST /api/v1/coupons/validate  { code, eventSlug, ticketTypeId }
 * Read-only preview for the "Validate" button — consumes nothing.
 */
const validateCoupon = asyncHandler(async (req, res) => {
  const { code, eventSlug, ticketTypeId } = req.body || {};
  if (!code || !String(code).trim()) throw ApiError.badRequest('Please enter a coupon code.');

  const { event, ticketType } = await loadEventAndPass(eventSlug, ticketTypeId);
  const check = await inspectCoupon(code, event._id);
  if (!check.ok) throw couponError(check.reason);

  const pricing = couponPricing(ticketType);
  return sendSuccess(res, {
    valid: true,
    code: check.coupon.code,
    companyName: check.coupon.company.name,
    currency: pricing.currency,
    originalAmount: pricing.discountAmount,
    discountAmount: pricing.discountAmount,
    finalAmount: 0,
  });
});

/**
 * POST /api/v1/registrations
 * Body: { eventSlug, ticketTypeId, attendee: { name, email, phone }, couponCode, idempotencyKey }
 *
 * Re-validates everything server-side, then takes capacity in three atomic
 * steps — coupon slot, pass unit, event seat — undoing earlier steps if a
 * later one fails. The registration is created confirmed with its QR token,
 * the response goes out, and email/WhatsApp delivery runs afterwards so a
 * provider outage can't fail or slow the registration.
 */
const createRegistration = asyncHandler(async (req, res) => {
  const { eventSlug, ticketTypeId, couponCode, campaignSource } = req.body || {};
  const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey) : '';
  if (idempotencyKey && !IDEMPOTENCY_RE.test(idempotencyKey)) throw ApiError.badRequest('Invalid request key.');

  const attendee = cleanAttendee(req.body?.attendee);
  if (!couponCode || !String(couponCode).trim()) throw ApiError.badRequest('A coupon code is required to register.');

  const { event, ticketType } = await loadEventAndPass(eventSlug, ticketTypeId);

  // A repeated submit of the same form (double-click, network retry)
  // returns the registration the first submit created.
  if (idempotencyKey) {
    const existing = await Registration.findOne({ idempotencyKey, event: event._id }).populate('company', 'name');
    if (existing && existing.attendee.email === attendee.email) {
      return sendSuccess(res, serializeRegistrationForPublic(existing, { event, ticketType, company: existing.company }));
    }
    if (existing) throw ApiError.conflict('This form was already submitted. Please reload the page.');
  }

  const activeKey = Registration.activeKeyFor(event._id, attendee.email);
  if (await Registration.exists({ activeKey })) {
    throw ApiError.conflict('This email address is already registered for this event. Check your email or WhatsApp for your ticket.');
  }

  const check = await inspectCoupon(couponCode, event._id);
  if (!check.ok) throw couponError(check.reason);
  const company = check.coupon.company;

  // 1. Coupon slot (atomic; re-checks active/dates/limit at write time).
  const coupon = await reserveCoupon(check.coupon._id, event._id);
  if (!coupon) {
    const recheck = await inspectCoupon(couponCode, event._id);
    throw couponError(recheck.ok ? 'exhausted' : recheck.reason);
  }

  // 2. Pass unit, 3. event seat — compensating on failure.
  const sold = await inventory.sellTicketDirect(ticketType._id);
  if (!sold) {
    await releaseCoupon(coupon._id);
    throw ApiError.conflict('This pass just sold out. Please pick another pass.');
  }
  const seated = await inventory.takeEventSeat(event._id);
  if (!seated) {
    await inventory.releaseTicketSale(ticketType._id);
    await releaseCoupon(coupon._id);
    throw ApiError.conflict('This event just reached capacity.');
  }

  const reg = new Registration({
    event: event._id,
    ticketType: ticketType._id,
    attendee,
    coupon: coupon._id,
    company: company._id,
    couponCode: coupon.code,
    pricing: couponPricing(ticketType),
    status: 'confirmed',
    activeKey,
    idempotencyKey: idempotencyKey || undefined,
    campaignSource: String(campaignSource || '').slice(0, 80),
  });
  reg.issueQrToken();

  try {
    await reg.save();
  } catch (err) {
    await Promise.all([
      inventory.releaseEventSeat(event._id),
      inventory.releaseTicketSale(ticketType._id),
      releaseCoupon(coupon._id),
    ]);
    if (err && err.code === 11000) {
      const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
      if (field === 'idempotencyKey') {
        const first = await Registration.findOne({ idempotencyKey }).populate('company', 'name');
        if (first && first.attendee.email === attendee.email) {
          return sendSuccess(res, serializeRegistrationForPublic(first, { event, ticketType, company: first.company }));
        }
        throw ApiError.conflict('This form was already submitted. Please reload the page.');
      }
      if (field === 'activeKey') {
        throw ApiError.conflict('This email address is already registered for this event. Check your email or WhatsApp for your ticket.');
      }
    }
    logger.error('Registration save failed after capacity was taken (compensated)', err);
    throw err;
  }

  dispatchTicketDelivery(reg._id);

  return sendSuccess(res, serializeRegistrationForPublic(reg, { event, ticketType, company }), { status: 201 });
});

module.exports = { createRegistration, validateCoupon, couponPricing, cleanAttendee };
