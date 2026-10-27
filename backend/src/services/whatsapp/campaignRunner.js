'use strict';

const WhatsAppCampaign = require('../../models/WhatsAppCampaign');
const { sendWhatsAppTemplate, normalizePhone } = require('./client');
const env = require('../../config/env');
const logger = require('../../utils/logger');

// In-memory active campaign jobs registry
const activeJobs = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds WATI template parameters dynamically for a recipient
 */
function buildBodyParams(templateName, { name, extra, customParamsValues = {}, imageUrl, templateObj }) {
  const cleanName = String(name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';
  let extraParamValue = extra || '';
  if (extraParamValue && extraParamValue.startsWith('http')) {
    extraParamValue = `\u2028${extraParamValue.trim()}\u2028`;
  }

  if (templateName === 'ciim2026_invite') {
    return [
      { name: 'Name', value: cleanName },
      { name: '1', value: cleanName },
    ];
  }

  const paramsList = [];
  const addedKeys = new Set();

  const addParam = (k, v) => {
    if (!addedKeys.has(k)) {
      addedKeys.add(k);
      paramsList.push({ name: String(k), value: String(v ?? '') });
    }
  };

  if (
    templateObj?.hasHeaderMedia ||
    ['ciim2026_registration_thankyou_02', 'ciim2026_registration_5', 'ciim2026_registration_thankyou', 'ciim2026_registration_4', 'ciim2026_registration_1'].includes(templateName)
  ) {
    const finalImg = imageUrl || 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg';
    addParam('img', finalImg);
    addParam('qr', finalImg);
    addParam('QR', finalImg);
  }

  const declaredParams = templateObj?.params || ['Name', 'extra'];
  declaredParams.forEach((paramKey, idx) => {
    const lower = paramKey.toLowerCase();
    let val = '';

    if (customParamsValues[paramKey] !== undefined && customParamsValues[paramKey] !== '') {
      val = customParamsValues[paramKey];
    } else if (lower.includes('name') || lower === 'drname' || lower === 'delegate') {
      val = cleanName;
    } else if (lower.includes('extra') || lower.includes('ticket') || lower.includes('link') || lower.includes('notes')) {
      val = extraParamValue || '...';
    } else {
      val = customParamsValues[paramKey] || '';
    }

    addParam(paramKey, val);
    addParam(String(idx + 1), val);
  });

  addParam('Name', cleanName);
  addParam('DrName', cleanName);
  addParam('1', cleanName);
  if (extraParamValue) {
    addParam('extra', extraParamValue);
    addParam('2', extraParamValue);
  }

  return paramsList;
}

/**
 * Calculates current execution statistics (speed, ETA, percentages)
 */
function getJobProgressSnapshot(job) {
  const processed = job.processedCount;
  const total = Math.max(1, job.total);
  const percentage = Math.min(100, Math.round((processed / total) * 1000) / 10);
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - job.startedAt.getTime()) / 1000));
  const speed = processed > 0 ? Math.round((processed / elapsedSeconds) * 10) / 10 : 0;
  const remainingCount = Math.max(0, job.total - processed);
  const etaSeconds = speed > 0 ? Math.ceil(remainingCount / speed) : Math.ceil(remainingCount * 0.3);

  return {
    campaignId: job.id,
    templateName: job.templateName,
    title: job.title,
    status: job.status,
    total: job.total,
    processedCount: processed,
    sentCount: job.sentCount,
    deliveredCount: job.deliveredCount,
    readCount: job.readCount,
    failedCount: job.failedCount,
    pendingCount: remainingCount,
    percentage,
    speed,
    etaSeconds,
    elapsedSeconds,
    currentRecipient: job.currentRecipient,
    recentLogs: job.recentLogs.slice(-40),
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

/**
 * Broadcasts an event to all SSE listeners connected to this campaign
 */
function broadcastJobEvent(job, eventType, data) {
  if (!job.sseClients || job.sseClients.size === 0) return;
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of job.sseClients) {
    try {
      client.write(payload);
    } catch {
      job.sseClients.delete(client);
    }
  }
}

/**
 * Flushes in-memory progress to MongoDB Atlas
 */
