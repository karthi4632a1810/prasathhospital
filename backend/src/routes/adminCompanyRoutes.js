'use strict';

const express = require('express');
const { listCompanies, createCompany, updateCompany, deleteCompany } = require('../controllers/adminCompanyController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('superadmin', 'manager'));

router.get('/', listCompanies);
router.post('/', createCompany);
router.patch('/:id', updateCompany);
router.delete('/:id', deleteCompany);

module.exports = router;
