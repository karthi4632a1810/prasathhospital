# Prashanth Hospitals — Fertility & Gynaecology Event Management Platform

A complete digital platform for running Fertility & Gynaecology events: a premium
public microsite, company-coupon registration and ticketing, email + WhatsApp delivery,
event-day QR check-in, and an admin dashboard.

This repository was delivered **module by module**, all 15 tracked in
[`docs/BUILD-CHECKLIST.md`](docs/BUILD-CHECKLIST.md) with what was built and
how each was actually verified (not just "it returns 200" — real registrations,
real end-to-end flow tests, real screenshots).

---

## Delivered so far

**Public microsite** (`frontend-public`) — branded hero with a live countdown,
speakers, agenda, sponsors, FAQ, SEO/JSON-LD, WhatsApp-first sharing, and the
full attendee journey: enter details + company coupon → validate (₹0.00) →
instantly confirmed QR ticket + PDF, sent by email and WhatsApp → check in on event day → leave feedback → download a
certificate once the event concludes.

**Admin dashboard** (`frontend-admin`) — a separate app, same design system,
behind JWT auth with three roles (`superadmin`/`manager`/`checkin_staff`
enforced server-side, not just hidden nav): Event CMS, passes, companies,
coupons, registrations with delivery tracking and retry, a camera-based check-in
scanner, live stats + charts, CSV export, feedback, user management and an
audit log of every admin action.

**Backend** (`backend`) — Express 4 API, one `{success,data}` envelope,
MongoDB/Mongoose, SMTP email + Meta WhatsApp Cloud API integrations that both
degrade gracefully (clear "not configured" messaging, never a crash) until
real credentials are supplied, a 120-check verification suite, an 87-case
live functional suite and a 19-case coupon flow test (see docs/QA-REPORT.md)
(`backend/tests/verify.js`) that needs no live database.

