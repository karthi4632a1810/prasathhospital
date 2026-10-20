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
  'United Kingdom',
  'United States',
  'United Arab Emirates',
  'Singapore',
  'Malaysia',
  'Australia',
  'Canada',
  'Germany',
  'Nepal',
  'Sri Lanka',
  'Bangladesh',
  'Other',
];

const REGISTRATION_CATEGORIES = [
  'Non IFS Member',
  'IFS Member',
  'Postgraduate Student',
  'Delegate / Consultant',
  'Faculty / Invited Speaker',
  'International Delegate',
];

const WORKSHOP_OPTIONS = [
  { value: 'None', label: 'None (Conference Only)' },
  { value: 'Basic Infertility - Getting it Right', label: 'Basic Infertility — Getting it Right' },
  { value: 'Ultrasound in ART & Early Pregnancy', label: 'Ultrasound in ART & Early Pregnancy' },
  { value: 'Live Tele-Robotic Surgery Masterclass', label: 'Live Tele-Robotic Surgery Masterclass' },
  { value: 'Embryology & Quality Control Protocols', label: 'Embryology & Quality Control Protocols' },
];

const EMPTY_FORM = {
  title: 'Dr',
  firstName: '',
  lastName: '',
  gender: 'Male',
  email: '',
  phone: '',
  institution: '',
  designation: '',
  address: '',
  country: 'India',
  state: 'Tamil Nadu',
  city: '',
  pincode: '',
  registrationCategory: 'Non IFS Member',
  workshop: 'Basic Infertility - Getting it Right',
  hasAccompanyingPerson: false,
  accompanyingPersonName: '',
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
  const ticketTypes = useMemo(() => state.data?.ticketTypes || [], [state.data]);

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
          institution: form.institution.trim(),
          designation: form.designation.trim(),
          address: form.address.trim(),
          country: form.country,
          state: form.state,
          city: form.city.trim(),
          pincode: form.pincode.trim(),
          category: selectedTicket.name,
          registrationCategory: form.registrationCategory,
          workshop: form.workshop,
          accompanyingPerson: {
            hasAccompanyingPerson: form.hasAccompanyingPerson,
            name: form.accompanyingPersonName.trim(),
          },
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
      if (err instanceof ApiError && /coupon/i.test(message)) {
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
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">1. Registration Category & Workshop Option</h3>
                </div>

                <div className="register-field-row">
                  {ticketTypes.length > 1 && (
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
                    </label>
                  )}

                  <label className="register-field">
                    <span>Registration Category *</span>
                    <select
                      value={form.registrationCategory}
                      onChange={(e) => updateField('registrationCategory', e.target.value)}
                      required
                    >
                      {REGISTRATION_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="register-field">
                  <span>Full Day Workshops</span>
                  <select
                    value={form.workshop}
                    onChange={(e) => updateField('workshop', e.target.value)}
                  >
                    {WORKSHOP_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <small className="register-field__hint">
                    Select a dedicated practical masterclass or skill lab (subject to capacity).
                  </small>
                </label>
              </div>

              {/* --- Section B: Personal Information --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">2. Personal Information</h3>
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
                    <span>Last Name</span>
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
                      Your QR entry ticket is instantly sent here via WhatsApp.
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
                    Confirmation & delegate credentials will be delivered to this address.
                  </small>
                </label>
              </div>

              {/* --- Section C: Professional & Institutional Details --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">3. Institutional & Professional Profile</h3>
                </div>

                <div className="register-field-row">
                  <label className="register-field">
                    <span>Institution / Hospital *</span>
                    <input
                      required
                      maxLength={150}
                      value={form.institution}
                      onChange={(e) => updateField('institution', e.target.value)}
                      placeholder="e.g. Prashanth Fertility Research Centre"
                    />
                  </label>

                  <label className="register-field">
                    <span>Designation</span>
                    <input
                      maxLength={100}
                      value={form.designation}
                      onChange={(e) => updateField('designation', e.target.value)}
                      placeholder="e.g. Consultant Gynecologist / Senior Embryologist"
                    />
                  </label>
                </div>
              </div>

              {/* --- Section D: Correspondence Address --- */}
              <div className="form-section">
                <div className="form-section__header">
                  <h3 className="form-section__title">4. Correspondence Address</h3>
                </div>

                <label className="register-field">
                  <span>Correspondence Address *</span>
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
                      placeholder="e.g. Chennai"
                    />
                  </label>

                  <label className="register-field">
                    <span>PIN / ZIP Code *</span>
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

              {/* --- Section E: Accompanying Person Option --- */}
              <div className="form-section form-section--accompanying">
                <div className="form-section__header">
                  <h3 className="form-section__title">5. Accompanying Person Option</h3>
                </div>

                <label className="register-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.hasAccompanyingPerson}
                    onChange={(e) => updateField('hasAccompanyingPerson', e.target.checked)}
                  />
                  <span>
                    Accompanying Person Registration (Includes access to banquet, inauguration & meals)
                  </span>
                </label>

                {form.hasAccompanyingPerson && (
                  <div className="register-field register-field--accompanying-name">
                    <span>Accompanying Person Full Name *</span>
                    <input
                      required={form.hasAccompanyingPerson}
                      value={form.accompanyingPersonName}
                      onChange={(e) => updateField('accompanyingPersonName', e.target.value)}
                      placeholder="e.g. Dr. / Mr. / Mrs. Accompanying Guest"
                    />
                  </div>
                )}
              </div>

              {/* --- Section F: Coupon & Fee Validation --- */}
              <div className="form-section form-section--coupon">
                <div className="form-section__header">
                  <h3 className="form-section__title">6. Sponsor Pass / Coupon Code</h3>
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
                Category: {formState?.registrationCategory}
                {formState?.workshop && formState.workshop !== 'None' ? ` · ${formState.workshop}` : ''}
              </div>
            </td>
            <td className="text-right">{formatAmount(originalPrice, coupon.currency)}</td>
          </tr>
          {formState?.hasAccompanyingPerson && (
            <tr>
              <td>Accompanying Person ({formState.accompanyingPersonName || 'Guest'})</td>
              <td className="text-right">{formatAmount(15500, coupon.currency)}</td>
            </tr>
          )}
          <tr className="summary-table__discount">
            <td>
              <span>Sponsor / Coupon Discount ({coupon.code})</span>
              <div className="summary-table__sub">Issued by: {coupon.companyName}</div>
            </td>
            <td className="text-right text-success">
              −{formatAmount(originalPrice + (formState?.hasAccompanyingPerson ? 15500 : 0), coupon.currency)}
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
    ['Email', att.email],
    ['Mobile', att.phone],
    ['Gender', att.gender || formState?.gender],
    ['Institution / Hospital', att.institution || formState?.institution],
    ['Designation', att.designation || formState?.designation],
    ['City / State', [att.city || formState?.city, att.state || formState?.state, att.country || formState?.country].filter(Boolean).join(', ')],
    ['Category', result.ticketType?.name || 'Conference and Workshop'],
    ['Registration Category', att.registrationCategory || formState?.registrationCategory || 'Non IFS Member'],
    ['Full Day Workshops', att.workshop || formState?.workshop || 'Basic Infertility - Getting it Right'],
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
