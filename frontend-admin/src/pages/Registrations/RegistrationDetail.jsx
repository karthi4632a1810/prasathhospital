import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { registrationApi } from '../../lib/registrationApi';
import { checkinApi } from '../../lib/checkinApi';
import { formatDateTime } from '../../lib/format';
import Drawer from '../../components/ui/Drawer';
import Button from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/States';
import { DeliveryBadge, RegistrationStatusBadge } from '../../components/StatusBadges';
import IdCardModal from './IdCardModal';
import CertificateModal from './CertificateModal';
import EditRegistrationModal from './EditRegistrationModal';
import DeleteRegistrationModal from './DeleteRegistrationModal';

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

export default function RegistrationDetail({ id, isAdmin: propIsAdmin, onClose, onChanged, onDeleted }) {
  const [searchParams] = useSearchParams();
  const isAdmin =
    Boolean(propIsAdmin) ||
    searchParams.get('admin') === '1' ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1');

  const [reg, setReg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [busyLocation, setBusyLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [flash, setFlash] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  // Load checkpoint locations for this event
  useEffect(() => {
    const evtId = reg?.event?.id || reg?.event?._id || (typeof reg?.event === 'string' ? reg.event : null);
    if (!evtId) return;
    checkinApi
      .locations(evtId)
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));
  }, [reg?.event]);

  function apply(updated, message, tone = 'success') {
    setReg(updated);
    onChanged(updated);
    if (message) setFlash({ tone, message });
  }

  async function handleToggleLocation(loc, isChecked) {
    if (!loc) return;
    setBusyLocation(loc.code);
    setFlash(null);
    try {
      const res = await registrationApi.toggleCheckinLocation(reg.id, {
        locationId: loc.id,
        locationCode: loc.code,
        checked: isChecked,
      });
      apply(
        res.data,
        isChecked
          ? `Marked checked in at "${loc.name}".`
          : `Removed check-in from "${loc.name}". Attendee can now be scanned again at this checkpoint.`,
        'success'
      );
    } catch (err) {
      setFlash({ tone: 'error', message: err.message || 'Failed to update check-in.' });
    } finally {
      setBusyLocation(null);
    }
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
          isAdmin={isAdmin}
          locations={locations}
          busyLocation={busyLocation}
          onToggleLocation={handleToggleLocation}
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
          onOpenIdCard={() => setIdCardOpen(true)}
          onOpenCertificate={() => setCertificateOpen(true)}
          onOpenEdit={() => setEditOpen(true)}
          onOpenDelete={() => setDeleteOpen(true)}
        />
      )}
      {editOpen && reg && (
        <EditRegistrationModal
          registration={reg}
          onClose={() => setEditOpen(false)}
          onUpdated={(updated) => apply(updated, 'Registration and ID card number updated successfully.')}
        />
      )}
      {deleteOpen && reg && (
        <DeleteRegistrationModal
          registration={reg}
          onClose={() => setDeleteOpen(false)}
          onDeleted={(deletedId) => {
            if (onDeleted) onDeleted(deletedId);
            onClose();
          }}
        />
      )}
      {idCardOpen && reg && (
        <IdCardModal
          registration={reg}
          onClose={() => setIdCardOpen(false)}
          onUpdated={(updated) => apply(updated, 'ID Card & attendee updated.')}
        />
      )}
      {certificateOpen && reg && (
        <CertificateModal
          registration={reg}
          onClose={() => setCertificateOpen(false)}
          onUpdated={(updated) => apply(updated, 'Certificate attendee updated.')}
        />
      )}
    </Drawer>
  );
}

