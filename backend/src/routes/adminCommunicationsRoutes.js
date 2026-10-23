'use strict';

const express = require('express');
const {
  getCommunicationsConfig,
  sendTestWhatsAppMessage,
  sendTestEmail,
  previewEmail,
} = require('../controllers/adminCommunicationsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('superadmin', 'manager'));

router.get('/config', getCommunicationsConfig);
router.post('/whatsapp/test', sendTestWhatsAppMessage);
router.post('/email/test', sendTestEmail);
router.post('/email/preview', previewEmail);

module.exports = router;
