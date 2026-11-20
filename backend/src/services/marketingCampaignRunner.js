'use strict';

const MarketingCampaign = require('../models/MarketingCampaign');
const { sendWhatsAppTemplate, normalizePhone } = require('./whatsapp/client');
const { sendMail } = require('./email/mailer');
const {
  buildDelegateReminderEmail,
  buildSessionApprovalEmail,
} = require('./email/marketingEmails');
const logger = require('../utils/logger');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// In-memory active campaign jobs registry for real-time live monitoring
const activeMarketingJobs = new Map();

/**
 * Builds body params for WATI template dispatch
 */
function buildWatiParams(campaign, recipient) {
  const cleanName = String(recipient.name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';
  const params = [
    { name: 'Name', value: cleanName },
    { name: 'DrName', value: cleanName },
    { name: '1', value: cleanName },
  ];

  if (campaign.sessionDetails?.sessionTitle) {
    params.push({ name: 'Session', value: campaign.sessionDetails.sessionTitle });
    params.push({ name: '2', value: campaign.sessionDetails.sessionTitle });
  }
  if (campaign.sessionDetails?.sessionTime) {
    params.push({ name: 'Time', value: campaign.sessionDetails.sessionTime });
    params.push({ name: '3', value: campaign.sessionDetails.sessionTime });
  }
  if (campaign.sessionDetails?.sessionDate) {
    params.push({ name: 'Date', value: campaign.sessionDetails.sessionDate });
  }

  // Merge any custom params from options
  if (campaign.whatsappOptions?.customParams) {
    Object.entries(campaign.whatsappOptions.customParams).forEach(([k, v]) => {
      params.push({ name: k, value: String(v || '') });
    });
  }

  return params;
}

/**
 * Calculates current execution statistics (speed, ETA, percentages)
 */
function getJobProgressSnapshot(job) {
  const processed = job.processedCount || (job.sentCount + job.failedCount);
  const total = Math.max(1, job.totalRecipients);
  const percentage = Math.min(100, Math.round((processed / total) * 1000) / 10);
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - job.startedAt.getTime()) / 1000));
  const speed = processed > 0 ? Math.round((processed / elapsedSeconds) * 10) / 10 : 0;
  const remainingCount = Math.max(0, job.totalRecipients - processed);
  const etaSeconds = speed > 0 ? Math.ceil(remainingCount / speed) : Math.ceil(remainingCount * 0.1);

  return {
    campaignId: String(job.campaignId),
    campaignName: job.campaignName,
    tab: job.tab,
    channels: job.channels,
    templateId: job.templateId,
    sessionDetails: job.sessionDetails,
    status: job.status,
    totalRecipients: job.totalRecipients,
    processedCount: processed,
    sentCount: job.sentCount,
    failedCount: job.failedCount,
    whatsappSentCount: job.whatsappSentCount || 0,
    emailSentCount: job.emailSentCount || 0,
    percentage,
    speed,
    etaSeconds,
    elapsedSeconds,
    recentLogs: (job.recentLogs || []).slice(-20),
  };
}

/**
 * Dispatches an approved marketing campaign across WhatsApp and/or Email.
 */
