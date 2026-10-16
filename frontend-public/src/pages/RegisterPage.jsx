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

const EMPTY_FORM = { name: '', phone: '', email: '' };

export default function RegisterPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const slug = params.slug || DEFAULT_SLUG;
  const preselectedCode = searchParams.get('ticket');

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // validated preview for the current code + pass
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
    try {
      const res = await api.register({
        eventSlug: slug,
        ticketTypeId: selectedTicket.id,
        attendee: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
        couponCode: coupon.code,
        idempotencyKey: idempotencyKey.current,
        campaignSource: getCampaign().source,
      });
      setResult(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      // A coupon problem found at submit time (e.g. the last slot went
      // seconds ago) invalidates the preview, so the button locks again.
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
          <RegistrationSuccess result={result} event={event} slug={slug} />
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
            <h1 className="register-page__title">Register</h1>
            <p className="register-page__subtitle">
              Registration is by sponsor coupon. Enter the code from your company to receive your QR
              ticket instantly — there is nothing to pay.
            </p>

            <form onSubmit={handleSubmit} className="register-form">
              {ticketTypes.length > 1 && (
                <label className="register-field">
                  <span>Pass</span>
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
                <span>Full name</span>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Dr. Jane Doe"
                />
              </label>

              <div className="register-field-row">
                <label className="register-field">
                  <span>Mobile number</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    pattern="[0-9+ \(\)\-]{10,20}"
                    title="10-digit mobile number, optionally with country code"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="98765 43210"
                  />
                  <small className="register-field__hint">
                    Your ticket is also sent here on WhatsApp.
                  </small>
                </label>
                <label className="register-field">
                  <span>Email address</span>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <div className="register-field">
                <label htmlFor="coupon-code">
                  <span className="register-field__label">Coupon code</span>
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
                    placeholder="e.g. COMPANY2026"
                    aria-describedby="coupon-status"
                    aria-invalid={couponError ? 'true' : undefined}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleValidate}
                    disabled={!couponCode.trim() || checking || Boolean(coupon)}
                  >
                    {checking ? 'Checking…' : coupon ? 'Validated' : 'Validate'}
                  </Button>
                </div>

                <div id="coupon-status" aria-live="polite">
                  {couponError && <p className="coupon-error">{couponError}</p>}
                  {coupon && <CouponSummary coupon={coupon} />}
                </div>
              </div>

              {submitError && (
                <p className="register-error" role="alert">
                  {submitError}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={!canSubmit}>
                {submitting ? 'Registering…' : 'Complete Registration'}
              </Button>
              {!coupon && (
                <p className="register-form__hint">
                  Validate your coupon code to complete registration.
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

function CouponSummary({ coupon }) {
  return (
    <div className="coupon-card">
      <div className="coupon-card__head">
        <span className="coupon-card__check" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <strong>Valid coupon</strong>
        <span className="coupon-card__code">{coupon.code}</span>
      </div>
      <dl className="coupon-card__rows">
        <div>
          <dt>Company</dt>
          <dd>{coupon.companyName}</dd>
        </div>
        <div>
          <dt>Original amount</dt>
          <dd>{formatAmount(coupon.originalAmount, coupon.currency)}</dd>
        </div>
        <div className="coupon-card__discount">
          <dt>Discount</dt>
          <dd>−{formatAmount(coupon.discountAmount, coupon.currency)}</dd>
        </div>
        <div className="coupon-card__total">
          <dt>Final payable</dt>
          <dd>{formatAmount(coupon.finalAmount, coupon.currency)}</dd>
        </div>
      </dl>
    </div>
  );
}

function RegistrationSuccess({ result, event, slug }) {
  const ticketPath = `/tickets/${result.qrToken}`;
  const qrUrl = `${API_BASE}/api/v1/tickets/${result.qrToken}/qr.png`;
  const pdfUrl = `${API_BASE}/api/v1/tickets/${result.qrToken}/pdf`;

  const rows = [
    ['Registration ID', result.registrationCode],
    ['Name', result.attendee.name],
    ['Mobile', result.attendee.phone],
    ['Email', result.attendee.email],
    ['Company', result.company?.name],
    ['Coupon', result.couponCode],
    ['Pass', result.ticketType?.name],
    ['Amount paid', formatAmount(result.pricing?.totalAmount ?? 0, result.pricing?.currency)],
  ].filter(([, value]) => value);

  return (
    <div className="register-success register-success--ticket">
      <div className="register-success__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="36"
          height="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1>You're registered!</h1>
      <p className="register-success__lead">
        Your registration for <strong>{event.title}</strong> is{' '}
        <span className="status-pill">Confirmed</span>
      </p>

      <div className="register-success__qr">
        <img
          src={qrUrl}
          alt={`QR ticket for ${result.registrationCode}`}
          width={200}
          height={200}
        />
        <p>Show this QR code at the registration desk</p>
      </div>

      <dl className="register-success__details">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="register-success__actions">
        <Button variant="primary" href={pdfUrl} external>
          Download ticket (PDF)
        </Button>
        <Button variant="secondary" href={ticketPath}>
          Open ticket page
        </Button>
      </div>

      <p className="register-success__note">
        We're also sending your ticket to <strong>{result.attendee.email}</strong> and to{' '}
        <strong>{result.attendee.phone}</strong> on WhatsApp. If it doesn't arrive, this page and
        the PDF are your ticket — bookmark the ticket page.
      </p>

      <Button variant="ghost" href={`/events/${slug}`}>
        Back to event
      </Button>
    </div>
  );
}
