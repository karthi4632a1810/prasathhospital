'use strict';

const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { uploadDir } = require('../config/uploadPath');

// MIME type -> stored extension. The extension comes from here, never from
// the uploaded file's name, so "photo.html" sent as image/png is saved as
// .png and can't be served back as a web page.
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES[file.mimetype]) {
    cb(ApiError.badRequest('Only JPEG, PNG, WebP or SVG images are allowed.'));
    return;
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES, files: 1 } });

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'Images must be 5 MB or smaller.',
  LIMIT_FILE_COUNT: 'Upload one image at a time.',
  LIMIT_UNEXPECTED_FILE: 'Send the image in a form field named "file".',
};

/** multer.single('file') with its errors mapped to clear 400 responses. */
function uploadSingleImage(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(ApiError.badRequest(MULTER_MESSAGES[err.code] || 'The upload could not be processed.'));
    }
    return next(err);
  });
}

module.exports = { uploadSingleImage, ALLOWED_TYPES };
