'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CampaignRecipientSchema = new Schema(
  {
    registrationId: { type: Schema.Types.ObjectId, ref: 'Registration', default: null },
    registrationCode: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: 'Delegate' },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    whatsappStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    emailStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    whatsappMessageId: { type: String, default: null },
    emailMessageId: { type: String, default: null },
    whatsappError: { type: String, default: null },
    emailError: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  { _id: true }
);

const MarketingCampaignSchema = new Schema(
  {
    campaignName: { type: String, trim: true, required: true },
    tab: {
      type: String,
      enum: ['delegate_reminder', 'session_approve'],
      default: 'delegate_reminder',
      index: true,
    },
    templateId: { type: String, required: true, trim: true },
    channels: [{ type: String, enum: ['whatsapp', 'email'] }],
    scheduleMode: {
      type: String,
      enum: ['immediate', 'scheduled'],
      default: 'immediate',
      index: true,
    },
    scheduledFor: { type: Date, default: null, index: true },
    sessionDetails: {
      sessionTitle: { type: String, trim: true, default: '' },
      sessionTime: { type: String, trim: true, default: '' },
      sessionDate: { type: String, trim: true, default: '' },
      speakerNames: [{ type: String, trim: true }],
      track: { type: String, trim: true, default: '' },
    },
    whatsappOptions: {
      templateName: { type: String, trim: true, default: '' },
      headerImageUrl: { type: String, trim: true, default: '' },
      customParams: { type: Schema.Types.Mixed, default: {} },
    },
    emailOptions: {
      subject: { type: String, trim: true, default: '' },
      customMessage: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: ['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    recipients: [CampaignRecipientSchema],
    dispatchedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dispatcherName: { type: String, trim: true, default: 'Admin' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MarketingCampaignSchema.index({ createdAt: -1 });
MarketingCampaignSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model('MarketingCampaign', MarketingCampaignSchema);
