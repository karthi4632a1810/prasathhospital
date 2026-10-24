'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const RecipientSchema = new Schema(
  {
    rowIndex: { type: Number, default: 0 },
    name: { type: String, trim: true, default: 'Delegate' },
    phone: { type: String, required: true, trim: true },
    normalizedPhone: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    messageId: { type: String, default: null },
    broadcastId: { type: String, default: null },
    error: { type: String, default: null },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const WhatsAppCampaignSchema = new Schema(
  {
    title: { type: String, trim: true, default: '' },
    templateName: { type: String, required: true, trim: true },
    channelNumber: { type: String, default: '919940030935' },
    headerImageUrl: { type: String, default: '' },
    total: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    recipients: [RecipientSchema],
    dispatchedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dispatcherName: { type: String, trim: true, default: 'Admin' },
  },
  { timestamps: true }
);

WhatsAppCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WhatsAppCampaign', WhatsAppCampaignSchema);
