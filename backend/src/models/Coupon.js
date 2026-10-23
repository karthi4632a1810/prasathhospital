'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A company-sponsored registration coupon. Every registration on the
 * platform redeems exactly one coupon and costs the attendee ₹0.
 *
 * `code` is stored uppercased with a unique index, which is what makes codes
 * case-insensitive ("yamaha26" and "YAMAHA26" are the same coupon).
 * `usageCount` is only ever changed through services/coupon.js, which
 * guards the increment against `maxAllowedRegistrations` atomically.
 * Coupons are deactivated, never deleted, once anyone has used them, so
 * registrations always keep a valid reference.
 */
const CouponSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      minlength: 4,
      maxlength: 32,
      match: [/^[A-Z0-9_-]+$/, 'Coupon codes may only contain letters, numbers, "-" and "_".'],
    },
    description: { type: String, trim: true, default: '', maxlength: 500 },

    maxAllowedRegistrations: { type: Number, required: true, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },

    startDate: { type: Date, default: null },
    expiryDate: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          if (!value || !this.startDate) return true;
          return value > this.startDate;
        },
        message: 'Expiry date must be after the start date.',
      },
    },

    isActive: { type: Boolean, default: true },
    isTest: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CouponSchema.index({ event: 1, company: 1 });

CouponSchema.statics.normalizeCode = function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
};

CouponSchema.virtual('remaining').get(function remaining() {
  return Math.max(this.maxAllowedRegistrations - this.usageCount, 0);
});

/** Why this coupon can't be redeemed right now, or null if it can. */
CouponSchema.methods.unavailableReason = function unavailableReason(now = new Date()) {
  if (!this.isActive) return 'inactive';
  if (this.startDate && now < this.startDate) return 'not_started';
  if (this.expiryDate && now > this.expiryDate) return 'expired';
  if (this.usageCount >= this.maxAllowedRegistrations) return 'exhausted';
  return null;
};

module.exports = mongoose.model('Coupon', CouponSchema);
