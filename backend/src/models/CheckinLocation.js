'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Check-in Location (Checkpoint) for an Event.
 * e.g. "Main Entry Desk", "Lunch Counter", "Delegate Kit Counter", etc.
 * Allows the same QR code to be scanned across multiple checkpoints
 * with location-specific duplicate prevention and live counts.
 */
const CheckinLocationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    icon: { type: String, trim: true, default: 'door', maxlength: 32 },
    color: { type: String, trim: true, default: '#2563eb', maxlength: 32 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

CheckinLocationSchema.index({ event: 1, code: 1 }, { unique: true });

CheckinLocationSchema.statics.normalizeCode = function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .slice(0, 32);
};

module.exports = mongoose.model('CheckinLocation', CheckinLocationSchema);

