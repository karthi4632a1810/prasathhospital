# Backend QA Report — bug-fix and functional testing pass

Date: 15 Oct 2026 · Scope: the whole backend API plus the nginx configs in front of it.

## How it was tested

| Suite | What it covers | Needs | Result |
|---|---|---|---|
| `npm run verify` | Models, serializers, validation, route guards, HTTP layer, regression checks | nothing (no DB) | **120 / 120** |
| `npm run test:functional` | **Every API area** end to end over real HTTP + MongoDB (see below) | running stack | **87 / 87** |
| `npm run test:flow` | The 19 coupon-registration acceptance cases from the spec | running stack | **19 / 19** |

`test:functional` builds its own throwaway event, pass, companies, coupons
and users (prefixed `FT-`), so the real CIIM event is never touched. It also
deletes everything it created afterwards, including uploaded test images.

Areas covered by `test:functional`:
- **Health, routing and request handling:** 404 envelope, malformed JSON,
  security headers.
- **Auth:**
  - validation, identical errors for unknown email vs wrong password
  - NoSQL-injection payloads
  - lockout after 5 failures and unlock by password reset
  - a password reset ends existing sessions; deactivated users are signed out
- **Users:**
  - email, password, role and duplicate validation
  - no password hashes in responses
  - a superadmin cannot change their own role, deactivate or delete themselves
  - role changes take effect immediately
- **RBAC:**
  - check-in staff get 403 on every ops route and 200 on dashboard/check-in
  - managers get 403 on users and the audit log
  - query-string operator injection is neutralised
- **Event CMS:**
  - create/publish/edit, date validation, duplicate slug
  - all six content-array endpoints and their validation
  - draft events stay private
  - the public payload leaks no internal counters
  - the registration-closed state is reported correctly
- **Passes:** validation, duplicate codes; hidden passes and inventory never
  appear publicly; GST maths.
- **Companies:** validation, case/space-insensitive uniqueness, search and
  filters, stats, delete guards.
- **Coupons:**
  - validation (characters, length, limit, dates, unknown company or event)
  - case-insensitive uniqueness
  - the not-started state; codes from other events don't leak
  - a deactivated company blocks its coupons
  - once used, the code and company are locked
  - the limit can't drop below usage; used coupons can't be deleted
  - list filters
- **Public registration:**
  - input validation
  - ₹0 pricing that reconciles
  - each capacity counter moves by exactly one
  - duplicate email refused
  - coupon exhausted; pass sold out (and the coupon place is released)
- **Registration admin:**
  - every filter, search, sort and pagination
  - bad filter values give 400
  - delivery is recorded per channel; delivery retry is logged and audited
  - attendee correction, and an email clash gives 409
  - filtered CSV with the spec's columns
- **Tickets, check-in, feedback:**
  - ticket payload carries no internals; QR is a PNG and the PDF is a PDF
  - bad tokens give 404
  - check-in: success, duplicate, empty and garbage scans
  - checked-in registrations can't be cancelled
  - cancelling releases the coupon, pass and seat, voids the QR and is audited
  - cancelled tickets are refused at check-in and for PDF and delivery
  - a cancelled delegate's email is freed to register again
  - feedback: validation, injection, duplicates, cancelled tickets
  - certificate only after completion and only when confirmed
- **Reports:** overview and breakdown match the database exactly, date
  filters, validation, company/coupon CSVs.
- **Uploads:**
  - images are served correctly on both sites and sandboxed
  - an `.html` filename is stored as `.png`
  - non-image and oversized files get 400; a 2 MB image works
- **Audit log:** actions are recorded with actor names, and passwords never
  appear in it.
- **Delete guards:**
  - a pass or draft event with registrations can't be deleted
  - deleting an empty draft event removes its passes too

