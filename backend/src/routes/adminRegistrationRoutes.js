'use strict';

const express = require('express');
const {
  listRegistrations,
  getRegistration,
  updateRegistration,
  cancelRegistration,
  retryDelivery,
  exportRegistrationsCsv,
} = require('../controllers/adminRegistrationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'manager'));

router.get('/', listRegistrations);
router.get('/export.csv', exportRegistrationsCsv);
router.get('/:id', getRegistration);
router.patch('/:id', updateRegistration);
router.post('/:id/cancel', cancelRegistration);
router.post('/:id/deliveries/:channel', retryDelivery);

module.exports = router;
