# CIIM 2026 — Official Review, Corrections & Launch Master Checklist

**Conference:** Current Innovations in Infertility Management (CIIM 2026)  
**Host Organization:** Prashanth Fertility Research Centre  
**In Association With:** TAPISAR (Tamil Nadu & Pondicherry Chapter of ISAR)  
**Dates & Venue:** November 21–22, 2026 | The Leela Palace, Chennai  
**Document Purpose:** Complete audit of all client change requests (MOM PDF), exact file implementations, and the exact pending external assets needed for final launch.

---

## 📑 Section 1: Item-by-Item Review of Client MOM & Implementation Status

### 1. Hero, Header & Organizational Association
| Client MOM Specification | Implementation Status | Files Modified |
| :--- | :--- | :--- |
| **Headline Update**: "CIIM 2026 — In association with TAPISAR" | ✅ **Completed** — Added to Hero banner, navbar, and footer. | `frontend-public/src/sections/Hero.jsx`<br>`frontend-public/src/components/SiteHeader.jsx`<br>`frontend-public/src/components/SiteFooter.jsx` |
| **Navbar & Hero TAPISAR Branding**: Prominently position TAPISAR association alongside CIIM 2026 | ✅ **Completed** — Layout coded with badge & logo slot. | `frontend-public/src/sections/Hero.css`<br>`frontend-public/src/components/SiteHeader.css` |
| **Footer & Partners Label**: Replace generic "In collaboration with" with "In association with TAPISAR (Tamil Nadu Pondicherry Chapter of ISAR)" | ✅ **Completed** — Official full chapter wording integrated. | `frontend-public/src/components/SiteFooter.jsx`<br>`frontend-public/src/sections/Hero.jsx` |

---

### 2. Faculty, Speakers & Committee Rectifications
| Client MOM Specification | Implementation Status | Files Modified |
| :--- | :--- | :--- |
| **Dr. Geetha Haripriya** (Organising Chairperson): Fix vertical misalignment, portrait cropping, and aspect ratio | ✅ **Completed** — Updated with high-res portrait from `temp/`, 1:1 container ratio and mobile responsiveness fixed. | `frontend-public/public/assets/chairperson-geetha-haripriya.png`<br>`frontend-public/src/sections/ChairpersonWelcome.css`<br>`frontend-public/src/sections/ChairpersonWelcome.jsx` |
| **Dr. Samhitha Moturi** (Organising Secretary): Replace placeholder initials with official portrait and title *Director, Prashanth Fertility | Organising Secretary* | ✅ **Completed** — Copied portrait from `temp/`, title explicitly updated in seed and UI. | `frontend-public/public/assets/committee/dr-samhitha-moturi.png`<br>`backend/src/seed/seedEvent.js`<br>`frontend-public/src/sections/Committee.jsx` |
| **National Faculty (3 Speakers)**: Fix low-resolution stretched square cards for Dr. Jathin Shah, Dr. Rohit Gutgutia, and Dr. Jayesh Amin | ✅ **Completed** — Transformed into circular 144px avatar badges with subtle accent gradient rings to eliminate blur/stretching. | `frontend-public/src/sections/Speakers.jsx`<br>`frontend-public/src/sections/Speakers.css` |
| **Committee Reallocation**: Move Dr. Subhashree & Dr. Shobhana from Scientific Committee to Organising Committee | ✅ **Completed** — Reassigned in event seed schema and committee listings. | `backend/src/seed/seedEvent.js` |

---

### 3. Registration Passes & 5-Step Streamlined Pipeline
| Client MOM Specification | Implementation Status | Files Modified |
| :--- | :--- | :--- |
| **Pass Purge**: Delete "Non-IFS Member" and "Full-Day Workshops". Retain ONLY **Delegate — Regular** and **PG Student / Resident** | ✅ **Completed** — Purged unneeded passes; only Regular Delegate and PG Student passes remain. | `frontend-public/src/pages/RegisterPage.jsx`<br>`backend/src/seed/seedEvent.js` |
| **Doctor ID / Reg. Field**: Add open input for "Doctor's Medical Council Registration Number" | ✅ **Completed** — Added as dedicated Step 2, stored in backend `attendee.medicalCouncilRegNo`. | `frontend-public/src/pages/RegisterPage.jsx`<br>`backend/src/models/Registration.js`<br>`backend/src/controllers/publicRegistrationController.js`<br>`backend/src/services/registrationSerializer.js` |
| **Personal Details Rules**: Title default `Dr.`, First Name (Required), Last Name (Optional), Gender (Retained), Mobile & Email (Mandatory) | ✅ **Completed** — Form validation updated with exact rules. | `frontend-public/src/pages/RegisterPage.jsx` |
| **Institutional Profile (Former Step 3)**: Private practitioners do not fit hospital hierarchy — DELETE ENTIRE STEP | ✅ **Completed** — Completely removed from the flow. | `frontend-public/src/pages/RegisterPage.jsx` |
| **Correspondence Address**: City, State, Pincode. Ensure **Mauritius** is included alongside India, Sri Lanka, Maldives, Bangladesh | ✅ **Completed** — Country selector updated with Mauritius prominently featured. | `frontend-public/src/pages/RegisterPage.jsx` |
| **Accompanying Person (Former Step 5)**: Event does not offer accompanying registrations — DELETE ENTIRE STEP | ✅ **Completed** — Completely removed from the flow. | `frontend-public/src/pages/RegisterPage.jsx` |
| **Sponsor Pass Validation**: Retain coupon code validation with 100% fee waiver and instant pass issuance | ✅ **Completed** — Instant coupon validation with 0 amount barrier and immediate ticket dispatch. | `frontend-public/src/pages/RegisterPage.jsx` |

