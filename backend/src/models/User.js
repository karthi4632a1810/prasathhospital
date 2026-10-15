'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ROLES = ['superadmin', 'manager', 'checkin_staff'];

/**
 * An admin/staff account. Passwords are stored as bcrypt hashes only — the
 * plaintext never round-trips through this model (see utils/password.js).
 */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'manager' },
    isActive: { type: Boolean, default: true },

    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    // Tokens issued before this moment are rejected (password reset ends
    // every existing session for the account).
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
});

module.exports = mongoose.model('User', UserSchema);
module.exports.ROLES = ROLES;
