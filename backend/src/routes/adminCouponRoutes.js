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

router.use(requireAuth, requireRole('superadmin', 'manager'));

router.get('/', listCoupons);
router.get('/generate-code', generateCode);
router.post('/test-batch', createTestBatch);
router.delete('/test-batch', purgeTestBatch);
router.post('/series', createCouponSeries);
router.post('/', createCoupon);
router.patch('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

module.exports = router;
