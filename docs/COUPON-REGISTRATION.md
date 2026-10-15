# Coupon Registration — Change Notes

This change replaces the paid Razorpay / promo-code flow with **company
coupon registration**. Every registration is ₹0.00 and is confirmed the
moment it is created. Attendee-facing flow: [CURRENT-FLOW.md](CURRENT-FLOW.md).

---

## 1. Summary of changes

**Registration**
- The public form asks only for **full name, mobile, email and coupon
  code**. Pass selection is kept; participant type is removed.
- **Validate** previews the coupon: company, original amount, discount, and
  final ₹0.00. **Complete Registration** re-validates on the server, then
  creates the registration as `confirmed` with a unique QR token.
- Capacity is taken in three atomic, guarded steps — coupon place, pass unit,
  event seat. If a later step fails, the earlier ones are undone. A
  concurrency test (12 simultaneous submits on a 5-place coupon) produces
  exactly 5 registrations.
- Duplicate protection:
  - A per-form idempotency key means a double submit returns the same
    registration.
  - A unique "active registration" key allows one live registration per
    email per event.

**Ticket delivery**
- After the response is sent, the ticket goes out by **email** (SMTP via
  nodemailer: HTML message, inline QR, PDF attachment, ticket link) and by
  **WhatsApp** (existing Meta client, with optional approved-template
  support).
- The two channels are independent. Each one records:
  - status: `pending` / `sent` / `failed` / `retryable` / `not_configured`
  - attempts, last-attempt time, sent time, error and provider message id
  - a per-attempt history (`deliveryLog`)
- A channel is marked `sent` only when the provider accepted the message and
  returned an id. Missing credentials never block a registration.

**Admin**
- New Companies and Coupons pages.
- The Registrations page is rebuilt:
  - all the spec's columns, search, nine filters, sorting and pagination
  - filtered CSV export
  - a detail drawer with QR/ticket download, resend email, retry WhatsApp,
    the delivery log, notes, and cancel-with-reason
- The Dashboard and Reports are rebuilt around companies, coupons, delivery
  and check-in.
- Role-gated navigation and routes.

**Check-in**
- Check-in is now a single guarded update, so simultaneous scans can't both
  succeed.
- Cancelled tickets are refused with a clear message.
- The result shows the attendee's company.

**Payment removal**
- Razorpay is removed: the SDK, payment routes, webhook, checkout UI, admin
  Payments ledger, promo-code admin and API, the 15-minute hold sweep, and the
  raw-body capture.
- The `Payment` and `PromoCode` models stay so historical records still load.

**Fixed along the way:** check-in staff couldn't load the event list on the
Check-in page, because `/admin/events` is manager-only. A minimal
`/admin/checkin/events` list now serves that page and the Dashboard.

## 2. Files

**Added — backend**
- `src/models/Company.js`, `src/models/Coupon.js`
- `src/services/coupon.js` — validation and atomic reserve/release
- `src/services/delivery.js` — independent email/WhatsApp delivery and status
- `src/services/email/mailer.js`, `src/services/email/ticketEmail.js`
- `src/services/registrationQuery.js` — shared filters and sort for the list, CSV and reports
- `src/middleware/rateLimits.js`
- `src/controllers/adminCompanyController.js`, `src/controllers/adminCouponController.js`
- `src/routes/adminCompanyRoutes.js`, `src/routes/adminCouponRoutes.js`, `src/routes/publicCouponRoutes.js`
- `src/seed/seedCoupons.js`
- `tests/coupon-flow.js`

**Added — admin**
- `pages/Companies`, `pages/Coupons`
- `components/ui/Drawer.*`, `components/StatusBadges.jsx`
- `lib/companyApi.js`, `lib/couponApi.js`, `lib/download.js`, `lib/useEvents.jsx`

