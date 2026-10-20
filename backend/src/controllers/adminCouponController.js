'use strict';

const Coupon = require('../models/Coupon');
const Company = require('../models/Company');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { recordAudit } = require('../services/auditLog');
const { generateUniqueCouponCode } = require('../services/couponCode');

const CODE_RE = /^[A-Z0-9_-]{4,32}$/;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** active | inactive | scheduled | expired | exhausted */
function couponState(coupon, now = new Date()) {
  if (!coupon.isActive) return 'inactive';
  if (coupon.expiryDate && now > coupon.expiryDate) return 'expired';
  if (coupon.usageCount >= coupon.maxAllowedRegistrations) return 'exhausted';
  if (coupon.startDate && now < coupon.startDate) return 'scheduled';
  return 'active';
}

function serializeCoupon(coupon) {
  return {
    id: coupon._id,
    code: coupon.code,
    description: coupon.description,
    event: coupon.event?._id ? { id: coupon.event._id, title: coupon.event.title } : coupon.event,
    company: coupon.company?._id ? { id: coupon.company._id, name: coupon.company.name, isActive: coupon.company.isActive } : coupon.company,
    maxAllowedRegistrations: coupon.maxAllowedRegistrations,
    usageCount: coupon.usageCount,
    remaining: Math.max(coupon.maxAllowedRegistrations - coupon.usageCount, 0),
    startDate: coupon.startDate,
    expiryDate: coupon.expiryDate,
    isActive: coupon.isActive,
    state: couponState(coupon),
    createdBy: coupon.createdBy?.name ? { id: coupon.createdBy._id, name: coupon.createdBy.name } : coupon.createdBy,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

function parseDate(value, label) {
  if (value === null || value === '' || value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`${label} is not a valid date.`);
  return date;
}

/** Validates the editable fields present in `body` and returns the cleaned changes. */
function cleanChanges(body, current = {}) {
  const changes = {};
  if ('code' in body) {
    const code = Coupon.normalizeCode(body.code);
    if (!CODE_RE.test(code)) throw ApiError.badRequest('Coupon code must be 4–32 letters, numbers, "-" or "_".');
    changes.code = code;
  }
  if ('description' in body) changes.description = String(body.description || '').trim().slice(0, 500);
  if ('maxAllowedRegistrations' in body) {
    const max = Number(body.maxAllowedRegistrations);
    if (!Number.isInteger(max) || max < 1 || max > 100000) {
      throw ApiError.badRequest('Max registrations must be a whole number of at least 1.');
    }
    changes.maxAllowedRegistrations = max;
  }
  if ('startDate' in body) changes.startDate = parseDate(body.startDate, 'Start date');
  if ('expiryDate' in body) changes.expiryDate = parseDate(body.expiryDate, 'Expiry date');
  if ('isActive' in body) changes.isActive = Boolean(body.isActive);

  const start = 'startDate' in changes ? changes.startDate : current.startDate;
  const expiry = 'expiryDate' in changes ? changes.expiryDate : current.expiryDate;
  if (start && expiry && expiry <= start) throw ApiError.badRequest('Expiry date must be after the start date.');
  return changes;
}

async function assertCodeFree(code, exceptId) {
  const clash = await Coupon.exists({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw ApiError.conflict(`Coupon code ${code} is already in use.`);
}

async function findOr404(id) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return coupon;
}

function populated(query) {
  return query.populate('company', 'name isActive').populate('event', 'title').populate('createdBy', 'name');
}

/** GET /api/v1/admin/coupons?event=&company=&state=&q= */
const listCoupons = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = req.query.event;
  if (req.query.company) filter.company = req.query.company;
  if (req.query.q) filter.code = new RegExp(escapeRegex(String(req.query.q).trim().toUpperCase()));

  const coupons = await populated(Coupon.find(filter).sort({ createdAt: -1 }));
  let rows = coupons.map(serializeCoupon);
  if (req.query.state) rows = rows.filter((c) => c.state === req.query.state);
  return sendSuccess(res, rows);
});

/** POST /api/v1/admin/coupons */
const createCoupon = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.event) throw ApiError.badRequest('An "event" id is required.');
  if (!body.company) throw ApiError.badRequest('Please choose a company.');
  if (!('maxAllowedRegistrations' in body)) throw ApiError.badRequest('Max registrations is required.');

  const [event, company] = await Promise.all([
    Event.findById(body.event).select('_id'),
    Company.findById(body.company).select('_id isActive name'),
  ]);
  if (!event) throw ApiError.notFound('Event not found');
  if (!company) throw ApiError.notFound('Company not found');
  if (!company.isActive) throw ApiError.conflict(`${company.name} is inactive. Activate the company first.`);

  // A blank code means "generate one": unique, prefixed with the company name.
  const autoCode = !String(body.code ?? '').trim();
  const changes = cleanChanges(autoCode ? { ...body, code: await generateUniqueCouponCode(company.name) } : body);
  await assertCodeFree(changes.code);

  let coupon;
  try {
    coupon = await Coupon.create({ ...changes, event: event._id, company: company._id, createdBy: req.user._id });
  } catch (err) {
    // Another admin took the same code between the check and the insert.
    if (err && err.code === 11000) throw ApiError.conflict(`Coupon code ${changes.code} is already in use. Try again.`);
    throw err;
  }
  recordAudit(req, {
    action: 'coupon.create',
    entityType: 'Coupon',
    entityId: coupon._id,
    meta: { code: coupon.code, company: company.name, maxAllowedRegistrations: coupon.maxAllowedRegistrations, generated: autoCode },
  });
  return sendSuccess(res, serializeCoupon(await populated(Coupon.findById(coupon._id))), { status: 201 });
});

