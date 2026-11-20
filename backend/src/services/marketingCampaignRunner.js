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

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < campaign.recipients.length; i++) {
    const recipient = campaign.recipients[i];
    if (recipient.whatsappStatus === 'SENT' && recipient.emailStatus === 'SENT') {
      sentCount++;
      continue;
    }

    let overallSuccess = true;

    // 1. WhatsApp Dispatch
    if (sendWhatsApp && recipient.whatsappStatus !== 'SENT') {
      try {
        const phone = normalizePhone(recipient.phone);
        const watiParams = buildWatiParams(campaign, recipient);
        const templateName = campaign.templateId || 'ciim_delegate_reminder_1';

        const res = await sendWhatsAppTemplate(phone, templateName, watiParams);
        if (res.sent) {
          recipient.whatsappStatus = 'SENT';
          recipient.whatsappMessageId = res.messageId || 'sent';
          recipient.whatsappError = null;
        } else {
          recipient.whatsappStatus = 'FAILED';
          recipient.whatsappError = res.error || 'Failed to send WhatsApp';
          overallSuccess = false;
        }
      } catch (err) {
        recipient.whatsappStatus = 'FAILED';
        recipient.whatsappError = err.message || 'WhatsApp dispatch error';
        overallSuccess = false;
      }
    }

    // 2. Email Dispatch
    if (sendEmail && recipient.emailStatus !== 'SENT') {
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
          } else {
            recipient.emailStatus = 'FAILED';
            recipient.emailError = mailRes.error || 'Email dispatch failed';
            overallSuccess = false;
          }
        } catch (err) {
          recipient.emailStatus = 'FAILED';
          recipient.emailError = err.message || 'Email dispatch error';
          overallSuccess = false;
        }
      }
    }

    recipient.sentAt = new Date();

    if (overallSuccess) {
      sentCount++;
    } else {
      failedCount++;
    }

    // Periodic flush every 10 recipients
    if (i % 10 === 0 || i === campaign.recipients.length - 1) {
      campaign.sentCount = sentCount;
      campaign.failedCount = failedCount;
      await campaign.save().catch(() => {});
    }

    await sleep(40);
  }

  campaign.status = 'COMPLETED';
  campaign.completedAt = new Date();
  campaign.sentCount = sentCount;
  campaign.failedCount = failedCount;
  await campaign.save();

  logger.info(
    `[MarketingCampaign] Completed campaign ${campaign.campaignName} (${campaign._id}): ${sentCount} sent, ${failedCount} failed.`
  );
}

/**
 * Background scheduler checking for pending campaigns every 20 seconds.
 */
let schedulerStarted = false;
function startMarketingScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info('[MarketingCampaign] Scheduler initialized (20s interval).');

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
  }, 20000).unref();
}

module.exports = {
  runMarketingCampaign,
  startMarketingScheduler,
};
