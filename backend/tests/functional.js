'use strict';

/**
 * Backend functional test suite — every API area, against a RUNNING stack
 * (docker compose up) with real HTTP and a real MongoDB.
 *
 *   API_URL=http://localhost:8080 MONGODB_URI=mongodb://127.0.0.1:27017/prashanth_events \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:functional
 *
 * Everything runs against its own throwaway event, pass, companies, coupons
 * and users (all prefixed "FT-"), so the real event's numbers are never
 * touched; all of it is deleted at the end. Raise COUPON_VALIDATE_LIMIT_MAX,
 * REGISTRATION_LIMIT_MAX and RATE_LIMIT_MAX in backend/.env first (see
 * docs/COUPON-REGISTRATION.md), since this makes a few hundred requests.
 */

const mongoose = require('mongoose');

const API = (process.env.API_URL || 'http://localhost:8080').replace(/\/$/, '');
const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prashanth_events';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@prashanthhospitals.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
// Uploads go through the admin origin, exactly like the CMS does.
const ADMIN_URL = (process.env.ADMIN_URL || 'http://localhost:8082').replace(/\/$/, '');
const RUN = Date.now().toString(36).toUpperCase();
const ZERO_ID = '000000000000000000000000';
const DAY = 86400000;

let pass = 0;
let fail = 0;
let section = '';
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label || 'value'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function test(name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    fail += 1;
    failures.push(`[${section}] ${name}: ${err.message}`);
    console.log(`  FAIL  ${name}  — ${err.message}`);
  }
}

function group(name) {
  section = name;
  console.log(`\n=== ${name} ===`);
}

async function call(method, path, { body, token, raw, headers, rawBody } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json, headers: res.headers };
}

const get = (path, token) => call('GET', path, { token });
const post = (path, body, token) => call('POST', path, { body, token });
const patch = (path, body, token) => call('PATCH', path, { body, token });
const del = (path, token) => call('DELETE', path, { token });
const put = (path, body, token) => call('PUT', path, { body, token });

function expectStatus(res, status, label = '') {
  if (res.status !== status) {
    throw new Error(`${label}expected ${status}, got ${res.status}: ${JSON.stringify(res.body?.error || res.body).slice(0, 200)}`);
  }
  return res;
}

let seq = 0;
function person(tag = 'P') {
  seq += 1;
  const n = String(seq).padStart(3, '0');
  return {
    name: `FT Delegate ${tag} ${n}`,
    email: `ft-${RUN.toLowerCase()}-${n}@example.com`,
    phone: `98${String(Date.now()).slice(-5)}${n}`.slice(0, 10),
  };
}
function key() {
  return `ft-${RUN}-${Math.random().toString(36).slice(2)}-${Date.now()}`.slice(0, 64);
}

async function login(email, password) {
  const r = await post('/admin/auth/login', { email, password });
  expectStatus(r, 200, `login ${email}: `);
  return r.body.data.token;
}

