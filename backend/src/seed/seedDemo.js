'use strict';

/**
 * Demo data for walkthroughs and training: sponsoring companies, generated
 * coupons and ~70 registrations spread over the last two weeks — some
 * checked in, a few cancelled, a realistic mix of email/WhatsApp delivery
 * results — plus feedback.
 *
 *   npm run seed:demo            # (re)create the demo data
 *   npm run seed:demo -- --clear # remove ALL demo data (do this before launch)
 *
 * Every demo record is tagged (companies: notes "DEMO DATA"; registrations:
 * campaignSource "demo-seed"), so --clear never touches real data. Coupon
 * usage, pass sold counts and the event's registered count are kept
 * consistent in both directions.
 */

const crypto = require('crypto');
const { connectDatabase, disconnectDatabase, ensureIndexes } = require('../config/database');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const Company = require('../models/Company');
const Coupon = require('../models/Coupon');
const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const { buildCode } = require('../services/couponCode');
const logger = require('../utils/logger');

const SLUG = process.env.EVENT_SLUG || 'fertility-gynaecology-summit-2026';
const DEMO_TAG = 'DEMO DATA';
const DEMO_SOURCE = 'demo-seed';
const DEMO_COUPON_SUFFIX = ' · demo';
const DAY = 86400000;

const COMPANIES = [
  { name: 'Yamaha Motor India', contactName: 'Rahul Menon', coupons: [40, 15] },
  { name: 'Bajaj Auto', contactName: 'Priya Nair', coupons: [30] },
  { name: 'TVS Motor Company', contactName: 'Karthik Raman', coupons: [25] },
  { name: 'Hero MotoCorp', contactName: 'Anjali Gupta', coupons: [20] },
  { name: 'Sun Pharma', contactName: 'Dr. Vivek Rao', coupons: [15] },
  { name: 'Apollo Diagnostics', contactName: 'Meera Krishnan', coupons: [10], inactive: true },
];

const FIRST = ['Aarthi', 'Divya', 'Kavya', 'Lakshmi', 'Meena', 'Nandhini', 'Priya', 'Revathi', 'Sangeetha', 'Swathi',
  'Anitha', 'Deepa', 'Gayathri', 'Janani', 'Keerthana', 'Malini', 'Pavithra', 'Ramya', 'Shalini', 'Vidya',
  'Arjun', 'Karthik', 'Rajesh', 'Suresh', 'Vignesh', 'Ashok', 'Bala', 'Ganesh', 'Manoj', 'Senthil'];
const LAST = ['Raman', 'Krishnan', 'Subramanian', 'Iyer', 'Nair', 'Menon', 'Pillai', 'Reddy', 'Sharma', 'Venkatesh',
  'Rajan', 'Kumar', 'Srinivasan', 'Murugan', 'Balaji'];

// Deterministic randomness, so re-seeding produces the same-looking data.
let seed = 20261121;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function clearDemo() {
  const companies = await Company.find({ notes: DEMO_TAG }).select('_id');
  const companyIds = companies.map((c) => c._id);
  const regs = await Registration.find({ campaignSource: DEMO_SOURCE }).select('_id status ticketType event');

  // Give back the inventory that confirmed demo registrations took.
  const soldByPass = new Map();
  const seatsByEvent = new Map();
  for (const r of regs.filter((x) => x.status === 'confirmed')) {
    soldByPass.set(String(r.ticketType), (soldByPass.get(String(r.ticketType)) || 0) + 1);
    seatsByEvent.set(String(r.event), (seatsByEvent.get(String(r.event)) || 0) + 1);
  }
  for (const [id, n] of soldByPass) {
    // eslint-disable-next-line no-await-in-loop
    const t = await TicketType.findById(id);
    if (t) await TicketType.updateOne({ _id: id }, { $set: { quantitySold: Math.max(t.quantitySold - n, 0) } });
  }
  for (const [id, n] of seatsByEvent) {
    // eslint-disable-next-line no-await-in-loop
    const e = await Event.findById(id).select('registeredCount');
    if (e) await Event.updateOne({ _id: id }, { $set: { registeredCount: Math.max(e.registeredCount - n, 0) } });
  }

  const regIds = regs.map((r) => r._id);
  const [fb, rg, cp, co] = await Promise.all([
    Feedback.deleteMany({ registration: { $in: regIds } }),
    Registration.deleteMany({ _id: { $in: regIds } }),
    Coupon.deleteMany({ $or: [{ company: { $in: companyIds } }, { description: { $regex: `${DEMO_COUPON_SUFFIX}$` } }] }),
    Company.deleteMany({ _id: { $in: companyIds } }),
  ]);
  logger.info(`Cleared demo data: ${co.deletedCount} companies, ${cp.deletedCount} coupons, ${rg.deletedCount} registrations, ${fb.deletedCount} feedback`);
}

