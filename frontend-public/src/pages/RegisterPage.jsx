import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { LoadingState, ErrorState, NotFoundState } from '../components/ui/States';

import { api, ApiError } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { captureCampaign, getCampaign } from '../lib/campaign';
import { openRazorpayCheckout } from '../lib/razorpay';
import './RegisterPage.css';

const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_EVENT_SLUG || 'fertility-gynaecology-summit-2026';

export default function RegisterPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const slug = params.slug || DEFAULT_SLUG;
  const preselectedCode = searchParams.get('ticket');

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', participantType: '' });
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null); // { valid, reason?, discountAmount? }
  const [promoChecking, setPromoChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null); // the created registration

  useEffect(() => {
    captureCampaign();
  }, []);

  const load = useCallback(() => {
    setState({ status: 'loading', data: null, error: null });
    api
      .getEvent(slug)
      .then((res) => setState({ status: 'ready', data: res.data, error: null }))
      .catch((err) => setState({ status: err.status === 404 ? 'not-found' : 'error', data: null, error: err }));
  }, [slug]);

  useEffect(load, [load]);

  const event = state.data?.event;
  const ticketTypes = useMemo(() => state.data?.ticketTypes || [], [state.data]);

  useEffect(() => {
    if (!ticketTypes.length) return;
    const preselected = preselectedCode && ticketTypes.find((t) => t.code === preselectedCode);
    setTicketTypeId((preselected || ticketTypes[0]).id);
  }, [ticketTypes, preselectedCode]);

  const selectedTicket = ticketTypes.find((t) => t.id === ticketTypeId) || null;

  async function handleApplyPromo() {
    if (!promoCode.trim() || !selectedTicket) return;
    setPromoChecking(true);
    setPromoResult(null);
    try {
      const res = await api.validatePromo(promoCode.trim(), selectedTicket.id);
      setPromoResult(res.data);
    } catch (err) {
      setPromoResult({ valid: false, reason: err.message });
    } finally {
      setPromoChecking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTicket) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.register({
        eventSlug: slug,
        ticketTypeId: selectedTicket.id,
        attendee: form,
        promoCode: promoResult?.valid ? promoCode.trim() : undefined,
        campaignSource: getCampaign().source,
      });
      setResult(res.data);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
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
          <div className="register-success">
            <div className="register-success__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>{result.status === 'confirmed' ? "You're registered!" : 'Registration received'}</h1>
            <p className="register-success__code">
              Reference code <strong>{result.registrationCode}</strong>
            </p>

            {result.status === 'confirmed' ? (
              <>
                <p className="register-success__note">
                  A confirmation with your digital ticket will also be sent to{' '}
                  <strong>{result.attendee.email}</strong> and on WhatsApp shortly.
                </p>
                <Button variant="primary" href={`/tickets/${result.qrToken}`}>
                  View your ticket
                </Button>
                <div style={{ marginTop: 16 }}>
                  <Button variant="secondary" href={`/events/${slug}`}>
                    Back to event
                  </Button>
                </div>
              </>
            ) : (
              <PendingPaymentPanel registration={result} onConfirmed={setResult} eventSlug={slug} />
            )}
          </div>
        </main>
        <SiteFooter event={event} />
      </>
    );
  }

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
              Every pass includes a digital ticket with a unique QR code.
            </p>

            <form onSubmit={handleSubmit} className="register-form">
              <label className="register-field">
                <span>Select your pass</span>
                <select
                  value={ticketTypeId}
                  onChange={(e) => {
                    setTicketTypeId(e.target.value);
                    setPromoResult(null);
                  }}
                  required
                >
                  {ticketTypes.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.saleState !== 'on-sale'}>
                      {t.name} — {t.isFree ? 'Free' : formatCurrency(t.priceWithTax)}
                      {t.saleState !== 'on-sale' ? ` (${t.saleState.replace('-', ' ')})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="register-field">
                <span>Full name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Dr. Jane Doe"
                />
              </label>

              <div className="register-field-row">
                <label className="register-field">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="register-field">
                  <span>Phone (WhatsApp preferred)</span>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="98765 43210"
                  />
                </label>
              </div>

              <label className="register-field">
                <span>Participant type (optional)</span>
                <input
                  value={form.participantType}
                  onChange={(e) => setForm((f) => ({ ...f, participantType: e.target.value }))}
                  placeholder="e.g. PG Student"
                />
              </label>

              <label className="register-field">
                <span>Promo code (optional)</span>
                <div className="register-promo">
                  <input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoResult(null);
                    }}
                    placeholder="e.g. EARLYBIRD"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || promoChecking}
                  >
                    {promoChecking ? 'Checking…' : 'Apply'}
                  </Button>
                </div>
                {promoResult && (
                  <div className="register-promo-result">
                    <Badge tone={promoResult.valid ? 'success' : 'danger'} size="sm">
                      {promoResult.valid
                        ? `Code applied — ${formatCurrency(promoResult.discountAmount)} off`
                        : promoResult.reason}
                    </Badge>
                  </div>
                )}
              </label>

              {submitError && <p className="register-error">{submitError}</p>}

              {selectedTicket && (
                <OrderSummary ticket={selectedTicket} promoResult={promoResult} />
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={submitting || !selectedTicket}>
                {submitting ? 'Submitting…' : selectedTicket?.isFree ? 'Confirm free registration' : 'Continue'}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter event={event} />
    </>
  );
}

function PendingPaymentPanel({ registration, onConfirmed, eventSlug }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [notConfigured, setNotConfigured] = useState(false);

  async function handlePayNow() {
    setPaying(true);
    setError('');
    try {
      const orderRes = await api.createPaymentOrder(registration.id);
      const order = orderRes.data;

      const checkoutResult = await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Prashanth Hospitals',
        description: `Registration ${order.registrationCode}`,
        prefill: {
          name: order.attendee?.name,
          email: order.attendee?.email,
          contact: order.attendee?.phone,
        },
        theme: { color: '#96291F' },
      });

      const verifyRes = await api.verifyPayment({
        razorpay_order_id: checkoutResult.razorpay_order_id,
        razorpay_payment_id: checkoutResult.razorpay_payment_id,
        razorpay_signature: checkoutResult.razorpay_signature,
      });
      onConfirmed(verifyRes.data);
    } catch (err) {
      if (err instanceof ApiError && /not configured/i.test(err.message)) {
        setNotConfigured(true);
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <p className="register-success__note">
        Your pass is reserved for a short while for{' '}
        <strong>{formatCurrency(registration.pricing.totalAmount)}</strong>.
      </p>

      {notConfigured ? (
        <p className="register-success__note">
          Online payment is being enabled shortly — our team will reach out on WhatsApp/phone to
          complete your registration.
        </p>
      ) : (
        <>
          {error && <p className="register-error" style={{ textAlign: 'left' }}>{error}</p>}
          <Button variant="primary" size="lg" onClick={handlePayNow} disabled={paying} fullWidth>
            {paying ? 'Opening payment…' : `Pay ${formatCurrency(registration.pricing.totalAmount)}`}
          </Button>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" href={`/events/${eventSlug}`}>
          Back to event
        </Button>
      </div>
    </>
  );
}

function OrderSummary({ ticket, promoResult }) {
  const base = ticket.price;
  const discount = promoResult?.valid ? promoResult.discountAmount : 0;
  const subtotal = Math.max(base - discount, 0);
  const tax = ticket.taxPercent ? Math.round(subtotal * (ticket.taxPercent / 100) * 100) / 100 : 0;
  const total = subtotal + tax;

  return (
    <div className="order-summary">
      <div className="order-summary__row">
        <span>{ticket.name}</span>
        <span>{formatCurrency(base)}</span>
      </div>
      {discount > 0 && (
        <div className="order-summary__row order-summary__row--discount">
          <span>Promo discount</span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}
      {tax > 0 && (
        <div className="order-summary__row">
          <span>GST ({ticket.taxPercent}%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
      )}
      <div className="order-summary__row order-summary__row--total">
        <span>Total</span>
        <span>{total === 0 ? 'Free' : formatCurrency(total)}</span>
      </div>
    </div>
  );
}
