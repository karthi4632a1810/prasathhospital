'use strict';

const express = require('express');
const {
  submitTopicQuestions,
  getTopicsMetadata,
} = require('../controllers/publicTopicQuestionController');

const router = express.Router();

router.post('/', submitTopicQuestions);
router.get('/topics', getTopicsMetadata);

module.exports = router;

