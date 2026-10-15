'use strict';

const express = require('express');
const { createRegistration } = require('../controllers/publicRegistrationController');
const { registrationLimiter } = require('../middleware/rateLimits');

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);

module.exports = router;
