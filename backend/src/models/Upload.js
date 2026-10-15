'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * A CMS image (speaker/committee photo, sponsor logo, hero image) stored in
 * MongoDB itself. Hosts like Render's free tier wipe the local disk on every
 * restart, so files written there vanish; the database is the one thing that
 * persists. Images are capped at 5 MB by the upload middleware, well under
 * MongoDB's 16 MB document limit.
 */
const UploadSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Upload', UploadSchema);