async function flushJobToDatabase(job, recipientsData) {
  try {
    const updatePayload = {
      status: job.status,
      total: job.total,
      sentCount: job.sentCount,
      deliveredCount: job.deliveredCount,
      readCount: job.readCount,
      failedCount: job.failedCount,
    };
    if (job.status === 'COMPLETED' || job.status === 'STOPPED') {
      updatePayload.completedAt = job.completedAt || new Date();
    }
    if (recipientsData && recipientsData.length > 0) {
      updatePayload.recipients = recipientsData;
    }

    await WhatsAppCampaign.findByIdAndUpdate(job.id, { $set: updatePayload });
  } catch (err) {
    logger.warn(`Failed to flush campaign ${job.id} to MongoDB: ${err.message}`);
  }
}

/**
 * The main asynchronous 1-by-1 message dispatcher loop
 */
async function runCampaignLoop(job, recipients, templateObj) {
  logger.info(`[CampaignRunner] Starting broadcast loop for campaign ${job.id}: ${recipients.length} recipients`);
  const recipientsDataForDb = [...(job.recipientsState || [])];

  let unpersistedCount = 0;

  for (let i = job.currentIndex; i < recipients.length; i++) {
    job.currentIndex = i;

    // Check if stopped
    if (job.status === 'STOPPED') {
      logger.info(`[CampaignRunner] Campaign ${job.id} was stopped by admin at row ${i + 1}`);
      break;
    }

    // Handle paused state
    while (job.status === 'PAUSED') {
      await sleep(400);
      if (job.status === 'STOPPED') break;
    }
    if (job.status === 'STOPPED') break;

    const item = recipients[i];
    const originalRowIndex = item.rowIndex !== undefined ? item.rowIndex : i + 1;
    const recipientName = item.name ? String(item.name).trim() : 'Delegate';
    const rawPhone = item.phone ? String(item.phone).trim() : '';
    const normalizedPhone = normalizePhone(rawPhone);
    const extraVal =
      item.extra !== undefined && item.extra !== null && item.extra !== '' ? String(item.extra).trim() : (job.globalExtra || '');

    // Set currently sending recipient
    job.currentRecipient = {
      rowIndex: originalRowIndex,
      name: recipientName,
      phone: rawPhone,
      normalizedPhone,
      status: 'SENDING',
      time: new Date(),
    };
    broadcastJobEvent(job, 'SENDING', { recipient: job.currentRecipient });

    // Validate phone number
    if (!normalizedPhone || normalizedPhone.length < 10) {
      job.failedCount++;
      job.processedCount++;
      const failItem = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone: '',
        sent: false,
        status: 'FAILED',
        error: 'Invalid or missing phone number',
        sentAt: new Date(),
        params: item.params || {},
      };
      recipientsDataForDb[i] = failItem;
      job.recentLogs.push({
        ...failItem,
        time: new Date(),
      });
      broadcastJobEvent(job, 'PROGRESS', getJobProgressSnapshot(job));
      unpersistedCount++;
      continue;
    }

    const customParamsValues = {
      ...(job.globalParams || {}),
      ...(item.params || {}),
      ...(item.originalData || {}),
    };

    const bodyParams = buildBodyParams(job.templateName, {
      name: recipientName,
      extra: extraVal,
      customParamsValues,
      imageUrl: job.headerImageUrl,
      templateObj,
    });

    let sendResult = { sent: false, error: 'Unknown' };
    try {
      sendResult = await sendWhatsAppTemplate({
        to: normalizedPhone,
        name: job.templateName,
        language: env.whatsappTemplateLanguage || 'en_GB',
        bodyParams,
      });
    } catch (err) {
      sendResult = { sent: false, error: err.message || 'Network exception during send' };
    }

    job.processedCount++;

    if (sendResult.sent) {
      job.sentCount++;
      const successItem = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone,
        sent: true,
        status: 'SENT',
        messageId: sendResult.messageId || 'wati_sent',
        broadcastId: sendResult.broadcastId || null,
        error: null,
        sentAt: new Date(),
        params: customParamsValues,
      };
      recipientsDataForDb[i] = successItem;
      job.currentRecipient = { ...successItem, status: 'SENT', time: new Date() };
      job.recentLogs.push({ ...successItem, time: new Date() });
    } else {
      job.failedCount++;
      const failItem = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone,
        sent: false,
        status: 'FAILED',
        error: sendResult.error || sendResult.reason || 'WATI API rejected message',
        sentAt: new Date(),
        params: customParamsValues,
      };
      recipientsDataForDb[i] = failItem;
      job.currentRecipient = { ...failItem, status: 'FAILED', time: new Date() };
      job.recentLogs.push({ ...failItem, time: new Date() });
    }

    // Keep recentLogs trimmed to last 60 items
    if (job.recentLogs.length > 80) {
      job.recentLogs = job.recentLogs.slice(-60);
    }

    // Notify connected SSE listeners
    broadcastJobEvent(job, 'PROGRESS', getJobProgressSnapshot(job));

    unpersistedCount++;
    // Persist to MongoDB in chunks of 15 or on last element
    if (unpersistedCount >= 15 || i === recipients.length - 1) {
      await flushJobToDatabase(job, recipientsDataForDb);
      unpersistedCount = 0;
    }

    // Throttle interval between messages (safe 1-by-1 sending)
    if (i < recipients.length - 1 && job.throttleMs > 0) {
      await sleep(job.throttleMs);
    }
  }

  // Completion
  if (job.status !== 'STOPPED') {
    job.status = 'COMPLETED';
    job.completedAt = new Date();
  }

  await flushJobToDatabase(job, recipientsDataForDb);
  logger.info(
    `[CampaignRunner] Finished broadcast for campaign ${job.id}: ${job.sentCount} sent, ${job.failedCount} failed (${job.status})`
  );

  broadcastJobEvent(job, 'COMPLETED', getJobProgressSnapshot(job));

  // Auto-close SSE streams after sending completion event
  setTimeout(() => {
    if (job.sseClients) {
      for (const client of job.sseClients) {
        try {
          client.end();
        } catch {
          // Ignore
        }
      }
      job.sseClients.clear();
    }
  }, 3000);
}

