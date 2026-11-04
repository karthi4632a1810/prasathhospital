'use strict';

const TopicQuestion = require('../models/TopicQuestion');
const Event = require('../models/Event');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');

const VALID_TOPICS = [
  'Thin Endometrium',
  'Low Ovarian Reserve & Exosomes',
  'Recurrent Implantation Failure',
  'Recurrent Pregnancy Loss',
  'Adenomyosis & Fertility',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{9,15}$/;

/**
 * POST /api/v1/topic-questions
 * Body: {
 *   doctorName,
 *   email,
 *   phone,
 *   hospital,
 *   city,
 *   delegateId,
 *   eventSlug,
 *   questions: [
 *     { topic, question, targetFaculty, clinicalCase }
 *   ]
 * }
 */
const submitTopicQuestions = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const doctorName = String(body.doctorName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').replace(/[\s()-]/g, '');
  const hospital = String(body.hospital || '').trim();
  const city = String(body.city || '').trim();
  const delegateId = String(body.delegateId || '').trim();
  const eventSlug = String(body.eventSlug || '').trim();

  if (!doctorName || doctorName.length < 2) {
    throw ApiError.badRequest('Please provide the doctor’s full name.');
  }

  if (!email || !EMAIL_RE.test(email)) {
    throw ApiError.badRequest('Please provide a valid email address.');
  }

  if (!phone || !PHONE_RE.test(phone)) {
    throw ApiError.badRequest('Please enter a valid phone or WhatsApp number (10 to 15 digits).');
  }

  const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
  if (rawQuestions.length === 0) {
    throw ApiError.badRequest('Please submit at least one clinical question.');
  }

  const cleanedQuestions = [];
  for (const item of rawQuestions) {
    const topic = String(item.topic || '').trim();
    const questionText = String(item.question || '').trim();
    const targetFaculty = String(item.targetFaculty || 'Any Faculty / Open Panel').trim();
    const clinicalCase = String(item.clinicalCase || '').trim();

    if (!VALID_TOPICS.includes(topic)) {
      throw ApiError.badRequest(`Invalid topic: "${topic}". Please select from the 5 supported topics.`);
    }

    if (!questionText || questionText.length < 5) {
      throw ApiError.badRequest(`Question text under "${topic}" is too short. Please provide a detailed question.`);
    }

    cleanedQuestions.push({
      topic,
      question: questionText.slice(0, 2000),
      targetFaculty: targetFaculty.slice(0, 120),
      clinicalCase: clinicalCase.slice(0, 2000),
    });
  }

  let eventId = null;
  if (eventSlug) {
    const ev = await Event.findOne({ slug: eventSlug }).select('_id').lean();
    if (ev) eventId = ev._id;
  }

  const record = await TopicQuestion.create({
    event: eventId,
    doctorName,
    email,
    phone,
    hospital,
    city,
    delegateId,
    questions: cleanedQuestions,
    status: 'pending',
  });

  return sendSuccess(
    res,
    {
      id: record._id,
      totalQuestions: cleanedQuestions.length,
      topics: [...new Set(cleanedQuestions.map((q) => q.topic))],
      message: 'Your questions have been successfully submitted to the scientific committee.',
    },
    { status: 201 }
  );
});

/**
 * GET /api/v1/topic-questions/topics
 * Returns the list of standard topics and sample prompt questions.
 */
const getTopicsMetadata = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    topics: VALID_TOPICS,
  });
});

module.exports = {
  submitTopicQuestions,
  getTopicsMetadata,
};

