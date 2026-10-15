'use strict';

const crypto = require('crypto');
const Coupon = require('../models/Coupon');

/**
 * Generates unique, company-branded coupon codes: "YAMAHA-7KQ93X".
 *
 * - Prefix: the company's first word (letters/digits, max 8), so staff and
 *   delegates can tell at a glance whose coupon it is.
 * - Suffix: 6 characters from a 31-symbol alphabet without look-alikes
 *   (no 0/O, 1/I/L) — ~887 million combinations per company, which together
 *   with the per-IP rate limit on /coupons/validate makes guessing
 *   impractical. Uses crypto.randomInt, not Math.random.
 * - Uniqueness is checked here and enforced by Coupon's unique index.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 6;

function companyPrefix(companyName) {
  const words = String(companyName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  // Very short leading words ("L&T Finance", "3M India") borrow from the
  // following words until the prefix is at least 3 characters.
  let prefix = '';
  for (const word of words) {
    prefix = (prefix + word).slice(0, 8);
    if (prefix.length >= 3) break;
  }
  return prefix.length >= 2 ? prefix : 'CPN';
}

function randomSuffix(length = SUFFIX_LENGTH) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

function buildCode(companyName) {
  return `${companyPrefix(companyName)}-${randomSuffix()}`;
}

/** A code no existing coupon uses. Throws only if 10 random draws all collide. */
async function generateUniqueCouponCode(companyName) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = buildCode(companyName);
    // eslint-disable-next-line no-await-in-loop
    if (!(await Coupon.exists({ code }))) return code;
  }
  throw new Error('Could not generate a unique coupon code');
}

module.exports = { generateUniqueCouponCode, buildCode, companyPrefix, randomSuffix, ALPHABET };
