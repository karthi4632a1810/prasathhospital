'use strict';

const express = require('express');
const {
  listCoupons,
  createCoupon,
  createCouponSeries,
  createTestBatch,
  purgeTestBatch,
  updateCoupon,
  deleteCoupon,
  generateCode,
} = require('../controllers/adminCouponController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('superadmin', 'manager', 'counter_staff'), listCoupons);
router.get('/generate-code', requireRole('superadmin', 'manager'), generateCode);
router.post('/test-batch', requireRole('superadmin', 'manager'), createTestBatch);
router.delete('/test-batch', requireRole('superadmin', 'manager'), purgeTestBatch);
router.post('/series', requireRole('superadmin', 'manager'), createCouponSeries);
router.post('/', requireRole('superadmin', 'manager'), createCoupon);
router.patch('/:id', requireRole('superadmin', 'manager'), updateCoupon);
router.delete('/:id', requireRole('superadmin', 'manager'), deleteCoupon);

module.exports = router;
