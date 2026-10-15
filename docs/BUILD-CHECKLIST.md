# Build checklist — Modules 2–15

Live tracker for the full platform build-out. Checked items are done, built,
and verified (docker rebuild + `tests/verify.js` + manual/curl smoke, and
Playwright screenshots for UI-heavy modules). See
`README.md` for the module summary table and `docs/API.md` for the endpoint
reference as it grows.

> **Update (Oct 2026):** Modules 5 (promo codes) and 6 (Razorpay payments) were
> later replaced by company-coupon registration at ₹0 — see
> [COUPON-REGISTRATION.md](COUPON-REGISTRATION.md). The sections below are kept
> as the historical build record.

## Foundation — Auth & RBAC ✅

- [x] `User` model + `bcryptjs`/`jsonwebtoken` utils + `requireAuth`/`requireRole` middleware
- [x] `POST /api/v1/admin/auth/login` (rate-limited + lockout), `GET /api/v1/admin/auth/me`
- [x] `seed/seedAdmin.js` idempotent superadmin bootstrap
- [x] `frontend-admin/` app scaffold (Vite, Router, AuthContext, ProtectedRoute, shell layout, Login page)
- [x] `frontend-admin` Dockerfile + nginx conf; `admin` service added to docker-compose.yml
- [x] `tests/verify.js` §Auth (41/41 passing)

Verified: full stack up via `docker compose up --build -d` (mongo/api/web/admin all
healthy), `npm run seed:admin` bootstraps superadmin, login → `/me` round-trips a
JWT end-to-end through NGINX on port 8082, wrong password / missing token / bad
token all correctly rejected. Playwright screenshots (desktop + mobile, incl. the
mobile nav drawer) confirm the premium split-screen login and sidebar shell with
zero console errors. Role-gated nav items (`Users & roles`, `Audit log`) only
render for `superadmin`.

## Module 2 — Event CMS ✅

- [x] Admin CRUD for Event (details, venue, theme, seo, organizer, contact)
- [x] Sub-resource CRUD: speakers, agenda days/items, sponsors, faqs, announcements
- [x] Image upload (multer → `/uploads`, static-served, 5MB limit, image-only)
- [x] `frontend-admin` Event Editor (8-tab UI: Details, Venue & Contact, Theme & SEO, Speakers, Agenda, Sponsors, FAQ, Announcements)
- [x] Verified in Docker + screenshots

Verified: logged in as superadmin, edited the tagline through the Details tab
and confirmed the change round-tripped to the public microsite's `/public/events/:slug`
payload live; replaced the FAQ array via the CMS and confirmed it too. Ran the
full 8-tab editor against the real seeded event (6 speakers, nested
day→session agenda, 5 sponsors) via Playwright — all tabs render real data
correctly, the nested agenda editor (days containing sessions) works, and
Save round-trips through PATCH/PUT correctly. Found and fixed one real bug
during review: `ImageUploadField` rendered a blank white box instead of the
neutral placeholder icon when a stored image URL 404s (e.g. the seed data's
placeholder `/assets/logo-prashanth.svg`) — switched from a CSS
background-image to an `<img onError>` with a broken-state fallback.
`checkin_staff` role is correctly excluded from all `/admin/events/*` routes
(manager+ only). Re-seeded after testing to restore the original demo content.

## Module 4 — Ticketing & Pass Types ✅

- [x] Admin CRUD for TicketType (create/update/delete, manager+ only)
- [x] `frontend-admin` Ticket Types page (live sold/held/available inventory)
- [x] Verified

Verified: edited the Regular pass's price live against the real seeded event
(118 sold / 0 held / 132 available correctly computed from real inventory
fields), saved, confirmed via screenshot, re-seeded to restore. Delete is
blocked server-side once `quantitySold > 0` (409 conflict) — deactivate
instead of delete once a pass has sales. `tests/verify.js` extended with
route-guard checks (52/52 passing). Zero console errors.

## Module 5 — Promo Code Management ✅

- [x] PromoCode model + admin CRUD
- [x] Public `POST /api/v1/promo/validate`
- [x] `frontend-admin` Promo Codes page
- [x] Verified

Verified: created a real 20%-off code through the admin UI, then hit the
public `/api/v1/promo/validate` endpoint directly — correctly computed
₹500 off a ₹2500 pass (final ₹2000), and correctly rejected an unknown code
with `valid:false`. Delete is blocked once a code has been redeemed
(`usedCount > 0`, 409), same pattern as ticket-type delete. Model-level
checks (discount rounding, flat-discount capping, expiry window, exhausted
max-uses, unlimited-use codes, validTo/validFrom ordering) all covered in
`tests/verify.js` without needing a DB (62/62 passing). Test code cleaned
up afterward.

