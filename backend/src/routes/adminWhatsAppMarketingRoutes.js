'use strict';

const express = require('express');
const {
  getMarketingConfig,
  sendTestSingle,
  sendBatch,
} = require('../controllers/adminWhatsAppMarketingController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('superadmin', 'manager'));

router.get('/config', getMarketingConfig);
router.post('/test-single', sendTestSingle);
router.post('/send-batch', sendBatch);

module.exports = router;
