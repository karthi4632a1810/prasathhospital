'use strict';

const express = require('express');
const {
  listTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
} = require('../controllers/adminTicketTypeController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('superadmin', 'manager', 'counter_staff'), listTicketTypes);
router.post('/', requireRole('superadmin', 'manager'), createTicketType);
router.patch('/:id', requireRole('superadmin', 'manager'), updateTicketType);
router.delete('/:id', requireRole('superadmin', 'manager'), deleteTicketType);

module.exports = router;