## Module 3 — Registration Management ✅

- [x] Inventory hold/release service (`services/inventory.js`)
- [x] Public `POST /api/v1/registrations`
- [x] Admin registration list/search/filter/detail/cancel (resend arrives in Module 8 with WhatsApp)
- [x] `frontend-public` real registration form (replaces placeholder route)
- [x] `frontend-admin` Registrations page
- [x] Verified

Verified end-to-end through the real Docker stack, not just curl:
- **Paid path (UI):** selected "Delegate — Regular" on the live microsite, filled
  the form, submitted — got a "Registration received" holding state with a real
  registration code, ₹2,950 total (2500 + 18% GST) computed correctly.
  Confirmed server-side the pass's `quantityHeld` went 0→1 (a true atomic hold,
  `Event.registeredCount` deliberately untouched until payment confirms).
- **Free path (API):** created a temp free pass, registered against it —
  confirmed immediately, 48-hex `qrToken` issued, `quantitySold` and
  `Event.registeredCount` both incremented atomically.
- **Cancel + compensation:** cancelled the paid (held) registration from the
  admin UI — hold released back to 0, status flipped to "cancelled" with the
  reason note, all reflected live with no page reload. Cancelled the free
  (confirmed) registration via the API — `quantitySold` and
  `registeredCount` both correctly decremented back.
- Sold-out and closed-registration paths return a clear 409 with the specific
  reason (`sold-out`, `closed`, `not-yet-open`, etc.) rather than a generic error.
- `tests/verify.js` covers the DB-free parts (registrationCode generation,
  `isFree` virtual, QR token format) — 69/69 passing. The inventory/capacity
  logic itself was verified against the live database above rather than in
  the DB-free suite, since it's inherently about atomic Mongo updates.
- Test data cleaned up afterward.

## Module 6 — Payment Gateway ✅

- [x] Razorpay order creation, signature verify, webhook (idempotent)
- [x] Inventory hold→sold commit on payment confirm
- [x] `frontend-public` checkout step (Razorpay Checkout.js)
- [x] `frontend-admin` Payments ledger page
- [x] Verified (HMAC fixtures now; real test-mode charge once keys supplied)

Verified against the real Docker stack running with `NODE_ENV=production` (the
actual deployment config, not the dev-mode verify sandbox) — and that caught a
real bug: `createOrder`/`verifyPayment` originally threw `ApiError.internal()`
(500) for "payments not configured yet," but `errorHandler.js` masks every
5xx message in production to avoid leaking internals, so the attendee-facing
UI showed a generic "Something went wrong" instead of the intended graceful
message. Fixed by using 409 (Conflict) instead, matching how the codebase
already uses 409 for other "can't do this right now" states (sold-out,
already-cancelled) — 409 isn't masked. Re-verified in the same production-mode
container: the register→pay flow now correctly shows "Online payment is being
enabled shortly" and the admin Payments page shows a helpful empty state
naming the exact env vars to add. The raw webhook body is captured via
`express.json({verify})` in `app.js` so the HMAC signature is computed over
the true bytes Razorpay sent, not a re-serialization. `tests/verify.js`
covers the dev-safe-when-unconfigured paths and the HMAC formula itself
(74/74 passing) — the DB-free suite alone would NOT have caught the masking
bug above, which is why the real production-mode Docker pass mattered here.

## Module 7 — Digital Ticket & QR ✅

- [x] QR token generation (`utils/qrcode.js`), branded PDF ticket (`utils/ticketPdf.js`, pdfkit)
- [x] `GET /api/v1/tickets/:qrToken`, `/qr.png`, `/pdf`
- [x] `frontend-public` Ticket page (`/tickets/:qrToken`)
- [x] Verified

Verified end-to-end: created a temp free pass, registered through the real
UI, followed "View your ticket" to `/tickets/:qrToken`, confirmed the QR
image renders (real `<img>` hitting `/api/v1/tickets/:qrToken/qr.png`) and
downloaded the PDF (`file` confirms: valid PDF 1.3, 1 page). The QR encodes
`{PUBLIC_SITE_URL}/tickets/:qrToken` so any camera opens the ticket page, and
Module 9's admin scanner will extract the token from that same URL.

