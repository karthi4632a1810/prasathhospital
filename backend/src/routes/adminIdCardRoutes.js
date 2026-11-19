'use strict';

const express = require('express');
const {
  getFacultySeed,
  generateBulkPdf,
  generateBulkZip,
  generateSinglePdf,
} = require('../controllers/adminIdCardController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'manager'));

router.get('/faculty-seed', getFacultySeed);
router.post('/bulk-pdf', generateBulkPdf);
router.post('/bulk-zip', generateBulkZip);
router.post('/single-pdf', generateSinglePdf);
router.get('/single-pdf', generateSinglePdf);

module.exports = router;
