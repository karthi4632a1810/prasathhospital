'use strict';

const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');

/**
 * POST /api/v1/feedback
 * Body: { qrToken, rating, comments }
 * qrToken (unguessable, only ever known to the ticket-holder) is the spam
 * gate — no separate auth needed, same pattern as the ticket routes.
 */
const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comments } = req.body || {};
  const qrToken = typeof req.body?.qrToken === 'string' ? req.body.qrToken.trim() : '';
  if (!qrToken) throw ApiError.badRequest('A ticket reference is required.');
  if (comments !== undefined && typeof comments !== 'string') throw ApiError.badRequest('Comments must be text.');
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw ApiError.badRequest('Rating must be a whole number from 1 to 5.');
  }

  if (!/^[a-f0-9]{48}$/i.test(qrToken)) throw ApiError.notFound('Ticket not found');
  const reg = await Registration.findOne({ qrToken });
  if (!reg) throw ApiError.notFound('Ticket not found');
  if (reg.status !== 'confirmed') {
    throw ApiError.conflict('Feedback can only be submitted for a confirmed registration.');
  }

  let feedback;
  try {
    feedback = await Feedback.create({
      event: reg.event,
      registration: reg._id,
      rating: ratingNum,
      comments: (comments || '').slice(0, 2000),
    });
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('You have already submitted feedback for this event.');
    }
    throw err;
  }

  return sendSuccess(res, { id: feedback._id, rating: feedback.rating }, { status: 201 });
});

module.exports = { submitFeedback };
