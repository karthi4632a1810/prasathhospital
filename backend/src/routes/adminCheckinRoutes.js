'use strict';

const express = require('express');
const {
  scanTicket,
  getCheckinStats,
  listCheckinEvents,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} = require('../controllers/adminCheckinController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Scanner operations available to checkin_staff, manager, and superadmin
router.use(requireAuth, requireRole('superadmin', 'manager', 'checkin_staff'));

router.post('/scan', scanTicket);
router.get('/stats', getCheckinStats);
router.get('/events', listCheckinEvents);
router.get('/locations', listLocations);

// Checkpoint location setup & configuration (manager + superadmin)
router.post('/locations', requireRole('superadmin', 'manager'), createLocation);
router.patch('/locations/:id', requireRole('superadmin', 'manager'), updateLocation);
router.delete('/locations/:id', requireRole('superadmin', 'manager'), deleteLocation);

module.exports = router;