Caught and fixed two real layout bugs by actually reading the rendered PDF
(not just checking it parsed): the header text ("PRASHANTH HOSPITALS" /
"DIGITAL TICKET") overlapped because the two lines were spaced for a
single-line brand name that actually wrapped to two, and the event title
broke mid-word ("Gy" / "naecology") because the left band was too narrow for
an 18pt title. Fixed by measuring actual wrapped height with
`doc.heightOfString()` before placing the title, widening the band, and
right-sizing the font for longer titles. Re-verified with a fresh PDF —
clean two-line brand header, title wraps at word boundaries only.
`tests/verify.js` covers the QR PNG generation (magic-byte check) — the
layout bugs above were only visible by rendering the real output, which is
why this module's verification leaned on that rather than the DB-free suite.
Test data cleaned up afterward.

## Module 8 — WhatsApp Integration ✅

- [x] Meta Cloud API client (dev-safe no-op without credentials)
- [x] Send ticket confirmation on payment/free-registration confirm
- [x] Admin manual resend endpoint + `frontend-admin` "Resend ticket" button
- [x] Verified (log-based, real send once keys supplied)

Verified: registering a free pass through the real API triggers the send
path, which correctly no-ops with a clear log line
(`[WhatsApp no-op] would message 9222222222: Hi WA Test! 🎉...`) and a one-
time warning, without blocking or failing the registration response itself
(wrapped in try/catch at both call sites — Module 3's free-confirm path and
Module 6's paid-confirm path). The admin "Resend ticket" button surfaces the
same "not configured" state as a clear, actionable message naming the exact
env vars to set — same graceful-degradation pattern as Module 6's payments.
Phone normalization (bare 10-digit → 91-prefixed, formatted numbers →
digits-only) covered in `tests/verify.js` (78/78 passing). Test data cleaned
up afterward.

## Module 9 — Event-Day Check-in ✅

- [x] `POST /api/v1/admin/checkin/scan`, `GET /admin/checkin/stats`
- [x] `frontend-admin` Check-in scanner page (camera + manual, `checkin_staff` role included)
- [x] Verified

Verified with a real registration end-to-end: first check-in shows a full-
screen green "Checked in" state with live stats updating (1→2 across two
test registrations); scanning the same code again correctly shows amber
"Already checked in" with the original timestamp, not a duplicate success;
an invalid code shows a clear red "Not valid" state. All three states and
the stats tiles confirmed via screenshots.

Found and fixed two real bugs during this verification, not caught by the
DB-free suite:
1. The debounce guard meant to stop the camera's continuous frame callback
   from re-submitting the same code a dozen times a second was also
   blocking **manual** submissions — a human deliberately clicking "Check
   in" a second time did nothing. Split into `submitScan` (the raw call,
   used by manual entry) and `handleCameraDetect` (debounced, camera-only).
2. When `Html5Qrcode`'s constructor throws (no camera / element timing),
   the UI got stuck forever on "Starting camera…" instead of falling back
   to manual entry, because the throw happened outside the promise chain's
   `.catch()`. Wrapped the constructor in try/catch to set `cameraStatus`
   to `'unavailable'` on failure — re-verified showing the correct
   "Camera not available … use manual entry below" message.

`tests/verify.js` covers the QR-payload token extraction (URL → token,
bare token, trailing slash) — 83/83 passing. Test data cleaned up
afterward.

## Module 10 — Admin Dashboard ✅

- [x] Overview page (real stat tiles + `recharts` bar chart, `GET /admin/reports/overview`)
- [x] Users/role management (superadmin only, full CRUD + password reset)
- [x] Full nav shell (all pages built through Module 9 are live, no more ComingSoon placeholders except Feedback/Audit Log/Help)
- [x] Verified + screenshots

Verified with real data: created 3 registrations, confirmed the dashboard's
stat tiles (3 registrations, "Free" revenue, 0/3 checked in) and the
"Registrations by pass" bar chart (built per the `dataviz` skill: single
brand-hue bars since it's one measure split by category, not a multi-series
palette; recessive grid, no axis lines, tooltip) all render real live data —
screenshot confirms a correctly-scaled, correctly-labeled bar. Verified the
Users page end-to-end: created a `checkin_staff` user through the UI, logged
in as them, and confirmed **both** layers of the RBAC actually hold — the
sidebar correctly hides "Users & roles"/"Audit log" for that role, **and**
independently the server returns a real 403 on `GET /admin/events` for that
role's token (checked directly via `fetch`, not just "the button isn't
shown"). Self-protection confirmed: a superadmin cannot deactivate or delete
their own account (both client button disabled and would 400 server-side).
Test user, ticket type and registrations all cleaned up afterward.
`tests/verify.js` route-guard coverage extended to `/admin/reports` and
`/admin/users` (88/88 passing).