**Docker** is the standard way to run all of it — `mongo`, `api`, `web`
(public site) and `admin` in one `docker-compose.yml`, the same file used
locally and in production (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

### Module status


| #   | Module                    | Status   |
| --- | ------------------------- | -------- |
| 1   | Premium Event Microsite   | **Done** |
| 2   | Event CMS                 | **Done** |
| 3   | Registration Management   | **Done** |
| 4   | Ticketing & Pass Types    | **Done** |
| 5   | Promo Code Management     | Replaced by company coupons |
| 6   | Payment Gateway           | Removed — coupon registration at ₹0 |
| 7   | Digital Ticket & QR       | **Done** |
| 8   | WhatsApp Integration      | **Done** |
| 9   | Event-Day Check-in        | **Done** |
| 10  | Admin Dashboard           | **Done** |
| 11  | Reports & Export          | **Done** |
| 12  | Feedback & Certificates   | **Done** |
| 13  | Security & Access Control | **Done** |
| 14  | Deployment & Go-Live      | **Done** |
| 15  | Support                   | **Done** |


---



## Tech stack


| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Frontend   | React 18, Vite, React Router           |
| Backend    | Node.js 18+, Express 4                 |
| Database   | MongoDB 7 (Mongoose 8)                 |
| Web server | NGINX (reverse proxy + static SPA)     |
| Styling    | CSS custom properties, no UI framework |


---



## Quick start



### Prerequisites

- Node.js 18 or newer
- MongoDB 7 running locally (or a connection string)



### 1. Backend

```bash
cd backend
cp .env.example .env          # edit MONGODB_URI if needed
npm install
npm run seed                  # loads the sample summit + 5 pass types
npm run dev                   # http://localhost:5000
```

Check it: `curl http://localhost:5000/api/v1/health`

### 2. Microsite

```bash
cd frontend-public
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

The dev server proxies `/api` to `localhost:5000`, so no CORS setup is needed.

Open **[http://localhost:5173](http://localhost:5173)** — the seeded summit loads at the root, and also at
`/events/fertility-gynaecology-summit-2026`.

### No MongoDB yet?

Front-end work does not need a database:

```bash
cd backend && npm run mock    # serves the real seed payload on :5000
```



### Docker

The standard way to run the whole platform — mongo, api, the public
microsite and the admin dashboard — in one command:

```bash
cp backend/.env.example backend/.env
docker compose up --build -d
docker compose exec api npm run seed          # sample event + 5 passes
docker compose exec api npm run seed:admin    # bootstraps the first superadmin

# microsite: http://localhost:8080
# admin:     http://localhost:8082  (login with ADMIN_BOOTSTRAP_EMAIL/PASSWORD from backend/.env)
# API:       http://localhost:8080/api/v1/health
```

There is no payment gateway — registration is by company coupon at ₹0 (see
[`docs/COUPON-REGISTRATION.md`](docs/COUPON-REGISTRATION.md)). Email and
WhatsApp sends stay dev-safe with no configuration — add SMTP / Meta
credentials to `backend/.env` to turn them on. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the production setup
(TLS, backups, CI).

---



## Verifying the build

```bash
cd backend && npm run verify
```

Runs 120 checks across every module's models, serializers, auth/RBAC guards,
coupon rules, delivery classification, QR/CSV utilities and HTTP layer — including that
internal inventory counts and non-public passes never reach the browser.
No database required.

```bash
cd frontend-public && npm run build
cd frontend-admin && npm run build
```

---



## Project layout

```
prashanth-events/
├── backend/
│   ├── src/
│   │   ├── config/          env, database connection, upload path
│   │   ├── models/          Event, TicketType, User, Registration, Company,
│   │   │                    Coupon, Feedback, AuditLog (+ legacy Payment, PromoCode)
│   │   ├── controllers/     public + admin (adminEvent, adminRegistration,
│   │   │                    adminCheckin, adminUser, adminAuditLog, …)
│   │   ├── services/        serializers, inventory, coupons, delivery,
│   │   │                    email (SMTP), whatsapp client, audit log
│   │   ├── routes/          one file per resource, mounted in routes/index.js
│   │   ├── middleware/      auth (JWT + RBAC), upload, error handling
│   │   ├── utils/           logger, ApiError, response envelope, qrcode,
│   │   │                    ticketPdf, certificatePdf, csv
│   │   ├── seed/            sample event + admin bootstrap
│   │   └── dev/             mock API for DB-free frontend work
│   └── tests/              verify.js (120), functional.js (87, live), coupon-flow.js (19, live)
│
├── frontend-public/         attendee-facing microsite
│   └── src/
│       ├── sections/        Hero, Speakers, Agenda, Tickets, Venue…
│       ├── pages/           EventMicrosite, RegisterPage, TicketPage,
│       │                    FeedbackPage
│       ├── components/      header, footer, sticky CTA, share sheet, UI kit
│       ├── lib/             api client,
│       │                    campaign tracking, formatting
│       └── styles/          design tokens + global styles
│
├── frontend-admin/          staff-facing dashboard (separate app, same tokens)
│   └── src/
│       ├── pages/           EventEditor, TicketTypes, Companies, Coupons,
│       │                    Registrations, CheckIn, Reports,
│       │                    Feedback, Users, AuditLog
│       ├── components/      sidebar shell, protected routes, UI kit
│       └── lib/             per-resource API clients, auth context
│
├── scripts/                 backup-mongo.sh
├── .github/workflows/       CI (verify, both frontend builds, docker build)
├── nginx/                   production host reverse-proxy reference config
├── docs/                    API reference, deployment, build checklist
└── docker-compose.yml       mongo + api + web + admin
```

---

## Documentation

- [`docs/API.md`](docs/API.md) — endpoint reference, admin role matrix
- [`docs/CONTENT-GUIDE.md`](docs/CONTENT-GUIDE.md) — what each microsite field controls
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment (Docker-first)
- [`docs/BUILD-CHECKLIST.md`](docs/BUILD-CHECKLIST.md) — module-by-module delivery log, with how each was verified
- [`docs/SUPPORT.md`](docs/SUPPORT.md) — ops runbook for common support tasks

---

© Prashanth Hospitals. All rights reserved.#   p r a s h a n t h 
 
 