## Bugs found and fixed

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | **High (security)** | `POST /feedback` passed `qrToken` straight into a Mongo query. `{"qrToken":{"$ne":null}}` matched someone else's registration, so anyone could post feedback as any delegate | Token must be a 48-hex string; type-checked before any lookup |
| 2 | **High (security)** | Uploads kept the client's file extension, so an "image" named `x.html` was stored and served as HTML. SVGs could carry script. Either way, script could run in the admin origin and steal tokens | Extension now comes from the MIME allow-list; `/uploads` is served with `nosniff` and a `sandbox` CSP |
| 3 | **High (broken feature)** | The public site's nginx had **no `/uploads/` route**, so speaker photos and sponsor logos uploaded in the CMS returned `index.html`. The production nginx config 404'd them too | `location ^~ /uploads/` proxy added to `frontend-public/nginx-container.conf` and `nginx/prashanth-events.conf` |
| 4 | **High (broken feature)** | nginx's default 1 MB body limit rejected admin image uploads between 1 and 5 MB with an HTML 413, although the API allows 5 MB | `client_max_body_size 6m` on both container configs |
| 5 | Medium (security) | Query strings were parsed with the "extended" parser, so `?event[$ne]=x` reached Mongo filters as an operator | `app.set('query parser', 'simple')` |
| 6 | Medium (security) | A password reset left the user's existing 7-day sessions valid | `passwordChangedAt`; tokens issued before it are rejected |
| 7 | Medium | Cancelled registrations could still download the ticket PDF and the attendance certificate | Both now require a confirmed registration |
| 8 | Medium | A superadmin could demote themselves, and an account could be left with no active superadmin | Own-role changes are blocked; the last active superadmin can't be demoted, deactivated or deleted |
| 9 | Medium | Deleting a draft event left its passes, coupons and registrations orphaned | Blocked if it has registrations or coupons; its passes are deleted with it |
| 10 | Medium | A pass with only cancelled registrations could be deleted, orphaning those records | Blocked while any registration references it |
| 11 | Medium | An oversized upload or wrong form field returned **500** (multer errors weren't mapped) | Mapped to clear 400 messages |
| 12 | Low | `GET /admin/feedback?event=<bad id>` returned **500** | 400 "Invalid event id" |
| 13 | Low | Creating or updating a user with a non-string name or password caused a **500** | Types validated; email format checked; duplicate gives 409 |
| 14 | Low | `registration-closed` events reported `unavailable` instead of `closed` (the branch was unreachable) | Condition order fixed |
| 15 | Low | The lockout message showed the unlock time in the server's UTC clock | Now "Try again in N minutes" |
| 16 | Low | A company contact email wasn't validated | Validated |
| 17 | Low | The login rate limit was hardcoded | `LOGIN_LIMIT_MAX` env var (default 20 per 15 min) |
| 18 | Low | The ticket email's plain-text version had stray blank lines when company or venue were missing | Fixed |
| 19 | Cleanup | The production nginx still had the Razorpay webhook block | Removed |

## Running the suites

```bash
cd backend
npm run verify                       # no DB needed

# Live suites hit the per-IP limits, so raise them in backend/.env first:
#   COUPON_VALIDATE_LIMIT_MAX=1000 REGISTRATION_LIMIT_MAX=1000
#   RATE_LIMIT_MAX=5000 LOGIN_LIMIT_MAX=1000
# then `docker compose up -d --force-recreate api`, and revert afterwards.
API_URL=http://localhost:8080 ADMIN_URL=http://localhost:8082 \
MONGODB_URI=mongodb://127.0.0.1:27017/prashanth_events npm run test:functional
npm run test:flow
```

## Not covered

- **Real email and WhatsApp sending.** No SMTP or Meta credentials were
  available, so only the `not_configured` path ran live. Sent, failed and
  retryable classification is unit-tested in `verify.js`.
- **Camera QR scanning in a browser.** The scan API is fully tested; the
  camera UI wasn't tested on a device.
- **Load testing** beyond the 12-way concurrency test in `test:flow`.