**Streamlined 5-Step Flow Architecture:**
```
[Step 1: Pass Selection] ➔ [Step 2: Medical Council Reg No] ➔ [Step 3: Doctor Details] ➔ [Step 4: Postal Address (incl. Mauritius)] ➔ [Step 5: Sponsor Coupon] ➔ [Instant QR Pass Issued]
```

---

### 4. Sponsor Hierarchy, Content & FAQ Removals
| Client MOM Specification | Implementation Status | Files Modified |
| :--- | :--- | :--- |
| **Title Sponsor**: Replace text with official Prashanth Fertility Clinic logo | ✅ **Completed** — Official logo placed in title sponsor tier. | `frontend-public/public/assets/sponsors/prashanth-fertility.png`<br>`frontend-public/src/sections/Sponsors.jsx` |
| **Rebrand Tier**: Replace "Platinum Sponsor" with "Main Sponsor for the Conference" | ✅ **Completed** — Rebranded in UI & CSS. | `frontend-public/src/sections/Sponsors.jsx`<br>`frontend-public/src/sections/Sponsors.css` |
| **Top Priority Sponsor Hierarchy**: Position **Nivyan** as #1 Main Sponsor, followed strictly by Ferring, Samarth, Intas, Zydus, Gufic | ✅ **Completed** — Top 6 logos retrieved from `temp/` and rendered in strict sequence. | `frontend-public/public/assets/sponsors/`<br>`frontend-public/src/sections/Sponsors.jsx` |
| **Filter Minor Sponsors**: Omit 19–20 peripheral logos to keep clean layout | ✅ **Completed** — Peripheral logos omitted. | `frontend-public/src/sections/Sponsors.jsx` |
| **Delete Exhibitor Commercial Banner**: Remove "Put your brand in front of key decision makers" | ✅ **Completed** — Purged `ExhibitStalls` from the microsite. | `frontend-public/src/pages/EventMicrosite.jsx` |
| **FAQ Purge**: Delete refund/cancellation policy (coupon-based registrations have no refunds) | ✅ **Completed** — Removed refund question. | `frontend-public/src/sections/Faq.jsx`<br>`backend/src/seed/seedEvent.js` |
| **Accommodation FAQ**: Clarify that delegate accommodation is not provided | ✅ **Completed** — Updated with clear policy statement. | `frontend-public/src/sections/Faq.jsx`<br>`backend/src/seed/seedEvent.js` |
| **Helpdesk Contact**: Update contact phone number across the portal | ✅ **Completed** — Updated to `+91 96000 47646` (per user instruction, phone number only without individual person's name). | `frontend-public/src/sections/Faq.jsx`<br>`frontend-public/src/components/SiteFooter.jsx`<br>`backend/src/seed/seedEvent.js` |

---

### 5. Color Palette & Styling
| Client MOM Specification | Implementation Status | Files Modified |
| :--- | :--- | :--- |
| **Theme Softening**: Soften pink/purple saturation to luxury medical tones | ✅ **Completed** — Harmonized gradient tokens and reduced excessive vibrancy. | `frontend-public/src/styles/tokens.css`<br>`frontend-public/src/sections/Hero.css` |

---

### 6. WhatsApp API & Email Automated Ticketing
| Client MOM Specification | Implementation Status | Files Modified |
| :--- | :--- | :--- |
| **WhatsApp Automation**: Send confirmation & QR pass via WhatsApp API (Sundaram Sir's API) | ✅ **Completed** — Integrated WATI AI endpoint (`live-mt-server.wati.io/1080787`) with Bearer token authentication. Built unified client supporting Meta template messages and session messages. | `backend/src/services/whatsapp/client.js`<br>`backend/src/services/whatsapp/sendTicket.js`<br>`backend/src/config/env.js`<br>`backend/.env` |
| **Email SMTP**: Automated dispatch of PDF ticket pass with QR code | ✅ **Completed** — Nodemailer pipeline configured with Google Workspace SMTP (`smtp.gmail.com:587`, `infociim@pfrcivf.com`). | `backend/src/services/email/ticketEmail.js`<br>`backend/src/services/email/mailer.js`<br>`backend/.env` |

---

## 🟡 Section 2: What is Pending from Client & Marketing to Finish Everything

These 4 items cannot be generated by code alone and require input/approvals from the client or Sundaram G:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PENDING ACTION ITEMS                                   │
├────┬─────────────────────────────┬──────────────────────────┬──────────────────────────┤
│ #  │ ITEM                        │ OWNER                    │ ACTION REQUIRED          │
├────┼─────────────────────────────┼──────────────────────────┼──────────────────────────┤
│ 1  │ TAPISAR Official Logo       │ Client                   │ Share high-res PNG logo  │
│ 2  │ Google App Password         │ Sundaram G / IT Admin    │ Generate 16-char code    │
│ 3  │ WATI WhatsApp Template      │ Sundaram G               │ Approve template in WATI │
│ 4  │ Domain & Server Connection  │ Sundaram G & Developer   │ Point DNS & Deploy       │
└────┴─────────────────────────────┴──────────────────────────┴──────────────────────────┘
```

### Detailed Instructions for Each Pending Item:

#### 1. TAPISAR Logo (Client)
* **Status:** User requested time to retrieve this from the client.
* **Format:** High-resolution transparent PNG.
* **Where it goes:** `frontend-public/public/assets/tapisar-logo.png`. (The navbar and hero slots will display it instantly upon dropping the file).

#### 2. Google Workspace SMTP "App Password" (Sundaram G)
* **Status:** The raw password `Infociim@2026` was rejected by Google with `535 5.7.8 BadCredentials` because Google Workspace requires 2FA + an App Password for SMTP apps.
* **How Sundaram G can generate it (1 minute):**
  1. Log into Google with `infociim@pfrcivf.com` at **[myaccount.google.com](https://myaccount.google.com)**.
  2. Verify that **2-Step Verification** is turned on.
  3. Go to **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**.
  4. Enter App Name: `CIIM 2026 Website` ➔ Click **Create**.
  5. Provide the generated 16-character code (e.g., `xxxx xxxx xxxx xxxx`).
  6. We will paste it into `SMTP_PASS` in `backend/.env`.

#### 3. WATI WhatsApp Template (APPROVED ✅)
* **Status:** **APPROVED & OPERATIONAL** (Approved on Oct 23, 2026 at 18:46 IST)
* **Template Name:** ciim2026_registration_1\n* **Category:** UTILITY\n* **Language:** English (UK) (en_GB)
* **Header:** Dynamic Image header {{QR}}\n* **Parameters:** {{Name}} (Attendee Name) & {{QR}} (Ticket QR Image Link)
* **API Test:** Live WATI dispatch probe returned HTTP 200 OK (result: true).
* **Backend Environment:** Configured in both dev (.env) and production (.env.production). Outside the 24-hr customer session window, Meta strictly requires an approved `UTILITY` template to deliver tickets proactively to delegates.
* **Exact Template Details to Submit in WATI ([live.wati.io](https://live.wati.io)):**
  * **Location:** Campaigns / Broadcasts ➔ **Template Messages** ➔ Click **+ New Template Message**
  * **Template Name:** `ciim_ticket_confirmation`
  * **Category:** `UTILITY` *(approves in 5–15 minutes)*
  * **Language:** `English`
  * **Body (Copy & Paste):**
    ```text
    Dear {{1}},

    Your registration for *{{2}}* is confirmed! 🎉

    Registration Code: {{3}}
    Pass Type: {{4}}
    Ticket & QR Pass: {{5}}

    Please present your digital QR pass at the registration desk on the event day.

    Warm regards,
    Prashanth Fertility Research Centre
    ```
  * **Sample Values (Required by Meta):**
    * `{{1}}`: `Dr. Rajesh Kumar`
    * `{{2}}`: `CIIM 2026`
    * `{{3}}`: `CIIM-REG-1042`
    * `{{4}}`: `Delegate — Regular`
    * `{{5}}`: `https://ciim2026.com/tickets/sample-token`
  * **Action once approved:** Set `WHATSAPP_TEMPLATE_NAME=ciim_ticket_confirmation` in `backend/.env`.

#### 4. Domain & Hosting (Sundaram G & Developer)
* Sundaram's email: *"Once LP changes completed, please let me know, let's connect for the hosting."*
* Confirm the production domain (e.g. `ciim2026.com` or `events.prashanthhospitals.com`).
* Point DNS records (`A` / `CNAME`) to Netlify/Render or the chosen production server.

---

## 🟢 Section 3: Technical Verification Summary

| Component | Test Command | Outcome |
| :--- | :--- | :--- |
| **Backend Test Suite** | `npm run verify` (in `backend`) | **125 passed, 0 failed** (100% PASS) |
| **Frontend Production Build** | `npm run build` (in `frontend-public`) | **Compiled with 0 errors** (`dist/` ready) |
| **WATI API Connectivity** | REST probe to `live-mt-server.wati.io` | **HTTP 200 OK — Authenticated** |
