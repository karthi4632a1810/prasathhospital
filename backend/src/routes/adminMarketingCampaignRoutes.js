'use strict';

const express = require('express');
const {
  getRecipients,
  getSessions,
  createAndDispatchCampaign,
  listCampaigns,
  getCampaignDetails,
  cancelCampaign,
} = require('../controllers/adminMarketingCampaignController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('superadmin', 'manager', 'counter_staff'));

router.get('/recipients', getRecipients);
router.get('/sessions', getSessions);
router.get('/', listCampaigns);
router.get('/:id', getCampaignDetails);
router.post('/send', createAndDispatchCampaign);
router.post('/:id/cancel', cancelCampaign);

module.exports = router;
