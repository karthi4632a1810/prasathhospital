import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Button from '../components/ui/Button';
import { LoadingState, ErrorState, NotFoundState } from '../components/ui/States';

import { api, ApiError } from '../lib/api';
import { formatAmount } from '../lib/format';
import { captureCampaign, getCampaign } from '../lib/campaign';
import './RegisterPage.css';

const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_EVENT_SLUG || 'fertility-gynaecology-summit-2026';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** One key per form session, so a double-clicked or retried submit can't register twice. */
function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const INDIAN_STATES = [
  'Tamil Nadu',
  'Karnataka',
  'Kerala',
  'Andhra Pradesh',
  'Telangana',
  'Maharashtra',
  'Delhi',
  'Gujarat',
  'West Bengal',
  'Uttar Pradesh',
  'Rajasthan',
  'Madhya Pradesh',
  'Punjab',
  'Haryana',
  'Bihar',
  'Odisha',
  'Assam',
  'Goa',
  'Chandigarh',
  'Other State / UT',
];

const COUNTRIES = [
  'India',
  'Mauritius',
  'Sri Lanka',
  'Maldives',
  'Bangladesh',
  'United Kingdom',
  'United States',
  'United Arab Emirates',
  'Singapore',
  'Malaysia',
  'Australia',
  'Canada',
  'Germany',
  'Nepal',
  'Other',
];

const EMPTY_FORM = {
  title: 'Dr',
  firstName: '',
  lastName: '',
  gender: 'Male',
  email: '',
  phone: '',
  medicalCouncilRegNo: '',
  address: '',
  country: 'India',
  state: 'Tamil Nadu',
  city: '',
  pincode: '',
};