/**
 * Starts a new background broadcast campaign
 */
function startCampaign({
  campaignId,
  title,
  templateName,
  headerImageUrl,
  recipients,
  templateObj,
  globalParams = {},
  globalExtra = '',
  throttleMs = 100,
}) {
  const idStr = campaignId.toString();

  // If already running, return existing
  if (activeJobs.has(idStr)) {
    const existing = activeJobs.get(idStr);
    if (existing.status === 'RUNNING' || existing.status === 'PAUSED') {
      return getJobProgressSnapshot(existing);
    }
  }

  const job = {
    id: idStr,
    campaignId,
    title,
    templateName,
    headerImageUrl,
    globalParams,
    globalExtra,
    throttleMs: typeof throttleMs === 'number' ? Math.max(40, throttleMs) : 100,
    status: 'RUNNING',
    total: recipients.length,
    processedCount: 0,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    currentIndex: 0,
    currentRecipient: null,
    startedAt: new Date(),
    completedAt: null,
    recentLogs: [],
    recipientsState: recipients.map((r, idx) => ({
      rowIndex: r.rowIndex !== undefined ? r.rowIndex : idx + 1,
      name: r.name || 'Delegate',
      phone: r.phone || '',
      normalizedPhone: normalizePhone(r.phone),
      status: 'PENDING',
      error: null,
    })),
    sseClients: new Set(),
  };

  activeJobs.set(idStr, job);

  // Launch async runner non-blocking
  runCampaignLoop(job, recipients, templateObj).catch((err) => {
    logger.error(`[CampaignRunner] Fatal error in campaign ${idStr}:`, err);
    job.status = 'FAILED';
    broadcastJobEvent(job, 'ERROR', { error: err.message });
    flushJobToDatabase(job, job.recipientsState).catch(() => {});
  });

  return getJobProgressSnapshot(job);
}

/**
 * Retrieves real-time status of a campaign
 */
