'use strict';

const express = require('express');
const { validateCoupon } = require('../controllers/publicRegistrationController');
const { couponValidateLimiter } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/validate', couponValidateLimiter, validateCoupon);

module.exports = router;