function deliveryFor(createdAt, emailStatus, whatsappStatus) {
  const at = new Date(createdAt.getTime() + 20000);
  const channel = (status, kind) => ({
    status,
    attempts: status === 'pending' ? 0 : 1,
    lastAttemptAt: status === 'pending' ? null : at,
    sentAt: status === 'sent' ? at : null,
    error: {
      failed: kind === 'email' ? '550 5.1.1 Recipient address rejected: mailbox unavailable' : '(#131026) Message undeliverable: recipient is not a WhatsApp user',
      retryable: kind === 'email' ? 'Connection timeout' : 'Request timed out',
      not_configured: kind === 'email' ? 'SMTP is not configured' : 'WhatsApp API credentials are not configured',
    }[status] || '',
    providerMessageId: status === 'sent' ? (kind === 'email' ? `<${crypto.randomBytes(8).toString('hex')}@mail.demo>` : `wamid.${crypto.randomBytes(12).toString('hex')}`) : '',
  });
  const email = channel(emailStatus, 'email');
  const whatsapp = channel(whatsappStatus, 'whatsapp');
  const log = [];
  if (email.attempts) log.push({ channel: 'email', status: email.status, at, error: email.error, providerMessageId: email.providerMessageId, trigger: 'auto', actorName: '' });
  if (whatsapp.attempts) log.push({ channel: 'whatsapp', status: whatsapp.status, at, error: whatsapp.error, providerMessageId: whatsapp.providerMessageId, trigger: 'auto', actorName: '' });
  return { delivery: { email, whatsapp }, deliveryLog: log };
}

