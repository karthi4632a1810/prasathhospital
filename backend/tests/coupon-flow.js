'use strict';

/**
 * End-to-end test of the coupon registration flow against a RUNNING stack
 * (docker compose up) — real HTTP, real MongoDB.
 *
 *   API_URL=http://localhost:8080 MONGODB_URI=mongodb://127.0.0.1:27017/prashanth_events \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/coupon-flow.js
 *
 * It creates its own companies/coupons (prefixed "TEST-"), exercises the
 * spec's test cases, then cancels and deletes everything it created so the
 * event's counters end where they started.
 *
 * The public endpoints are rate limited per IP; raise COUPON_VALIDATE_LIMIT_MAX
 * and REGISTRATION_LIMIT_MAX in backend/.env (e.g. 1000) before running this.
 */

const mongoose = require('mongoose');

const API = (process.env.API_URL || 'http://localhost:8080').replace(/\/$/, '');
const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prashanth_events';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@prashanthhospitals.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const SLUG = process.env.EVENT_SLUG || 'fertility-gynaecology-summit-2026';
const RUN = Date.now().toString(36).toUpperCase();

let pass = 0;
let fail = 0;
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function test(name, fn) {
  try {
    const note = await fn();
    pass += 1;
    results.push(['PASS', name, note || '']);
    console.log(`PASS  ${name}${note ? `  — ${note}` : ''}`);
  } catch (err) {
    fail += 1;
    results.push(['FAIL', name, err.message]);
    console.log(`FAIL  ${name}  — ${err.message}`);
  }
}

