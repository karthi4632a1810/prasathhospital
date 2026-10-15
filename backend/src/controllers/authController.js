'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { comparePassword } = require('../utils/password');
const { signAdminToken } = require('../utils/jwt');
const { serializeUser } = require('../services/userSerializer');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * POST /api/v1/admin/auth/login
 * A dedicated, stricter rate limiter sits in front of this route
 * (see routes/adminAuthRoutes.js) on top of this per-account lockout.
 */
const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');

  if (!email || !password) {
    throw ApiError.badRequest('Email and password are required.');
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message whether the account exists or not, so login can't be used
  // to enumerate admin emails.
  const invalidCredentials = () => ApiError.unauthorized('Incorrect email or password.');

  if (!user || !user.isActive) throw invalidCredentials();

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.max(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000), 1);
    throw ApiError.forbidden(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const valid = await comparePassword(password, user.passwordHash);

  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw invalidCredentials();
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const token = signAdminToken(user);
  return sendSuccess(res, { token, user: serializeUser(user) });
});

/** GET /api/v1/admin/auth/me — used by the admin app to restore a session. */
const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: serializeUser(req.user) });
});

module.exports = { login, me };
