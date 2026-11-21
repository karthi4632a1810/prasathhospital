'use strict';

const express = require('express');
const {
  listRegistrations,
  getRegistration,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  cancelRegistration,
  retryDelivery,
  exportRegistrationsCsv,
  exportScannedAttendanceXlsx,
  getRegistrationBadge,
  getRegistrationBadgePdf,
  getRegistrationCertificate,
} = require('../controllers/adminRegistrationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'manager', 'counter_staff'));

router.get('/', listRegistrations);
router.post('/', createRegistration);
router.get('/export.csv', exportRegistrationsCsv);
router.get('/export-attendance.xlsx', exportScannedAttendanceXlsx);
router.get('/:id', getRegistration);
router.get('/:id/badge', getRegistrationBadge);
router.get('/:id/badge.:ext', getRegistrationBadge);
router.get('/:id/badge.pdf', getRegistrationBadgePdf);
router.get('/:id/certificate', getRegistrationCertificate);
router.get('/:id/certificate.:ext', getRegistrationCertificate);
router.patch('/:id', updateRegistration);
router.delete('/:id', deleteRegistration);
router.post('/:id/cancel', cancelRegistration);
router.post('/:id/deliveries/:channel', retryDelivery);

module.exports = router;
