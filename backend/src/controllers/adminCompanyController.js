'use strict';

const Company = require('../models/Company');
const Coupon = require('../models/Coupon');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { recordAudit } = require('../services/auditLog');

const EDITABLE_FIELDS = ['name', 'contactName', 'contactEmail', 'contactPhone', 'notes', 'isActive'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeCompany(company, stats = {}) {
  return {
    id: company._id,
    name: company.name,
    contactName: company.contactName,
    contactEmail: company.contactEmail,
    contactPhone: company.contactPhone,
    notes: company.notes,
    isActive: company.isActive,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    couponCount: stats.couponCount || 0,
    allocated: stats.allocated || 0,
    used: stats.used || 0,
    registrations: stats.registrations || 0,
  };
}

async function statsByCompany(companyIds) {
  const [couponRows, regRows] = await Promise.all([
    Coupon.aggregate([
      { $match: { company: { $in: companyIds } } },
      { $group: { _id: '$company', couponCount: { $sum: 1 }, allocated: { $sum: '$maxAllowedRegistrations' }, used: { $sum: '$usageCount' } } },
    ]),
    Registration.aggregate([
      { $match: { company: { $in: companyIds }, status: 'confirmed' } },
      { $group: { _id: '$company', registrations: { $sum: 1 } } },
    ]),
  ]);
  const stats = new Map();
  for (const row of couponRows) stats.set(String(row._id), { ...row });
  for (const row of regRows) stats.set(String(row._id), { ...(stats.get(String(row._id)) || {}), registrations: row.registrations });
  return stats;
}

function applyEditableFields(company, body) {
  for (const field of EDITABLE_FIELDS) {
    if (field in body) company[field] = field === 'isActive' ? Boolean(body[field]) : String(body[field] ?? '');
  }
}

async function findOr404(id) {
  const company = await Company.findById(id);
  if (!company) throw ApiError.notFound('Company not found');
  return company;
}

async function assertNameFree(name, exceptId) {
  const clash = await Company.findOne({ nameKey: Company.keyFor(name), ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw ApiError.conflict(`A company named "${clash.name}" already exists.`);
}

/** GET /api/v1/admin/companies?q=&active=true|false */
const listCompanies = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
  if (req.query.active === 'true') filter.isActive = true;
  if (req.query.active === 'false') filter.isActive = false;

  const companies = await Company.find(filter).sort({ name: 1 });
  const stats = await statsByCompany(companies.map((c) => c._id));
  return sendSuccess(res, companies.map((c) => serializeCompany(c, stats.get(String(c._id)))));
});

/** POST /api/v1/admin/companies */
const createCompany = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!String(body.name || '').trim()) throw ApiError.badRequest('Company name is required.');
  await assertNameFree(body.name);

  const company = new Company({ createdBy: req.user._id });
  applyEditableFields(company, body);
  await company.save();

  recordAudit(req, { action: 'company.create', entityType: 'Company', entityId: company._id, meta: { name: company.name } });
  return sendSuccess(res, serializeCompany(company), { status: 201 });
});

/** PATCH /api/v1/admin/companies/:id */
const updateCompany = asyncHandler(async (req, res) => {
  const company = await findOr404(req.params.id);
  const body = req.body || {};
  if ('name' in body) {
    if (!String(body.name || '').trim()) throw ApiError.badRequest('Company name is required.');
    await assertNameFree(body.name, company._id);
  }
  const wasActive = company.isActive;
  applyEditableFields(company, body);
  await company.save();

  let action = 'company.update';
  if (wasActive && !company.isActive) action = 'company.deactivate';
  if (!wasActive && company.isActive) action = 'company.activate';
  recordAudit(req, { action, entityType: 'Company', entityId: company._id, meta: { name: company.name, fields: Object.keys(body) } });

  const stats = await statsByCompany([company._id]);
  return sendSuccess(res, serializeCompany(company, stats.get(String(company._id))));
});

/** DELETE /api/v1/admin/companies/:id — only while nothing references it. */
const deleteCompany = asyncHandler(async (req, res) => {
  const company = await findOr404(req.params.id);
  const [coupons, registrations] = await Promise.all([
    Coupon.countDocuments({ company: company._id }),
    Registration.countDocuments({ company: company._id }),
  ]);
  if (coupons > 0 || registrations > 0) {
    throw ApiError.conflict('This company has coupons or registrations. Deactivate it instead of deleting.');
  }
  await company.deleteOne();
  recordAudit(req, { action: 'company.delete', entityType: 'Company', entityId: company._id, meta: { name: company.name } });
  return sendSuccess(res, null, { message: 'Company deleted' });
});

module.exports = { listCompanies, createCompany, updateCompany, deleteCompany };
