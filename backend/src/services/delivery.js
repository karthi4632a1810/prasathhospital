'use strict';

const Registration = require('../models/Registration');
const { sendTicketEmail } = require('./email/ticketEmail');
const { sendTicketConfirmation } = require('./whatsapp/sendTicket');
const logger = require('../utils/logger');

/**
 * Ticket delivery over email and WhatsApp.
 *
 * The two channels are fully independent: each is attempted on its own,
 * a failure (or missing credentials) on one never affects the other, and
 * neither can fail the registration itself — new registrations dispatch
 * delivery in the background after the 201 response is sent.
 *
 * Every attempt updates `delivery.<channel>` (current state) and appends to
 * `deliveryLog` (history). A channel is only marked `sent` when the
 * provider accepted the message and returned an id.
 */

const CHANNELS = ['email', 'whatsapp'];
const MAX_LOG_ENTRIES = 50;

function trimError(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/** Maps a provider result to one of the delivery statuses. */
function classifyResult(channel, result) {
  if (result.sent) return { status: 'sent', error: '', providerMessageId: String(result.messageId || '') };
  if (result.reason === 'not_configured') {
    const what = channel === 'email' ? 'SMTP is not configured' : 'WhatsApp API credentials are not configured';
    return { status: 'not_configured', error: what, providerMessageId: '' };
  }

  let retryable;
  if (channel === 'email') {
    retryable = Boolean(result.retryable);
  } else {
    // Network errors, rate limits and Meta-side 5xx are transient; other 4xx
    // (bad number, template not approved) need someone to fix the cause.
    retryable = result.reason === 'network_error' || result.httpStatus === 429 || result.httpStatus >= 500;
  }
  return { status: retryable ? 'retryable' : 'failed', error: trimError(result.error || result.reason), providerMessageId: '' };
}

async function attemptChannel(channel, context) {
  try {
    const result = channel === 'email' ? await sendTicketEmail(context) : await sendTicketConfirmation(context);
    return classifyResult(channel, result);
  } catch (err) {
    // Rendering the PDF/QR or an unexpected bug — recorded, never thrown.
    logger.error(`Ticket ${channel} delivery threw for ${context.registration.registrationCode}`, err);
    return { status: 'retryable', error: trimError(err.message), providerMessageId: '' };
  }
}

async function recordOutcome(registrationId, channel, outcome, { trigger, actorName }) {
  const now = new Date();
  const set = {
    [`delivery.${channel}.status`]: outcome.status,
    [`delivery.${channel}.lastAttemptAt`]: now,
    [`delivery.${channel}.error`]: outcome.error,
  };
  if (outcome.status === 'sent') {
    set[`delivery.${channel}.sentAt`] = now;
    set[`delivery.${channel}.providerMessageId`] = outcome.providerMessageId;
  }

  await Registration.updateOne(
    { _id: registrationId },
    {
      $set: set,
      $inc: { [`delivery.${channel}.attempts`]: 1 },
      $push: {
        deliveryLog: {
          $each: [{ channel, status: outcome.status, at: now, error: outcome.error, providerMessageId: outcome.providerMessageId, trigger, actorName }],
          $slice: -MAX_LOG_ENTRIES,
        },
      },
    }
  );
}

/**
 * Attempts the given channels for one registration and records each
 * outcome. Returns `{ email?: outcome, whatsapp?: outcome }`.
 */
async function deliverTicket(registrationId, { channels = CHANNELS, trigger = 'auto', actorName = '' } = {}) {
  const reg = await Registration.findById(registrationId)
    .populate('event', 'title startDate endDate venue mode timezone')
    .populate('ticketType', 'name admitsCount')
    .populate('company', 'name');
  if (!reg || reg.status !== 'confirmed' || !reg.qrToken) return {};

  const context = {
    event: reg.event,
    ticketType: reg.ticketType,
    registration: reg,
    companyName: reg.company?.name || '',
  };

  const wanted = channels.filter((c) => CHANNELS.includes(c));
  const outcomes = await Promise.all(wanted.map((channel) => attemptChannel(channel, context)));

  const result = {};
  await Promise.all(
    wanted.map(async (channel, i) => {
      result[channel] = outcomes[i];
      try {
        await recordOutcome(reg._id, channel, outcomes[i], { trigger, actorName });
      } catch (err) {
        logger.error(`Could not record ${channel} delivery for ${reg.registrationCode}`, err);
      }
    })
  );
  return result;
}

/** Fire-and-forget delivery for a brand-new registration. */
function dispatchTicketDelivery(registrationId) {
  setImmediate(() => {
    deliverTicket(registrationId).catch((err) => logger.error('Ticket delivery dispatch failed', err));
  });
}

module.exports = { deliverTicket, dispatchTicketDelivery, classifyResult, CHANNELS };
