'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { hashPassword } = require('../utils/password');
const { serializeUser } = require('../services/userSerializer');
const { recordAudit } = require('../services/auditLog');

const ROLES = ['superadmin', 'manager', 'checkin_staff'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters.');
  }
  if (password.length > 128) throw ApiError.badRequest('Password must be 128 characters or fewer.');
}

/** True if removing `user`'s superadmin powers would leave nobody able to manage users. */
async function isLastActiveSuperadmin(user) {
  if (user.role !== 'superadmin' || !user.isActive) return false;
  const others = await User.countDocuments({ _id: { $ne: user._id }, role: 'superadmin', isActive: true });
  return others === 0;
}

/** GET /api/v1/admin/users */
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  return sendSuccess(res, users.map(serializeUser));
});

/** POST /api/v1/admin/users */
const createUser = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  if (!name || !email || body.password === undefined) {
    throw ApiError.badRequest('Name, email and password are required.');
  }
  if (name.length > 120) throw ApiError.badRequest('Name must be 120 characters or fewer.');
  if (!EMAIL_RE.test(email)) throw ApiError.badRequest('Please enter a valid email address.');
  assertPassword(body.password);
  if (body.role !== undefined && !ROLES.includes(body.role)) throw ApiError.badRequest('Unknown role.');

  if (await User.exists({ email })) throw ApiError.conflict('A user with this email already exists.');

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(body.password),
    role: body.role || 'manager',
  });

  recordAudit(req, { action: 'user.create', entityType: 'User', entityId: user._id, meta: { email: user.email, role: user.role } });
  return sendSuccess(res, serializeUser(user), { status: 201 });
});

/** PATCH /api/v1/admin/users/:id */
const updateUser = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const isSelf = String(user._id) === String(req.user._id);

  if ('name' in body) {
    const name = text(body.name);
    if (!name || name.length > 120) throw ApiError.badRequest('Name is required (120 characters max).');
    user.name = name;
  }

  if ('role' in body && body.role !== user.role) {
    if (!ROLES.includes(body.role)) throw ApiError.badRequest('Unknown role.');
    if (isSelf) throw ApiError.badRequest('You cannot change your own role.');
    if (await isLastActiveSuperadmin(user)) throw ApiError.conflict('This is the only active superadmin. Promote someone else first.');
    user.role = body.role;
  }

  if ('isActive' in body) {
    const next = Boolean(body.isActive);
    if (!next && isSelf) throw ApiError.badRequest('You cannot deactivate your own account.');
    if (!next && (await isLastActiveSuperadmin(user))) throw ApiError.conflict('This is the only active superadmin and cannot be deactivated.');
    user.isActive = next;
  }

  if (body.newPassword !== undefined) {
    assertPassword(body.newPassword);
    user.passwordHash = await hashPassword(body.newPassword);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.passwordChangedAt = new Date();
  }

  await user.save();
  recordAudit(req, {
    action: 'user.update',
    entityType: 'User',
    entityId: user._id,
    // Never log the password itself — only whether one was reset.
    meta: { fields: Object.keys(body).filter((k) => k !== 'newPassword'), passwordReset: body.newPassword !== undefined },
  });
  return sendSuccess(res, serializeUser(user));
});

/** DELETE /api/v1/admin/users/:id */
const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (await isLastActiveSuperadmin(user)) throw ApiError.conflict('This is the only active superadmin and cannot be deleted.');
  await user.deleteOne();
  recordAudit(req, { action: 'user.delete', entityType: 'User', entityId: user._id, meta: { email: user.email } });
  return sendSuccess(res, null, { status: 200, message: 'User deleted' });
});

module.exports = { listUsers, createUser, updateUser, deleteUser };
