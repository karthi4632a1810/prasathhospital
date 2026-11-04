'use strict';

const TopicQuestion = require('../models/TopicQuestion');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { toCsv } = require('../utils/csv');

/**
 * GET /api/v1/admin/topic-questions
 * Query: { search, topic, status }
 */
const listTopicQuestions = asyncHandler(async (req, res) => {
  const { search, topic, status } = req.query;

  const filter = {};

  if (status && ['pending', 'shortlisted', 'addressed', 'archived'].includes(status)) {
    filter.status = status;
  }

  if (topic) {
    filter['questions.topic'] = topic;
  }

  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { doctorName: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { phone: { $regex: s, $options: 'i' } },
      { hospital: { $regex: s, $options: 'i' } },
      { city: { $regex: s, $options: 'i' } },
      { delegateId: { $regex: s, $options: 'i' } },
      { 'questions.question': { $regex: s, $options: 'i' } },
      { 'questions.targetFaculty': { $regex: s, $options: 'i' } },
    ];
  }

  const [items, totalRecords] = await Promise.all([
    TopicQuestion.find(filter).sort({ createdAt: -1 }).lean(),
    TopicQuestion.countDocuments({}),
  ]);

  // Compute breakdown stats across all questions
  const allRecords = await TopicQuestion.find({}).select('questions status').lean();

  const topicCounts = {
    'Thin Endometrium': 0,
    'Low Ovarian Reserve & Exosomes': 0,
    'Recurrent Implantation Failure': 0,
    'Recurrent Pregnancy Loss': 0,
    'Adenomyosis & Fertility': 0,
  };

  let totalQuestionsCount = 0;
  let shortlistedCount = 0;

  allRecords.forEach((doc) => {
    if (doc.status === 'shortlisted') shortlistedCount++;
    (doc.questions || []).forEach((q) => {
      totalQuestionsCount++;
      if (topicCounts[q.topic] !== undefined) {
        topicCounts[q.topic]++;
      }
    });
  });

  return sendSuccess(res, items, {
    meta: {
      totalDoctors: totalRecords,
      filteredDoctors: items.length,
      totalQuestions: totalQuestionsCount,
      shortlistedCount,
      topicCounts,
    },
  });
});

/**
 * PATCH /api/v1/admin/topic-questions/:id
 * Body: { status, moderatorNotes }
 */
const updateTopicQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, moderatorNotes } = req.body || {};

  const updates = {};
  if (status && ['pending', 'shortlisted', 'addressed', 'archived'].includes(status)) {
    updates.status = status;
  }
  if (typeof moderatorNotes === 'string') {
    updates.moderatorNotes = moderatorNotes.trim().slice(0, 1000);
  }

  const doc = await TopicQuestion.findByIdAndUpdate(id, { $set: updates }, { new: true });
  if (!doc) throw ApiError.notFound('Submission not found.');

  return sendSuccess(res, doc);
});

/**
 * GET /api/v1/admin/topic-questions/export
 * Downloads all submitted questions as a clean CSV spreadsheet.
 */
const exportTopicQuestionsCsv = asyncHandler(async (_req, res) => {
  const records = await TopicQuestion.find({}).sort({ createdAt: -1 }).lean();

  // Flatten submissions into 1 row per question
  const flatRows = [];
  records.forEach((doc) => {
    (doc.questions || []).forEach((q, idx) => {
      flatRows.push({
        refId: String(doc._id).slice(-6).toUpperCase(),
        doctorName: doc.doctorName,
        phone: doc.phone,
        email: doc.email,
        hospital: doc.hospital || '',
        city: doc.city || '',
        delegateId: doc.delegateId || '',
        questionIndex: idx + 1,
        topic: q.topic,
        question: q.question,
        targetFaculty: q.targetFaculty || 'Any Faculty',
        clinicalCase: q.clinicalCase || '',
        status: doc.status || 'pending',
        submittedAt: doc.createdAt ? new Date(doc.createdAt).toLocaleString('en-IN') : '',
      });
    });
  });

  const columns = [
    { key: 'refId', label: 'Ref ID' },
    { key: 'doctorName', label: 'Doctor Name' },
    { key: 'phone', label: 'Mobile / WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'hospital', label: 'Hospital / Clinic' },
    { key: 'city', label: 'City' },
    { key: 'delegateId', label: 'Delegate ID' },
    { key: 'topic', label: 'Topic' },
    { key: 'question', label: 'Clinical Question' },
    { key: 'targetFaculty', label: 'Target Faculty' },
    { key: 'clinicalCase', label: 'Case Context' },
    { key: 'status', label: 'Status' },
    { key: 'submittedAt', label: 'Submitted Date & Time' },
  ];

  const csvData = toCsv(flatRows, columns);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ciim2026-doctor-questions-${Date.now()}.csv"`);
  return res.status(200).send(csvData);
});

/**
 * DELETE /api/v1/admin/topic-questions/:id
 * Deletes the entire submission (with all its questions).
 */
const deleteTopicQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await TopicQuestion.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound('Submission not found.');

  return sendSuccess(res, { message: 'Submission deleted successfully.', id });
});

/**
 * DELETE /api/v1/admin/topic-questions/:id/questions/:questionId
 * Deletes an individual question from a doctor's submission.
 */
const deleteSingleQuestion = asyncHandler(async (req, res) => {
  const { id, questionId } = req.params;
  const doc = await TopicQuestion.findById(id);
  if (!doc) throw ApiError.notFound('Submission not found.');

  const originalLength = doc.questions.length;
  doc.questions = doc.questions.filter((q) => String(q._id) !== String(questionId));

  if (doc.questions.length === originalLength) {
    throw ApiError.notFound('Question not found in this submission.');
  }

  // If no questions remain, remove the entire submission document
  if (doc.questions.length === 0) {
    await TopicQuestion.findByIdAndDelete(id);
    return sendSuccess(res, {
      message: 'Last question removed; submission deleted.',
      deletedSubmission: true,
      id,
    });
  }

  await doc.save();
  return sendSuccess(res, {
    message: 'Question deleted successfully.',
    deletedSubmission: false,
    doc,
  });
});

module.exports = {
  listTopicQuestions,
  updateTopicQuestion,
  exportTopicQuestionsCsv,
  deleteTopicQuestion,
  deleteSingleQuestion,
};