async function getJobStatus(campaignId) {
  const idStr = campaignId.toString();
  if (activeJobs.has(idStr)) {
    return getJobProgressSnapshot(activeJobs.get(idStr));
  }

  // Not in active memory: fetch from MongoDB Atlas
  const campaign = await WhatsAppCampaign.findById(campaignId).lean();
  if (!campaign) return null;

  const total = campaign.total || campaign.recipients?.length || 0;
  const processed = (campaign.sentCount || 0) + (campaign.failedCount || 0);

  return {
    campaignId: campaign._id,
    templateName: campaign.templateName,
    title: campaign.title,
    status: campaign.status || (processed >= total && total > 0 ? 'COMPLETED' : 'IDLE'),
    total,
    processedCount: processed,
    sentCount: campaign.sentCount || 0,
    deliveredCount: campaign.deliveredCount || 0,
    readCount: campaign.readCount || 0,
    failedCount: campaign.failedCount || 0,
    pendingCount: Math.max(0, total - processed),
    percentage: total > 0 ? Math.min(100, Math.round((processed / total) * 1000) / 10) : 0,
    speed: 0,
    etaSeconds: 0,
    elapsedSeconds: 0,
    currentRecipient: null,
    recentLogs: (campaign.recipients || [])
      .filter((r) => r.status && r.status !== 'PENDING')
      .slice(-30)
      .map((r) => ({
        rowIndex: r.rowIndex,
        name: r.name,
        phone: r.phone || r.normalizedPhone,
        status: r.status,
        messageId: r.messageId,
        error: r.error,
        time: r.sentAt,
      })),
    startedAt: campaign.createdAt,
    completedAt: campaign.completedAt || campaign.updatedAt,
  };
}

/**
 * Pauses an ongoing campaign
 */
async function pauseCampaign(campaignId) {
  const idStr = campaignId.toString();
  if (activeJobs.has(idStr)) {
    const job = activeJobs.get(idStr);
    job.status = 'PAUSED';
    broadcastJobEvent(job, 'STATUS_CHANGE', { status: 'PAUSED' });
    await WhatsAppCampaign.findByIdAndUpdate(campaignId, { status: 'PAUSED' });
    return getJobProgressSnapshot(job);
  }
  await WhatsAppCampaign.findByIdAndUpdate(campaignId, { status: 'PAUSED' });
  return { campaignId, status: 'PAUSED' };
}

/**
 * Resumes a paused campaign
 */
async function resumeCampaign(campaignId, templatesList = []) {
  const idStr = campaignId.toString();
  if (activeJobs.has(idStr)) {
    const job = activeJobs.get(idStr);
    job.status = 'RUNNING';
    broadcastJobEvent(job, 'STATUS_CHANGE', { status: 'RUNNING' });
    await WhatsAppCampaign.findByIdAndUpdate(campaignId, { status: 'RUNNING' });
    return getJobProgressSnapshot(job);
  }

  // If server restarted or job dropped from memory, resume from DB pending recipients
  const camp = await WhatsAppCampaign.findById(campaignId);
  if (!camp) throw new Error('Campaign not found to resume.');

  const pendingRecipients = camp.recipients.filter((r) => r.status === 'PENDING');
  if (pendingRecipients.length === 0) {
    camp.status = 'COMPLETED';
    await camp.save();
    return { campaignId, status: 'COMPLETED', message: 'All recipients already completed.' };
  }

  const templateObj = (templatesList || []).find((t) => t.name === camp.templateName);
  camp.status = 'RUNNING';
  await camp.save();

  return startCampaign({
    campaignId: camp._id,
    title: camp.title,
    templateName: camp.templateName,
    headerImageUrl: camp.headerImageUrl,
    recipients: pendingRecipients.map((r) => r.toObject()),
    templateObj,
    throttleMs: 100,
  });
}

/**
 * Stops an active campaign
 */
async function stopCampaign(campaignId) {
  const idStr = campaignId.toString();
  if (activeJobs.has(idStr)) {
    const job = activeJobs.get(idStr);
    job.status = 'STOPPED';
    job.completedAt = new Date();
    broadcastJobEvent(job, 'STATUS_CHANGE', { status: 'STOPPED' });
    await flushJobToDatabase(job, job.recipientsState);
    return getJobProgressSnapshot(job);
  }
  await WhatsAppCampaign.findByIdAndUpdate(campaignId, { status: 'STOPPED', completedAt: new Date() });
  return { campaignId, status: 'STOPPED' };
}

/**
 * Connects an HTTP response as an SSE client
 */
function subscribeToJobStream(campaignId, req, res) {
  const idStr = campaignId.toString();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(': sse connected\n\n');

  let job = activeJobs.get(idStr);
  if (job) {
    job.sseClients.add(res);
    // Send immediate snapshot
    res.write(`event: INITIAL_STATE\ndata: ${JSON.stringify(getJobProgressSnapshot(job))}\n\n`);
  } else {
    // If job not active in memory, send DB snapshot
    getJobStatus(campaignId).then((snapshot) => {
      if (snapshot) {
        res.write(`event: INITIAL_STATE\ndata: ${JSON.stringify(snapshot)}\n\n`);
        if (snapshot.status === 'COMPLETED' || snapshot.status === 'STOPPED') {
          res.write(`event: COMPLETED\ndata: ${JSON.stringify(snapshot)}\n\n`);
          res.end();
        }
      }
    });
  }

  // Heartbeat every 15s to keep proxy/gateway connection alive
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    if (job && job.sseClients) {
      job.sseClients.delete(res);
    }
  });
}

