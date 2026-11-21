import { useState } from 'react';
import Button from '../../components/ui/Button';
import { registrationApi } from '../../lib/registrationApi';

export default function DeleteRegistrationModal({ registration, onClose, onDeleted }) {
  if (!registration) return null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const regCode = registration.registrationCode || registration.code || registration.id;
  const regId = registration.id || registration._id || regCode;
  const attendeeName = registration.attendee?.name || registration.name || 'Attendee';
  const badgeNo = registration.badgeNo || registration.badgeNumber;

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await registrationApi.delete(regId);
      if (onDeleted) {
        onDeleted(regId);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete registration.');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          border: '1px solid #fee2e2',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              flexShrink: 0,
              border: '2px solid #fca5a5',
            }}
          >
            🗑️
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>
              Delete Registration
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>
              This action permanently deletes this record and cannot be undone.
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                fontSize: '0.85rem',
                border: '1px solid #fecaca',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the registration for:
          </p>

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Registration ID:</span>
              <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{regCode}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Attendee:</span>
              <strong style={{ color: '#0f172a' }}>{attendeeName}</strong>
            </div>
            {badgeNo && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ID Card Badge No:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    color: '#4338ca',
                    backgroundColor: '#eef2ff',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid #c7d2fe',
                  }}
                >
                  #{badgeNo}
                </span>
              </div>
            )}
            {registration.attendee?.phone && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Mobile:</span>
                <span style={{ fontSize: '0.85rem', color: '#334155' }}>{registration.attendee.phone}</span>
              </div>
            )}
          </div>

          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.8rem',
              color: '#92400e',
              lineHeight: 1.4,
            }}
          >
            ⚠️ Deleting this registration will remove their ticket, check-in data, release any reserved coupon quota, and free up their ID card number.
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDelete}
            disabled={busy}
            style={{
              backgroundColor: '#dc2626',
              borderColor: '#b91c1c',
              color: '#ffffff',
              fontWeight: 700,
              padding: '8px 18px',
            }}
          >
            {busy ? 'Deleting…' : '🗑️ Permanently Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
