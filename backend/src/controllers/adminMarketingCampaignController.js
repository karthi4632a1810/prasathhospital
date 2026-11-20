'use strict';

const mongoose = require('mongoose');
const MarketingCampaign = require('../models/MarketingCampaign');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const {
  runMarketingCampaign,
  pauseMarketingJob,
  resumeMarketingJob,
  cancelMarketingJob,
  getAllLiveJobs,
} = require('../services/marketingCampaignRunner');
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
  const event =
    (await Event.findOne({ status: { $ne: 'draft' } }).lean()) ||
    (await Event.findOne().lean());
  if (!event || !event.agenda || !event.agenda.length) {
    return sendSuccess(res, { sessions: [] });
  }

  const sessions = [];
  event.agenda.forEach((day, dayIdx) => {
    const dayLabel = day.label || `Day ${dayIdx + 1}`;
    const dayDate = day.date
      ? new Date(day.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      : '';

    (day.items || []).forEach((item, itemIdx) => {
      sessions.push({
        id: item._id ? String(item._id) : `day${dayIdx + 1}_item${itemIdx + 1}`,
        dayIndex: dayIdx,
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
 * GET /api/v1/admin/marketing-campaigns/live-monitor
 * Comprehensive live monitoring status: running jobs, scheduled queue, and today's summary.
 */
const getLiveMonitor = asyncHandler(async (req, res) => {
  // 1. In-memory active running jobs with real-time speed, ETA, and recent logs
  const activeJobs = getAllLiveJobs();

  // 2. Upcoming scheduled campaigns from MongoDB
  const scheduledCampaigns = await MarketingCampaign.find({
    status: 'SCHEDULED',
  })
    .sort({ scheduledFor: 1 })
    .select('-recipients')
    .lean();

  // Calculate countdown seconds for each scheduled campaign
  const nowMs = Date.now();
  const scheduledWithCountdown = scheduledCampaigns.map((c) => {
    const targetMs = c.scheduledFor ? new Date(c.scheduledFor).getTime() : nowMs;
    const diffSeconds = Math.max(0, Math.round((targetMs - nowMs) / 1000));
    return {
      ...c,
      countdownSeconds: diffSeconds,
    };
  });

  // 3. Recently completed or running campaigns in MongoDB
  const recentCampaigns = await MarketingCampaign.find({
    status: { $in: ['COMPLETED', 'RUNNING', 'FAILED'] },
  })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('-recipients')
    .lean();

  // 4. Aggregate counters for summary metrics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalDispatchedToday, totalScheduled] = await Promise.all([
    MarketingCampaign.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, totalSent: { $sum: '$sentCount' }, totalFailed: { $sum: '$failedCount' } } },
    ]),
    MarketingCampaign.countDocuments({ status: 'SCHEDULED' }),
  ]);

  return sendSuccess(res, {
    activeJobs,
    scheduledCampaigns: scheduledWithCountdown,
    recentCampaigns,
    summary: {
      activeWorkersCount: activeJobs.length,
      scheduledCount: totalScheduled,
      totalSentToday: totalDispatchedToday[0]?.totalSent || 0,
      totalFailedToday: totalDispatchedToday[0]?.totalFailed || 0,
    },
    serverTime: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/admin/marketing-campaigns/schedule-all-sessions
 * Automatically creates timed scheduled campaigns for ALL sessions of tomorrow (or target day).
 */
const scheduleAllSessions = asyncHandler(async (req, res) => {
  const {
    targetDate = '2026-11-21', // Tomorrow (Day 1)
    dayIndex = 0,
    leadTimeMinutes = 15,
    channels = ['whatsapp', 'email'],
    templateId = 'ciim_session_approve_1',
    customMessage = '',
  } = req.body;

  const event =
    (await Event.findOne({ status: { $ne: 'draft' } }).lean()) ||
    (await Event.findOne().lean());
  if (!event || !event.agenda || !event.agenda[dayIndex]) {
    throw ApiError.badRequest('Event agenda day not found.');
  }

  const selectedDay = event.agenda[dayIndex];
  const sessions = (selectedDay.items || []).filter(
    (item) => item.type === 'session' || !item.type || item.type === 'keynote'
  );

  if (!sessions.length) {
    throw ApiError.badRequest('No scientific sessions found for this day.');
  }

  // Fetch all confirmed attendees
  const confirmedRegistrations = await Registration.find({ status: 'confirmed' })
    .select('registrationCode attendee')
    .lean();

  if (!confirmedRegistrations.length) {
    throw ApiError.badRequest('No confirmed registrations found to schedule for.');
  }

  const mappedRecipients = confirmedRegistrations.map((r) => ({
    registrationId: r._id,
    registrationCode: r.registrationCode,
    name: r.attendee?.name || 'Delegate',
    phone: r.attendee?.phone || '',
    email: r.attendee?.email || '',
    whatsappStatus: channels.includes('whatsapp') ? 'PENDING' : 'SKIPPED',
    emailStatus: channels.includes('email') ? 'PENDING' : 'SKIPPED',
  }));

  const createdCampaigns = [];
  const now = new Date();

  for (const session of sessions) {
    // Parse start time (e.g. "08:30")
    const [hh, mm] = (session.startTime || '09:00').split(':').map((v) => parseInt(v, 10) || 0);

    // Build session datetime in IST (+05:30)
    // targetDate is 'YYYY-MM-DD'
    const sessionDateObj = new Date(`${targetDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);

    // Subtract lead time
    let scheduledTime = new Date(sessionDateObj.getTime() - leadTimeMinutes * 60 * 1000);

    // If scheduled time has already passed relative to server time, set to 1 minute in future
    if (scheduledTime <= now) {
      scheduledTime = new Date(now.getTime() + 60 * 1000);
    }

    const sessionDateFormatted = sessionDateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const campaign = await MarketingCampaign.create({
      campaignName: `Session: ${session.title} (${session.startTime})`,
      tab: 'session_approve',
      templateId: templateId.trim() || 'ciim_session_approve_1',
      channels,
      scheduleMode: 'scheduled',
      scheduledFor: scheduledTime,
      sessionDetails: {
        sessionTitle: session.title,
        sessionTime: `${session.startTime} - ${session.endTime || ''}`,
        sessionDate: sessionDateFormatted,
        speakerNames: session.speakerNames || [],
        track: session.track || 'Main Auditorium',
      },
      whatsappOptions: {
        templateName: templateId.trim() || 'ciim_session_approve_1',
      },
      emailOptions: {
        subject: `CIIM 2026: Session Schedule Details - ${session.title}`,
        customMessage: customMessage || `Session starts at ${session.startTime} in ${session.track || 'Main Auditorium'}.`,
      },
      status: 'SCHEDULED',
      totalRecipients: mappedRecipients.length,
      sentCount: 0,
      failedCount: 0,
      recipients: mappedRecipients,
      dispatchedBy: req.user?._id || null,
      dispatcherName: req.user?.name || 'Staff',
    });

    createdCampaigns.push({
      id: campaign._id,
      title: campaign.campaignName,
      sessionTitle: session.title,
      startTime: session.startTime,
      scheduledFor: scheduledTime,
      recipientsCount: mappedRecipients.length,
    });
  }

  return sendSuccess(res, {
    count: createdCampaigns.length,
    scheduledCampaigns: createdCampaigns,
    message: `Successfully scheduled all ${createdCampaigns.length} sessions for tomorrow (${targetDate}) with a ${leadTimeMinutes}-minute lead time!`,
  });
});

/**
 * POST /api/v1/admin/marketing-campaigns/campaigns/:id/launch-now
 * Force-launches a scheduled campaign immediately without waiting for timer.
 */
const launchScheduledCampaignNow = asyncHandler(async (req, res) => {
  const campaign = await MarketingCampaign.findById(req.params.id);
  if (!campaign) {
    throw ApiError.notFound('Campaign not found');
  }

  if (campaign.status === 'COMPLETED') {
    throw ApiError.badRequest('Campaign is already completed.');
  }

  campaign.scheduleMode = 'immediate';
  campaign.scheduledFor = new Date();
  campaign.status = 'RUNNING';
  campaign.startedAt = new Date();
  await campaign.save();

  runMarketingCampaign(campaign._id).catch(() => { });

  return sendSuccess(res, {
    message: `Campaign "${campaign.campaignName}" launched immediately!`,
    campaign,
  });
});

/**
 * POST /api/v1/admin/marketing-campaigns/campaigns/:id/pause
 */
const pauseCampaign = asyncHandler(async (req, res) => {
  const ok = pauseMarketingJob(req.params.id);
  const campaign = await MarketingCampaign.findById(req.params.id);
  if (campaign) {
    campaign.status = 'PAUSED';
    await campaign.save();
  }
  return sendSuccess(res, { success: ok, message: 'Campaign execution paused.' });
});

/**
 * POST /api/v1/admin/marketing-campaigns/campaigns/:id/resume
 */
const resumeCampaign = asyncHandler(async (req, res) => {
  const ok = resumeMarketingJob(req.params.id);
  const campaign = await MarketingCampaign.findById(req.params.id);
  if (campaign) {
    campaign.status = 'RUNNING';
    await campaign.save();
  }
  return sendSuccess(res, { success: ok, message: 'Campaign execution resumed.' });
});

/**
 * POST /api/v1/admin/marketing-campaigns/send
 * Creates and dispatches or schedules an individual campaign.
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

  const title =
    campaignName?.trim() ||
    (tab === 'session_approve' ? 'Session Schedule Campaign' : 'Delegate Reminder Campaign');

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
    runMarketingCampaign(campaign._id).catch(() => { });
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
  cancelMarketingJob(req.params.id);
  const campaign = await MarketingCampaign.findById(req.params.id);
  if (!campaign) {
    throw ApiError.notFound('Campaign not found');
  }

  if (campaign.status === 'COMPLETED') {
    throw ApiError.badRequest('Cannot cancel an already completed campaign.');
  }

  campaign.status = 'CANCELLED';
  await campaign.save();

  return sendSuccess(res, { message: 'Campaign cancelled successfully', campaign });
});

module.exports = {
  getRecipients,
  getSessions,
  getLiveMonitor,
  scheduleAllSessions,
  launchScheduledCampaignNow,
  pauseCampaign,
  resumeCampaign,
  createAndDispatchCampaign,
  listCampaigns,
  getCampaignDetails,
  cancelCampaign,
};
