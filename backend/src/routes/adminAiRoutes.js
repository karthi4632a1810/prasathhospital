'use strict';

const express = require('express');
const {
  chat,
  downloadCertificate,
  downloadIdCard,
  downloadExcel,
} = require('../controllers/adminAiController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('superadmin', 'manager', 'counter_staff'));

router.post('/chat', chat);
router.get('/download/certificate', downloadCertificate);
router.get('/download/id-card', downloadIdCard);
router.get('/download/excel/:fileId', downloadExcel);

module.exports = router;
