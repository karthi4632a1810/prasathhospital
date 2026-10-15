'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Tighter per-IP limits for the two public endpoints that touch coupons, on
 * top of the global /api limiter in app.js. This is what makes guessing
 * coupon codes impractical: a client gets COUPON_VALIDATE_LIMIT_MAX guesses
 * per PUBLIC_LIMIT_WINDOW_MINUTES.
 */
function publicLimiter(max, message) {
  return rateLimit({
    windowMs: env.publicLimitWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message, code: 'RATE_LIMITED' } },
  });
}

const couponValidateLimiter = publicLimiter(
  env.couponValidateLimitMax,
  'Too many coupon attempts. Please wait a few minutes and try again.'
);

const registrationLimiter = publicLimiter(
  env.registrationLimitMax,
  'Too many registration attempts. Please wait a few minutes and try again.'
);

module.exports = { couponValidateLimiter, registrationLimiter };
