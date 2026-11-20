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

// Scanner operations available to checkin_staff, counter_staff, manager, and superadmin
router.use(requireAuth, requireRole('superadmin', 'manager', 'checkin_staff', 'counter_staff'));

router.post('/scan', scanTicket);
router.get('/stats', getCheckinStats);
router.get('/events', listCheckinEvents);
router.get('/locations', listLocations);

// Checkpoint location setup & configuration
router.post('/locations', requireRole('superadmin', 'manager', 'counter_staff'), createLocation);
router.patch('/locations/:id', requireRole('superadmin', 'manager', 'counter_staff'), updateLocation);
router.delete('/locations/:id', requireRole('superadmin', 'manager', 'counter_staff'), deleteLocation);

module.exports = router;
