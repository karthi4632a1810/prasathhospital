'use strict';

/**
 * Optional sample data: two sponsoring companies (Yamaha, Bajaj) with one
 * coupon each for the CIIM event, so the registration flow can be tried
 * end to end. Real companies and coupons are managed from the admin
 * dashboard — nothing in the app depends on these.
 *
 * Idempotent: existing companies/coupons are left untouched.
 *
 *   npm run seed:coupons
 */

const { connectDatabase, disconnectDatabase } = require('../config/database');
const Event = require('../models/Event');
const Company = require('../models/Company');
const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');

const EVENT_SLUG = 'fertility-gynaecology-summit-2026';

const SAMPLES = [
  { company: 'Yamaha Motor India', code: 'YAMAHA2026', max: 50, description: 'Yamaha-sponsored delegate passes' },
  { company: 'Bajaj Auto', code: 'BAJAJ2026', max: 50, description: 'Bajaj-sponsored delegate passes' },
];

async function seedCoupons() {
  await connectDatabase();
  const event = await Event.findOne({ slug: EVENT_SLUG });
  if (!event) throw new Error(`Event ${EVENT_SLUG} not found — run "npm run seed" first.`);

  for (const sample of SAMPLES) {
    // eslint-disable-next-line no-await-in-loop
    let company = await Company.findOne({ nameKey: Company.keyFor(sample.company) });
    if (!company) {
      // eslint-disable-next-line no-await-in-loop
      company = await Company.create({ name: sample.company });
      logger.info(`Created company ${company.name}`);
    }
    // eslint-disable-next-line no-await-in-loop
    const exists = await Coupon.exists({ code: sample.code });
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await Coupon.create({
        event: event._id,
        company: company._id,
        code: sample.code,
        description: sample.description,
        maxAllowedRegistrations: sample.max,
        expiryDate: event.registrationClosesAt || null,
      });
      logger.info(`Created coupon ${sample.code} (${sample.max} registrations) for ${company.name}`);
    }
  }
}

seedCoupons()
  .then(() => disconnectDatabase())
  .catch(async (err) => {
    logger.error('Coupon seed failed', err);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