/** POST /api/v1/admin/coupons/series */
const createCouponSeries = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.event) throw ApiError.badRequest('An "event" id is required.');
  if (!body.company) throw ApiError.badRequest('Please choose a company.');

  const [event, company] = await Promise.all([
    Event.findById(body.event).select('_id'),
    Company.findById(body.company).select('_id isActive name'),
  ]);
  if (!event) throw ApiError.notFound('Event not found');
  if (!company) throw ApiError.notFound('Company not found');
  if (!company.isActive) throw ApiError.conflict(`${company.name} is inactive. Activate the company first.`);

  const seriesField = Number(body.seriesField) || 2;
  if (![1, 2, 3].includes(seriesField)) {
    throw ApiError.badRequest('Series field selection must be 1, 2, or 3.');
  }

  const startNum = parseInt(body.startNum, 10);
  const endNum = parseInt(body.endNum, 10);

  if (Number.isNaN(startNum) || startNum < 0) {
    throw ApiError.badRequest('Series start number must be a non-negative integer (e.g. 1).');
  }
  if (Number.isNaN(endNum) || endNum < startNum) {
    throw ApiError.badRequest('Series end number must be greater than or equal to start number.');
  }

  const count = endNum - startNum + 1;
  if (count > 2000) {
    throw ApiError.badRequest(`Maximum 2,000 coupons can be generated in one batch (requested: ${count}).`);
  }

  const defaultDigits = Math.max(String(endNum).length, 3);
  const digits = Math.min(Math.max(parseInt(body.digits, 10) || defaultDigits, 1), 10);

  const field1 = String(body.field1 || '').trim().toUpperCase();
  const field2 = String(body.field2 || '').trim().toUpperCase();
  const field3 = String(body.field3 || '').trim().toUpperCase();

  const generatedCodes = [];
  for (let i = startNum; i <= endNum; i++) {
    const padded = String(i).padStart(digits, '0');
    let code;
    if (seriesField === 1) {
      code = `${padded}${field2}${field3}`;
    } else if (seriesField === 2) {
      code = `${field1}${padded}${field3}`;
    } else {
      code = `${field1}${field2}${padded}`;
    }

    if (!CODE_RE.test(code)) {
      throw ApiError.badRequest(
        `Generated code "${code}" is invalid. Coupon codes must be 4–32 letters, numbers, "-" or "_". Please check your inputs.`
      );
    }
    generatedCodes.push(code);
  }

  // Check for uniqueness within the batch itself
  const codeSet = new Set(generatedCodes);
  if (codeSet.size !== generatedCodes.length) {
    throw ApiError.badRequest('Duplicate codes were generated within this series batch.');
  }

  // Check for collision with existing codes in database
  const existing = await Coupon.find({ code: { $in: generatedCodes } }).select('code').lean();
  if (existing.length > 0) {
    const list = existing.slice(0, 5).map((c) => c.code).join(', ');
    const more = existing.length > 5 ? ` and ${existing.length - 5} more` : '';
    throw ApiError.conflict(
      `${existing.length} coupon code(s) already exist in the database (${list}${more}). Please adjust prefix/suffix or range.`
    );
  }

  const maxAllowedRegistrations = Number(body.maxAllowedRegistrations) || 1; // single use default
  const startDate = parseDate(body.startDate, 'Start date');
  const expiryDate = parseDate(body.expiryDate, 'Expiry date');
  if (startDate && expiryDate && expiryDate <= startDate) {
    throw ApiError.badRequest('Expiry date must be after the start date.');
  }

  const description = body.description ? String(body.description).trim().slice(0, 500) : '';
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  const docs = generatedCodes.map((code) => ({
    event: event._id,
    company: company._id,
    code,
    description: description || `Series coupon (${code})`,
    maxAllowedRegistrations,
    usageCount: 0,
    startDate,
    expiryDate,
    isActive,
    createdBy: req.user._id,
  }));

  await Coupon.insertMany(docs, { ordered: true });

  recordAudit(req, {
    action: 'coupon.create_series',
    entityType: 'Coupon',
    meta: {
      company: company.name,
      event: event._id,
      count: docs.length,
      firstCode: generatedCodes[0],
      lastCode: generatedCodes[generatedCodes.length - 1],
      seriesField,
      startNum,
      endNum,
      digits,
      maxAllowedRegistrations,
    },
  });

  return sendSuccess(
    res,
    {
      count: docs.length,
      firstCode: generatedCodes[0],
      lastCode: generatedCodes[generatedCodes.length - 1],
      sample: generatedCodes.slice(0, 10),
      codes: generatedCodes,
    },
    {
      status: 201,
      message: `Successfully created ${docs.length} coupon codes (${generatedCodes[0]} to ${generatedCodes[generatedCodes.length - 1]}).`,
    }
  );
});

