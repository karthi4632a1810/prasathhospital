# API Reference — Module 1

Base URL: `/api/v1`

Every response uses the same envelope:

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { ... } }

// Failure
{ "success": false, "error": { "message": "...", "code": "...", "details": [...] } }
```

---

## Health

### `GET /api/v1/health`

Liveness/readiness probe for NGINX, Docker and uptime monitoring.

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 1284,
    "database": "connected",
    "timestamp": "2026-09-22T05:30:00.000Z"
  }
}
```

---

## Public endpoints

No authentication. Only published events are visible.

### `GET /api/v1/public/events`

Lists published events (for an "all events" page or a campaign landing).

| Query | Type | Default | Notes |
|-------------|---------|---------|-----------------------------------|
| `page` | integer | `1` | |
| `limit` | integer | `12` | max 50 |
| `category` | string | — | `cme`, `conference`, `workshop`, `awareness-camp`, `public-seminar` |
| `upcoming` | boolean | — | `true` hides finished events |
| `q` | string | — | full-text search on title/tagline/summary |

Returns compact cards plus pagination `meta`:

```json
{
  "success": true,
  "data": [
    {
      "id": "…", "slug": "fertility-gynaecology-summit-2026",
      "title": "Fertility & Gynaecology Summit 2026",
      "tagline": "…", "summary": "…",
      "category": "cme", "mode": "in-person", "status": "published",
      "startDate": "2026-11-06T03:00:00.000Z",
      "endDate": "2026-11-06T12:00:00.000Z",
      "heroImageUrl": "", "city": "Chennai",
      "venueName": "Prashanth Hospitals — Convention Hall",
      "registrationState": "open", "isFeatured": true
    }
  ],
  "meta": { "page": 1, "limit": 12, "total": 1, "totalPages": 1 }
}
```

---

### `GET /api/v1/public/events/:slug`

The full microsite payload — everything the public page renders.

**404** when the slug does not exist or the event is still a draft.

```jsonc
{
  "success": true,
  "data": {
    "event": {
      "id": "…",
      "slug": "fertility-gynaecology-summit-2026",
      "title": "…", "tagline": "…", "summary": "…", "description": "…",

      "category": "cme", "mode": "in-person", "status": "published",
      "startDate": "…", "endDate": "…", "timezone": "Asia/Kolkata",
      "registrationOpensAt": "…", "registrationClosesAt": "…",

      "registrationState": "open",   // see table below
      "seatsRemaining": 218,         // null when capacity is unlimited
      "isSoldOut": false,

      "organizer": { "name": "…", "department": "…", "websiteUrl": "…" },
      "venue": { "name": "…", "city": "…", "mapEmbedUrl": "…", … },  // null for virtual events
      "virtualLink": "",                                              // "" for in-person events

      "highlights": ["6 CME credit points (TNMC accredited)", …],
      "speakers": [ { "id", "name", "credentials", "designation",
                      "organization", "photoUrl", "bio", "topic", "isKeynote" } ],
      "agenda":   [ { "id", "date", "label",
                      "items": [ { "id", "startTime", "endTime", "title",
                                   "description", "speakerNames", "track", "type" } ] } ],
      "sponsors": [ { "id", "name", "logoUrl", "websiteUrl", "tier" } ],
      "faqs":     [ { "id", "question", "answer" } ],
      "announcements": [ { "id", "message", "level", "publishedAt" } ],  // active only

      "contact": { "name", "phone", "whatsapp", "email" },
      "theme":   { "primaryColor", "accentColor", "heroImageUrl", "logoUrl" },
      "seo":     { "metaTitle", "metaDescription", "keywords",
                   "ogImageUrl", "canonicalUrl", "noIndex" },
      "jsonLd":  { "@context": "https://schema.org", "@type": "Event", … }
    },

    "ticketTypes": [ /* see below */ ]
  }
}
```

---

### `GET /api/v1/public/events/:slug/ticket-types`