**Changed**
- Backend:
  - `models/Registration.js`, `config/env.js`, `app.js`, `routes/index.js`
  - the registration, admin-registration, report, check-in and ticket
    controllers and routes
  - `services/inventory.js`, `services/registrationSerializer.js`,
    `services/whatsapp/*`, `utils/ticketPdf.js`
  - `tests/verify.js`, `package.json`, `.env.example`
- Public site: `pages/RegisterPage.*`, `pages/TicketPage.*`, `lib/api.js`,
  `lib/format.js`, `sections/Tickets.jsx`.
- Admin:
  - `App.jsx`, `components/layout/AppShell.jsx`
  - the Registrations, Dashboard, Reports, Check-in and Help pages
  - `lib/registrationApi.js`, `lib/reportApi.js`, `lib/checkinApi.js`,
    `styles/admin.css`
- Config: `render.yaml`, `docker-compose.yml`, and `docs/*`.

**Removed**
- Backend:
  - `controllers/publicPaymentController.js`, `controllers/adminPaymentController.js`
  - `controllers/publicPromoController.js`, `controllers/adminPromoController.js`
  - their four route files
  - `services/razorpay.js`, `services/promo.js`, `services/promoCodeSerializer.js`
- Public site: `lib/razorpay.js`.
- Admin: `pages/Payments`, `pages/PromoCodes`, `lib/paymentApi.js`,
  `lib/promoApi.js`.
- Dependency: `razorpay`. Added: `nodemailer@10.1.1` (`npm audit` clean).

## 3. Migration notes (MongoDB)

No migration script is needed. Nothing is deleted, and every change is
additive.

**New collections**
- `companies`: unique `nameKey`, the lowercased name.
- `coupons`: unique uppercase `code`, plus `event`, `company` and
  `{event, company}` indexes.

**`registrations` — new fields**
- `coupon`, `company`, `couponCode` (snapshot)
- `idempotencyKey` (unique, sparse), `activeKey` (unique, sparse)
- `delivery.email`, `delivery.whatsapp`, `deliveryLog`
- `cancelledAt`, `cancelledBy`, `cancellationReason`

**`registrations` — new indexes**
- `{event, createdAt}`, `attendee.phone`
- `delivery.email.status`, `delivery.whatsapp.status`

**`registrations` — kept unchanged**
- `status` keeps its old enum values, so `pending_payment` and `refunded`
  records still load. Only `confirmed` is ever created now.
- `promoCode`, `payment` and `participantType` are kept for history.
- `payments` and `promocodes` collections are untouched (read-only history,
  no longer exposed).

**Index builds**
- Indexes are built on API start by `ensureIndexes()`, which is idempotent.
- The new unique indexes are sparse, and older registrations don't have
  those fields, so the builds can't fail on existing data.

**Legacy and leftover data**
- Old registrations show up as "No company (legacy)" in reports.
- Any `pending_payment` registration left from the old flow can be cancelled
  from Registrations. That also releases its old hold.
- Leftover env vars (`RAZORPAY_*`, `TICKET_HOLD_MINUTES`) are now ignored and
  can be deleted from `.env` and Render.

**Coupon policy on cancellation:** cancelling a confirmed registration
gives one place back to its coupon (`usageCount − 1`), along with the pass
unit and event seat. Checked-in registrations can't be cancelled.

## 4. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_LIMIT_WINDOW_MINUTES` | 10 | Window for the two limits below |
| `COUPON_VALIDATE_LIMIT_MAX` | 20 | Coupon validations per IP per window (anti-guessing) |
| `REGISTRATION_LIMIT_MAX` | 10 | Registration submits per IP per window |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | – / 587 / false | SMTP server (`SMTP_SECURE=true` for port 465) |
| `SMTP_USER` / `SMTP_PASS` | – | SMTP credentials |
| `MAIL_FROM` | – | Sender, e.g. `CIIM 2026 <tickets@ciim2026.com>`. Email is "not configured" without it and `SMTP_HOST` |
| `MAIL_REPLY_TO` | – | Optional reply-to |
| `WHATSAPP_TEMPLATE_NAME` | – | Approved Meta template. Body params: `{{1}}` name, `{{2}}` event, `{{3}}` registration ID, `{{4}}` ticket link |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `en` | Template language code |

