'use strict';

const express = require('express');
const mongoose = require('mongoose');
const publicEventRoutes = require('./publicEventRoutes');
const adminAuthRoutes = require('./adminAuthRoutes');
const adminEventRoutes = require('./adminEventRoutes');
const adminUploadRoutes = require('./adminUploadRoutes');
const adminTicketTypeRoutes = require('./adminTicketTypeRoutes');
const adminCompanyRoutes = require('./adminCompanyRoutes');
const adminCouponRoutes = require('./adminCouponRoutes');
const publicCouponRoutes = require('./publicCouponRoutes');
const publicRegistrationRoutes = require('./publicRegistrationRoutes');
const adminRegistrationRoutes = require('./adminRegistrationRoutes');
const publicTicketRoutes = require('./publicTicketRoutes');
const adminCheckinRoutes = require('./adminCheckinRoutes');
const adminReportRoutes = require('./adminReportRoutes');
const adminUserRoutes = require('./adminUserRoutes');
const publicFeedbackRoutes = require('./publicFeedbackRoutes');
const adminFeedbackRoutes = require('./adminFeedbackRoutes');
const adminAuditLogRoutes = require('./adminAuditLogRoutes');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

/** Liveness/readiness probe for NGINX, Docker and uptime monitoring. */
router.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return sendSuccess(res, {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

router.use('/public', publicEventRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/events', adminEventRoutes);
router.use('/admin/uploads', adminUploadRoutes);
router.use('/admin/ticket-types', adminTicketTypeRoutes);
router.use('/admin/companies', adminCompanyRoutes);
router.use('/admin/coupons', adminCouponRoutes);
router.use('/coupons', publicCouponRoutes);
router.use('/registrations', publicRegistrationRoutes);
router.use('/admin/registrations', adminRegistrationRoutes);
router.use('/tickets', publicTicketRoutes);
router.use('/admin/checkin', adminCheckinRoutes);
router.use('/admin/reports', adminReportRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/feedback', publicFeedbackRoutes);
router.use('/admin/feedback', adminFeedbackRoutes);
router.use('/admin/audit-log', adminAuditLogRoutes);

module.exports = router;
