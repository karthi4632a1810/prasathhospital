'use strict';

const express = require('express');
const {
  chat,
  downloadCertificate,
  downloadIdCard,
  downloadExcel,
  downloadExport,
} = require('../controllers/adminAiController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('superadmin', 'manager', 'counter_staff'));

router.post('/chat', chat);
router.get('/download/certificate', downloadCertificate);
router.get('/download/id-card', downloadIdCard);
router.get('/download/export/:fileId', downloadExport);
router.get('/download/pdf/:fileId', downloadExport);
router.get('/download/csv/:fileId', downloadExport);
router.get('/download/excel/:fileId', downloadExcel);

module.exports = router;
