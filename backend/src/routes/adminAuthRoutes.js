'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const env = require('../config/env');

const router = express.Router();

// Tighter than the general /api limiter: login is the one endpoint worth
// slowing down hard against credential-stuffing, independent of lockout.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.loginLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts. Please try again shortly.' } },
});

router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);

module.exports = router;