/**
 * Syncs delivery status for a campaign from WATI
 */
async function syncCampaignDelivery(campaignId) {
  const campaign = await WhatsAppCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found.');

  const baseUrl = (env.watiBaseUrl || '').replace(/\/$/, '');
  const token = env.watiAccessToken
    ? (env.watiAccessToken.startsWith('Bearer ') ? env.watiAccessToken : `Bearer ${env.watiAccessToken}`)
    : '';

  if (!baseUrl || !token) {
    return { syncedCount: 0, message: 'WATI credentials not configured.' };
  }

  // Check sent recipients that haven't been marked READ yet
  const targets = campaign.recipients.filter((r) => r.status === 'SENT' || r.status === 'DELIVERED');
  if (targets.length === 0) {
    return {
      syncedCount: 0,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      message: 'All sent recipients already up-to-date.',
    };
  }

  let updatedCount = 0;
  const chunkLimit = Math.min(targets.length, 60);

  for (let i = 0; i < chunkLimit; i += 6) {
    const chunk = targets.slice(i, i + 6);
    await Promise.all(
      chunk.map(async (rec) => {
        const norm = rec.normalizedPhone || normalizePhone(rec.phone);
        if (!norm) return;
        try {
          const resp = await fetch(`${baseUrl}/api/v1/getMessages/${norm}?pageSize=3`, {
            headers: { Authorization: token },
            signal: AbortSignal.timeout(5000),
          });
          if (resp.ok) {
            const data = await resp.json();
            const msgs = data.messages?.items || data.messages || [];
            const latestMsg = msgs.find((m) => m.statusString) || msgs[0];
            if (latestMsg && latestMsg.statusString) {
              const raw = String(latestMsg.statusString).toUpperCase();
              let newStatus = rec.status;
              if (raw === 'READ') newStatus = 'READ';
              else if (raw === 'DELIVERED' && rec.status !== 'READ') newStatus = 'DELIVERED';
              else if (raw === 'FAILED') newStatus = 'FAILED';

              if (newStatus !== rec.status) {
                rec.status = newStatus;
                if (newStatus === 'READ') {
                  rec.readAt = new Date();
                  if (!rec.deliveredAt) rec.deliveredAt = rec.readAt;
                } else if (newStatus === 'DELIVERED') {
                  rec.deliveredAt = new Date();
                }
                updatedCount++;
              }
            }
          }
        } catch {
          // Continue on network errors
        }
      })
    );
  }

  campaign.deliveredCount = campaign.recipients.filter((r) => ['DELIVERED', 'READ'].includes(r.status)).length;
  campaign.readCount = campaign.recipients.filter((r) => r.status === 'READ').length;
  campaign.sentCount = campaign.recipients.filter((r) => ['SENT', 'DELIVERED', 'READ'].includes(r.status)).length;
  campaign.failedCount = campaign.recipients.filter((r) => r.status === 'FAILED').length;
  await campaign.save();

  // If in active memory, sync counters
  const idStr = campaignId.toString();
  if (activeJobs.has(idStr)) {
    const job = activeJobs.get(idStr);
    job.deliveredCount = campaign.deliveredCount;
    job.readCount = campaign.readCount;
    broadcastJobEvent(job, 'DELIVERY_UPDATE', getJobProgressSnapshot(job));
  }

  return {
    syncedCount: updatedCount,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
  };
}

/**
 * The asynchronous 1-by-1 retry loop for failed recipients
 */
