'use strict';

const express = require('express');
const {
  listTopicQuestions,
  updateTopicQuestion,
  exportTopicQuestionsCsv,
  deleteTopicQuestion,
  deleteSingleQuestion,
} = require('../controllers/adminTopicQuestionController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('superadmin', 'manager', 'counter_staff'), listTopicQuestions);
router.get('/export', requireAuth, requireRole('superadmin', 'manager', 'counter_staff'), exportTopicQuestionsCsv);
router.patch('/:id', requireAuth, requireRole('superadmin', 'manager', 'counter_staff'), updateTopicQuestion);
router.delete('/:id', requireAuth, requireRole('superadmin', 'manager', 'counter_staff'), deleteTopicQuestion);
router.delete('/:id/questions/:questionId', requireAuth, requireRole('superadmin', 'manager', 'counter_staff'), deleteSingleQuestion);

module.exports = router;