async function call(method, path, { body, token, raw } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

let seq = 0;
function attendee(tag) {
  seq += 1;
  const n = String(seq).padStart(3, '0');
  return {
    name: `Test Delegate ${tag} ${n}`,
    email: `test-${RUN.toLowerCase()}-${tag.toLowerCase()}-${n}@example.com`,
    phone: `9${String(Date.now()).slice(-6)}${n}`.slice(0, 10),
  };
}

function key() {
  return `test-${RUN}-${Math.random().toString(36).slice(2)}-${Date.now()}`.slice(0, 64);
}

async function main() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;

  const login = await call('POST', '/admin/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  assert(login.status === 200, `admin login failed (${login.status})`);
  const token = login.body.data.token;

  const eventRes = await call('GET', `/public/events/${SLUG}`);
  const event = eventRes.body.data.event;
  const pass1 = eventRes.body.data.ticketTypes.find((t) => t.saleState === 'on-sale');
  assert(event && pass1, 'event or on-sale pass missing — run the seed first');
  const eventDoc = await db.collection('events').findOne({ slug: SLUG });
  const passDoc = await db.collection('tickettypes').findOne({ _id: new mongoose.Types.ObjectId(pass1.id) });
  const startCounts = { event: eventDoc.registeredCount, pass: passDoc.quantitySold };

  const created = { companies: [], coupons: [], registrations: [] };

  async function company(name) {
    const r = await call('POST', '/admin/companies', { token, body: { name } });
    assert(r.status === 201, `company create ${r.status} ${r.body.error?.message}`);
    created.companies.push(r.body.data.id);
    return r.body.data;
  }
  async function coupon(fields) {
    const r = await call('POST', '/admin/coupons', { token, body: { event: event.id, maxAllowedRegistrations: 5, ...fields } });
    assert(r.status === 201, `coupon create ${r.status} ${r.body.error?.message}`);
    created.coupons.push(r.body.data.id);
    return r.body.data;
  }
  function register(code, who = attendee('X'), idem = key()) {
    return call('POST', '/registrations', {
      body: { eventSlug: SLUG, ticketTypeId: pass1.id, attendee: who, couponCode: code, idempotencyKey: idem },
    });
  }
  function validate(code) {
    return call('POST', '/coupons/validate', { body: { code, eventSlug: SLUG, ticketTypeId: pass1.id } });
  }
  function track(r) {
    if (r.status === 201 || r.status === 200) {
      const code = r.body.data.registrationCode;
      if (!created.registrations.includes(code)) created.registrations.push(code);
    }
    return r;
  }

  const yamaha = await company(`TEST-Yamaha ${RUN}`);
  const bajaj = await company(`TEST-Bajaj ${RUN}`);
  const yCode = `TY${RUN}`;
  const bCode = `TB${RUN}`;
  await coupon({ company: yamaha.id, code: yCode, maxAllowedRegistrations: 20 });
  await coupon({ company: bajaj.id, code: bCode, maxAllowedRegistrations: 20 });

  let yamahaReg;

  // 1. Yamaha valid coupon
  await test('1. Valid Yamaha coupon validates and registers at ₹0', async () => {
    const v = await validate(yCode.toLowerCase());
    assert(v.status === 200 && v.body.data.valid, `validate ${v.status} ${v.body.error?.message}`);
    assert(v.body.data.companyName === yamaha.name, 'wrong company');
    assert(v.body.data.finalAmount === 0 && v.body.data.discountAmount === v.body.data.originalAmount, 'amounts');
    const r = track(await register(yCode));
    assert(r.status === 201, `register ${r.status} ${r.body.error?.message}`);
    const d = r.body.data;
    assert(d.status === 'confirmed' && d.pricing.totalAmount === 0, 'not confirmed at 0');
    assert(d.company.name === yamaha.name && d.couponCode === yCode, 'company/coupon not linked');
    assert(/^[0-9a-f]{48}$/.test(d.qrToken), 'no QR token');
    yamahaReg = d;
    return `${d.registrationCode}, original ₹${v.body.data.originalAmount} → ₹0`;
  });

  // 2. Bajaj valid coupon
  await test('2. Valid Bajaj coupon registers and links to Bajaj', async () => {
    const r = track(await register(bCode));
    assert(r.status === 201, `register ${r.status} ${r.body.error?.message}`);
    assert(r.body.data.company.name === bajaj.name, 'wrong company');
    return r.body.data.registrationCode;
  });

  // 3. Invalid coupon
  await test('3. Invalid coupon is rejected', async () => {
    const v = await validate(`NOPE${RUN}`);
    assert(v.status === 400 && v.body.error.code === 'COUPON_INVALID', `got ${v.status} ${v.body.error?.code}`);
    const r = await register(`NOPE${RUN}`);
    assert(r.status === 400, `register got ${r.status}`);
    return v.body.error.message;
  });

  // 4. Expired coupon
  await test('4. Expired coupon is rejected', async () => {
    const code = `TE${RUN}`;
    await coupon({ company: yamaha.id, code, startDate: new Date(Date.now() - 10 * 86400000).toISOString(), expiryDate: new Date(Date.now() - 86400000).toISOString() });
    const v = await validate(code);
    assert(v.status === 400 && v.body.error.code === 'COUPON_EXPIRED', `got ${v.status} ${v.body.error?.code}`);
    const r = await register(code);
    assert(r.status === 400 && r.body.error.code === 'COUPON_EXPIRED', `register got ${r.status}`);
    return v.body.error.message;
  });

  // 5. Inactive coupon
  await test('5. Inactive coupon is rejected', async () => {
    const code = `TI${RUN}`;
    const c = await coupon({ company: yamaha.id, code });
    const off = await call('PATCH', `/admin/coupons/${c.id}`, { token, body: { isActive: false } });
    assert(off.status === 200 && off.body.data.state === 'inactive', 'deactivate failed');
    const v = await validate(code);
    assert(v.status === 400 && v.body.error.code === 'COUPON_INACTIVE', `got ${v.status} ${v.body.error?.code}`);
    return v.body.error.message;
  });

  // 6. Exhausted coupon
  await test('6. Exhausted coupon is rejected', async () => {
    const code = `TX${RUN}`;
    await coupon({ company: bajaj.id, code, maxAllowedRegistrations: 1 });
    const first = track(await register(code));
    assert(first.status === 201, `first ${first.status}`);
    const v = await validate(code);
    assert(v.status === 409 && v.body.error.code === 'COUPON_EXHAUSTED', `got ${v.status} ${v.body.error?.code}`);
    const second = await register(code);
    assert(second.status === 409, `second got ${second.status}`);
    return v.body.error.message;
  });

  // 7. Concurrency
  await test('7. 12 concurrent registrations on a 5-place coupon → exactly 5 succeed', async () => {
    const code = `TC${RUN}`;
    const c = await coupon({ company: yamaha.id, code, maxAllowedRegistrations: 5 });
    const responses = await Promise.all(Array.from({ length: 12 }, () => register(code)));
    responses.forEach(track);
    const ok = responses.filter((r) => r.status === 201).length;
    const refused = responses.filter((r) => r.status === 409).length;
    const doc = await db.collection('coupons').findOne({ _id: new mongoose.Types.ObjectId(c.id) });
    const regs = await db.collection('registrations').countDocuments({ coupon: doc._id, status: 'confirmed' });
    assert(ok === 5 && refused === 7, `ok=${ok} refused=${refused}`);
    assert(doc.usageCount === 5 && regs === 5, `usageCount=${doc.usageCount} regs=${regs}`);
    return `5 created, 7 refused, usageCount=${doc.usageCount}`;
  });

  // 8. Duplicate submit
  await test('8. Duplicate submit (same idempotency key) returns the same registration', async () => {
    const who = attendee('DUP');
    const idem = key();
    const [a, b] = await Promise.all([register(yCode, who, idem), register(yCode, who, idem)]);
    [a, b].forEach(track);
    const codes = [a, b].filter((r) => r.status === 200 || r.status === 201).map((r) => r.body.data.registrationCode);
    const count = await db.collection('registrations').countDocuments({ 'attendee.email': who.email });
    assert(count === 1, `expected 1 registration, found ${count} (statuses ${a.status}/${b.status})`);
    assert(new Set(codes).size <= 1, 'two different registration codes returned');
    const again = await register(yCode, who, key());
    assert(again.status === 409, `same email, new key should be 409, got ${again.status}`);
    return `statuses ${a.status}/${b.status}, one record; re-register with same email → 409`;
  });

  // 9. Unique QR
  await test('9. Every registration gets a unique QR token', async () => {
    const docs = await db.collection('registrations').find({ registrationCode: { $in: created.registrations } }).project({ qrToken: 1 }).toArray();
    const tokens = docs.map((d) => d.qrToken);
    assert(tokens.length >= 9 && tokens.every((t) => /^[0-9a-f]{48}$/.test(t)), 'missing tokens');
    assert(new Set(tokens).size === tokens.length, 'duplicate tokens');
    return `${tokens.length} unique tokens`;
  });

  // Let background delivery finish.
  await new Promise((r) => setTimeout(r, 2500));
  const yDoc = await db.collection('registrations').findOne({ registrationCode: yamahaReg.registrationCode });

  // 10-12. Delivery failures / missing credentials don't block registration
  await test('10. Email failure/missing SMTP does not block registration', async () => {
    assert(yDoc.status === 'confirmed', 'registration not confirmed');
    const s = yDoc.delivery.email.status;
    assert(s !== 'sent' || yDoc.delivery.email.providerMessageId, 'claimed sent without provider id');
    assert(['sent', 'not_configured', 'failed', 'retryable'].includes(s), `email status ${s}`);
    return `email=${s}, registration confirmed`;
  });

  await test('11. WhatsApp failure/missing credentials does not block registration', async () => {
    const s = yDoc.delivery.whatsapp.status;
    assert(yDoc.status === 'confirmed', 'registration not confirmed');
    assert(s !== 'sent' || yDoc.delivery.whatsapp.providerMessageId, 'claimed sent without provider id');
    return `whatsapp=${s}, registration confirmed`;
  });

  await test('12. Channels are tracked independently with attempt log', async () => {
    assert(yDoc.delivery.email.attempts >= 1 && yDoc.delivery.whatsapp.attempts >= 1, 'attempts not recorded');
    const channels = new Set(yDoc.deliveryLog.map((l) => l.channel));
    assert(channels.has('email') && channels.has('whatsapp'), 'log missing a channel');
    return `log entries: ${yDoc.deliveryLog.length}`;
  });

  // 13. Retry
  await test('13. Admin can retry email and WhatsApp delivery', async () => {
    const id = String(yDoc._id);
    const e = await call('POST', `/admin/registrations/${id}/deliveries/email`, { token });
    const w = await call('POST', `/admin/registrations/${id}/deliveries/whatsapp`, { token });
    assert(e.status === 200 && w.status === 200, `retry statuses ${e.status}/${w.status}`);
    const after = await db.collection('registrations').findOne({ _id: yDoc._id });
    assert(after.delivery.email.attempts === yDoc.delivery.email.attempts + 1, 'email attempts not incremented');
    assert(after.deliveryLog.some((l) => l.trigger === 'admin'), 'admin attempt not logged');
    const audit = await db.collection('auditlogs').countDocuments({ entityId: yDoc._id, action: /registration\.delivery/ });
    assert(audit >= 2, 'retry not audit-logged');
    return `email → ${e.body.data.outcome.status}, whatsapp → ${w.body.data.outcome.status}`;
  });

  // 14. Reports
  await test('14. Reports match the database', async () => {
    const r = await call('GET', `/admin/reports/breakdown?event=${event.id}`, { token });
    assert(r.status === 200, `status ${r.status}`);
    const yRow = r.body.data.companies.find((c) => c.id === yamaha.id);
    const dbCount = await db.collection('registrations').countDocuments({ company: new mongoose.Types.ObjectId(yamaha.id), status: 'confirmed' });
    assert(yRow && yRow.confirmed === dbCount, `report ${yRow?.confirmed} vs db ${dbCount}`);
    const cRow = r.body.data.coupons.find((c) => c.code === `TC${RUN}`);
    assert(cRow.allocated === 5 && cRow.used === 5 && cRow.remaining === 0 && cRow.state === 'exhausted', JSON.stringify(cRow));
    const o = await call('GET', `/admin/reports/overview?event=${event.id}`, { token });
    const totalDb = await db.collection('registrations').countDocuments({ event: new mongoose.Types.ObjectId(event.id) });
    assert(o.body.data.registrations.total === totalDb, `overview total ${o.body.data.registrations.total} vs ${totalDb}`);
    const csv = await call('GET', `/admin/registrations/export.csv?event=${event.id}&company=${yamaha.id}`, { token, raw: true });
    const lines = (await csv.text()).trim().split('\r\n');
    const allY = await db.collection('registrations').countDocuments({ company: new mongoose.Types.ObjectId(yamaha.id) });
    assert(lines.length - 1 === allY, `csv rows ${lines.length - 1} vs ${allY}`);
    return `Yamaha confirmed=${dbCount}, CSV rows=${lines.length - 1}`;
  });

  // 15-17. Check-in
  await test('15. Check-in succeeds for a confirmed ticket', async () => {
    const r = await call('POST', '/admin/checkin/scan', { token, body: { qrToken: `${API}/tickets/${yamahaReg.qrToken}` } });
    assert(r.status === 200 && r.body.data.result === 'success', `got ${r.status} ${r.body.data?.result}`);
    assert(r.body.data.company?.name === yamaha.name, 'company missing from scan');
    return r.body.data.registrationCode;
  });

  await test('16. Duplicate scan is rejected as already checked in', async () => {
    const r = await call('POST', '/admin/checkin/scan', { token, body: { qrToken: yamahaReg.qrToken } });
    assert(r.status === 200 && r.body.data.result === 'already-checked-in', `got ${r.status} ${r.body.data?.result}`);
    const racers = await Promise.all([1, 2, 3].map(() => call('POST', '/admin/checkin/scan', { token, body: { qrToken: yamahaReg.qrToken } })));
    assert(racers.every((x) => x.body.data.result === 'already-checked-in'), 'a re-scan reported success');
    return 'already-checked-in';
  });

  await test('17. Cancelled registration cannot check in; cancel releases the coupon place', async () => {
    const victim = track(await register(bCode));
    assert(victim.status === 201, `register ${victim.status}`);
    const doc = await db.collection('registrations').findOne({ registrationCode: victim.body.data.registrationCode });
    const before = await db.collection('coupons').findOne({ code: bCode });
    const noReason = await call('POST', `/admin/registrations/${doc._id}/cancel`, { token, body: {} });
    assert(noReason.status === 400, 'cancel without reason allowed');
    const c = await call('POST', `/admin/registrations/${doc._id}/cancel`, { token, body: { reason: 'Test cancellation' } });
    assert(c.status === 200 && c.body.data.status === 'cancelled', `cancel ${c.status}`);
    const after = await db.collection('coupons').findOne({ code: bCode });
    assert(after.usageCount === before.usageCount - 1, `usage ${before.usageCount} → ${after.usageCount}`);
    const again = await call('POST', `/admin/registrations/${doc._id}/cancel`, { token, body: { reason: 'again' } });
    assert(again.status === 409, 'double cancel allowed');
    const scan = await call('POST', '/admin/checkin/scan', { token, body: { qrToken: victim.body.data.qrToken } });
    assert(scan.status === 409, `scan got ${scan.status}`);
    const invalid = await call('POST', '/admin/checkin/scan', { token, body: { qrToken: 'f'.repeat(48) } });
    assert(invalid.status === 404, `invalid scan got ${invalid.status}`);
    const audit = await db.collection('auditlogs').countDocuments({ entityId: doc._id, action: 'registration.cancel' });
    assert(audit === 1, 'cancel not audited');
    return `${scan.body.error.message} / invalid → 404`;
  });

  // 18. Unauthorized access
  await test('18. Unauthorized API access is blocked (no token, and check-in staff role)', async () => {
    for (const path of ['/admin/coupons', '/admin/companies', '/admin/registrations', '/admin/reports/breakdown?event=x']) {
      // eslint-disable-next-line no-await-in-loop
      const r = await call('GET', path);
      assert(r.status === 401, `${path} → ${r.status}`);
    }
    const email = `test-staff-${RUN.toLowerCase()}@example.com`;
    const password = `Staff-${RUN}-pw1`;
    const u = await call('POST', '/admin/users', { token, body: { name: 'Test Staff', email, password, role: 'checkin_staff' } });
    assert(u.status === 201, `user create ${u.status} ${u.body.error?.message}`);
    created.user = u.body.data.id || u.body.data._id;
    const staff = await call('POST', '/admin/auth/login', { body: { email, password } });
    const st = staff.body.data.token;
    const forbidden = await Promise.all(
      ['/admin/coupons', '/admin/companies', `/admin/registrations?event=${event.id}`, `/admin/reports/breakdown?event=${event.id}`].map((p) => call('GET', p, { token: st }))
    );
    assert(forbidden.every((r) => r.status === 403), `statuses ${forbidden.map((r) => r.status)}`);
    const allowed = await call('GET', `/admin/reports/overview?event=${event.id}`, { token: st });
    const events = await call('GET', '/admin/checkin/events', { token: st });
    assert(allowed.status === 200 && events.status === 200, 'staff blocked from dashboard/check-in');
    return 'anon → 401, checkin_staff → 403 on ops, 200 on overview/check-in';
  });

  // 19. No Razorpay / existing features
  await test('19. Runs without Razorpay; existing public features still work', async () => {
    const removed = await Promise.all(['/payments/orders', '/payments/verify', '/promo/validate'].map((p) => call('POST', p, { body: {} })));
    assert(removed.every((r) => r.status === 404), 'payment routes still exist');
    const health = await call('GET', '/health');
    assert(health.body.data.database === 'connected', 'db not connected');
    const ticket = await call('GET', `/tickets/${yamahaReg.qrToken}`);
    assert(ticket.status === 200 && ticket.body.data.company.name === yamaha.name && ticket.body.data.couponCode === yCode, 'ticket page data');
    const pdf = await call('GET', `/tickets/${yamahaReg.qrToken}/pdf`, { raw: true });
    const buf = Buffer.from(await pdf.arrayBuffer());
    assert(pdf.status === 200 && buf.slice(0, 4).toString() === '%PDF', 'PDF broken');
    const qr = await call('GET', `/tickets/${yamahaReg.qrToken}/qr.png`, { raw: true });
    assert(qr.status === 200, 'QR broken');
    const ev = await call('GET', `/public/events/${SLUG}`);
    assert(ev.status === 200 && ev.body.data.event.title, 'event page broken');
    assert(!JSON.stringify(ticket.body).includes('deliveryLog'), 'internal fields leaked');
    return 'health, event page, ticket, PDF, QR OK; payment routes 404';
  });

  // ---- cleanup ----
  for (const code of created.registrations) {
    // eslint-disable-next-line no-await-in-loop
    const doc = await db.collection('registrations').findOne({ registrationCode: code });
    if (doc && doc.status === 'confirmed') {
      // eslint-disable-next-line no-await-in-loop
      await db.collection('registrations').updateOne({ _id: doc._id }, { $set: { checkedInAt: null } });
      // eslint-disable-next-line no-await-in-loop
      await call('POST', `/admin/registrations/${doc._id}/cancel`, { token, body: { reason: 'test cleanup' } });
    }
  }
  const regIds = (await db.collection('registrations').find({ registrationCode: { $in: created.registrations } }).project({ _id: 1 }).toArray()).map((d) => d._id);
  await db.collection('registrations').deleteMany({ _id: { $in: regIds } });
  await db.collection('auditlogs').deleteMany({ entityId: { $in: regIds } });
  await db.collection('coupons').deleteMany({ _id: { $in: created.coupons.map((id) => new mongoose.Types.ObjectId(id)) } });
  await db.collection('companies').deleteMany({ _id: { $in: created.companies.map((id) => new mongoose.Types.ObjectId(id)) } });
  if (created.user) await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(created.user) });

  const endEvent = await db.collection('events').findOne({ slug: SLUG });
  const endPass = await db.collection('tickettypes').findOne({ _id: passDoc._id });
  const restored = endEvent.registeredCount === startCounts.event && endPass.quantitySold === startCounts.pass;
  console.log(`\nCleanup: ${created.registrations.length} registrations, ${created.coupons.length} coupons, ${created.companies.length} companies removed; counters ${restored ? 'restored' : `NOT restored (event ${startCounts.event}→${endEvent.registeredCount}, pass ${startCounts.pass}→${endPass.quantitySold})`}`);
  if (!restored) fail += 1;

  await mongoose.disconnect();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