async function seedDemo() {
  const event = await Event.findOne({ slug: SLUG });
  if (!event) throw new Error(`Event "${SLUG}" not found — seed the event first.`);
  const passes = await TicketType.find({ event: event._id, isActive: true, isPubliclyVisible: true }).sort({ order: 1 });
  if (!passes.length) throw new Error('No public passes to register against.');
  // Weight towards the regular delegate pass, like a real conference.
  const passPool = passes.flatMap((p, i) => Array(i === 0 ? 6 : i === 1 ? 2 : 1).fill(p));
  // Never sell past a pass's limit (quantityTotal 0 = unlimited).
  const left = new Map(passes.map((p) => [String(p._id), p.quantityTotal ? p.quantityTotal - p.quantitySold - p.quantityHeld : Infinity]));
  const pickPass = () => {
    const open = passPool.filter((p) => left.get(String(p._id)) > 0);
    if (!open.length) throw new Error('All passes are sold out — nothing left to seed against.');
    return pick(open);
  };

  const now = Date.now();
  const used = new Set();
  const regs = [];
  const couponDocs = [];

  for (const [ci, c] of COMPANIES.entries()) {
    // A real company with the same name is reused untouched (only its demo
    // coupons are tagged, so --clear removes just those).
    // eslint-disable-next-line no-await-in-loop
    const company = (await Company.findOne({ nameKey: Company.keyFor(c.name) })) || await Company.create({
      name: c.name,
      contactName: c.contactName,
      contactEmail: `${c.contactName.toLowerCase().replace(/[^a-z]+/g, '.')}@demo.example.com`.replace('..', '.'),
      contactPhone: `98400${String(10000 + ci * 1111).slice(0, 5)}`,
      notes: DEMO_TAG,
      isActive: !c.inactive,
    });

    for (const [k, max] of c.coupons.entries()) {
      let code;
      do code = buildCode(c.name); while (used.has(code));
      used.add(code);
      // Fill most coupons partially; Hero MotoCorp's gets used up completely.
      const fill = c.name === 'Hero MotoCorp' ? max : Math.floor(max * (0.45 + rand() * 0.35));
      const coupon = {
        _id: new Coupon()._id,
        event: event._id,
        company: company._id,
        code,
        description: (k === 0 ? `${c.name} sponsored delegates` : `${c.name} — dealer network`) + DEMO_COUPON_SUFFIX,
        maxAllowedRegistrations: max,
        usageCount: 0,
        startDate: null,
        expiryDate: event.registrationClosesAt || null,
        isActive: !c.inactive,
        createdAt: new Date(now - 16 * DAY),
        updatedAt: new Date(now - 16 * DAY),
      };
      couponDocs.push(coupon);

      for (let i = 0; i < fill; i += 1) {
        const first = pick(FIRST);
        const last = pick(LAST);
        const n = regs.length + 1;
        const createdAt = new Date(now - Math.floor(rand() * 14 * DAY) - Math.floor(rand() * 8) * 3600000);
        const pass = pickPass();
        const cancelled = c.name !== 'Hero MotoCorp' && rand() < 0.07;
        if (!cancelled) left.set(String(pass._id), left.get(String(pass._id)) - 1);
        const status = cancelled ? 'cancelled' : 'confirmed';
        if (!cancelled) coupon.usageCount += 1;

        const r = rand();
        const emailStatus = r < 0.82 ? 'sent' : r < 0.9 ? 'failed' : r < 0.95 ? 'retryable' : 'pending';
        const w = rand();
        const whatsappStatus = w < 0.7 ? 'sent' : w < 0.82 ? 'failed' : w < 0.9 ? 'retryable' : 'not_configured';
        const checkedIn = !cancelled && rand() < 0.38;
        const original = Math.round((pass.priceWithTax || pass.price) * 100) / 100;
        const email = `${first}.${last}.${n}`.toLowerCase() + '@demo.example.com';

        regs.push({
          event: event._id,
          ticketType: pass._id,
          attendee: { name: `Dr. ${first} ${last}`, email, phone: `9${String(800000000 + n * 7919).slice(0, 9)}`, participantType: '' },
          coupon: coupon._id,
          company: company._id,
          couponCode: code,
          pricing: { basePrice: pass.price, taxAmount: Math.round((original - pass.price) * 100) / 100, discountAmount: original, totalAmount: 0, currency: 'INR' },
          status,
          promoCode: null,
          payment: null,
          registrationCode: `REG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          qrToken: crypto.randomBytes(24).toString('hex'),
          ...(cancelled ? {} : { activeKey: Registration.activeKeyFor(event._id, email) }),
          ...deliveryFor(createdAt, emailStatus, whatsappStatus),
          checkedInAt: checkedIn ? new Date(Math.min(now, createdAt.getTime() + 3 * DAY)) : null,
          checkedInBy: null,
          certificateIssuedAt: null,
          cancelledAt: cancelled ? new Date(createdAt.getTime() + DAY) : null,
          cancelledBy: null,
          cancellationReason: cancelled ? pick(['Delegate unable to attend', 'Duplicate registration', 'Replaced by colleague']) : '',
          campaignSource: DEMO_SOURCE,
          notes: '',
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }

  await Coupon.collection.insertMany(couponDocs);
  await Registration.collection.insertMany(regs);

  // Keep inventory consistent with the confirmed demo registrations.
  const confirmed = regs.filter((r) => r.status === 'confirmed');
  const byPass = new Map();
  for (const r of confirmed) byPass.set(String(r.ticketType), (byPass.get(String(r.ticketType)) || 0) + 1);
  for (const [id, n] of byPass) {
    // eslint-disable-next-line no-await-in-loop
    await TicketType.updateOne({ _id: id }, { $inc: { quantitySold: n } });
  }
  await Event.updateOne({ _id: event._id }, { $inc: { registeredCount: confirmed.length } });

  // Feedback from about half of the checked-in delegates.
  const comments = ['Excellent sessions and faculty.', 'Very well organised.', 'Workshop was the highlight.', 'Great networking.', 'Venue was superb.', ''];
  const feedback = regs
    .filter((r) => r.checkedInAt && rand() < 0.5)
    .map((r) => ({ event: event._id, registration: null, code: r.registrationCode, rating: rand() < 0.7 ? 5 : 4, comments: pick(comments) }));
  for (const f of feedback) {
    // eslint-disable-next-line no-await-in-loop
    const reg = await Registration.findOne({ registrationCode: f.code }).select('_id');
    // eslint-disable-next-line no-await-in-loop
    await Feedback.create({ event: f.event, registration: reg._id, rating: f.rating, comments: f.comments });
  }

  const checkedIn = confirmed.filter((r) => r.checkedInAt).length;
  logger.info(`Demo data: ${COMPANIES.length} companies, ${couponDocs.length} coupons, ${regs.length} registrations ` +
    `(${confirmed.length} confirmed, ${regs.length - confirmed.length} cancelled, ${checkedIn} checked in), ${feedback.length} feedback`);
  logger.info(`Coupon codes: ${couponDocs.map((c) => `${c.code} (${c.usageCount}/${c.maxAllowedRegistrations})`).join(', ')}`);
}

(async () => {
  try {
    await connectDatabase();
    await ensureIndexes();
    await clearDemo();
    if (!process.argv.includes('--clear')) await seedDemo();
  } catch (err) {
    logger.error('Demo seed failed', err);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase().catch(() => {});
  }
})();