function Body({
  reg,
  isAdmin,
  locations = [],
  busyLocation,
  onToggleLocation,
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
  onOpenIdCard,
  onOpenCertificate,
  onOpenEdit,
  onOpenDelete,
}) {
  const isConfirmed = reg.status === 'confirmed';
  const canCancel = (isConfirmed || reg.status === 'pending_payment') && !reg.checkedInAt;
  const ticketUrl = reg.qrToken ? `${PUBLIC_SITE}/tickets/${reg.qrToken}` : null;
  const qrUrl = reg.qrToken ? `${API_BASE}/api/v1/tickets/${reg.qrToken}/qr.png` : null;
  const pdfUrl = reg.qrToken ? `${API_BASE}/api/v1/tickets/${reg.qrToken}/pdf` : null;
  const badgePdfUrl = reg.qrToken
    ? `${API_BASE}/api/v1/tickets/${reg.qrToken}/badge.pdf`
    : reg.registrationCode
    ? `${API_BASE}/api/v1/tickets/${reg.registrationCode}/badge.pdf`
    : null;

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
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <RegistrationStatusBadge status={reg.status} />
          {reg.checkedInAt && <span className="badge badge--success badge--sm">Checked in</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenEdit}
            style={{
              backgroundColor: '#f8fafc',
              borderColor: '#cbd5e1',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            ✏️ Edit Registration
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDelete}
            style={{
              color: '#dc2626',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            🗑️ Delete
          </Button>
        </div>
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
          <dt>ID Card Number</dt>
          <dd>
            {reg.badgeNo ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  backgroundColor: '#eef2ff',
                  color: '#3730a3',
                  border: '1.5px solid #c7d2fe',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                #{reg.badgeNo}{' '}
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#059669',
                    backgroundColor: '#ecfdf5',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  🔒 Fixed
                </span>
              </span>
            ) : (
              <span className="muted">Not assigned yet</span>
            )}
          </dd>
          <dt>Category / Role</dt>
          <dd>
            <span
              style={{
                fontWeight: 700,
                color: '#be185d',
                backgroundColor: '#fdf2f8',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #fbcfe8',
                fontSize: '0.82rem',
              }}
            >
              {reg.badgeRole || reg.role || reg.attendee?.category || 'DELEGATE'}
            </span>
          </dd>
          <dt>Name</dt>
          <dd>{reg.attendee?.name}</dd>
          <dt>Mobile</dt>
          <dd>{reg.attendee?.phone}</dd>
          <dt>Email</dt>
          <dd>{reg.attendee?.email}</dd>
          <dt>TNMC / Council</dt>
          <dd>
            {(() => {
              const raw = String(reg.attendee?.medicalCouncilRegNo || '').trim();
              const hasTnmc =
                raw &&
                !['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', 'NOTAPPLICABLE', '-'].includes(
                  raw.toUpperCase()
                );
              return hasTnmc ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  🩺 TNMC: {raw}
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                  }}
                >
                  ⚡ Non-TNMC (No TNMC Number)
                </span>
              );
            })()}
          </dd>
          {reg.attendee?.designation && (
            <>
              <dt>Designation</dt>
              <dd>{reg.attendee.designation}</dd>
            </>
          )}
          {reg.attendee?.institution && (
            <>
              <dt>Institution</dt>
              <dd>{reg.attendee.institution}</dd>
            </>
          )}
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
              {isConfirmed && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenIdCard}
                  style={{
                    backgroundColor: '#be185d',
                    borderColor: '#9d174d',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  🪪 Print / Edit ID Card
                </Button>
              )}
              {isConfirmed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenCertificate}
                  style={{
                    backgroundColor: '#f0fdf4',
                    borderColor: '#86efac',
                    color: '#15803d',
                    fontWeight: 700,
                  }}
                >
                  📜 Download Certificate (PNG/JPG/PDF)
                </Button>
              )}
              {ticketUrl && (
                <Button variant="ghost" size="sm" href={ticketUrl} external>
                  Open ticket page
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Checkpoint Check-in Status & Admin Location Controls */}
      <div style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-2)',
          }}
        >
          <p className="section-label" style={{ margin: 0 }}>📍 Checkpoint Locations &amp; Check-in</p>
          {isAdmin && (
            <span
              style={{
                fontSize: '0.72rem',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              ⚙️ Admin Edit Mode (?admin=1)
            </span>
          )}
        </div>

        {isAdmin ? (
          /* Editable Checkpoint Checkbox List for ?admin=1 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
              Check the box to record check-in at a location, or uncheck to remove check-in so this member can be scanned again at the desk.
            </p>
            {locations.length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>Loading checkpoints…</p>
            ) : (
              locations.map((loc) => {
                const checkinItem = (reg.checkins || []).find((c) => c.locationCode === loc.code);
                const isChecked = Boolean(checkinItem);
                const isBusy = busyLocation === loc.code;

                return (
                  <label
                    key={loc.id || loc.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: isChecked ? '1.5px solid #86efac' : '1px solid var(--ink-200)',
                      backgroundColor: isChecked ? '#f0fdf4' : 'var(--white)',
                      cursor: isBusy ? 'wait' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isBusy}
                        onChange={(e) => onToggleLocation(loc, e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink-900)' }}>
                          {loc.name}
                        </span>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-500)', marginLeft: '6px' }}>
                          ({loc.code})
                        </span>
                        {loc.isActive === false && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px' }}>(Inactive)</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {isBusy ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-500)' }}>Updating…</span>
                      ) : isChecked ? (
                        <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>
                          ✅ Checked in {checkinItem?.checkedInAt ? `at ${new Date(checkinItem.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-400)' }}>
                          ⚪ Not checked in
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        ) : (
          /* Read-only Checkpoint View without ?admin=1 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reg.checkins && reg.checkins.length > 0 ? (
              reg.checkins.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    backgroundColor: '#f0fdf4',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#15803d' }}>
                    📍 {c.locationName || c.locationCode}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                    ✅ Checked in at {formatDateTime(c.checkedInAt)}
                  </span>
                </div>
              ))
            ) : reg.checkedInAt ? (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                  backgroundColor: '#f0fdf4',
                  color: '#15803d',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                }}
              >
                📍 Main Entry Desk · Checked in at {formatDateTime(reg.checkedInAt)}
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px dashed var(--ink-200)',
                  backgroundColor: 'var(--ink-50)',
                  color: 'var(--ink-500)',
                  fontSize: '0.85rem',
                }}
              >
                ⚪ Not checked in at any checkpoint yet
              </div>
            )}
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