async function runRetryLoop(job, failedRecipients, templateObj) {
  logger.info(`[CampaignRunner] Starting 1-by-1 retry loop for campaign ${job.id}: ${failedRecipients.length} failed recipients`);

  const campaignDoc = await WhatsAppCampaign.findById(job.id);
  if (!campaignDoc) {
    logger.error(`[CampaignRunner] Campaign ${job.id} not found for retry.`);
    job.status = 'FAILED';
    return;
  }

  let unpersistedCount = 0;

  for (let i = job.currentIndex; i < failedRecipients.length; i++) {
    job.currentIndex = i;

    if (job.status === 'STOPPED') break;

    while (job.status === 'PAUSED') {
      await sleep(400);
      if (job.status === 'STOPPED') break;
    }
    if (job.status === 'STOPPED') break;

    const item = failedRecipients[i];
    const originalRowIndex = item.rowIndex !== undefined ? item.rowIndex : i + 1;
    const recipientName = item.name ? String(item.name).trim() : 'Delegate';
    const rawPhone = item.phone ? String(item.phone).trim() : '';
    const normalizedPhone = normalizePhone(rawPhone);
    const extraVal =
      item.extra !== undefined && item.extra !== null && item.extra !== ''
        ? String(item.extra).trim()
        : (job.globalExtra || '');

    job.currentRecipient = {
      rowIndex: originalRowIndex,
      name: recipientName,
      phone: rawPhone,
      normalizedPhone,
      status: 'SENDING',
      time: new Date(),
    };
    broadcastJobEvent(job, 'SENDING', { recipient: job.currentRecipient });

    if (!normalizedPhone || normalizedPhone.length < 10) {
      job.failedCount++;
      job.processedCount++;
      const failLog = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone: '',
        sent: false,
        status: 'FAILED',
        error: 'Invalid or missing phone number',
        sentAt: new Date(),
      };
      job.recentLogs.push({ ...failLog, time: new Date() });
      broadcastJobEvent(job, 'PROGRESS', getJobProgressSnapshot(job));
      unpersistedCount++;
      continue;
    }

    const customParamsValues = {
      ...(job.globalParams || {}),
      ...(item.params || {}),
      ...(item.originalData || {}),
    };

    const bodyParams = buildBodyParams(job.templateName, {
      name: recipientName,
      extra: extraVal,
      customParamsValues,
      imageUrl: job.headerImageUrl,
      templateObj,
    });

    let sendResult = { sent: false, error: 'Unknown' };
    try {
      sendResult = await sendWhatsAppTemplate({
        to: normalizedPhone,
        name: job.templateName,
        language: env.whatsappTemplateLanguage || 'en_GB',
        bodyParams,
      });
    } catch (err) {
      sendResult = { sent: false, error: err.message || 'Network exception during resend' };
    }

    job.processedCount++;

    // Locate recipient in the live campaign document
    const docItem =
      (item._id && typeof campaignDoc.recipients.id === 'function' ? campaignDoc.recipients.id(item._id) : null) ||
      campaignDoc.recipients.find(
        (r) =>
          (item._id && String(r._id) === String(item._id)) ||
          r.rowIndex === originalRowIndex ||
          (r.phone === rawPhone && r.status === 'FAILED') ||
          (r.normalizedPhone === normalizedPhone && r.status === 'FAILED')
      );

    if (sendResult.sent) {
      job.sentCount++;
      if (docItem) {
        docItem.status = 'SENT';
        docItem.messageId = sendResult.messageId || 'wati_sent';
        docItem.broadcastId = sendResult.broadcastId || docItem.broadcastId || null;
        docItem.error = null;
        docItem.sentAt = new Date();
      }
      const successLog = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone,
        sent: true,
        status: 'SENT',
        messageId: sendResult.messageId || 'wati_sent',
        error: null,
      };
      job.currentRecipient = { ...successLog, time: new Date() };
      job.recentLogs.push({ ...successLog, time: new Date() });
    } else {
      job.failedCount++;
      if (docItem) {
        docItem.status = 'FAILED';
        docItem.error = sendResult.error || sendResult.reason || 'WATI API rejected message';
        docItem.sentAt = new Date();
      }
      const failLog = {
        rowIndex: originalRowIndex,
        name: recipientName,
        phone: rawPhone,
        normalizedPhone,
        sent: false,
        status: 'FAILED',
        error: sendResult.error || sendResult.reason || 'WATI API rejected message',
      };
      job.currentRecipient = { ...failLog, time: new Date() };
      job.recentLogs.push({ ...failLog, time: new Date() });
    }

    if (job.recentLogs.length > 80) {
      job.recentLogs = job.recentLogs.slice(-60);
    }

    broadcastJobEvent(job, 'PROGRESS', getJobProgressSnapshot(job));

    unpersistedCount++;
    if (unpersistedCount >= 8 || i === failedRecipients.length - 1) {
      try {
        campaignDoc.sentCount = campaignDoc.recipients.filter((r) =>
          ['SENT', 'DELIVERED', 'READ'].includes(r.status)
        ).length;
        campaignDoc.deliveredCount = campaignDoc.recipients.filter((r) =>
          ['DELIVERED', 'READ'].includes(r.status)
        ).length;
        campaignDoc.readCount = campaignDoc.recipients.filter((r) => r.status === 'READ').length;
        campaignDoc.failedCount = campaignDoc.recipients.filter((r) => r.status === 'FAILED').length;
        await campaignDoc.save();
      } catch (err) {
        logger.warn(`Failed to persist retry batch to DB: ${err.message}`);
      }
      unpersistedCount = 0;
    }

    if (i < failedRecipients.length - 1 && job.throttleMs > 0) {
      await sleep(job.throttleMs);
    }
  }

  if (job.status !== 'STOPPED') {
    job.status = 'COMPLETED';
    job.completedAt = new Date();
  }

  try {
    campaignDoc.sentCount = campaignDoc.recipients.filter((r) =>
      ['SENT', 'DELIVERED', 'READ'].includes(r.status)
    ).length;
    campaignDoc.deliveredCount = campaignDoc.recipients.filter((r) =>
      ['DELIVERED', 'READ'].includes(r.status)
    ).length;
    campaignDoc.readCount = campaignDoc.recipients.filter((r) => r.status === 'READ').length;
    campaignDoc.failedCount = campaignDoc.recipients.filter((r) => r.status === 'FAILED').length;
    await campaignDoc.save();
  } catch (err) {
    logger.warn(`Failed final retry save: ${err.message}`);
  }

  logger.info(
    `[CampaignRunner] Finished 1-by-1 retry for campaign ${job.id}: ${job.sentCount} sent, ${job.failedCount} still failed`
  );

  broadcastJobEvent(job, 'COMPLETED', getJobProgressSnapshot(job));
}

