'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A sponsoring organisation (Yamaha, Bajaj, …) whose coupons pay for its
 * delegates' registrations. Managed from the admin dashboard — never
 * hardcoded. `nameKey` is the lowercased name and carries the unique index,
 * so "Yamaha" and "YAMAHA " can't both exist.
 */
const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameKey: { type: String, required: true, unique: true },
    contactName: { type: String, trim: true, default: '', maxlength: 120 },
    contactEmail: { type: String, trim: true, lowercase: true, default: '', maxlength: 160 },
    contactPhone: { type: String, trim: true, default: '', maxlength: 20 },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

CompanySchema.statics.keyFor = function keyFor(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
};

CompanySchema.pre('validate', function syncNameKey(next) {
  if (this.name) {
    this.name = this.name.trim().replace(/\s+/g, ' ');
    this.nameKey = this.constructor.keyFor(this.name);
  }
  next();
});

module.exports = mongoose.model('Company', CompanySchema);
