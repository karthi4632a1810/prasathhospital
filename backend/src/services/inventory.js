'use strict';

const TicketType = require('../models/TicketType');
const Event = require('../models/Event');

/**
 * MongoDB here runs as a single standalone node (see docker-compose.yml),
 * not a replica set, so multi-document ACID transactions aren't available.
 * Every function below is a single atomic findOneAndUpdate guarded by an
 * $expr capacity check instead — safe under concurrent requests for the
 * one field it touches, with the multi-step callers compensating (undoing
 * earlier steps) if a later step fails, rather than relying on a
 * cross-collection transaction.
 *
 * The 15-minute checkout holds that served the retired payment flow are
 * gone: every registration is now confirmed (and sold) immediately.
 */

/** +1 quantitySold, only if capacity allows (0 = unlimited). Returns true if the unit was taken. */
async function sellTicketDirect(ticketTypeId) {
  const result = await TicketType.findOneAndUpdate(
    {
      _id: ticketTypeId,
      $expr: {
        $or: [
          { $eq: ['$quantityTotal', 0] },
          { $lt: [{ $add: ['$quantitySold', '$quantityHeld'] }, '$quantityTotal'] },
        ],
      },
    },
    { $inc: { quantitySold: 1 } }
  );
  return Boolean(result);
}

/** -1 quantitySold (a confirmed registration was cancelled). */
async function releaseTicketSale(ticketTypeId) {
  await TicketType.updateOne({ _id: ticketTypeId, quantitySold: { $gt: 0 } }, { $inc: { quantitySold: -1 } });
}

/** -1 quantityHeld. Only used to unwind holds left over from the retired paid flow. */
async function releaseTicketHold(ticketTypeId) {
  await TicketType.updateOne({ _id: ticketTypeId, quantityHeld: { $gt: 0 } }, { $inc: { quantityHeld: -1 } });
}

/** +1 Event.registeredCount, only if capacity allows. Returns true if the seat was taken. */
async function takeEventSeat(eventId) {
  const result = await Event.findOneAndUpdate(
    {
      _id: eventId,
      $expr: { $or: [{ $eq: ['$capacity', 0] }, { $lt: ['$registeredCount', '$capacity'] }] },
    },
    { $inc: { registeredCount: 1 } }
  );
  return Boolean(result);
}

/** -1 Event.registeredCount (never below zero). */
async function releaseEventSeat(eventId) {
  await Event.updateOne({ _id: eventId, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } });
}

module.exports = {
  sellTicketDirect,
  releaseTicketSale,
  releaseTicketHold,
  takeEventSeat,
  releaseEventSeat,
};
