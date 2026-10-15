# CIIM 2026 Event Platform — Current Flow

How the platform works today, end to end. There are three apps: the
**public site** (attendees), the **admin dashboard** (organisers and staff),
and the **API + database** behind both.

| App | Local URL | Who uses it |
|---|---|---|
| Public site | http://localhost:8080 | Delegates / attendees |
| Admin dashboard | http://localhost:8082 | Organisers, managers, check-in staff |
| API | http://localhost:8080/api/v1 (proxied) | Both apps |

**There is no payment step anywhere.** Every delegate registers with a
coupon issued by a sponsoring company (Yamaha, Bajaj, …). The coupon covers
the full pass price, so the delegate pays ₹0.00 and is confirmed instantly.

---

## 1. Attendee flow (public site)

1. **Lands on the event page** — `/events/fertility-gynaecology-summit-2026`
   (hero, chairperson's message, highlights, speakers, committee, agenda,
   passes, venue, sponsors, exhibitor stalls, FAQ).
2. **Clicks Register** → `/events/<slug>/register`.
3. **Fills in four things** — full name, mobile number, email address and
   the **coupon code** from their company. (Pass selection stays if the
   event has more than one pass.)
4. **Clicks "Validate"** — the server checks the coupon and shows:
   ✓ Valid coupon · company name · original amount · discount · **final
   payable ₹0.00**. Invalid, expired, not-yet-started, inactive and fully
   used coupons each get a clear message.
5. **Clicks "Complete Registration"** — the server re-checks everything,
   takes one place on the coupon (atomically — two people can't grab the
   last place), confirms the registration and issues a unique QR ticket.
6. **Sees the success page** — QR code, registration ID, name, mobile, email,
   company, coupon, pass, amount paid ₹0.00, a **PDF ticket download** and a
   link to their ticket page `/tickets/<token>`.
7. **Receives the ticket** by **email** (PDF attached + QR + link) and by
   **WhatsApp** (ticket link). The two are sent independently in the
   background; if either is unavailable the registration is still complete.
8. **After the event** — leaves a rating at `/feedback/<token>` and downloads
   a certificate once the event is marked completed.

One email address can hold one active registration per event; a
double-clicked submit returns the same registration instead of a second one.

## 2. Exhibitor / sponsor enquiries

The public page lists Platinum, Gold and Silver stall packages. **"Reserve
your stall"** opens an email to `secretariat@ciim2026.com`.

## 3. Organiser flow (admin dashboard)

Sign in at http://localhost:8082. What each role can do (enforced by the
API, not just hidden in the menu):

| Area | Superadmin | Manager | Check-in staff |
|---|:---:|:---:|:---:|
| Dashboard (live numbers) | ✓ | ✓ | ✓ |
| Check-in scanner | ✓ | ✓ | ✓ |
| Companies & coupons | ✓ | ✓ | |
| Registrations (search, resend, cancel, CSV) | ✓ | ✓ | |
| Reports & CSV exports | ✓ | ✓ | |
| Event CMS, passes, feedback | ✓ | ✓ | |
| Users & roles, audit log | ✓ | | |

**Setting up a sponsor:** Companies → *Add company* → Coupons → *New
coupon* (code, company, how many delegates it covers, optional start and
expiry dates). Coupons can be deactivated at any time; registrations already
made are kept. A coupon's code and company lock once it has been used.

**Registrations page:** every registration with ID, name, mobile, email,
company, coupon, date, status, QR status, email status, WhatsApp status and
check-in. Search, filter (company, coupon, status, delivery status, check-in,
date range), sort, paginate and export exactly what's filtered to CSV. Open a
row for full details, the QR, ticket download, **Resend email / Retry
WhatsApp**, every delivery attempt with its error, internal notes and
**Cancel** (reason required).

**Cancelling** voids the QR, frees the pass and event seat, and **gives the
coupon place back** to the company. It's recorded in the audit log.

**Dashboard:** total / confirmed / cancelled registrations, checked-in vs
still to arrive, coupon places used vs allocated, email and WhatsApp sent /
failed, registrations by company, and each coupon's allocation vs usage.

**Reports:** company-wise and coupon-wise tables (allocated, used,
remaining, confirmed, cancelled, checked in, email/WhatsApp sent and failed,
first/last registration), registrations by date, a date filter, and CSV
exports for registrations, companies and coupons.

## 4. Event day — check-in

1. Staff open **Check-in** and scan the QR (or paste the ticket link).
2. The result shows instantly:
   - **Checked in** (green) — name, company, pass, registration ID
   - **Already checked in** — a repeat scan, with the original time
   - **Not valid** — unknown code, or a **cancelled** registration
3. Live counts (checked in / remaining) update as you go.

## 5. After the event

Mark the event **completed** in the CMS to unlock certificate downloads.
Reports, the audit log and feedback stay available.

---

## 6. What is live vs. pending

| Item | Status |
|---|---|
| Coupon registration, ₹0 confirmation, QR tickets, PDF ticket | ✅ Working |
| Companies, coupons, registrations admin, reports, CSV | ✅ Working |
| Check-in (manual entry) | ✅ Working |
| Check-in (camera scanning) | ⚠️ Built, not tested on a real camera |
| **Ticket email** | ⏳ Needs SMTP settings in `backend/.env` — until then shows "Not configured" and can be sent later from the admin |
| **WhatsApp ticket delivery** | ⏳ Needs Meta WhatsApp API credentials (and an approved template for production) — same "Not configured" fallback |
| Sample Yamaha / Bajaj coupons | ✅ `npm run seed:coupons` (YAMAHA2026, BAJAJ2026 — 50 places each) |
| **Demo data (live site)** | ⚠️ 6 demo companies, 7 coupons, 107 registrations, feedback — loaded with `npm run seed:demo`. **Remove before launch:** `npm run seed:demo -- --clear` (only removes demo-tagged records) |
| Stall booking | ✉️ Email only |
| Agenda | ⚠️ Sample programme — replace with the real one |
| Secretariat phone number | ⚠️ Placeholder |

## 7. Hosting

| Environment | Where | Notes |
|---|---|---|
| Local development | Docker Compose (`docker compose up -d`) | Full platform with MongoDB |
| Online demo — API | https://prashanth-niqz.onrender.com | **Demo mode**: no database, read-only — the event page works, registration and admin do not |
| Online demo — site | https://prashanth-1.onrender.com | Render static site pointed at the demo API |

A full production setup needs a MongoDB Atlas database, removing
`DEMO_MODE`, and adding SMTP / WhatsApp credentials. See `docs/DEPLOYMENT.md`.

## 8. Local admin login (development only)

`admin@prashanthhospitals.com` / `ChangeMe123!`
Change this password before any real deployment — it is in the public repo.