Existing and unchanged: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_API_VERSION`, `PUBLIC_SITE_URL` (used in ticket links).
**Removed:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `TICKET_HOLD_MINUTES`.

## 5. Endpoints

**Added**

| Method & path | Role | Notes |
|---|---|---|
| `POST /api/v1/coupons/validate` | public, rate-limited | `{ code, eventSlug, ticketTypeId }` → `{ valid, code, companyName, originalAmount, discountAmount, finalAmount: 0, currency }` |
| `GET/POST /api/v1/admin/companies`, `PATCH/DELETE /api/v1/admin/companies/:id` | superadmin, manager | Delete only if unused; otherwise deactivate |
| `GET/POST /api/v1/admin/coupons`, `PATCH/DELETE /api/v1/admin/coupons/:id` | superadmin, manager | Filters: `event`, `company`, `state`, `q`. Delete only if never used |
| `GET /api/v1/admin/registrations/export.csv` | superadmin, manager | Same filters as the list |
| `POST /api/v1/admin/registrations/:id/deliveries/:channel` | superadmin, manager | `channel` = `email` \| `whatsapp`; returns the outcome + updated registration |
| `GET /api/v1/admin/reports/breakdown` | superadmin, manager | Company and coupon tables + daily counts; `from`/`to` |
| `GET /api/v1/admin/reports/export/companies.csv`, `/coupons.csv` | superadmin, manager | `event`, `from`, `to` |
| `GET /api/v1/admin/checkin/events` | all admin roles | Minimal event list |

**Changed**

| Method & path | Change |
|---|---|
| `POST /api/v1/registrations` | Body `{ eventSlug, ticketTypeId, attendee: { name, email, phone }, couponCode, idempotencyKey }`. Coupon required; always `confirmed` at ₹0; rate-limited; 201 (or 200 for an idempotent repeat) |
| `GET /api/v1/admin/registrations` | New filters `company`, `coupon`, `emailStatus`, `whatsappStatus`, `checkedIn`, `from`, `to`, `sort`; company/coupon/delivery/`qrStatus` in rows |
| `POST /api/v1/admin/registrations/:id/cancel` | `reason` required; releases the coupon place; atomic; refuses checked-in |
| `GET /api/v1/admin/reports/overview` | New shape (coupons, delivery, byCompany, byCoupon, daily); now readable by `checkin_staff` |
| `GET /api/v1/admin/reports/export/registrations.csv` | Coupon-era columns, honours filters |
| `POST /api/v1/admin/checkin/scan` | Atomic; adds company/coupon; cancelled → 409 with a clear message |
| `GET /api/v1/tickets/:qrToken` | Adds `company`, `couponCode`, `amountPaid`, `registeredAt`; attendee trimmed to name/email/phone |

**Removed:** `POST /payments/orders`, `POST /payments/verify`,
`POST /payments/webhook`, `GET /admin/payments`, `POST /promo/validate`,
`/admin/promo` (CRUD), `GET /registrations/:code` (exposed attendee data by a
guessable code), `POST /admin/registrations/:id/resend-ticket` (replaced by
`deliveries/:channel`), `GET /admin/reports/export/payments.csv`.

**Coupon error codes** (`error.code`)
- `COUPON_INVALID` (400) — also returned for a code that belongs to another
  event, so the error never confirms that a code exists.
- `COUPON_EXPIRED` (400)
- `COUPON_NOT_STARTED` (400)
- `COUPON_INACTIVE` (400)
- `COUPON_COMPANY_INACTIVE` (400)
- `COUPON_EXHAUSTED` (409)
- `RATE_LIMITED` (429)

## 6. Test results

**`npm run verify`** (no database): **120 passed, 0 failed** (after the QA pass). It covers:
- route guards for every new admin route
- removed payment routes returning 404
- coupon model rules and code normalisation
- pricing reconciliation (base + tax − discount = 0)
- delivery status classification
- safe filter building

**`npm run test:flow`** (live Docker stack + MongoDB): **19 passed, 0 failed**.

| # | Case | Result |
|---|---|---|
| 1 | Valid Yamaha coupon | ✅ registered at ₹0, linked to Yamaha |
| 2 | Valid Bajaj coupon | ✅ linked to Bajaj |
| 3 | Invalid coupon | ✅ 400 `COUPON_INVALID` |
| 4 | Expired coupon | ✅ 400 `COUPON_EXPIRED` |
| 5 | Inactive coupon | ✅ 400 `COUPON_INACTIVE` |
| 6 | Exhausted coupon | ✅ 409 `COUPON_EXHAUSTED` |
| 7 | Concurrency (12 at once, 5 places) | ✅ exactly 5 created, 7 refused, `usageCount` = 5 |
| 8 | Duplicate submit | ✅ same registration returned, one record; same email again → 409 |
| 9 | Unique QR | ✅ all tokens unique, 48 hex chars |
| 10 | Email failure / missing SMTP | ✅ registration confirmed; email `not_configured` |
| 11 | WhatsApp failure / missing credentials | ✅ registration confirmed; WhatsApp `not_configured` |
| 12 | Independent channels | ✅ both tracked, both in the attempt log |
| 13 | Retry deliveries | ✅ attempts incremented, admin attempt logged, audit-logged |
| 14 | Accurate reports | ✅ company counts and CSV rows match the database |
| 15 | Check-in success | ✅ |
| 16 | Duplicate scan | ✅ `already-checked-in`, including 3 simultaneous re-scans |
| 17 | Cancelled scan | ✅ 409; cancel released the coupon place; double cancel refused; audit-logged |
| 18 | Unauthorised access | ✅ no token → 401; `checkin_staff` → 403 on ops, 200 on dashboard/check-in |
| 19 | No Razorpay; existing features | ✅ payment routes 404; event page, ticket, PDF, QR, health OK |

The flow test cleans up after itself and confirms the event and pass
counters are restored.

**Also checked by hand**
- With the default limits, the 21st coupon validation from one IP got 429.
- Playwright run of register → validate → success → ticket page (desktop and
  390 px mobile) and every new admin page: no console errors, no horizontal
  overflow.

**Not tested:** real email and WhatsApp delivery. No SMTP or Meta
credentials were available, so only the `not_configured` path has run end to
end. The sent and failed classification is covered by unit checks.

A later QA pass added a full backend functional suite (`npm run test:functional`, 87/87) and fixed 19 bugs — see [QA-REPORT.md](QA-REPORT.md).

## 7. Setup

```bash
cp backend/.env.example backend/.env       # fill SMTP_* / WHATSAPP_* when available
docker compose up --build -d
docker compose exec api npm run seed        # sample event (skip for a real launch)
docker compose exec api npm run seed:admin
docker compose exec api npm run seed:coupons  # optional: YAMAHA2026 / BAJAJ2026, 50 places each

cd backend && npm run verify                # unit/HTTP checks, no DB needed
# Live flow test — raise COUPON_VALIDATE_LIMIT_MAX / REGISTRATION_LIMIT_MAX in
# backend/.env first (e.g. 1000), restart the api, then revert afterwards:
API_URL=http://localhost:8080 MONGODB_URI=mongodb://127.0.0.1:27017/prashanth_events npm run test:flow
```

## 8. Integrations that still need credentials

| Integration | What to provide | Until then |
|---|---|---|
| **Email (SMTP)** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` from any provider (Google Workspace, Zoho, SES, SendGrid…) | Email status `not_configured`; use "Send email" per registration once set |
| **WhatsApp (Meta Cloud API)** | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and an approved template name in `WHATSAPP_TEMPLATE_NAME` with 4 body variables | WhatsApp status `not_configured`; "Retry WhatsApp" once set |

Neither one blocks registration. The attendee always sees the QR on screen
and can download the PDF.
