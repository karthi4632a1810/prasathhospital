'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/response');
const { verifyAdminToken } = require('../utils/jwt');

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * corresponding active user as `req.user`. Every /admin/* route sits behind
 * this. Kept as an asyncHandler-wrapped middleware so a lookup failure flows
 * through the same central error handler as everything else.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Sign in to continue.');
  }

  let payload;
  try {
    payload = verifyAdminToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Your session is no longer valid.');
  }
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw ApiError.unauthorized('Your password was changed. Please sign in again.');
  }

  req.user = user;
  next();
});

/** Restricts a route to one or more roles. Use after requireAuth. */
function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user) throw ApiError.unauthorized('Sign in to continue.');
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to do this.');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