async function runMarketingCampaign(campaignId) {
  const campaign = await MarketingCampaign.findById(campaignId);
  if (!campaign || ['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
    return;
  }

  campaign.status = 'RUNNING';
  campaign.startedAt = campaign.startedAt || new Date();
  await campaign.save();

  const sendWhatsApp = campaign.channels.includes('whatsapp');
  const sendEmail = campaign.channels.includes('email');

  let sentCount = campaign.sentCount || 0;
  let failedCount = campaign.failedCount || 0;
  let whatsappSentCount = campaign.recipients.filter(r => r.whatsappStatus === 'SENT').length;
  let emailSentCount = campaign.recipients.filter(r => r.emailStatus === 'SENT').length;

  // Register in-memory job for Live Monitor
  const job = {
    campaignId: campaign._id,
    campaignName: campaign.campaignName,
    tab: campaign.tab,
    channels: campaign.channels,
    templateId: campaign.templateId,
    sessionDetails: campaign.sessionDetails,
    status: 'RUNNING',
    totalRecipients: campaign.totalRecipients || campaign.recipients.length,
    sentCount,
    failedCount,
    whatsappSentCount,
    emailSentCount,
    startedAt: campaign.startedAt,
    recentLogs: [],
    isPaused: false,
    isCancelled: false,
  };
  activeMarketingJobs.set(String(campaign._id), job);

  for (let i = 0; i < campaign.recipients.length; i++) {
    // Check if cancelled externally
    if (job.isCancelled) {
      campaign.status = 'CANCELLED';
      await campaign.save();
      activeMarketingJobs.delete(String(campaign._id));
      return;
    }

    // Check if paused
    while (job.isPaused) {
      await sleep(1000);
      if (job.isCancelled) {
        campaign.status = 'CANCELLED';
        await campaign.save();
        activeMarketingJobs.delete(String(campaign._id));
        return;
      }
    }

    const recipient = campaign.recipients[i];
    const waAlreadySent = recipient.whatsappStatus === 'SENT';
    const emailAlreadySent = recipient.emailStatus === 'SENT';

    if ((!sendWhatsApp || waAlreadySent) && (!sendEmail || emailAlreadySent)) {
      continue;
    }

    let waSuccess = waAlreadySent;
    let emailSuccess = emailAlreadySent;

    // 1. WhatsApp Dispatch
    if (sendWhatsApp && !waAlreadySent) {
      try {
        const phone = normalizePhone(recipient.phone);
        const watiParams = buildWatiParams(campaign, recipient);
        const templateName = campaign.templateId || 'ciim_delegate_reminder_1';

        const res = await sendWhatsAppTemplate({
          to: phone,
          name: templateName,
          bodyParams: watiParams,
        });
        if (res.sent) {
          recipient.whatsappStatus = 'SENT';
          recipient.whatsappMessageId = res.messageId || 'sent';
          recipient.whatsappError = null;
          waSuccess = true;
          whatsappSentCount++;
        } else {
          recipient.whatsappStatus = 'FAILED';
          recipient.whatsappError = res.error || 'Failed to send WhatsApp';
        }
      } catch (err) {
        recipient.whatsappStatus = 'FAILED';
        recipient.whatsappError = err.message || 'WhatsApp dispatch error';
      }
    }

    // 2. Email Dispatch
    if (sendEmail && !emailAlreadySent) {
      if (!recipient.email) {
        recipient.emailStatus = 'SKIPPED';
        recipient.emailError = 'No email address registered';
      } else {
        try {
          let emailContent;
          if (campaign.tab === 'session_approve') {
            emailContent = buildSessionApprovalEmail({
              name: recipient.name,
              sessionTitle: campaign.sessionDetails?.sessionTitle || 'Conference Session',
              sessionTime: campaign.sessionDetails?.sessionTime || '',
              sessionDate: campaign.sessionDetails?.sessionDate || '',
              speakerNames: campaign.sessionDetails?.speakerNames || [],
              track: campaign.sessionDetails?.track || 'Main Auditorium',
              customMessage: campaign.emailOptions?.customMessage || '',
            });
          } else {
            emailContent = buildDelegateReminderEmail({
              name: recipient.name,
              sessionTitle: campaign.sessionDetails?.sessionTitle || '',
              customMessage: campaign.emailOptions?.customMessage || '',
            });
          }

          const mailRes = await sendMail({
            to: recipient.email,
            subject: campaign.emailOptions?.subject || emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });

          if (mailRes.sent) {
            recipient.emailStatus = 'SENT';
            recipient.emailMessageId = mailRes.messageId || 'sent';
            recipient.emailError = null;
            emailSuccess = true;
            emailSentCount++;
          } else {
            recipient.emailStatus = 'FAILED';
            recipient.emailError = mailRes.error || 'Email dispatch failed';
          }
        } catch (err) {
          recipient.emailStatus = 'FAILED';
          recipient.emailError = err.message || 'Email dispatch error';
        }
      }
    }

    recipient.sentAt = new Date();

    const anySuccess = (sendWhatsApp && waSuccess) || (sendEmail && emailSuccess);
    const allSuccess = (!sendWhatsApp || waSuccess) && (!sendEmail || emailSuccess);

    if (anySuccess) {
      sentCount++;
    } else {
      failedCount++;
    }

    job.sentCount = sentCount;
    job.failedCount = failedCount;
    job.whatsappSentCount = whatsappSentCount;
    job.emailSentCount = emailSentCount;

    // Append to live monitoring stream
    job.recentLogs.push({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      name: recipient.name,
      phone: recipient.phone,
      email: recipient.email,
      whatsappStatus: recipient.whatsappStatus,
      whatsappError: recipient.whatsappError,
      emailStatus: recipient.emailStatus,
      emailError: recipient.emailError,
      success: allSuccess || anySuccess,
    });
    if (job.recentLogs.length > 50) {
      job.recentLogs.shift();
    }

    // Lightweight atomic count update to MongoDB every 25 recipients (avoids sending 420KB recipients payload repeatedly)
    if (i % 25 === 0 || i === campaign.recipients.length - 1) {
      MarketingCampaign.updateOne(
        { _id: campaign._id },
        { $set: { sentCount, failedCount } }
      ).catch(() => { });
    }

    await sleep(40);
  }

  await MarketingCampaign.updateOne(
    { _id: campaign._id },
    {
      $set: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sentCount,
        failedCount,
        recipients: campaign.recipients,
      },
    }
  );

  job.status = 'COMPLETED';

  // Keep finished job in memory for 5 minutes so users see completion stats
  setTimeout(() => {
    activeMarketingJobs.delete(String(campaignId));
  }, 5 * 60 * 1000);

  logger.info(
    `[MarketingCampaign] Completed campaign ${campaign.campaignName} (${campaign._id}): ${sentCount} sent, ${failedCount} failed.`
  );
}

