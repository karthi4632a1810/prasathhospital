'use strict';

const mongoose = require('mongoose');
const MarketingCampaign = require('../models/MarketingCampaign');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { runMarketingCampaign } = require('../services/marketingCampaignRunner');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');

/**
 * GET /api/v1/admin/marketing-campaigns/recipients
 * Fetches all registered delegates eligible for marketing communications.
 */
const getRecipients = asyncHandler(async (req, res) => {
  const query = { status: { $ne: 'cancelled' } };

  if (req.query.q) {
    const searchRegex = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { 'attendee.name': searchRegex },
      { 'attendee.email': searchRegex },
      { 'attendee.phone': searchRegex },
      { registrationCode: searchRegex },
      { 'attendee.medicalCouncilRegNo': searchRegex },
    ];
  }

  const registrations = await Registration.find(query)
    .populate('ticketType', 'name code')
    .sort({ createdAt: 1 })
    .lean();

  const recipients = registrations.map((r, idx) => {
    const attendee = r.attendee || {};
    return {
      id: r._id,
      index: idx + 1,
      registrationCode: r.registrationCode,
      badgeNo: r.badgeNo || String(idx + 1).padStart(4, '0'),
      name: attendee.name || 'Delegate',
      phone: attendee.phone || '',
      email: attendee.email || '',
      ticketType: r.ticketType?.name || 'Delegate Pass',
      tnmcNumber: attendee.medicalCouncilRegNo || '',
      institution: attendee.institution || '',
      city: attendee.city || '',
      registeredAt: r.createdAt,
    };
  });

  return sendSuccess(res, {
    total: recipients.length,
    recipients,
  });
});

/**
 * GET /api/v1/admin/marketing-campaigns/sessions
 * Returns agenda sessions from active event.
 */
const getSessions = asyncHandler(async (req, res) => {
  const event = await Event.findOne({ status: { $ne: 'draft' } }).lean() || await Event.findOne().lean();
  if (!event || !event.agenda || !event.agenda.length) {
    return sendSuccess(res, { sessions: [] });
  }

  const sessions = [];
  event.agenda.forEach((day, dayIdx) => {
    const dayLabel = day.label || `Day ${dayIdx + 1}`;
    const dayDate = day.date ? new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    (day.items || []).forEach((item, itemIdx) => {
      sessions.push({
        id: item._id ? String(item._id) : `day${dayIdx + 1}_item${itemIdx + 1}`,
        dayLabel,
        dayDate,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        speakerNames: item.speakerNames || [],
        track: item.track || 'Main Auditorium',
        type: item.type || 'session',
        description: item.description || '',
      });
    });
  });

  return sendSuccess(res, {
    eventTitle: event.title,
    total: sessions.length,
    sessions,
  });
});

/**
 * POST /api/v1/admin/marketing-campaigns/send
 * Creates and dispatches or schedules a campaign.
 */
const createAndDispatchCampaign = asyncHandler(async (req, res) => {
  const {
    campaignName,
    tab = 'delegate_reminder',
    templateId = 'ciim_delegate_reminder_1',
    channels = ['whatsapp', 'email'],
    scheduleMode = 'immediate',
    scheduledFor = null,
    sessionDetails = {},
    whatsappOptions = {},
    emailOptions = {},
    recipients = [],
  } = req.body;

  if (!recipients || !recipients.length) {
    throw ApiError.badRequest('At least one recipient must be selected.');
  }

  if (!channels || !channels.length) {
    throw ApiError.badRequest('Please select at least one delivery channel (WhatsApp or Email).');
  }

  if (!templateId || !templateId.trim()) {
    throw ApiError.badRequest('Template ID is required.');
  }

  const title = campaignName?.trim() || (tab === 'session_approve' ? 'Session Schedule Campaign' : 'Delegate Reminder Campaign');

  const mappedRecipients = recipients.map((r) => ({
    registrationId: r.id && mongoose.isValidObjectId(r.id) ? r.id : null,
    registrationCode: r.registrationCode || '',
    name: r.name || 'Delegate',
    phone: r.phone || '',
    email: r.email || '',
    whatsappStatus: channels.includes('whatsapp') ? 'PENDING' : 'SKIPPED',
    emailStatus: channels.includes('email') ? 'PENDING' : 'SKIPPED',
  }));

  const isScheduled = scheduleMode === 'scheduled' && scheduledFor;
  const targetDate = isScheduled ? new Date(scheduledFor) : null;

  const campaign = await MarketingCampaign.create({
    campaignName: title,
    tab,
    templateId: templateId.trim(),
    channels,
    scheduleMode: isScheduled ? 'scheduled' : 'immediate',
    scheduledFor: targetDate,
    sessionDetails,
    whatsappOptions: {
      templateName: templateId.trim(),
      ...whatsappOptions,
    },
    emailOptions,
    status: isScheduled ? 'SCHEDULED' : 'RUNNING',
    totalRecipients: mappedRecipients.length,
    sentCount: 0,
    failedCount: 0,
    recipients: mappedRecipients,
    dispatchedBy: req.user?._id || null,
    dispatcherName: req.user?.name || 'Staff',
    startedAt: isScheduled ? null : new Date(),
  });

  if (!isScheduled) {
    runMarketingCampaign(campaign._id).catch(() => {});
  }

  return sendSuccess(res, {
    campaign,
    message: isScheduled
      ? `Campaign scheduled successfully for ${targetDate.toLocaleString('en-IN')}.`
      : 'Campaign dispatch started.',
  });
});

/**
 * GET /api/v1/admin/marketing-campaigns
 * Lists all marketing campaigns
 */
const listCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await MarketingCampaign.find()
    .select('-recipients')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return sendSuccess(res, { campaigns });
});

/**
 * GET /api/v1/admin/marketing-campaigns/:id
 * Gets full campaign details with recipients
 */
const getCampaignDetails = asyncHandler(async (req, res) => {
  const campaign = await MarketingCampaign.findById(req.params.id).lean();
  if (!campaign) {
    throw ApiError.notFound('Campaign not found');
  }
  return sendSuccess(res, { campaign });
});

/**
 * POST /api/v1/admin/marketing-campaigns/:id/cancel
 */
const cancelCampaign = asyncHandler(async (req, res) => {
  const campaign = await MarketingCampaign.findById(req.params.id);
  if (!campaign) {
    throw ApiError.notFound('Campaign not found');
  }

  if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
    throw ApiError.badRequest(`Cannot cancel campaign in ${campaign.status} status`);
  }

  campaign.status = 'CANCELLED';
  await campaign.save();

  return sendSuccess(res, { message: 'Campaign cancelled successfully', campaign });
});

module.exports = {
  getRecipients,
  getSessions,
  createAndDispatchCampaign,
  listCampaigns,
  getCampaignDetails,
  cancelCampaign,
};
