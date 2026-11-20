'use strict';

const express = require('express');
const { listCompanies, createCompany, updateCompany, deleteCompany } = require('../controllers/adminCompanyController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('superadmin', 'manager', 'counter_staff'), listCompanies);
router.post('/', requireRole('superadmin', 'manager'), createCompany);
router.patch('/:id', requireRole('superadmin', 'manager'), updateCompany);
router.delete('/:id', requireRole('superadmin', 'manager'), deleteCompany);

module.exports = router;