## Module 11 — Reports & Export ✅

- [x] Aggregation endpoint (shared with Module 10's overview) + hand-rolled CSV export utility
- [x] `frontend-admin` Reports page (stat tiles, revenue-by-pass chart, CSV downloads)
- [x] Verified

Verified end-to-end, not just that the endpoint returns 200: clicked "Export
registrations CSV" in the real browser (token-authenticated download via
fetch+blob, since a plain `<a href>` can't carry a Bearer header) and read
the downloaded file back — correct header row, correct escaping, 14 rows
matching the actual registration history including historical
cancelled/refunded ones. `tests/verify.js` covers the CSV utility directly
(comma/quote/newline escaping, dotted-path key lookup, missing-value
blanking) — 92/92 passing.

Found and fixed a real chart bug via screenshot, not caught by the DB-free
suite: when every confirmed registration is on a free pass (all-zero
revenue), recharts can't infer a real scale from an all-zero dataset and
fabricates a small linear 0–4 axis — which, run through the currency
tick-formatter, rendered as "₹1, ₹2, ₹3, ₹4" next to bars that were
actually zero. A chart implying nonexistent revenue is worse than no chart.
Fixed by detecting `overview.revenue === 0` and showing an honest
"No paid revenue yet — N confirmed registrations, all on free passes"
empty state instead of a bar chart with a fabricated scale. Re-verified with
a fresh screenshot. Test data cleaned up afterward.

## Module 12 — Feedback & Certificates ✅

- [x] Feedback model + public submit endpoint (`POST /feedback`, qrToken-gated, one per registration)
- [x] On-the-fly certificate PDF (`GET /tickets/:qrToken/certificate.pdf`, gated on `event.status === 'completed'`)
- [x] `frontend-public` Feedback page (star rating + comments); `frontend-admin` Feedback page (list + average)
- [x] Verified

Verified end-to-end with a real registration: submitted feedback (4 stars +
comment) through the real star-rating UI, confirmed the admin Feedback page
shows it with the correct average (4★) and attendee attribution.
Confirmed the certificate button is correctly **hidden** on the ticket page
while the event is still upcoming, then temporarily flipped the event to
`completed`, downloaded the certificate, and read the actual rendered PDF —
clean double-border layout, centered text, no overlaps (applying the lesson
from Module 7's ticket-PDF bugs paid off: this one rendered correctly on the
first try). Restored the event to `published` and removed all test data
(including the test feedback document, via a direct one-off `mongosh`
delete since there's intentionally no admin delete endpoint for feedback —
it's meant to be an honest, immutable attendee record). `tests/verify.js`
covers rating validation ahead of any DB lookup — 97/97 passing.

## Module 13 — Security & Access Control ✅

- [x] AuditLog model + `recordAudit()` wired into every admin mutation (Event
      CMS, Ticket Types, Promo Codes, Registrations, Users, Check-in)
- [x] Login lockout verified; CORS admin origin added (both already in
      place since Foundation, re-verified here)
- [x] `frontend-admin` Audit Log page
- [x] Role matrix documented in `docs/API.md`

Verified with real actions, not synthetic ones: patched the live event's
tagline, created and deleted a real promo code, and created a test
`manager` user — all four showed up correctly in `GET /admin/audit-log`
with the right actor, action, entity and metadata (screenshot confirms
color-coded action badges: green=create, blue=update, red=delete).
Confirmed the RBAC boundary directly via `curl` with a real `manager`-role
token (not just "the nav item is hidden"): `403` on `/admin/users` and
`/admin/audit-log`, `200` on `/admin/events` — exactly matching the role
matrix now documented in `docs/API.md`. Password fields are explicitly
excluded from audit `meta` (only a `passwordReset: true/false` boolean is
logged, never the value). Test manager user cleaned up afterward; the
audit trail itself was left intact as the honest historical record it's
meant to be. `tests/verify.js` route-guard coverage extended to
`/admin/audit-log` (98/98 passing).

## Module 14 — Deployment & Go-Live ✅

- [x] docker-compose finalized (mongo/api/web/admin + uploads volume) — in
      place since Foundation/Module 2, confirmed still correct here
- [x] GitHub Actions CI (`.github/workflows/ci.yml`: backend verify+lint,
      both frontend builds, then a full `docker compose build`)
- [x] `scripts/backup-mongo.sh`
- [x] `docs/DEPLOYMENT.md` rewritten Docker-first (the old version predated
      Docker becoming the standard path and described a bare-metal PM2
      setup with none of Modules 2-13's services)

Verified for real, not just written: ran `docker compose build` locally —
the exact command CI's final job runs — and all three custom images
(api/web/admin) built cleanly. Ran the actual backup script against the
live stack: dumped all 8 collections (14 registrations, 5 audit log
entries, etc.) to a gzipped archive, then — since the deployment guide
says "test a restore before go-live, not after an incident" — actually
practiced that advice: restored the archive into a throwaway database
(`restore_test`, via `mongorestore --nsFrom/--nsTo` so the live data was
never touched), confirmed the document counts matched, and dropped the
test database. `backend/npm run lint` (`node --check`) verified to pass
before trusting it in the CI job. Test backup artifact removed;
`backups/` added to `.gitignore`.

## Module 15 — Support ✅

- [x] `docs/SUPPORT.md` ops runbook (everyday tasks, emergency superadmin
      recovery, restart/redeploy, troubleshooting, escalation criteria)
- [x] `frontend-admin` Help page (role-aware quick-task cards + troubleshooting)

Verified visually: logged in and confirmed all six task cards render and
link to the correct pages, the four troubleshooting entries are readable
and accurate against what was actually built in Modules 6/8 (payment/
WhatsApp dev-safe degradation, hold-window sold-out confusion), zero
console errors. Superadmin-only cards ("Add or reset an admin user", "See
who changed what") use the same role-filter pattern already verified
working in the sidebar nav (Module 10) and route guards throughout, so a
dedicated re-test wasn't needed. No backend changes this module —
`tests/verify.js` unaffected (98/98 passing).

---

## All 15 modules delivered ✅

Foundation (auth/RBAC) plus all 13 build modules are complete, verified
against the live Docker stack, and committed. See the final click-through
demo checklist below.

## Final demo ✅

- [x] Full click-through, captured with screenshots at every step

Capstone verification, run against a **fresh `docker compose down` +
`up --build`** (not the long-running dev containers) to make sure the whole
stack actually comes up clean from nothing, not just "still running from
earlier": register on the public microsite → view digital ticket with QR →
check in via the admin scanner (manual entry, camera correctly reports
unavailable in headless Chromium) → submit feedback via the ticket's
"Give feedback" link → confirm it appears correctly in Admin → Reports
(1 confirmed, 100% checked in) and Admin → Feedback (5★, correct attendee
attribution). All four services (`mongo`/`api`/`web`/`admin`) came up
healthy from the clean rebuild; zero console errors across the whole flow
in both the public and admin apps. The payment step of "register → pay"
was exercised earlier in Module 6 with the same real Razorpay Checkout.js
flow (dev-safe "not configured" path, since no real test keys were
supplied) and the certificate step in Module 12 (event temporarily flipped
to `completed`, PDF downloaded and read back) — not re-run here to avoid
re-mutating event state right before hand-off; both are documented with
their own screenshots in their module sections above.

All test data (2 registrations, 1 temp ticket type, 2 feedback entries)
cleaned up afterward — confirmed via API: 0 confirmed registrations, 5
ticket types (the original seed set), 0 feedback entries. Final
`backend/tests/verify.js` run: **98/98 passing.**

## UI refresh — Modern SaaS minimal ✅

Both apps (`frontend-public`, `frontend-admin`) restyled in the Linear/Stripe/Vercel
direction: Inter-only typography, near-monochrome ink palette with a single indigo
accent (`#4F46E5`), near-black primary buttons, hairline borders, tighter radii,
restrained shadows and motion, near-black hero / admin sidebar with a soft indigo
glow. Done by remapping the design tokens (variable names unchanged) plus targeted
component tweaks, so no page logic changed.

- [x] Tokens, fonts, headings, buttons, badges-adjacent surfaces in both apps
- [x] Public: hero, announcement bar (info = ink, warning = amber), tickets, speakers, agenda, CTA
- [x] Admin: sidebar shell, login, forms, cards, stat tiles, tables
- [x] Event theme defaults (`#4F46E5`) in `Event.js` + CMS Theme tab; Razorpay checkout theme
- [x] Rebuilt in Docker; Playwright desktop + mobile screenshots of both apps, 0 console errors
- [x] `backend/tests/verify.js` still **98/98**
