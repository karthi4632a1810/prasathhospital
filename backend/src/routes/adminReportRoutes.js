'use strict';

const express = require('express');
const { getOverview, getBreakdown, exportCompaniesCsv, exportCouponsCsv } = require('../controllers/adminReportController');
const { exportRegistrationsCsv } = require('../controllers/adminRegistrationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Dashboard tiles are aggregate-only, so check-in staff can see them too.
router.get('/overview', requireRole('superadmin', 'manager', 'checkin_staff'), getOverview);

router.use(requireRole('superadmin', 'manager'));
router.get('/breakdown', getBreakdown);
router.get('/export/registrations.csv', exportRegistrationsCsv);
router.get('/export/companies.csv', exportCompaniesCsv);
router.get('/export/coupons.csv', exportCouponsCsv);

module.exports = router;