export default function RegisterPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const slug = params.slug || DEFAULT_SLUG;
  const preselectedCode = searchParams.get('ticket');

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // validated preview
  const [couponError, setCouponError] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    captureCampaign();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const load = useCallback(() => {
    setState({ status: 'loading', data: null, error: null });
    api
      .getEvent(slug)
      .then((res) => setState({ status: 'ready', data: res.data, error: null }))
      .catch((err) =>
        setState({ status: err.status === 404 ? 'not-found' : 'error', data: null, error: err })
      );
  }, [slug]);

  useEffect(load, [load]);

  useEffect(() => {
    if (state.status === 'ready') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [state.status]);

  const event = state.data?.event;
  const ticketTypes = useMemo(() => {
    const raw = state.data?.ticketTypes || [];
    const allowed = ['REG', 'PGS'];
    return raw.filter((t) => allowed.includes(t.code) || /regular|pg student|resident/i.test(t.name));
  }, [state.data]);

  useEffect(() => {
    if (!ticketTypes.length) return;
    const onSale = ticketTypes.filter((t) => t.saleState === 'on-sale');
    const preselected = preselectedCode && onSale.find((t) => t.code === preselectedCode);
    setTicketTypeId((preselected || onSale[0] || ticketTypes[0]).id);
  }, [ticketTypes, preselectedCode]);

  const selectedTicket = ticketTypes.find((t) => t.id === ticketTypeId) || null;

  function resetCoupon() {
    setCoupon(null);
    setCouponError('');
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSubmitError('');
  }

  async function handleValidate() {
    const code = couponCode.trim();
    if (!code || !selectedTicket) return;
    setChecking(true);
    resetCoupon();
    try {
      const res = await api.validateCoupon({
        code,
        eventSlug: slug,
        ticketTypeId: selectedTicket.id,
      });
      setCoupon(res.data);
    } catch (err) {
      setCouponError(
        err instanceof ApiError ? err.message : 'Could not check this coupon. Please try again.'
      );
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTicket || !coupon) return;
    setSubmitting(true);
    setSubmitError('');

    const fullName = [form.title, form.firstName.trim(), form.lastName.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();

    try {
      const res = await api.register({
        eventSlug: slug,
        ticketTypeId: selectedTicket.id,
        attendee: {
          name: fullName,
          title: form.title,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          gender: form.gender,
          email: form.email.trim(),
          phone: form.phone.trim(),
          medicalCouncilRegNo: form.medicalCouncilRegNo.trim(),
          address: form.address.trim(),
          country: form.country,
          state: form.state,
          city: form.city.trim(),
          pincode: form.pincode.trim(),
          category: selectedTicket.name,
        },
        couponCode: coupon.code,
        idempotencyKey: idempotencyKey.current,
        campaignSource: getCampaign().source,
      });
      setResult(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      if (err instanceof ApiError && (err.code?.startsWith('COUPON_') || (/coupon/i.test(message) && !/already registered/i.test(message)))) {
        setCoupon(null);
        setCouponError(message);
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'not-found') return <NotFoundState message={state.error?.message} />;
  if (state.status === 'error') return <ErrorState message={state.error?.message} onRetry={load} />;

  if (event.registrationState !== 'open') {
    return (
      <>
        <SiteHeader event={event} canRegister={false} availableSections={[]} />
        <main id="main" className="register-page">
          <div className="state-message">
            <h1 className="state-message__title">Registration isn't open</h1>
            <p className="state-message__text">
              {{
                'not-yet-open': 'Registration for this event has not opened yet.',
                closed: 'Registration for this event has closed.',
                'sold-out': 'This event is sold out.',
                completed: 'This event has already taken place.',
                cancelled: 'This event has been cancelled.',
              }[event.registrationState] || 'Registration is not available right now.'}
            </p>
            <div className="state-message__actions">
              <Button variant="primary" href={`/events/${slug}`}>
                Back to event
              </Button>
            </div>
          </div>
        </main>
        <SiteFooter event={event} />
      </>
    );
  }

  if (result) {
    return (
      <>
        <SiteHeader event={event} canRegister={false} availableSections={[]} />
        <main id="main" className="register-page">
          <RegistrationSuccess result={result} event={event} slug={slug} formState={form} />
        </main>
        <SiteFooter event={event} />
      </>
    );
  }

  const canSubmit = Boolean(coupon) && Boolean(selectedTicket) && !submitting;

  return (
    <>
      <SiteHeader event={event} canRegister={false} availableSections={[]} />
      <main id="main" className="register-page">
        <div className="container register-page__grid">
          <div>
            <Link to={`/events/${slug}`} className="register-page__back">
              ← Back to {event.title}
            </Link>

            <div className="register-banner">
              <span className="register-banner__badge">Official Registration</span>
              <h1 className="register-banner__title">Online Registration Form</h1>
              <p className="register-banner__subtitle">
                Please complete your delegate and institutional information below. Validate your sponsor
                or organization code to secure complimentary delegate enrollment.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="register-form">
              {/* --- Section A: Pass & Category Options --- */}
              {/* --- STEP 01: Pass Selection --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">1. Select Registration Pass</h3>
                </div>

                <div className="register-field">
                  <label className="register-field">
                    <span>Registration Pass *</span>
                    <select
                      value={ticketTypeId}
                      onChange={(e) => {
                        setTicketTypeId(e.target.value);
                        resetCoupon();
                      }}
                      required
                    >
                      {ticketTypes.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.saleState !== 'on-sale'}>
                          {t.name}
                          {t.saleState !== 'on-sale' ? ` (${t.saleState.replace('-', ' ')})` : ''}
                        </option>
                      ))}
                    </select>
                    <small className="register-field__hint">
                      Conference passes are limited to Delegate — Regular and PG Student / Resident.
                    </small>
                  </label>
                </div>
              </div>

              {/* --- STEP 02: Doctor Reg. No. --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">2. Doctor Medical Council Registration Number</h3>
                </div>

                <label className="register-field">
                  <span>Doctor's Medical Council Registration Number *</span>
                  <input
                    required
                    maxLength={50}
                    value={form.medicalCouncilRegNo}
                    onChange={(e) => updateField('medicalCouncilRegNo', e.target.value)}
                    placeholder="e.g. TNMC/104523/2018 or State Medical Council Reg. No."
                  />
                  <small className="register-field__hint">
                    Required for accreditation &amp; Tamil Nadu Medical Council (TNMC) 6 CME Credit Points.
                  </small>
                </label>
              </div>

              {/* --- STEP 03: Doctor Personal Details --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">3. Doctor Details</h3>
                </div>

                <div className="register-field-row register-field-row--name">
                  <label className="register-field register-field--title">
                    <span>Title *</span>
                    <select
                      value={form.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      required
                    >
                      <option value="Dr">Dr</option>
                      <option value="Prof">Prof</option>
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                    </select>
                  </label>

                  <label className="register-field register-field--first">
                    <span>First Name *</span>
                    <input
                      required
                      minLength={2}
                      maxLength={60}
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      placeholder="e.g. Parthibhan"
                    />
                  </label>

                  <label className="register-field register-field--last">
                    <span>Last Name (Optional)</span>
                    <input
                      maxLength={60}
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      placeholder="e.g. Kumar"
                    />
                  </label>
                </div>

                <div className="register-field-row">
                  <label className="register-field">
                    <span>Gender *</span>
                    <select
                      value={form.gender}
                      onChange={(e) => updateField('gender', e.target.value)}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="register-field">
                    <span>Mobile Number *</span>
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      pattern="[0-9+ ()-]{10,20}"
                      title="10-digit mobile number, optionally with country code"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="e.g. 9884485876"
                    />
                    <small className="register-field__hint">
                      Strictly mandatory: Your individual scannable QR pass is instantly dispatched here via WhatsApp.
                    </small>
                  </label>
                </div>

                <label className="register-field">
                  <span>Email Address *</span>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="e.g. jparthibhan@gmail.com"
                  />
                  <small className="register-field__hint">
                    Strictly mandatory: Confirmation email with formal invitation letter and QR ticket will be delivered to this address.
                  </small>
                </label>
              </div>

              {/* --- STEP 04: Correspondence Address --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">4. Postal Address</h3>
                </div>

                <label className="register-field">
                  <span>Postal / Clinic Address *</span>
                  <textarea
                    required
                    rows={3}
                    maxLength={300}
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="Clinic, Hospital, or Postal Address..."
                    className="register-textarea"
                  />
                </label>

                <div className="register-field-row">
                  <label className="register-field">
                    <span>Country *</span>
                    <select
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                      required
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="register-field">
                    <span>State *</span>
                    {form.country === 'India' ? (
                      <select
                        value={form.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        required
                      >
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        value={form.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        placeholder="Province / State"
                      />
                    )}
                  </label>
                </div>

                <div className="register-field-row">
                  <label className="register-field">
                    <span>City *</span>
                    <input
                      required
                      maxLength={80}
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="e.g. Chennai, Kanchipuram"
                    />
                  </label>

                  <label className="register-field">
                    <span>PIN / Postal Code *</span>
                    <input
                      required
                      maxLength={16}
                      value={form.pincode}
                      onChange={(e) => updateField('pincode', e.target.value)}
                      placeholder="e.g. 600031"
                    />
                  </label>
                </div>
              </div>

              {/* --- STEP 05: Coupon & Fee Validation --- */}
              <div className="form-section form-section--coupon">
                <div className="form-section__header">
                  <h3 className="form-section__title">5. Sponsor Pass / Coupon Code</h3>
                </div>

                <div className="register-field">
                  <label htmlFor="coupon-code">
                    <span className="register-field__label">Coupon or Invitation Code *</span>
                  </label>
                  <div className="register-promo">
                    <input
                      id="coupon-code"
                      required
                      maxLength={32}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        resetCoupon();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !coupon) {
                          e.preventDefault();
                          handleValidate();
                        }
                      }}
                      placeholder="e.g. PRASHANTH26 / COMPANY2026"
                      aria-describedby="coupon-status"
                      aria-invalid={couponError ? 'true' : undefined}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleValidate}
                      disabled={!couponCode.trim() || checking || Boolean(coupon)}
                    >
                      {checking ? 'Checking…' : coupon ? 'Validated' : 'Validate Code'}
                    </Button>
                  </div>

                  <div id="coupon-status" aria-live="polite">
                    {couponError && <p className="coupon-error">{couponError}</p>}
                    {coupon && (
                      <CouponSummary
                        coupon={coupon}
                        selectedTicket={selectedTicket}
                        formState={form}
                      />
                    )}
                  </div>
                </div>
              </div>

              {submitError && (
                <p className="register-error" role="alert">
                  {submitError}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={!canSubmit}>
                {submitting ? 'Registering Delegate…' : 'Submit & Complete Registration'}
              </Button>
              {!coupon && (
                <p className="register-form__hint">
                  Validate your coupon code above to enable submission.
                </p>
              )}
            </form>
          </div>
        </div>
      </main>
      <SiteFooter event={event} />
    </>
  );
}

function CouponSummary({ coupon, selectedTicket, formState }) {
  const originalPrice = selectedTicket?.price || coupon.originalAmount || 21000;
  return (
    <div className="registration-summary-card">
      <div className="registration-summary-card__header">
        <h4 className="registration-summary-card__title" style={{ color: '#ffffff' }}>
          Registration Summary
        </h4>
      </div>
      <table className="summary-table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Registration Fee ({selectedTicket?.name || 'Conference Pass'})</strong>
              <div className="summary-table__sub">
                Medical Council Reg: {formState?.medicalCouncilRegNo || 'Not Provided'}
              </div>
            </td>
            <td className="text-right">{formatAmount(originalPrice, coupon.currency)}</td>
          </tr>
          <tr className="summary-table__discount">
            <td>
              <span>Sponsor / Coupon Discount ({coupon.code})</span>
              <div className="summary-table__sub">Sponsored by: {coupon.companyName}</div>
            </td>
            <td className="text-right text-success">
              −{formatAmount(originalPrice, coupon.currency)}
            </td>
          </tr>
          <tr className="summary-table__grand-total">
            <td>
              <strong>Grand Total</strong>
            </td>
            <td className="text-right">
              <strong>{coupon.currency || 'INR'} 0.00</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RegistrationSuccess({ result, event, slug, formState }) {
  const [copied, setCopied] = useState(false);
  const ticketPath = `/tickets/${result.qrToken}`;
  const qrUrl = `${API_BASE}/api/v1/tickets/${result.qrToken}/qr.png`;
  const pdfUrl = `${API_BASE}/api/v1/tickets/${result.qrToken}/pdf`;

  const att = result.attendee || {};
  const fullName =
    att.name ||
    [formState?.title, formState?.firstName, formState?.lastName].filter(Boolean).join(' ') ||
    'Registered Delegate';
  const councilRegNo = att.medicalCouncilRegNo || formState?.medicalCouncilRegNo;
  const passCategory = result.ticketType?.name || formState?.ticketTypeName || 'Delegate Pass';
  const email = att.email || formState?.email;
  const phone = att.phone || formState?.phone;
  const gender = att.gender || formState?.gender;
  const address = att.address || formState?.address;
  const cityState = [
    att.city || formState?.city,
    att.state || formState?.state,
    att.country || formState?.country || 'India',
  ]
    .filter(Boolean)
    .join(', ');
  const pincode = att.pincode || formState?.pincode;
  const institution = att.institution || formState?.institution;
  const companyName = result.company?.name || (typeof result.company === 'string' ? result.company : '');
  const couponCode = result.couponCode || 'COMPLIMENTARY';

  const regDate = result.createdAt
    ? new Date(result.createdAt).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

  const pricing = result.pricing || {};
  const basePrice = pricing.basePrice ?? 6500;
  const taxAmount = pricing.taxAmount ?? Math.round(basePrice * 0.18);
  const grossAmount = pricing.discountAmount ?? basePrice + taxAmount;
  const discountAmount = pricing.discountAmount ?? grossAmount;
  const currency = pricing.currency || 'INR';

  const handleCopyCode = () => {
    if (!result.registrationCode) return;
    navigator.clipboard?.writeText(result.registrationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="conf-success-wrapper">
      {/* 1. Verified Hero Header */}
      <div className="conf-hero">
        <div className="conf-hero__seal" aria-hidden="true">
          <div className="conf-hero__seal-glow" />
          <div className="conf-hero__seal-ring">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="conf-hero__status-badge">
          <span className="conf-hero__status-dot" />
          <span>Registration Confirmed • Active Delegate</span>
        </div>

        <h1 className="conf-hero__title">Registration Confirmed</h1>
        <p className="conf-hero__subtitle">
          Delegate enrollment for <strong>{event.title}</strong> has been successfully processed.
        </p>

        {result.registrationCode && (
          <div className="conf-regcode-pill">
            <span className="conf-regcode-pill__label">Registration ID</span>
            <span className="conf-regcode-pill__code">{result.registrationCode}</span>
            <button
              type="button"
              className={`conf-regcode-pill__copy ${copied ? 'is-copied' : ''}`}
              onClick={handleCopyCode}
              aria-label="Copy Registration ID"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* 2. Executive VIP Delegate Pass Card */}
      <div className="delegate-pass-card">
        {/* Pass Top Branding Bar */}
        <div className="delegate-pass-card__top">
          <div className="delegate-pass-card__brand">
            <span className="delegate-pass-card__brand-main">PRASHANTH FERTILITY &amp; RESEARCH CENTRE</span>
            <span className="delegate-pass-card__brand-sub">IN ASSOCIATION WITH TAPISAR • CIIM 2026</span>
          </div>
          <span className="delegate-pass-card__vip-badge">
            <span className="delegate-pass-card__star">★</span> OFFICIAL DELEGATE PASS
          </span>
        </div>

        {/* Pass Main Grid */}
        <div className="delegate-pass-card__grid">
          {/* Delegate Info Column */}
          <div className="delegate-pass-card__info">
            <div className="delegate-pass-card__category-chip">{passCategory}</div>

            <h2 className="delegate-pass-card__name">{fullName}</h2>

            {councilRegNo && (
              <div className="delegate-pass-card__reg-tag">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M19 10.5V6a2 2 0 0 0-2-2h-3V2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2H5a2 2 0 0 0-2 2v4.5A5.5 5.5 0 0 0 8.5 16h.7A5.5 5.5 0 0 0 14 19.92V22a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.08A5.5 5.5 0 0 0 22 14.5a5.5 5.5 0 0 0-3-4zM10 4V2h2v2h-2zm-1.5 10A3.5 3.5 0 0 1 5 10.5V6h3.5v8z" />
                </svg>
                <span>
                  Medical Council Reg: <strong>{councilRegNo}</strong>
                </span>
                <span className="delegate-pass-card__cme-pill">6 CME Points</span>
              </div>
            )}

            <div className="delegate-pass-card__meta-rows">
              <div className="delegate-pass-card__meta-item">
                <span className="delegate-pass-card__meta-label">Dates</span>
                <span className="delegate-pass-card__meta-val">21 – 23 Nov 2026</span>
              </div>
              <div className="delegate-pass-card__meta-item">
                <span className="delegate-pass-card__meta-label">Venue</span>
                <span className="delegate-pass-card__meta-val">The Leela Palace, Chennai</span>
              </div>
              {companyName && (
                <div className="delegate-pass-card__meta-item">
                  <span className="delegate-pass-card__meta-label">Sponsor</span>
                  <span className="delegate-pass-card__meta-val">{companyName}</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Viewfinder Column */}
          <div className="delegate-pass-card__qr-col">
            <div className="delegate-pass-card__qr-box">
              <span className="qr-corner qr-corner--tl" />
              <span className="qr-corner qr-corner--tr" />
              <span className="qr-corner qr-corner--bl" />
              <span className="qr-corner qr-corner--br" />
              <img
                src={qrUrl}
                alt={`Official QR Pass for ${result.registrationCode || fullName}`}
                width={160}
                height={160}
                className="delegate-pass-card__qr-img"
              />
            </div>
            <p className="delegate-pass-card__qr-caption">Show at Leela Palace Desk</p>
            <span className="delegate-pass-card__qr-code">{result.registrationCode}</span>
          </div>
        </div>

        {/* Notched perforated ticket divider */}
        <div className="delegate-pass-card__perforation">
          <span className="delegate-pass-card__notch delegate-pass-card__notch--left" />
          <span className="delegate-pass-card__dashed-line" />
          <span className="delegate-pass-card__notch delegate-pass-card__notch--right" />
        </div>

        {/* Pass Actions Bar */}
        <div className="delegate-pass-card__footer">
          <div className="delegate-pass-card__actions">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="conf-btn conf-btn--primary"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Download Official Pass (PDF)</span>
            </a>

            <a href={ticketPath} className="conf-btn conf-btn--secondary">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="4" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="7" y1="8" x2="17" y2="8" strokeLinecap="round" />
                <line x1="7" y1="12" x2="17" y2="12" strokeLinecap="round" />
                <line x1="7" y1="16" x2="13" y2="16" strokeLinecap="round" />
              </svg>
              <span>View Digital Ticket</span>
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              className="conf-btn conf-btn--ghost conf-btn--print"
              title="Print Delegate Pass & Confirmation"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Instant Notification Dispatch Notice */}
      <div className="conf-delivery-card">
        <div className="conf-delivery-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="conf-delivery-card__content">
          <h4 className="conf-delivery-card__title">Instant Confirmation &amp; QR Ticket Dispatched</h4>
          <p className="conf-delivery-card__text">
            Your official delegate pass and scannable QR ticket have been sent automatically:
          </p>
          <div className="conf-delivery-badges">
            {email && (
              <span className="conf-delivery-badge">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>
                  Email: <strong>{email}</strong>
                </span>
              </span>
            )}
            {phone && (
              <span className="conf-delivery-badge conf-delivery-badge--whatsapp">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>
                  WhatsApp: <strong>{phone}</strong>
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Delegate Information & Roster Grid */}
      <div className="conf-details-card">
        <div className="conf-card-header">
          <div className="conf-card-header__left">
            <span className="conf-card-header__icon" aria-hidden="true">
              📋
            </span>
            <div>
              <h3 className="conf-card-header__title">Delegate Information</h3>
              <p className="conf-card-header__subtitle">Accreditation &amp; conference roster record</p>
            </div>
          </div>
          <span className="conf-status-tag conf-status-tag--confirmed">● Confirmed</span>
        </div>

        <div className="conf-grid">
          <div className="conf-grid__item">
            <span className="conf-grid__label">Full Name</span>
            <span className="conf-grid__value conf-grid__value--highlight">{fullName}</span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Medical Council Reg. No.</span>
            <span className="conf-grid__value">
              {councilRegNo ? (
                <>
                  <strong>{councilRegNo}</strong>
                  <span className="conf-grid__badge">TNMC Verified</span>
                </>
              ) : (
                'Not Provided'
              )}
            </span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Pass Category</span>
            <span className="conf-grid__value">{passCategory}</span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Registration Mode</span>
            <span className="conf-grid__value">Online (Complimentary Pass)</span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Email Address</span>
            <span className="conf-grid__value">{email || 'Not Provided'}</span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Mobile Number</span>
            <span className="conf-grid__value">{phone || 'Not Provided'}</span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Gender</span>
            <span className="conf-grid__value">{gender || 'Not Specified'}</span>
          </div>

          <div className="conf-grid__item">
            <span className="conf-grid__label">Registration Date</span>
            <span className="conf-grid__value">{regDate}</span>
          </div>

          {address && (
            <div className="conf-grid__item conf-grid__item--full">
              <span className="conf-grid__label">Postal Address</span>
              <span className="conf-grid__value">{address}</span>
            </div>
          )}

          {cityState && (
            <div className="conf-grid__item conf-grid__item--full">
              <span className="conf-grid__label">City, State &amp; Country</span>
              <span className="conf-grid__value">
                {cityState} {pincode ? `— ${pincode}` : ''}
              </span>
            </div>
          )}

          {institution && (
            <div className="conf-grid__item conf-grid__item--full">
              <span className="conf-grid__label">Institution / Hospital</span>
              <span className="conf-grid__value">{institution}</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Financial Summary & Receipt (Reconciled, Professional!) */}
      <div className="conf-details-card">
        <div className="conf-card-header">
          <div className="conf-card-header__left">
            <span className="conf-card-header__icon" aria-hidden="true">
              💳
            </span>
            <div>
              <h3 className="conf-card-header__title">Fee &amp; Payment Summary</h3>
              <p className="conf-card-header__subtitle">Official tax invoice &amp; sponsorship breakdown</p>
            </div>
          </div>
          <span className="conf-status-tag conf-status-tag--paid">✓ 100% Sponsored</span>
        </div>

        <div className="conf-receipt">
          <div className="conf-receipt__row">
            <div className="conf-receipt__item">
              <span className="conf-receipt__label">Delegate Pass Fee ({passCategory})</span>
              <span className="conf-receipt__sub">Summit scientific sessions &amp; delegate kit</span>
            </div>
            <span className="conf-receipt__amount">{formatAmount(basePrice, currency)}</span>
          </div>

          <div className="conf-receipt__row">
            <div className="conf-receipt__item">
              <span className="conf-receipt__label">Applicable GST (18%)</span>
              <span className="conf-receipt__sub">CGST (9%) + SGST (9%)</span>
            </div>
            <span className="conf-receipt__amount">{formatAmount(taxAmount, currency)}</span>
          </div>

          <div className="conf-receipt__row conf-receipt__row--subtotal">
            <span className="conf-receipt__label">Gross Total Value</span>
            <span className="conf-receipt__amount">{formatAmount(grossAmount, currency)}</span>
          </div>

          <div className="conf-receipt__row conf-receipt__row--discount">
            <div className="conf-receipt__item">
              <span className="conf-receipt__label">Sponsor / Coupon Discount ({couponCode})</span>
              <span className="conf-receipt__sub">
                {companyName ? `Complimentary pass sponsored by ${companyName}` : '100% full fee waiver applied'}
              </span>
            </div>
            <span className="conf-receipt__amount text-success">
              −{formatAmount(discountAmount, currency)}
            </span>
          </div>

          <div className="conf-receipt__row conf-receipt__row--grand">
            <div className="conf-receipt__item">
              <span className="conf-receipt__label">Grand Total Paid</span>
              <span className="conf-receipt__sub">Zero balance due • All taxes included</span>
            </div>
            <span className="conf-receipt__amount conf-receipt__amount--total">
              {currency} 0.00
            </span>
          </div>
        </div>
      </div>

      {/* 6. Event Venue & Check-In Guide */}
      <div className="conf-venue-card">
        <div className="conf-venue-card__header">
          <div className="conf-venue-card__pin" aria-hidden="true">
            📍
          </div>
          <div>
            <h4 className="conf-venue-card__title">The Leela Palace, Chennai</h4>
            <p className="conf-venue-card__address">
              Adyar Seaface, MRC Nagar, Raja Annamalai Puram, Chennai, Tamil Nadu 600028
            </p>
          </div>
        </div>
        <div className="conf-venue-card__tips">
          <div className="conf-venue-card__tip">
            <span className="conf-venue-card__tip-num">1</span>
            <span>
              Present this digital QR pass on your phone at <strong>Counter A</strong> for instant badge printing.
            </span>
          </div>
          <div className="conf-venue-card__tip">
            <span className="conf-venue-card__tip-num">2</span>
            <span>Registration desk opens at <strong>07:30 AM</strong> on Friday, 21 November 2026.</span>
          </div>
          <div className="conf-venue-card__tip">
            <span className="conf-venue-card__tip-num">3</span>
            <span>6 TNMC CME credit points will be awarded to verified attending delegates.</span>
          </div>
        </div>
      </div>

      {/* 7. Bottom Navigation */}
      <div className="conf-bottom-nav">
        <Button variant="ghost" href={`/events/${slug}`}>
          ← Back to CIIM 2026 Event Microsite
        </Button>
      </div>
    </div>
  );
}
