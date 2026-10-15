'use strict';

const AuditLog = require('../models/AuditLog');
const { sendSuccess, asyncHandler } = require('../utils/response');

/** GET /api/v1/admin/audit-log?page=&limit=&action=&entityType= */
const listAuditLog = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.action) filter.action = String(req.query.action);
  if (req.query.entityType) filter.entityType = String(req.query.entityType);

  const [entries, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return sendSuccess(res, entries, { meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
});

module.exports = { listAuditLog };