Publicly visible passes only. Used by the registration flow to refresh live
availability without re-fetching the whole event.

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "name": "Delegate — Regular",
      "code": "REG",
      "description": "Full-day access to all main hall sessions…",
      "kind": "paid",
      "price": 2500,
      "currency": "INR",
      "taxPercent": 18,
      "priceWithTax": 2950,
      "isFree": false,
      "admitsCount": 1,
      "benefits": ["Access to all main hall sessions", "…"],
      "minPerOrder": 1,
      "maxPerOrder": 5,
      "salesStartAt": null,
      "salesEndAt": null,
      "saleState": "on-sale",
      "isSoldOut": false,
      "isLowStock": false,
      "allowedParticipantTypes": []
    }
  ]
}
```

---

## Field reference

### `registrationState`

Derived server-side, so the site, the API and the future registration flow
never disagree about whether someone can register.

| Value | Meaning |
|-----------------|-----------------------------------------------------|
| `open` | Accepting registrations |
| `not-yet-open` | `registrationOpensAt` is in the future |
| `closed` | Past `registrationClosesAt`, or manually closed |
| `sold-out` | `registeredCount` has reached `capacity` |
| `completed` | The event has finished |
| `cancelled` | The event was cancelled |
| `unavailable` | Not published |

### `saleState` (per pass)

| Value | Meaning |
|----------------|--------------------------------------|
| `on-sale` | Selectable now |
| `not-yet-open` | Before `salesStartAt` |
| `closed` | After `salesEndAt` |
| `sold-out` | Allocation exhausted |
| `inactive` | Switched off in the CMS |

### What is deliberately **not** returned

These stay server-side so competitors and delegates cannot read the event's
commercial position:

- `quantityTotal`, `quantitySold`, `quantityHeld`, `quantityAvailable`
  → surfaced only as the boolean `isLowStock` and `isSoldOut`
- Passes with `isPubliclyVisible: false` (e.g. complimentary faculty passes)
- Draft events, and the physical venue of virtual events

---

## Error codes

| HTTP | `code` | When |
|------|---------------------|--------------------------------------|
| 400 | `VALIDATION_ERROR` | Schema validation failed |
| 400 | `INVALID_IDENTIFIER`| Malformed ObjectId or bad field value|
| 404 | `ROUTE_NOT_FOUND` | Unknown route |
| 404 | — | Event/resource not found |
| 409 | `DUPLICATE_KEY` | Unique constraint hit (e.g. slug) |
| 429 | — | Rate limit exceeded |
| 500 | — | Server error (details hidden in prod)|

---

## Campaign attribution

The microsite records the **first-touch** campaign source from the landing URL
and keeps it for the session:

```
https://events.prashanthhospitals.com/events/<slug>?utm_source=whatsapp&utm_campaign=summit26
https://events.prashanthhospitals.com/events/<slug>?src=qr-poster
```

Recognised sources: `whatsapp`, `instagram`, `facebook`, `qr-poster`, `email`,
`sms`, `referral`, `direct`. When no tag is present the referring domain is used
to infer one.

The stored value rides along to the registration route as `?src=…`, so Module 3
can persist it on the registration record and Module 10 can report on it.

---

## Admin API & RBAC

Everything under `/api/v1/admin/*` requires `Authorization: Bearer <token>`,
obtained from `POST /api/v1/admin/auth/login` (rate-limited to 20 attempts /
15 min, plus a per-account lockout after 5 wrong passwords). Tokens are
JWTs signed with `JWT_SECRET`, default 7-day expiry (`JWT_EXPIRES_IN`).

### Role matrix

Three roles, checked server-side by `requireRole(...)` on every route — the
admin UI hiding a nav item is a convenience, not the security boundary.

| Area | Route prefix | `superadmin` | `manager` | `checkin_staff` |
|---------------------------|------------------------------|:---:|:---:|:---:|
| Event CMS | `/admin/events`, `/admin/uploads` | ✅ | ✅ | ❌ |
| Ticket types | `/admin/ticket-types` | ✅ | ✅ | ❌ |
| Companies | `/admin/companies` | ✅ | ✅ | ❌ |
| Coupons | `/admin/coupons` | ✅ | ✅ | ❌ |
| Registrations (incl. delivery retry, cancel, CSV) | `/admin/registrations` | ✅ | ✅ | ❌ |
| Dashboard stats (aggregates only) | `/admin/reports/overview` | ✅ | ✅ | ✅ |
| Reports & CSV export | `/admin/reports/*` (rest) | ✅ | ✅ | ❌ |
| Feedback | `/admin/feedback` | ✅ | ✅ | ❌ |
| Event-day check-in | `/admin/checkin` | ✅ | ✅ | ✅ |
| Users & roles | `/admin/users` | ✅ | ❌ | ❌ |
| Audit log | `/admin/audit-log` | ✅ | ❌ | ❌ |

A `checkin_staff` account exists for event day: it sees the dashboard's
aggregate numbers and the scanner, and is locked out of everything that
shows attendee lists, coupons or exports.

### Endpoint index

Public endpoints need no auth; `/admin/*` need a bearer token per the table
above. Full request/response shapes are in each controller's JSDoc comment
(`backend/src/controllers/`) rather than duplicated here.

| Prefix | Module | Notes |
|-------------------------------------|--------|-------|
| `/public/events` | 1 | Read-only, published events only |
| `/admin/auth` | Foundation | `POST /login`, `GET /me` |
| `/admin/events`, `/admin/uploads` | 2 | Event CMS + image upload |
| `/admin/ticket-types` | 4 | Pass CRUD |
| `/coupons/validate` | Coupons | Public coupon preview (rate-limited per IP) |
| `/registrations` | Coupons | `POST` — coupon registration, ₹0, confirmed immediately (rate-limited) |
| `/admin/companies`, `/admin/coupons` | Coupons | Company + coupon CRUD |
| `/admin/registrations` | 3, Coupons | List/filter/sort, detail, cancel, `export.csv`, `deliveries/:channel` retry |
| `/tickets` | 7 | QR image, PDF ticket, certificate — keyed by `qrToken` |
| `/admin/checkin` | 9 | Scan + live stats + minimal event list |
| `/admin/reports` | 10, 11 | Overview, company/coupon breakdown, CSV exports |
| `/admin/users` | 10, 13 | User/role management, superadmin-only |
| `/feedback`, `/admin/feedback` | 12 | Submit (public, `qrToken`-gated) + list (admin) |
| `/admin/audit-log` | 13 | Who did what, superadmin-only |

### Coupon registration flow (no payment gateway)

The Razorpay/promo-code flow was removed. Every registration now redeems a
company coupon, costs ₹0 and is confirmed immediately. See
[COUPON-REGISTRATION.md](COUPON-REGISTRATION.md) for the full endpoint list,
request/response shapes, error codes and migration notes.
