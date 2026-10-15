'use strict';

const { Types } = require('mongoose');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');

/** GET /api/v1/admin/feedback?event=<eventId> */
const listFeedback = asyncHandler(async (req, res) => {
  if (!req.query.event) throw ApiError.badRequest('An "event" id is required.');
  if (!Types.ObjectId.isValid(String(req.query.event))) throw ApiError.badRequest('Invalid event id.');

  const [feedback, avgAgg] = await Promise.all([
    Feedback.find({ event: req.query.event })
      .populate('registration', 'registrationCode attendee')
      .sort({ createdAt: -1 }),
    Feedback.aggregate([
      { $match: { event: new Types.ObjectId(String(req.query.event)) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  return sendSuccess(res, feedback, {
    meta: { average: avgAgg[0]?.avg ? Math.round(avgAgg[0].avg * 10) / 10 : null, count: avgAgg[0]?.count || 0 },
  });
});

module.exports = { listFeedback };
