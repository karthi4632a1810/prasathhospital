'use strict';

const Upload = require('../models/Upload');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { ALLOWED_TYPES } = require('../middleware/upload');

/**
 * POST /api/v1/admin/uploads — stores the image in MongoDB and returns the
 * relative URL the CMS saves on the image field: /uploads/<id>.<ext>.
 */
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded.');
  const doc = await Upload.create({
    data: req.file.buffer,
    contentType: req.file.mimetype,
    size: req.file.size,
    originalName: String(req.file.originalname || '').slice(0, 200),
    uploadedBy: req.user?._id || null,
  });
  return sendSuccess(res, { url: `/uploads/${doc._id}${ALLOWED_TYPES[req.file.mimetype]}` }, { status: 201 });
});

// Same lock-down as the static mount: images only, never executable.
function setSafeHeaders(res) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
}

/**
 * GET /uploads/<id>.<ext> — serves an image stored by uploadImage. Anything
 * that isn't a stored-upload name falls through to the legacy disk mount.
 * Ids never change content, so responses are cached for a year.
 */
const serveStoredUpload = asyncHandler(async (req, res, next) => {
  const match = /^\/([a-f0-9]{24})\.(jpg|png|webp|svg)$/.exec(req.path);
  if (!match) return next();
  const doc = await Upload.findById(match[1]).lean();
  if (!doc) return next();
  // .lean() hands back the BSON Binary wrapper; its .buffer is the bytes.
  const bytes = Buffer.from(doc.data.buffer ?? doc.data);
  setSafeHeaders(res);
  res.set('Content-Type', doc.contentType);
  res.set('Content-Length', String(bytes.length));
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  return res.end(bytes);
});

module.exports = { uploadImage, serveStoredUpload, setSafeHeaders };
