'use strict';

const express = require('express');
const {
  getMarketingConfig,
  getCampaigns,
  getCampaignById,
  deleteCampaign,
  sendTestSingle,
  resendSingle,
  sendBatch,
  checkStatuses,
} = require('../controllers/adminWhatsAppMarketingController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('superadmin', 'manager'));

router.get('/config', getMarketingConfig);
router.get('/campaigns', getCampaigns);
router.get('/campaigns/:id', getCampaignById);
router.delete('/campaigns/:id', deleteCampaign);

router.post('/test-single', sendTestSingle);
router.post('/resend-single', resendSingle);
router.post('/send-batch', sendBatch);
router.post('/check-statuses', checkStatuses);

module.exports = router;
