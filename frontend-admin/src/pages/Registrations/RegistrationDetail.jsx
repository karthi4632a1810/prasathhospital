import { useCallback, useEffect, useState } from 'react';
import { registrationApi } from '../../lib/registrationApi';
import { formatDateTime } from '../../lib/format';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { DeliveryBadge, RegistrationStatusBadge } from '../../components/StatusBadges';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const PUBLIC_SITE = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '');

const CHANNEL_LABEL = { email: 'Email', whatsapp: 'WhatsApp' };

function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
}

export default function RegistrationDetail({ id, onClose, onChanged }) {
  const [reg, setReg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(() => {
    setError(null);
    registrationApi
      .get(id)
      .then((res) => {
        setReg(res.data);
        setNotes(res.data.notes || '');
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(load, [load]);

  function apply(updated, message, tone = 'success') {
    setReg(updated);
    onChanged(updated);
    if (message) setFlash({ tone, message });
  }

  async function handleRetry(channel) {
    setBusy(channel);
    setFlash(null);
    try {
      const res = await registrationApi.retryDelivery(reg.id, channel);
      const status = res.data.outcome.status;
      apply(
        res.data.registration,
        res.message,
        status === 'sent' ? 'success' : status === 'not_configured' ? 'warning' : 'error'
      );
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    } finally {
      setBusy('');
    }
  }

  async function handleCancel(e) {
    e.preventDefault();
    setBusy('cancel');
    setFlash(null);
    try {
      const res = await registrationApi.cancel(reg.id, reason.trim());
      apply(res.data, 'Registration cancelled. Its coupon place has been released.');
      setCancelOpen(false);
      setReason('');
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    } finally {
      setBusy('');
    }
  }

  async function handleSaveNotes() {
    setBusy('notes');
    try {
      const res = await registrationApi.update(reg.id, { notes });
      apply(res.data, 'Notes saved.');
    } catch (err) {
      setFlash({ tone: 'error', message: err.message });
    } finally {
      setBusy('');
    }
  }

  const title = reg ? reg.attendee?.name : 'Registration';
  const subtitle = reg ? reg.registrationCode : undefined;

  return (
    <Drawer open title={title} subtitle={subtitle} onClose={onClose} width={620}>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !reg ? (
        <LoadingState label="Loading registration…" />
      ) : (
        <Body
          reg={reg}
          busy={busy}
          flash={flash}
          onRetry={handleRetry}
          cancelOpen={cancelOpen}
          setCancelOpen={setCancelOpen}
          reason={reason}
          setReason={setReason}
          onCancel={handleCancel}
          notes={notes}
          setNotes={setNotes}
          onSaveNotes={handleSaveNotes}
        />
      )}
    </Drawer>
  );
}

function Body({
  reg,
  busy,
  flash,
  onRetry,
  cancelOpen,
  setCancelOpen,
  reason,
  setReason,
  onCancel,
  notes,
  setNotes,
  onSaveNotes,
}) {
  const isConfirmed = reg.status === 'confirmed';
  const canCancel = (isConfirmed || reg.status === 'pending_payment') && !reg.checkedInAt;
  const ticketUrl = reg.qrToken ? `${PUBLIC_SITE}/tickets/${reg.qrToken}` : null;
  const qrUrl = reg.qrToken ? `${API_BASE}/api/v1/tickets/${reg.qrToken}/qr.png` : null;
  const pdfUrl = reg.qrToken ? `${API_BASE}/api/v1/tickets/${reg.qrToken}/pdf` : null;

  return (
    <>
      {flash && (
        <div className={`notice notice--${flash.tone}`} role="status">
          {flash.message}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-5)',
        }}
      >
        <RegistrationStatusBadge status={reg.status} />
        {reg.checkedInAt && <span className="badge badge--success badge--sm">Checked in</span>}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-6)',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <dl className="detail-list" style={{ flex: '1 1 300px' }}>
          <dt>Registration ID</dt>
          <dd className="mono">{reg.registrationCode}</dd>
          <dt>Name</dt>
          <dd>{reg.attendee?.name}</dd>
          <dt>Mobile</dt>
          <dd>{reg.attendee?.phone}</dd>
          <dt>Email</dt>
          <dd>{reg.attendee?.email}</dd>
          <dt>Company</dt>
          <dd>{reg.company?.name || '—'}</dd>
          <dt>Coupon</dt>
          <dd className="mono">{reg.couponCode || reg.coupon?.code || '—'}</dd>
          <dt>Pass</dt>
          <dd>{reg.ticketType?.name || '—'}</dd>
          <dt>Amount paid</dt>
          <dd>{formatAmount(reg.pricing?.totalAmount, reg.pricing?.currency)}</dd>
          <dt>Registered</dt>
          <dd>{formatDateTime(reg.createdAt)}</dd>
          {reg.checkedInAt && (
            <>
              <dt>Checked in</dt>
              <dd>
                {formatDateTime(reg.checkedInAt)}
                {reg.checkedInBy?.name ? ` · ${reg.checkedInBy.name}` : ''}
              </dd>
            </>
          )}
          {reg.cancelledAt && (
            <>
              <dt>Cancelled</dt>
              <dd>
                {formatDateTime(reg.cancelledAt)}
                {reg.cancelledBy?.name ? ` · ${reg.cancelledBy.name}` : ''}
              </dd>
              <dt>Reason</dt>
              <dd>{reg.cancellationReason || '—'}</dd>
            </>
          )}
        </dl>

        {qrUrl && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={qrUrl}
              alt={`QR code for ${reg.registrationCode}`}
              width={150}
              height={150}
              style={{
                border: '1px solid var(--ink-200)',
                borderRadius: 'var(--radius-md)',
                padding: 6,
                opacity: isConfirmed ? 1 : 0.3,
              }}
            />
            <p
              className="muted"
              style={{ fontSize: 'var(--text-xs)', margin: 'var(--space-1) 0 var(--space-3)' }}
            >
              QR {reg.qrStatus === 'active' ? 'active' : 'void'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" href={pdfUrl} external>
                Download ticket
              </Button>
              {ticketUrl && (
                <Button variant="ghost" size="sm" href={ticketUrl} external>
                  Open ticket page
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="section-label">Delivery</p>
      <div className="field-row" style={{ marginBottom: 'var(--space-6)' }}>
        {['email', 'whatsapp'].map((channel) => {
          const d = reg.delivery?.[channel] || {};
          return (
            <div key={channel} className="card" style={{ padding: 'var(--space-4)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <strong>{CHANNEL_LABEL[channel]}</strong>
                <DeliveryBadge status={d.status} />
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: 0 }}>
                {d.attempts || 0} attempt{d.attempts === 1 ? '' : 's'}
                {d.lastAttemptAt ? ` · last ${formatDateTime(d.lastAttemptAt)}` : ''}
              </p>
              {d.sentAt && (
                <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: '2px 0 0' }}>
                  Sent {formatDateTime(d.sentAt)}
                </p>
              )}
              {d.error && d.status !== 'sent' && (
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--danger-700)',
                    margin: 'var(--space-2) 0 0',
                  }}
                >
                  {d.error}
                </p>
              )}
              {isConfirmed && (
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ marginTop: 'var(--space-3)' }}
                  onClick={() => onRetry(channel)}
                  disabled={Boolean(busy)}
                >
                  {busy === channel
                    ? 'Sending…'
                    : channel === 'email'
                      ? d.status === 'sent'
                        ? 'Resend email'
                        : 'Send email'
                      : d.status === 'sent'
                        ? 'Resend WhatsApp'
                        : 'Retry WhatsApp'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {reg.deliveryLog?.length > 0 && (
        <>
          <p className="section-label">Delivery attempts</p>
          <div className="data-table-wrap" style={{ marginBottom: 'var(--space-6)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Channel</th>
                  <th>Result</th>
                  <th>By</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {[...reg.deliveryLog].reverse().map((entry, i) => (
                  <tr key={`${entry.at}-${i}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</td>
                    <td>{CHANNEL_LABEL[entry.channel]}</td>
                    <td>
                      <DeliveryBadge status={entry.status} />
                    </td>
                    <td>{entry.trigger === 'admin' ? entry.actorName || 'Admin' : 'Auto'}</td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {entry.error || entry.providerMessageId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="section-label">Internal notes</p>
      <label className="field">
        <textarea
          className="field__textarea"
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Internal notes"
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        onClick={onSaveNotes}
        disabled={Boolean(busy) || notes === (reg.notes || '')}
      >
        {busy === 'notes' ? 'Saving…' : 'Save notes'}
      </Button>

      {canCancel && (
        <div
          style={{
            marginTop: 'var(--space-8)',
            paddingTop: 'var(--space-5)',
            borderTop: '1px solid var(--ink-100)',
          }}
        >
          <p className="section-label" style={{ color: 'var(--danger-700)' }}>
            Cancel registration
          </p>
          {!cancelOpen ? (
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel this registration…
            </Button>
          ) : (
            <form onSubmit={onCancel}>
              <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 0 }}>
                The QR ticket stops working at check-in, and the coupon place goes back to{' '}
                {reg.company?.name || 'the company'} so it can be reused. This is recorded in the
                audit log.
              </p>
              <label className="field">
                <span className="field__label">Reason *</span>
                <textarea
                  className="field__textarea"
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={busy === 'cancel' || reason.trim().length < 3}
                >
                  {busy === 'cancel' ? 'Cancelling…' : 'Confirm cancellation'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>
                  Keep registration
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
