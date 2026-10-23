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
        <h4 className="registration-summary-card__title">Registration Summary</h4>
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
  const ticketPath = `/tickets/${result.qrToken}`;
  const qrUrl = `${API_BASE}/api/v1/tickets/${result.qrToken}/qr.png`;
  const pdfUrl = `${API_BASE}/api/v1/tickets/${result.qrToken}/pdf`;

  const att = result.attendee || {};
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

  const detailRows = [
    ['Full Name', att.name || [formState?.title, formState?.firstName, formState?.lastName].filter(Boolean).join(' ')],
    ['Medical Council Reg. No.', att.medicalCouncilRegNo || formState?.medicalCouncilRegNo],
    ['Email', att.email],
    ['Mobile', att.phone],
    ['Gender', att.gender || formState?.gender],
    ['Address', att.address || formState?.address],
    ['City / State', [att.city || formState?.city, att.state || formState?.state, att.country || formState?.country].filter(Boolean).join(', ')],
    ['Pass Category', result.ticketType?.name || 'Delegate Pass'],
    ['Registration Mode', 'Online'],
    ['Status', 'Confirmed'],
    ['Registration Date', regDate],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="register-success register-success--medical">
      <div className="register-success__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="36"
          height="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="register-success__heading">Registration Confirmed</h1>
      <p className="register-success__lead">
        Delegate enrollment for <strong>{event.title}</strong> has been successfully processed.
      </p>

      {/* --- Registration Detail Table Matching Client Specification --- */}
      <div className="medical-summary-table-card">
        <div className="medical-table-header">Registration Detail</div>
        <table className="medical-table">
          <tbody>
            {detailRows.map(([label, value]) => (
              <tr key={label}>
                <td className="medical-table__label">{label}</td>
                <td className="medical-table__value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Registration Summary Table Matching Client Specification --- */}
      <div className="medical-summary-table-card" style={{ marginTop: 'var(--space-6)' }}>
        <div className="medical-table-header">Registration Summary</div>
        <table className="medical-table">
          <thead>
            <tr>
              <th className="medical-table__label">Description</th>
              <th className="medical-table__value text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Registration Fee</td>
              <td className="text-right">₹{result.pricing?.basePrice || 21000}</td>
            </tr>
            <tr>
              <td>Sponsor / Coupon Discount ({result.couponCode || 'APPLIED'})</td>
              <td className="text-right text-success">
                −₹{result.pricing?.discountAmount || result.pricing?.basePrice || 21000}
              </td>
            </tr>
            <tr className="medical-table__total-row">
              <td>
                <strong>Grand Total</strong>
              </td>
              <td className="text-right">
                <strong>INR 0</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="register-success__qr" style={{ marginTop: 'var(--space-8)' }}>
        <img
          src={qrUrl}
          alt={`QR ticket for ${result.registrationCode}`}
          width={180}
          height={180}
        />
        <p>Show this digital QR pass at the Leela Palace registration desk</p>
      </div>

      <div className="register-success__actions">
        <Button variant="primary" href={pdfUrl} external>
          Download Official Pass (PDF)
        </Button>
        <Button variant="secondary" href={ticketPath}>
          View Digital Ticket
        </Button>
      </div>

      <p className="register-success__note">
        An instant confirmation along with your delegate QR ticket has also been sent to{' '}
        <strong>{result.attendee.email}</strong> and on WhatsApp to{' '}
        <strong>{result.attendee.phone}</strong>.
      </p>

      <Button variant="ghost" href={`/events/${slug}`}>
        Back to event microsite
      </Button>
    </div>
  );
}
