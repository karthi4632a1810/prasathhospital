'use strict';

const express = require('express');
const { scanTicket, getCheckinStats, listCheckinEvents } = require('../controllers/adminCheckinController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// checkin_staff is the whole point of this route group, unlike the CMS/sales ones.
router.use(requireAuth, requireRole('superadmin', 'manager', 'checkin_staff'));

router.post('/scan', scanTicket);
router.get('/stats', getCheckinStats);
router.get('/events', listCheckinEvents);

module.exports = router;
