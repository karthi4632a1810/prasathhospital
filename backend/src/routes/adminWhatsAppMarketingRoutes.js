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
  getLiveProgress,
  getLiveStream,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  syncDelivery,
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

// Live one-by-one broadcast monitor and control routes
router.get('/campaigns/:id/live-progress', getLiveProgress);
router.get('/campaigns/:id/live-stream', getLiveStream);
router.post('/campaigns/:id/pause', pauseCampaign);
router.post('/campaigns/:id/resume', resumeCampaign);
router.post('/campaigns/:id/stop', stopCampaign);
router.post('/campaigns/:id/sync-delivery', syncDelivery);

router.post('/test-single', sendTestSingle);
router.post('/resend-single', resendSingle);
router.post('/send-batch', sendBatch);
router.post('/check-statuses', checkStatuses);

module.exports = router;