async function main() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;
  const oid = (id) => new mongoose.Types.ObjectId(String(id));
  const created = { users: [], companies: [], coupons: [], events: [], uploads: [] };

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const mePre = await get('/admin/auth/me', admin);
  const adminId = mePre.body.data.user.id;

  // ------------------------------------------------------------------ setup
  async function makeUser(role, suffix) {
    const email = `ft-${suffix}-${RUN.toLowerCase()}@example.com`;
    const password = `Ft-${RUN}-pw-${suffix}`;
    const r = await post('/admin/users', { name: `FT ${suffix}`, email, password, role }, admin);
    expectStatus(r, 201, `create ${role}: `);
    created.users.push(r.body.data.id);
    return { id: r.body.data.id, email, password, token: await login(email, password) };
  }
  const manager = await makeUser('manager', 'mgr');
  const staff = await makeUser('checkin_staff', 'staff');

  // ================================================================ HEALTH
  group('Health, routing and request handling');

  await test('health reports DB connected', async () => {
    const r = expectStatus(await get('/health'), 200);
    eq(r.body.data.database, 'connected', 'database');
  });

  await test('unknown route → 404 JSON envelope', async () => {
    const r = expectStatus(await get('/does-not-exist'), 404);
    eq(r.body.success, false, 'success');
    eq(r.body.error.code, 'ROUTE_NOT_FOUND', 'code');
  });

  await test('malformed JSON body → 400, not 500', async () => {
    const r = await call('POST', '/coupons/validate', { rawBody: '{"code": ' });
    expectStatus(r, 400);
  });

  await test('security headers present (helmet), no x-powered-by', async () => {
    const r = await get('/health');
    assert(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff missing');
    assert(!r.headers.get('x-powered-by'), 'x-powered-by leaked');
  });

  // ================================================================ AUTH
  group('Auth & sessions');

  await test('login requires email and password', async () => {
    expectStatus(await post('/admin/auth/login', { email: ADMIN_EMAIL }), 400);
  });

  await test('wrong password and unknown email give the same 401 message', async () => {
    const a = expectStatus(await post('/admin/auth/login', { email: manager.email, password: 'wrong-password' }), 401);
    const b = expectStatus(await post('/admin/auth/login', { email: `nobody-${RUN}@example.com`, password: 'x' }), 401);
    eq(a.body.error.message, b.body.error.message, 'messages');
  });

  await test('login with object payload (NoSQL injection) is rejected', async () => {
    const r = await post('/admin/auth/login', { email: { $ne: null }, password: { $ne: null } });
    assert(r.status === 401 || r.status === 400, `got ${r.status}`);
  });

  await test('/me returns the user without secrets', async () => {
    const r = expectStatus(await get('/admin/auth/me', manager.token), 200);
    eq(r.body.data.user.role, 'manager', 'role');
    assert(!('passwordHash' in r.body.data.user), 'passwordHash leaked');
  });

  await test('garbage / missing bearer token → 401', async () => {
    expectStatus(await get('/admin/auth/me', 'not.a.jwt'), 401);
    expectStatus(await get('/admin/auth/me'), 401);
  });

  await test('5 wrong passwords lock the account (403), even for the right password', async () => {
    const victim = await makeUser('manager', 'lock');
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await post('/admin/auth/login', { email: victim.email, password: 'bad-password' });
    }
    const r = expectStatus(await post('/admin/auth/login', { email: victim.email, password: victim.password }), 403);
    assert(/minute/.test(r.body.error.message), r.body.error.message);
    // Superadmin password reset clears the lock.
    expectStatus(await patch(`/admin/users/${victim.id}`, { newPassword: `${victim.password}-2` }, admin), 200);
    expectStatus(await post('/admin/auth/login', { email: victim.email, password: `${victim.password}-2` }), 200);
  });

  await test('password reset ends existing sessions', async () => {
    const u = await makeUser('manager', 'reset');
    await new Promise((r) => setTimeout(r, 1100)); // iat has 1s resolution
    expectStatus(await patch(`/admin/users/${u.id}`, { newPassword: `${u.password}-new` }, admin), 200);
    const r = expectStatus(await get('/admin/auth/me', u.token), 401);
    assert(/password/i.test(r.body.error.message), r.body.error.message);
  });

  await test('deactivated user is signed out and cannot log in', async () => {
    const u = await makeUser('manager', 'deact');
    expectStatus(await patch(`/admin/users/${u.id}`, { isActive: false }, admin), 200);
    expectStatus(await get('/admin/auth/me', u.token), 401);
    expectStatus(await post('/admin/auth/login', { email: u.email, password: u.password }), 401);
  });

  // ================================================================ USERS
  group('Users & roles (superadmin only)');

  await test('create validates email, password, role and duplicates', async () => {
    expectStatus(await post('/admin/users', { name: 'X', email: 'not-an-email', password: 'longenough1' }, admin), 400, 'bad email: ');
    expectStatus(await post('/admin/users', { name: 'X', email: `ft-x-${RUN}@example.com`, password: 'short' }, admin), 400, 'short pw: ');
    expectStatus(await post('/admin/users', { name: 'X', email: `ft-x-${RUN}@example.com`, password: 12345678 }, admin), 400, 'numeric pw: ');
    expectStatus(await post('/admin/users', { name: 'X', email: `ft-x-${RUN}@example.com`, password: 'longenough1', role: 'god' }, admin), 400, 'bad role: ');
    expectStatus(await post('/admin/users', { name: 'X', email: manager.email.toUpperCase(), password: 'longenough1' }, admin), 409, 'duplicate: ');
  });

  await test('list never exposes password hashes', async () => {
    const r = expectStatus(await get('/admin/users', admin), 200);
    assert(r.body.data.length >= 2, 'too few users');
    assert(!JSON.stringify(r.body).includes('passwordHash'), 'hash leaked');
  });

  await test('superadmin cannot change own role, deactivate or delete self', async () => {
    expectStatus(await patch(`/admin/users/${adminId}`, { role: 'manager' }, admin), 400, 'role: ');
    expectStatus(await patch(`/admin/users/${adminId}`, { isActive: false }, admin), 400, 'deactivate: ');
    expectStatus(await del(`/admin/users/${adminId}`, admin), 400, 'delete: ');
  });

  await test('update with a non-string name is a 400, not a crash', async () => {
    expectStatus(await patch(`/admin/users/${manager.id}`, { name: { a: 1 } }, admin), 400);
  });

  await test('role change takes effect on the next request', async () => {
    const u = await makeUser('manager', 'role');
    expectStatus(await get('/admin/companies', u.token), 200);
    expectStatus(await patch(`/admin/users/${u.id}`, { role: 'checkin_staff' }, admin), 200);
    expectStatus(await get('/admin/companies', u.token), 403);
  });

  await test('unknown user id → 404, malformed id → 400', async () => {
    expectStatus(await patch(`/admin/users/${ZERO_ID}`, { name: 'x' }, admin), 404);
    expectStatus(await patch('/admin/users/nope', { name: 'x' }, admin), 400);
  });

  // ================================================================ RBAC
  group('Role-based access control');

  const opsRoutes = [
    ['GET', '/admin/events'],
    ['GET', '/admin/ticket-types'],
    ['GET', '/admin/companies'],
    ['GET', '/admin/coupons'],
    ['GET', '/admin/registrations'],
    ['GET', '/admin/reports/breakdown?event=' + ZERO_ID],
    ['GET', '/admin/feedback?event=' + ZERO_ID],
    ['POST', '/admin/uploads'],
  ];

  await test('check-in staff → 403 on every ops route', async () => {
    for (const [m, p] of opsRoutes) {
      // eslint-disable-next-line no-await-in-loop
      const r = await call(m, p, { token: staff.token });
      eq(r.status, 403, `${m} ${p}`);
    }
  });

  await test('check-in staff → allowed on dashboard + check-in', async () => {
    expectStatus(await get(`/admin/reports/overview?event=${ZERO_ID}`, staff.token), 200, 'overview: ');
    expectStatus(await get('/admin/checkin/events', staff.token), 200, 'events: ');
    expectStatus(await get(`/admin/checkin/stats?event=${ZERO_ID}`, staff.token), 200, 'stats: ');
  });

  await test('manager → 403 on users and audit log, allowed on ops', async () => {
    expectStatus(await get('/admin/users', manager.token), 403);
    expectStatus(await get('/admin/audit-log', manager.token), 403);
    expectStatus(await get('/admin/companies', manager.token), 200);
  });

  await test('query-string operator injection is neutralised', async () => {
    const r = await get('/admin/registrations?event[$ne]=x', admin);
    assert(r.status === 200 || r.status === 400, `got ${r.status}`);
    if (r.status === 200) eq(r.body.meta.total, (await get('/admin/registrations', admin)).body.meta.total, 'treated as plain key');
    const a = expectStatus(await get('/admin/audit-log?action[$ne]=zzz', admin), 200);
    assert(Array.isArray(a.body.data), 'audit list');
  });

  // ================================================================ EVENT CMS
  group('Event CMS');

  const now = Date.now();
  const evBody = {
    title: `FT Event ${RUN}`,
    slug: `ft-event-${RUN.toLowerCase()}`,
    startDate: new Date(now + 30 * DAY).toISOString(),
    endDate: new Date(now + 31 * DAY).toISOString(),
    registrationOpensAt: new Date(now - DAY).toISOString(),
    registrationClosesAt: new Date(now + 29 * DAY).toISOString(),
    capacity: 6,
  };
  let event;

  await test('create event (starts as draft), validates dates', async () => {
    expectStatus(await post('/admin/events', { ...evBody, slug: `${evBody.slug}-bad`, endDate: new Date(now).toISOString() }, manager.token), 400, 'end before start: ');
    const r = expectStatus(await post('/admin/events', evBody, manager.token), 201);
    event = r.body.data;
    created.events.push(event._id || event.id);
    eq(event.status, 'draft', 'status');
  });
  const eventId = event._id || event.id;

  await test('draft event is not public', async () => {
    expectStatus(await get(`/public/events/${evBody.slug}`), 404);
  });

  await test('duplicate slug → 409', async () => {
    expectStatus(await post('/admin/events', { ...evBody, title: 'dup' }, manager.token), 409);
  });

  await test('replace speakers/agenda/faqs/sponsors/committee/announcements', async () => {
    expectStatus(await put(`/admin/events/${eventId}/speakers`, { speakers: [{ name: 'Dr FT', topic: 'Testing' }] }, manager.token), 200);
    expectStatus(await put(`/admin/events/${eventId}/faqs`, { faqs: [{ question: 'Q?', answer: 'A.' }] }, manager.token), 200);
    expectStatus(await put(`/admin/events/${eventId}/agenda`, { agenda: [{ date: evBody.startDate, items: [{ startTime: '09:00', title: 'Open' }] }] }, manager.token), 200);
    expectStatus(await put(`/admin/events/${eventId}/sponsors`, { sponsors: [{ name: 'FT Sponsor', tier: 'gold' }] }, manager.token), 200);
    expectStatus(await put(`/admin/events/${eventId}/committee`, { committee: [{ name: 'FT Chair', group: 'organising' }] }, manager.token), 200);
    expectStatus(await put(`/admin/events/${eventId}/announcements`, { announcements: [{ message: 'Hello', level: 'info' }] }, manager.token), 200);
  });

  await test('array endpoints reject non-arrays and invalid items', async () => {
    expectStatus(await put(`/admin/events/${eventId}/speakers`, { speakers: 'nope' }, manager.token), 400, 'non-array: ');
    expectStatus(await put(`/admin/events/${eventId}/faqs`, { faqs: [{ question: 'no answer' }] }, manager.token), 400, 'missing answer: ');
  });

  await test('publish → visible publicly with content, no internal fields', async () => {
    expectStatus(await patch(`/admin/events/${eventId}`, { status: 'published' }, manager.token), 200);
    const r = expectStatus(await get(`/public/events/${evBody.slug}`), 200);
    eq(r.body.data.event.registrationState, 'open', 'registrationState');
    eq(r.body.data.event.speakers[0].name, 'Dr FT', 'speaker');
    assert(!('registeredCount' in r.body.data.event), 'registeredCount leaked');
  });

  await test('published event cannot be deleted', async () => {
    expectStatus(await del(`/admin/events/${eventId}`, manager.token), 409);
  });

  await test('registration-closed status reports "closed" (was "unavailable")', async () => {
    expectStatus(await patch(`/admin/events/${eventId}`, { status: 'registration-closed' }, manager.token), 200);
    const r = expectStatus(await get(`/public/events/${evBody.slug}`), 200);
    eq(r.body.data.event.registrationState, 'closed', 'registrationState');
    expectStatus(await patch(`/admin/events/${eventId}`, { status: 'published' }, manager.token), 200);
  });

  await test('event list, get by id, 404 / 400 for bad ids', async () => {
    const l = expectStatus(await get('/admin/events', manager.token), 200);
    assert(l.body.data.some((e) => String(e.id) === String(eventId)), 'not listed');
    expectStatus(await get(`/admin/events/${eventId}`, manager.token), 200);
    expectStatus(await get(`/admin/events/${ZERO_ID}`, manager.token), 404);
    expectStatus(await get('/admin/events/xyz', manager.token), 400);
  });

  await test('public event listing paginates and caps the page size', async () => {
    const r = expectStatus(await get('/public/events?limit=500'), 200);
    eq(r.body.meta.limit, 50, 'limit cap');
  });

  // ================================================================ PASSES
  group('Passes (ticket types)');

  let pass1;
  let hiddenPass;
  await test('create passes; validation errors are 400', async () => {
    expectStatus(await post('/admin/ticket-types', { name: 'x', code: 'X' }, manager.token), 400, 'no event: ');
    expectStatus(await post('/admin/ticket-types', { event: eventId, name: 'Bad', code: 'BAD', price: -5 }, manager.token), 400, 'negative price: ');
    const r = expectStatus(await post('/admin/ticket-types', { event: eventId, name: 'FT Pass', code: 'FTP', price: 1000, taxPercent: 18, quantityTotal: 4 }, manager.token), 201);
    pass1 = r.body.data;
    const h = expectStatus(await post('/admin/ticket-types', { event: eventId, name: 'FT Hidden', code: 'FTH', price: 0, isPubliclyVisible: false }, manager.token), 201);
    hiddenPass = h.body.data;
  });
  const passId = pass1.id || pass1._id;
  const hiddenId = hiddenPass.id || hiddenPass._id;

  await test('duplicate pass code within an event → 409', async () => {
    expectStatus(await post('/admin/ticket-types', { event: eventId, name: 'Dup', code: 'ftp' }, manager.token), 409);
  });

  await test('public pass list hides hidden passes and inventory numbers', async () => {
    const r = expectStatus(await get(`/public/events/${evBody.slug}/ticket-types`), 200);
    eq(r.body.data.length, 1, 'visible passes');
    assert(!('quantitySold' in r.body.data[0]) && !('quantityTotal' in r.body.data[0]), 'inventory leaked');
    eq(r.body.data[0].priceWithTax, 1180, 'priceWithTax');
  });

  // ================================================================ COMPANIES
  group('Companies');

  let acme;
  let globex;
  await test('create; name required; contact email validated', async () => {
    expectStatus(await post('/admin/companies', { name: '  ' }, manager.token), 400, 'blank: ');
    expectStatus(await post('/admin/companies', { name: `FT Bad ${RUN}`, contactEmail: 'nope' }, manager.token), 400, 'email: ');
    acme = expectStatus(await post('/admin/companies', { name: `FT Acme ${RUN}`, contactEmail: 'ops@acme.example.com' }, manager.token), 201).body.data;
    globex = expectStatus(await post('/admin/companies', { name: `FT Globex ${RUN}` }, manager.token), 201).body.data;
    created.companies.push(acme.id, globex.id);
  });

  await test('names are unique case- and space-insensitively', async () => {
    expectStatus(await post('/admin/companies', { name: `  ft   ACME ${RUN.toLowerCase()} ` }, manager.token), 409);
    expectStatus(await patch(`/admin/companies/${globex.id}`, { name: `FT ACME ${RUN}` }, manager.token), 409);
  });

  await test('list with search and active filter', async () => {
    const r = expectStatus(await get(`/admin/companies?q=${encodeURIComponent(`FT Acme ${RUN}`)}`, manager.token), 200);
    eq(r.body.data.length, 1, 'search results');
    const inactive = expectStatus(await get('/admin/companies?active=false', manager.token), 200);
    assert(!inactive.body.data.some((c) => c.id === acme.id), 'active company in inactive filter');
  });

  // ================================================================ COUPONS
  group('Coupons');

  const C = (s) => `FT${s}${RUN}`.slice(0, 32);
  let acmeCoupon;
  await test('create validates code, limit, dates, company', async () => {
    const base = { event: eventId, company: acme.id, maxAllowedRegistrations: 3 };
    expectStatus(await post('/admin/coupons', { ...base, code: 'bad code!' }, manager.token), 400, 'chars: ');
    expectStatus(await post('/admin/coupons', { ...base, code: 'AB' }, manager.token), 400, 'short: ');
    expectStatus(await post('/admin/coupons', { ...base, code: C('Z'), maxAllowedRegistrations: 0 }, manager.token), 400, 'max 0: ');
    expectStatus(await post('/admin/coupons', { ...base, code: C('Z'), maxAllowedRegistrations: 2.5 }, manager.token), 400, 'fractional: ');
    expectStatus(await post('/admin/coupons', { ...base, code: C('Z'), startDate: new Date(now + 5 * DAY).toISOString(), expiryDate: new Date(now + DAY).toISOString() }, manager.token), 400, 'dates: ');
    expectStatus(await post('/admin/coupons', { ...base, code: C('Z'), company: ZERO_ID }, manager.token), 404, 'company: ');
    expectStatus(await post('/admin/coupons', { ...base, code: C('Z'), event: ZERO_ID }, manager.token), 404, 'event: ');
    acmeCoupon = expectStatus(await post('/admin/coupons', { ...base, code: C('a').toLowerCase() }, manager.token), 201).body.data;
    created.coupons.push(acmeCoupon.id);
    eq(acmeCoupon.code, C('A'), 'stored uppercase');
    eq(acmeCoupon.state, 'active', 'state');
  });

  await test('duplicate code (any case) → 409', async () => {
    expectStatus(await post('/admin/coupons', { event: eventId, company: globex.id, code: C('a').toLowerCase(), maxAllowedRegistrations: 1 }, manager.token), 409);
  });

  await test('not-yet-started coupon is rejected with COUPON_NOT_STARTED', async () => {
    const c = expectStatus(await post('/admin/coupons', { event: eventId, company: globex.id, code: C('S'), maxAllowedRegistrations: 1, startDate: new Date(now + 2 * DAY).toISOString() }, manager.token), 201).body.data;
    created.coupons.push(c.id);
    eq(c.state, 'scheduled', 'state');
    const v = expectStatus(await post('/coupons/validate', { code: C('S'), eventSlug: evBody.slug, ticketTypeId: passId }), 400);
    eq(v.body.error.code, 'COUPON_NOT_STARTED', 'code');
  });

  await test('coupon for another event is just "not valid" (no existence leak)', async () => {
    const real = await db.collection('events').findOne({ slug: 'fertility-gynaecology-summit-2026' });
    if (!real) return;
    const realPass = await db.collection('tickettypes').findOne({ event: real._id, isPubliclyVisible: true, isActive: true });
    const v = await post('/coupons/validate', { code: C('A'), eventSlug: real.slug, ticketTypeId: String(realPass._id) });
    eq(v.body.error?.code, 'COUPON_INVALID', 'code');
  });

  await test('validate shows company and ₹0 maths incl. GST', async () => {
    const v = expectStatus(await post('/coupons/validate', { code: `  ${C('a').toLowerCase()} `, eventSlug: evBody.slug, ticketTypeId: passId }), 200);
    eq(v.body.data.companyName, acme.name, 'company');
    eq(v.body.data.originalAmount, 1180, 'original');
    eq(v.body.data.discountAmount, 1180, 'discount');
    eq(v.body.data.finalAmount, 0, 'final');
  });

  await test('validate input errors: blank code, missing pass, hidden pass, bad slug', async () => {
    expectStatus(await post('/coupons/validate', { code: '', eventSlug: evBody.slug, ticketTypeId: passId }), 400, 'blank: ');
    expectStatus(await post('/coupons/validate', { code: C('A'), eventSlug: evBody.slug }), 400, 'no pass: ');
    expectStatus(await post('/coupons/validate', { code: C('A'), eventSlug: evBody.slug, ticketTypeId: hiddenId }), 404, 'hidden pass: ');
    expectStatus(await post('/coupons/validate', { code: C('A'), eventSlug: 'no-such-event', ticketTypeId: passId }), 404, 'slug: ');
    expectStatus(await post('/coupons/validate', { code: { $ne: null }, eventSlug: { $ne: null }, ticketTypeId: passId }), 404, 'object payload: ');
  });

  // ================================================================ REGISTRATION
  group('Public registration');

  const reg = (code, who = person(), idem = key(), extra = {}) =>
    post('/registrations', { eventSlug: evBody.slug, ticketTypeId: passId, attendee: who, couponCode: code, idempotencyKey: idem, ...extra });

  await test('input validation: name, email, phone, coupon, idempotency key', async () => {
    const ok = person();
    expectStatus(await reg(C('A'), { ...ok, name: 'A' }), 400, 'name: ');
    expectStatus(await reg(C('A'), { ...ok, email: 'x@y' }), 400, 'email: ');
    expectStatus(await reg(C('A'), { ...ok, phone: '12345' }), 400, 'phone: ');
    expectStatus(await reg(C('A'), { ...ok, phone: 'abcdefghij' }), 400, 'phone letters: ');
    expectStatus(await reg('', ok), 400, 'no coupon: ');
    expectStatus(await reg(C('A'), ok, 'bad key!'), 400, 'idem key: ');
    expectStatus(await reg(C('A'), ok, key(), { ticketTypeId: hiddenId }), 404, 'hidden pass: ');
  });

  let r1;
  let globexCoupon;
  await test('valid registration: 201, confirmed, ₹0, QR, coupon + company linked', async () => {
    r1 = expectStatus(await reg(C('A'), person('one')), 201).body.data;
    eq(r1.status, 'confirmed', 'status');
    eq(r1.pricing.totalAmount, 0, 'total');
    eq(r1.pricing.basePrice + r1.pricing.taxAmount - r1.pricing.discountAmount, 0, 'reconciles');
    eq(r1.company.name, acme.name, 'company');
    assert(/^REG-[0-9A-F]{8}$/.test(r1.registrationCode), 'code format');
    assert(/^[0-9a-f]{48}$/.test(r1.qrToken), 'qr');
    assert(!('deliveryLog' in r1) && !('activeKey' in r1) && !('idempotencyKey' in r1), 'internal fields leaked');
  });

  await test('capacity counters moved by exactly one', async () => {
    const c = await db.collection('coupons').findOne({ _id: oid(acmeCoupon.id) });
    const p = await db.collection('tickettypes').findOne({ _id: oid(passId) });
    const e = await db.collection('events').findOne({ _id: oid(eventId) });
    eq(c.usageCount, 1, 'coupon usage');
    eq(p.quantitySold, 1, 'pass sold');
    eq(e.registeredCount, 1, 'event registered');
  });

  await test('same email again (any case) → 409', async () => {
    const who = { ...person(), email: r1.attendee.email.toUpperCase() };
    expectStatus(await reg(C('A'), who), 409);
  });

  await test('coupon exhausted at its limit (3), counters unchanged by refusals', async () => {
    expectStatus(await reg(C('A')), 201);
    expectStatus(await reg(C('A')), 201);
    const r = expectStatus(await reg(C('A')), 409);
    eq(r.body.error.code, 'COUPON_EXHAUSTED', 'code');
    const c = await db.collection('coupons').findOne({ _id: oid(acmeCoupon.id) });
    eq(c.usageCount, 3, 'usage');
  });

  await test('create a second company coupon', async () => {
    globexCoupon = expectStatus(await post('/admin/coupons', { event: eventId, company: globex.id, code: C('G'), maxAllowedRegistrations: 10 }, manager.token), 201).body.data;
    created.coupons.push(globexCoupon.id);
  });

  await test('deactivating a company blocks its coupons', async () => {
    expectStatus(await patch(`/admin/companies/${globex.id}`, { isActive: false }, manager.token), 200);
    try {
    const v = expectStatus(await post('/coupons/validate', { code: C('G'), eventSlug: evBody.slug, ticketTypeId: passId }), 400);
    eq(v.body.error.code, 'COUPON_COMPANY_INACTIVE', 'code');
    expectStatus(await post('/admin/coupons', { event: eventId, company: globex.id, code: C('H'), maxAllowedRegistrations: 1 }, manager.token), 409, 'coupon for inactive company: ');
    } finally {
      expectStatus(await patch(`/admin/companies/${globex.id}`, { isActive: true }, manager.token), 200);
    }
  });

  await test('pass sold out (4 total) refuses and releases the coupon place', async () => {
    expectStatus(await reg(C('G')), 201); // 4th pass sold
    const r = await reg(C('G'));
    assert(r.status === 409 || r.status === 404, `expected refusal, got ${r.status}`);
    const c = await db.collection('coupons').findOne({ _id: oid(globexCoupon.id) });
    eq(c.usageCount, 1, 'coupon usage after refusal');
  });

  // ================================================================ COUPON ADMIN
  group('Coupon administration after use');

  await test('used coupon: code and company locked, limit can’t go below usage', async () => {
    expectStatus(await patch(`/admin/coupons/${acmeCoupon.id}`, { code: C('NEW') }, manager.token), 409, 'code: ');
    expectStatus(await patch(`/admin/coupons/${acmeCoupon.id}`, { company: globex.id }, manager.token), 409, 'company: ');
    expectStatus(await patch(`/admin/coupons/${acmeCoupon.id}`, { maxAllowedRegistrations: 2 }, manager.token), 409, 'limit: ');
    const r = expectStatus(await patch(`/admin/coupons/${acmeCoupon.id}`, { maxAllowedRegistrations: 5, description: 'raised' }, manager.token), 200);
    eq(r.body.data.remaining, 2, 'remaining');
  });

  await test('used coupon cannot be deleted; unused can', async () => {
    expectStatus(await del(`/admin/coupons/${acmeCoupon.id}`, manager.token), 409);
    const tmp = expectStatus(await post('/admin/coupons', { event: eventId, company: acme.id, code: C('T'), maxAllowedRegistrations: 1 }, manager.token), 201).body.data;
    expectStatus(await del(`/admin/coupons/${tmp.id}`, manager.token), 200);
  });

  await test('coupon list filters by company, state and search', async () => {
    const byCompany = expectStatus(await get(`/admin/coupons?event=${eventId}&company=${acme.id}`, manager.token), 200);
    assert(byCompany.body.data.every((c) => c.company.id === acme.id), 'company filter');
    const scheduled = expectStatus(await get(`/admin/coupons?event=${eventId}&state=scheduled`, manager.token), 200);
    eq(scheduled.body.data.length, 1, 'scheduled count');
    const search = expectStatus(await get(`/admin/coupons?event=${eventId}&q=${C('a').toLowerCase().slice(0, 6)}`, manager.token), 200);
    assert(search.body.data.length >= 1, 'search');
  });

  await test('company with coupons cannot be deleted; deactivation keeps history', async () => {
    expectStatus(await del(`/admin/companies/${acme.id}`, manager.token), 409);
    const lone = expectStatus(await post('/admin/companies', { name: `FT Lone ${RUN}` }, manager.token), 201).body.data;
    expectStatus(await del(`/admin/companies/${lone.id}`, manager.token), 200);
  });

  await test('company list carries coupon/usage/registration stats', async () => {
    const r = expectStatus(await get(`/admin/companies?q=${encodeURIComponent(acme.name)}`, manager.token), 200);
    const row = r.body.data[0];
    eq(row.used, 3, 'used');
    eq(row.registrations, 3, 'registrations');
  });

  // ================================================================ REG ADMIN
  group('Registration administration');

  const r1Doc = await db.collection('registrations').findOne({ registrationCode: r1.registrationCode });
  const r1Id = String(r1Doc._id);

  await test('list: filters, search, sort, pagination', async () => {
    const all = expectStatus(await get(`/admin/registrations?event=${eventId}&limit=2&page=1&sort=createdAt`, manager.token), 200);
    eq(all.body.meta.total, 4, 'total');
    eq(all.body.data.length, 2, 'page size');
    eq(all.body.meta.totalPages, 2, 'pages');
    eq(all.body.data[0].registrationCode, r1.registrationCode, 'oldest first');
    const byCompany = expectStatus(await get(`/admin/registrations?event=${eventId}&company=${globex.id}`, manager.token), 200);
    eq(byCompany.body.meta.total, 1, 'company filter');
    const byCoupon = expectStatus(await get(`/admin/registrations?event=${eventId}&coupon=${acmeCoupon.id}`, manager.token), 200);
    eq(byCoupon.body.meta.total, 3, 'coupon filter');
    const q = expectStatus(await get(`/admin/registrations?event=${eventId}&q=${encodeURIComponent(r1.attendee.phone)}`, manager.token), 200);
    eq(q.body.meta.total, 1, 'search by phone');
    const notIn = expectStatus(await get(`/admin/registrations?event=${eventId}&checkedIn=no`, manager.token), 200);
    eq(notIn.body.meta.total, 4, 'not checked in');
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    const dated = expectStatus(await get(`/admin/registrations?event=${eventId}&from=${today}&to=${today}`, manager.token), 200);
    eq(dated.body.meta.total, 4, 'date filter (IST today)');
    const future = expectStatus(await get(`/admin/registrations?event=${eventId}&from=2099-01-01`, manager.token), 200);
    eq(future.body.meta.total, 0, 'future date');
    const row = all.body.data[0];
    assert(row.company?.name && row.qrStatus === 'active' && row.delivery?.email?.status, 'row shape');
  });

  await test('list rejects bad filter values with 400', async () => {
    expectStatus(await get(`/admin/registrations?status=bogus`, manager.token), 400, 'status: ');
    expectStatus(await get(`/admin/registrations?emailStatus=bogus`, manager.token), 400, 'emailStatus: ');
    expectStatus(await get(`/admin/registrations?from=13/13/2026`, manager.token), 400, 'date: ');
    expectStatus(await get(`/admin/registrations?company=nope`, manager.token), 400, 'company id: ');
  });

  await test('delivery recorded for both channels without blocking (wait for background send)', async () => {
    await new Promise((r) => setTimeout(r, 1500));
    const d = expectStatus(await get(`/admin/registrations/${r1Id}`, manager.token), 200).body.data;
    assert(d.delivery.email.attempts >= 1 && d.delivery.whatsapp.attempts >= 1, 'attempts');
    assert(d.deliveryLog.length >= 2, 'log');
    for (const ch of ['email', 'whatsapp']) {
      if (d.delivery[ch].status === 'sent') assert(d.delivery[ch].providerMessageId, `${ch} sent without provider id`);
    }
  });

  await test('delivery retry: channel validated, attempts logged + audited', async () => {
    expectStatus(await post(`/admin/registrations/${r1Id}/deliveries/sms`, {}, manager.token), 400, 'channel: ');
    const r = expectStatus(await post(`/admin/registrations/${r1Id}/deliveries/whatsapp`, {}, manager.token), 200);
    assert(r.body.message && r.body.data.outcome.status, 'outcome');
    const log = r.body.data.registration.deliveryLog;
    assert(log.some((e) => e.trigger === 'admin' && e.actorName === 'FT mgr'), 'admin attempt not logged');
  });

  await test('update: notes and attendee correction; email clash → 409', async () => {
    const r = expectStatus(await patch(`/admin/registrations/${r1Id}`, { notes: 'VIP guest', attendee: { name: 'Dr. Corrected Name' } }, manager.token), 200);
    eq(r.body.data.attendee.name, 'Dr. Corrected Name', 'name');
    eq(r.body.data.notes, 'VIP guest', 'notes');
    const other = (await get(`/admin/registrations?event=${eventId}&coupon=${acmeCoupon.id}&sort=-createdAt`, manager.token)).body.data[0];
    expectStatus(await patch(`/admin/registrations/${r1Id}`, { attendee: { email: other.attendee.email } }, manager.token), 409, 'clash: ');
    expectStatus(await patch(`/admin/registrations/${r1Id}`, { attendee: { phone: '12' } }, manager.token), 400, 'bad phone: ');
  });

  await test('CSV export honours filters and has the spec columns', async () => {
    const res = await call('GET', `/admin/registrations/export.csv?event=${eventId}&coupon=${acmeCoupon.id}`, { token: manager.token, raw: true });
    eq(res.status, 200, 'status');
    assert(/text\/csv/.test(res.headers.get('content-type')), 'content-type');
    const lines = (await res.text()).trim().split('\r\n');
    eq(lines.length - 1, 3, 'rows');
    for (const col of ['Registration ID', 'Name', 'Mobile', 'Email', 'Company', 'Coupon', 'Status', 'QR Status', 'Email Status', 'WhatsApp Status', 'Checked In At']) {
      assert(lines[0].includes(col), `missing column ${col}`);
    }
  });

  // ================================================================ TICKETS
  group('Tickets, check-in, feedback');

  await test('public ticket shows company/coupon/status, never internals', async () => {
    const t = expectStatus(await get(`/tickets/${r1.qrToken}`), 200).body.data;
    eq(t.company.name, acme.name, 'company');
    eq(t.couponCode, C('A'), 'coupon');
    eq(t.status, 'confirmed', 'status');
    const s = JSON.stringify(t);
    assert(!s.includes('deliveryLog') && !s.includes('activeKey') && !s.includes('notes'), 'internals leaked');
  });

  await test('ticket QR is a PNG and PDF is a PDF', async () => {
    const qr = await call('GET', `/tickets/${r1.qrToken}/qr.png`, { raw: true });
    eq(qr.headers.get('content-type'), 'image/png', 'qr type');
    const pdf = await call('GET', `/tickets/${r1.qrToken}/pdf`, { raw: true });
    const buf = Buffer.from(await pdf.arrayBuffer());
    eq(buf.slice(0, 4).toString(), '%PDF', 'pdf magic');
  });

  await test('bad / unknown ticket tokens → 404', async () => {
    expectStatus(await get('/tickets/not-a-token'), 404);
    expectStatus(await get(`/tickets/${'a'.repeat(48)}`), 404);
  });

  await test('certificate refused before the event is completed', async () => {
    expectStatus(await get(`/tickets/${r1.qrToken}/certificate.pdf`), 409);
  });

  await test('check-in: empty → 400, garbage → 404, success, duplicate', async () => {
    expectStatus(await post('/admin/checkin/scan', { qrToken: '' }, staff.token), 400, 'empty: ');
    expectStatus(await post('/admin/checkin/scan', { qrToken: 'hello' }, staff.token), 404, 'garbage: ');
    const ok = expectStatus(await post('/admin/checkin/scan', { qrToken: `${API}/tickets/${r1.qrToken}` }, staff.token), 200);
    eq(ok.body.data.result, 'success', 'result');
    eq(ok.body.data.company.name, acme.name, 'company');
    const again = expectStatus(await post('/admin/checkin/scan', { qrToken: r1.qrToken }, staff.token), 200);
    eq(again.body.data.result, 'already-checked-in', 'duplicate');
    const stats = expectStatus(await get(`/admin/checkin/stats?event=${eventId}`, staff.token), 200).body.data;
    eq(stats.checkedIn, 1, 'checkedIn');
    eq(stats.remaining, 3, 'remaining');
  });

  await test('checked-in registration cannot be cancelled', async () => {
    expectStatus(await post(`/admin/registrations/${r1Id}/cancel`, { reason: 'test' }, manager.token), 409);
  });

  let cancelled;
  await test('cancel: reason required, releases coupon/pass/seat, voids QR, audited', async () => {
    const target = (await get(`/admin/registrations?event=${eventId}&company=${globex.id}`, manager.token)).body.data[0];
    const tid = target.id || target._id;
    const before = {
      coupon: (await db.collection('coupons').findOne({ _id: oid(globexCoupon.id) })).usageCount,
      pass: (await db.collection('tickettypes').findOne({ _id: oid(passId) })).quantitySold,
      event: (await db.collection('events').findOne({ _id: oid(eventId) })).registeredCount,
    };
    expectStatus(await post(`/admin/registrations/${tid}/cancel`, { reason: 'x' }, manager.token), 400, 'short reason: ');
    const r = expectStatus(await post(`/admin/registrations/${tid}/cancel`, { reason: 'Duplicate delegate' }, manager.token), 200);
    cancelled = r.body.data;
    eq(cancelled.status, 'cancelled', 'status');
    eq(cancelled.qrStatus, 'void', 'qr');
    eq(cancelled.cancellationReason, 'Duplicate delegate', 'reason');
    eq(cancelled.cancelledBy.name, 'FT mgr', 'cancelledBy');
    eq((await db.collection('coupons').findOne({ _id: oid(globexCoupon.id) })).usageCount, before.coupon - 1, 'coupon released');
    eq((await db.collection('tickettypes').findOne({ _id: oid(passId) })).quantitySold, before.pass - 1, 'pass released');
    eq((await db.collection('events').findOne({ _id: oid(eventId) })).registeredCount, before.event - 1, 'seat released');
    expectStatus(await post(`/admin/registrations/${tid}/cancel`, { reason: 'again please' }, manager.token), 409, 'double cancel: ');
    const audit = await db.collection('auditlogs').countDocuments({ entityId: oid(tid), action: 'registration.cancel' });
    eq(audit, 1, 'audit');
  });

  await test('cancelled ticket: check-in 409, PDF 409, delivery retry 409, page shows cancelled', async () => {
    const tok = (await db.collection('registrations').findOne({ registrationCode: cancelled.registrationCode })).qrToken;
    expectStatus(await post('/admin/checkin/scan', { qrToken: tok }, staff.token), 409, 'scan: ');
    expectStatus(await get(`/tickets/${tok}/pdf`), 409, 'pdf: ');
    expectStatus(await post(`/admin/registrations/${cancelled.id || cancelled._id}/deliveries/email`, {}, manager.token), 409, 'retry: ');
    eq(expectStatus(await get(`/tickets/${tok}`), 200).body.data.status, 'cancelled', 'ticket status');
  });

  await test('the cancelled delegate can register again (email freed)', async () => {
    const r = await reg(C('G'), { ...person(), email: cancelled.attendee.email });
    expectStatus(r, 201);
  });

  await test('feedback: validation, injection, success, duplicate, cancelled', async () => {
    expectStatus(await post('/feedback', { qrToken: { $ne: null }, rating: 5 }), 400, 'injection: ');
    expectStatus(await post('/feedback', { qrToken: r1.qrToken, rating: 9 }), 400, 'rating: ');
    expectStatus(await post('/feedback', { qrToken: 'b'.repeat(48), rating: 4 }), 404, 'unknown: ');
    expectStatus(await post('/feedback', { qrToken: r1.qrToken, rating: 5, comments: { x: 1 } }), 400, 'comments type: ');
    expectStatus(await post('/feedback', { qrToken: r1.qrToken, rating: 5, comments: 'Great' }), 201, 'submit: ');
    expectStatus(await post('/feedback', { qrToken: r1.qrToken, rating: 4 }), 409, 'duplicate: ');
    const tok = (await db.collection('registrations').findOne({ registrationCode: cancelled.registrationCode })).qrToken;
    expectStatus(await post('/feedback', { qrToken: tok, rating: 3 }), 409, 'cancelled: ');
  });

  await test('admin feedback list with average; bad event id → 400', async () => {
    const r = expectStatus(await get(`/admin/feedback?event=${eventId}`, manager.token), 200);
    eq(r.body.meta.average, 5, 'average');
    eq(r.body.meta.count, 1, 'count');
    expectStatus(await get('/admin/feedback?event=nope', manager.token), 400);
  });

  await test('certificate issued once the event is completed (confirmed only)', async () => {
    expectStatus(await patch(`/admin/events/${eventId}`, { status: 'completed' }, manager.token), 200);
    const res = await call('GET', `/tickets/${r1.qrToken}/certificate.pdf`, { raw: true });
    eq(res.status, 200, 'status');
    const tok = (await db.collection('registrations').findOne({ registrationCode: cancelled.registrationCode })).qrToken;
    expectStatus(await get(`/tickets/${tok}/certificate.pdf`), 409, 'cancelled cert: ');
    const v = await post('/coupons/validate', { code: C('A'), eventSlug: evBody.slug, ticketTypeId: passId });
    expectStatus(v, 409, 'registration after completion: ');
    expectStatus(await patch(`/admin/events/${eventId}`, { status: 'published' }, manager.token), 200);
  });

  // ================================================================ REPORTS
  group('Reports');

  await test('overview: totals, check-in, coupons, delivery all match the DB', async () => {
    const o = expectStatus(await get(`/admin/reports/overview?event=${eventId}`, staff.token), 200).body.data;
    const ev = oid(eventId);
    eq(o.registrations.total, await db.collection('registrations').countDocuments({ event: ev }), 'total');
    eq(o.registrations.confirmed, await db.collection('registrations').countDocuments({ event: ev, status: 'confirmed' }), 'confirmed');
    eq(o.registrations.cancelled, 1, 'cancelled');
    eq(o.checkIn.checkedIn, 1, 'checked in');
    const coupons = await db.collection('coupons').find({ event: ev }).toArray();
    eq(o.coupons.used, coupons.reduce((s, c) => s + c.usageCount, 0), 'coupon used');
    eq(o.coupons.allocated, coupons.reduce((s, c) => s + c.maxAllowedRegistrations, 0), 'allocated');
    const d = o.delivery.email;
    eq(d.sent + d.failed + d.retryable + d.pending + d.not_configured, o.registrations.confirmed, 'email statuses add up');
  });

  await test('breakdown: per-company and per-coupon numbers match the DB', async () => {
    const b = expectStatus(await get(`/admin/reports/breakdown?event=${eventId}`, manager.token), 200).body.data;
    const acmeRow = b.companies.find((c) => c.id === acme.id);
    eq(acmeRow.confirmed, await db.collection('registrations').countDocuments({ company: oid(acme.id), status: 'confirmed' }), 'acme confirmed');
    eq(acmeRow.checkedIn, 1, 'acme checked in');
    const gRow = b.coupons.find((c) => c.code === C('G'));
    eq(gRow.cancelled, 1, 'globex cancelled');
    eq(gRow.used, (await db.collection('coupons').findOne({ _id: oid(globexCoupon.id) })).usageCount, 'globex used');
    assert(b.daily.length >= 1, 'daily');
  });

  await test('breakdown date filter and validation', async () => {
    const empty = expectStatus(await get(`/admin/reports/breakdown?event=${eventId}&from=2099-01-01`, manager.token), 200).body.data;
    assert(empty.companies.every((c) => c.confirmed === 0), 'future range should have no registrations');
    expectStatus(await get(`/admin/reports/breakdown?event=${eventId}&from=garbage`, manager.token), 400, 'bad date: ');
    expectStatus(await get('/admin/reports/breakdown', manager.token), 400, 'no event: ');
    expectStatus(await get('/admin/reports/overview?event=bad', manager.token), 400, 'bad event: ');
  });

  await test('company and coupon CSV exports', async () => {
    for (const [path, header] of [['companies.csv', 'Company,Coupons,Allocated'], ['coupons.csv', 'Coupon,Company,State']]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await call('GET', `/admin/reports/export/${path}?event=${eventId}`, { token: manager.token, raw: true });
      eq(res.status, 200, path);
      // eslint-disable-next-line no-await-in-loop
      const text = await res.text();
      assert(text.startsWith(header), `${path} header: ${text.slice(0, 40)}`);
    }
  });

  // ================================================================ UPLOADS
  group('Uploads');

  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  async function upload(buf, type, name) {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type }), name);
    const res = await fetch(`${ADMIN_URL}/api/v1/admin/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${manager.token}` }, body: fd });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  await test('PNG upload → 201; served as an image (not index.html) on BOTH sites, sandboxed', async () => {
    const r = expectStatus(await upload(PNG, 'image/png', 'logo.png'), 201);
    created.uploads.push(r.body.data.url);
    for (const origin of [API, ADMIN_URL]) {
      // eslint-disable-next-line no-await-in-loop
      const img = await fetch(`${origin}${r.body.data.url}`);
      eq(img.headers.get('content-type'), 'image/png', `${origin} content-type`);
    }
    const res = await fetch(`${API}${r.body.data.url}`);
    eq(res.status, 200, 'fetch');
    assert(/sandbox/.test(res.headers.get('content-security-policy') || ''), 'no sandbox CSP');
    eq(res.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
  });

  await test('image with an .html filename is stored as .png (no HTML served)', async () => {
    const r = expectStatus(await upload(PNG, 'image/png', 'evil.html'), 201);
    created.uploads.push(r.body.data.url);
    assert(r.body.data.url.endsWith('.png'), r.body.data.url);
  });

  await test('non-image and oversized uploads → 400 (not 500)', async () => {
    expectStatus(await upload(Buffer.from('<script>alert(1)</script>'), 'text/html', 'x.html'), 400, 'html: ');
    expectStatus(await upload(Buffer.alloc(5.5 * 1024 * 1024, 1), 'image/png', 'big.png'), 400, 'too big: ');
    const mid = expectStatus(await upload(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), 'image/png', 'mid.png'), 201, '2 MB image: ');
    created.uploads.push(mid.body.data.url);
    const res = await fetch(`${ADMIN_URL}/api/v1/admin/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${manager.token}` } });
    eq(res.status, 400, 'no file');
  });

  // ================================================================ AUDIT
  group('Audit log');

  await test('admin actions are recorded with actor names', async () => {
    const r = expectStatus(await get('/admin/audit-log?action=coupon.create&limit=200', admin), 200);
    assert(r.body.data.some((e) => e.actorName === 'FT mgr'), 'coupon.create by FT mgr not found');
    const c = expectStatus(await get('/admin/audit-log?entityType=Company&limit=5', admin), 200);
    assert(c.body.data.every((e) => e.entityType === 'Company'), 'entityType filter');
  });

  await test('passwords never appear in the audit log', async () => {
    const r = expectStatus(await get('/admin/audit-log?action=user.update&limit=200', admin), 200);
    assert(!JSON.stringify(r.body).includes('-pw-'), 'password leaked into audit log');
  });

  // ================================================================ CMS DELETE GUARDS
  group('Delete guards');

  await test('pass with registrations cannot be deleted', async () => {
    expectStatus(await del(`/admin/ticket-types/${passId}`, manager.token), 409);
    expectStatus(await del(`/admin/ticket-types/${hiddenId}`, manager.token), 200);
  });

  await test('draft event with registrations/coupons cannot be deleted', async () => {
    expectStatus(await patch(`/admin/events/${eventId}`, { status: 'draft' }, manager.token), 200);
    expectStatus(await del(`/admin/events/${eventId}`, manager.token), 409);
  });

  await test('empty draft event deletes and takes its passes with it', async () => {
    const e = expectStatus(await post('/admin/events', { ...evBody, slug: `${evBody.slug}-2`, title: 'FT temp' }, manager.token), 201).body.data;
    const eid = e._id || e.id;
    expectStatus(await post('/admin/ticket-types', { event: eid, name: 'T', code: 'T1' }, manager.token), 201);
    expectStatus(await del(`/admin/events/${eid}`, manager.token), 200);
    eq(await db.collection('tickettypes').countDocuments({ event: oid(eid) }), 0, 'passes cascade');
  });

  // ================================================================ CLEANUP
  const ev = oid(eventId);
  const regIds = (await db.collection('registrations').find({ event: ev }).project({ _id: 1 }).toArray()).map((d) => d._id);
  await db.collection('feedbacks').deleteMany({ event: ev });
  await db.collection('registrations').deleteMany({ event: ev });
  await db.collection('coupons').deleteMany({ event: ev });
  await db.collection('tickettypes').deleteMany({ event: ev });
  await db.collection('events').deleteMany({ _id: { $in: created.events.map(oid) } });
  await db.collection('companies').deleteMany({ name: new RegExp(`^FT .* ${RUN}$`) });
  const userIds = (await db.collection('users').find({ email: new RegExp(`^ft-.*-${RUN.toLowerCase()}@example\\.com$`) }).project({ _id: 1 }).toArray()).map((u) => u._id);
  await db.collection('users').deleteMany({ _id: { $in: userIds } });
  await db.collection('auditlogs').deleteMany({ $or: [{ actor: { $in: userIds } }, { entityId: { $in: [...regIds, ...userIds, ev] } }] });
  try {
    // Uploaded test images live in the api container's volume.
    // eslint-disable-next-line global-require
    const { execFileSync } = require('child_process');
    const files = created.uploads.map((u) => `/app${u}`);
    if (files.length) execFileSync('docker', ['exec', 'prashanth-api', 'rm', '-f', ...files], { stdio: 'ignore' });
  } catch {
    console.log('  (could not remove uploaded test images — not running under docker compose?)');
  }
  console.log(`\nCleanup: test event, ${regIds.length} registrations, coupons, companies and ${userIds.length} users removed.`);

  await mongoose.disconnect();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (failures.length) console.log(`\nFailures:\n- ${failures.join('\n- ')}`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