/**
 * GET /api/v1/admin/coupons/generate-code?company=<id>
 * A fresh unique code for the company ("YAMAHA-7KQ93X") to prefill the
 * form. Nothing is reserved — the create call re-checks uniqueness.
 */
const generateCode = asyncHandler(async (req, res) => {
  if (!req.query.company) throw ApiError.badRequest('Please choose a company.');
  const company = await Company.findById(String(req.query.company)).select('name');
  if (!company) throw ApiError.notFound('Company not found');
  return sendSuccess(res, { code: await generateUniqueCouponCode(company.name) });
});

/**
 * PATCH /api/v1/admin/coupons/:id
 * Code and company are frozen once the coupon has been used, so existing
 * registrations keep pointing at what they were issued under. The new
 * limit is applied with a guard so it can never drop below live usage, even
 * if a registration lands mid-edit.
 */
const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await findOr404(req.params.id);
  const body = req.body || {};
  const changes = cleanChanges(body, coupon);

  if (body.company && String(body.company) !== String(coupon.company)) {
    if (coupon.usageCount > 0) throw ApiError.conflict('The company can’t be changed after the coupon has been used.');
    const company = await Company.findById(body.company).select('_id isActive');
    if (!company) throw ApiError.notFound('Company not found');
    changes.company = company._id;
  }
  if (changes.code && changes.code !== coupon.code) {
    if (coupon.usageCount > 0) throw ApiError.conflict('The code can’t be changed after the coupon has been used.');
    await assertCodeFree(changes.code, coupon._id);
  } else {
    delete changes.code;
  }

  const guard = { _id: coupon._id };
  if ('maxAllowedRegistrations' in changes) guard.usageCount = { $lte: changes.maxAllowedRegistrations };

  const updated = await Coupon.findOneAndUpdate(guard, { $set: changes }, { new: true });
  if (!updated) {
    throw ApiError.conflict('Max registrations can’t be lower than the number of registrations already made.');
  }

  let action = 'coupon.update';
  if ('isActive' in changes && coupon.isActive && !changes.isActive) action = 'coupon.deactivate';
  if ('isActive' in changes && !coupon.isActive && changes.isActive) action = 'coupon.activate';
  recordAudit(req, { action, entityType: 'Coupon', entityId: coupon._id, meta: { code: updated.code, changes } });

  return sendSuccess(res, serializeCoupon(await populated(Coupon.findById(coupon._id))));
});

/** DELETE /api/v1/admin/coupons/:id — only if never used; otherwise deactivate. */
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await findOr404(req.params.id);
  const hasRegistrations = await Registration.exists({ coupon: coupon._id });
  if (coupon.usageCount > 0 || hasRegistrations) {
    throw ApiError.conflict('This coupon has been used. Deactivate it instead so its history is kept.');
  }
  await coupon.deleteOne();
  recordAudit(req, { action: 'coupon.delete', entityType: 'Coupon', entityId: coupon._id, meta: { code: coupon.code } });
  return sendSuccess(res, null, { message: 'Coupon deleted' });
});

module.exports = { listCoupons, createCoupon, createCouponSeries, updateCoupon, deleteCoupon, generateCode, couponState };