/**
 * Starts 1-by-1 retry for all failed recipients in a campaign
 */
async function retryFailedCampaign({ campaignId, templateObj, throttleMs = 120 }) {
  const idStr = campaignId.toString();

  // If already running
  if (activeJobs.has(idStr)) {
    const existing = activeJobs.get(idStr);
    if (existing.status === 'RUNNING' || existing.status === 'PAUSED') {
      return getJobProgressSnapshot(existing);
    }
  }

  const campaign = await WhatsAppCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found.');

  const failedRecipients = campaign.recipients.filter((r) => r.status === 'FAILED');
  if (failedRecipients.length === 0) {
    return {
      campaignId,
      status: 'COMPLETED',
      total: 0,
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      message: 'No failed recipients found to retry.',
    };
  }

  const job = {
    id: idStr,
    campaignId,
    title: `Retry Failed — ${campaign.title || campaign.templateName} (${failedRecipients.length} recipients)`,
    templateName: campaign.templateName,
    headerImageUrl: campaign.headerImageUrl,
    globalParams: campaign.globalParams || {},
    globalExtra: campaign.globalExtra || '',
    throttleMs: typeof throttleMs === 'number' ? Math.max(50, throttleMs) : 120,
    status: 'RUNNING',
    total: failedRecipients.length,
    processedCount: 0,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    currentIndex: 0,
    currentRecipient: null,
    startedAt: new Date(),
    completedAt: null,
    recentLogs: [],
    recipientsState: failedRecipients.map((r) => r.toObject()),
    sseClients: new Set(),
    isRetryJob: true,
  };

  activeJobs.set(idStr, job);

  // Launch non-blocking async 1-by-1 retry loop
  runRetryLoop(job, failedRecipients.map((r) => r.toObject()), templateObj).catch((err) => {
    logger.error(`[CampaignRunner] Error in retry loop ${idStr}:`, err);
    job.status = 'FAILED';
    broadcastJobEvent(job, 'ERROR', { error: err.message });
  });

  return getJobProgressSnapshot(job);
}

module.exports = {
  startCampaign,
  retryFailedCampaign,
  getJobStatus,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  subscribeToJobStream,
  syncCampaignDelivery,
  buildBodyParams,
};

