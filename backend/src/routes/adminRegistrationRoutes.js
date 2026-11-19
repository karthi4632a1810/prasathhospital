'use strict';

const express = require('express');
const {
  listRegistrations,
  getRegistration,
  updateRegistration,
  cancelRegistration,
  retryDelivery,
  exportRegistrationsCsv,
  exportScannedAttendanceXlsx,
  getRegistrationBadgePdf,
} = require('../controllers/adminRegistrationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'manager'));

router.get('/', listRegistrations);
router.get('/export.csv', exportRegistrationsCsv);
router.get('/export-attendance.xlsx', exportScannedAttendanceXlsx);
router.get('/:id', getRegistration);
router.get('/:id/badge.pdf', getRegistrationBadgePdf);
router.patch('/:id', updateRegistration);
router.post('/:id/cancel', cancelRegistration);
router.post('/:id/deliveries/:channel', retryDelivery);

module.exports = router;