/**
 * Control functions for active jobs
 */
function pauseMarketingJob(campaignId) {
  const job = activeMarketingJobs.get(String(campaignId));
  if (job) {
    job.isPaused = true;
    job.status = 'PAUSED';
    return true;
  }
  return false;
}

function resumeMarketingJob(campaignId) {
  const job = activeMarketingJobs.get(String(campaignId));
  if (job) {
    job.isPaused = false;
    job.status = 'RUNNING';
    return true;
  }
  return false;
}

function cancelMarketingJob(campaignId) {
  const job = activeMarketingJobs.get(String(campaignId));
  if (job) {
    job.isCancelled = true;
    job.status = 'CANCELLED';
    return true;
  }
  return false;
}

function getLiveJobSnapshot(campaignId) {
  const job = activeMarketingJobs.get(String(campaignId));
  if (!job) return null;
  return getJobProgressSnapshot(job);
}

function getAllLiveJobs() {
  const list = [];
  for (const job of activeMarketingJobs.values()) {
    list.push(getJobProgressSnapshot(job));
  }
  return list;
}

/**
 * Background scheduler checking for pending campaigns every 15 seconds.
 */
let schedulerStarted = false;
function startMarketingScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info('[MarketingCampaign] Scheduler initialized (15s interval).');

  setInterval(async () => {
    try {
      const now = new Date();
      const dueCampaigns = await MarketingCampaign.find({
        status: 'SCHEDULED',
        scheduledFor: { $lte: now },
      }).limit(5);

      for (const campaign of dueCampaigns) {
        logger.info(
          `[MarketingCampaign] Triggering scheduled campaign: ${campaign.campaignName} (${campaign._id})`
        );
        campaign.status = 'RUNNING';
        await campaign.save();
        runMarketingCampaign(campaign._id).catch((err) => {
          logger.error(`[MarketingCampaign] Execution error for ${campaign._id}`, err);
        });
      }
    } catch (err) {
      logger.error('[MarketingCampaign] Scheduler check failed', err);
    }
  }, 15000).unref();
}

module.exports = {
  runMarketingCampaign,
  startMarketingScheduler,
  pauseMarketingJob,
  resumeMarketingJob,
  cancelMarketingJob,
  getLiveJobSnapshot,
  getAllLiveJobs,
};
