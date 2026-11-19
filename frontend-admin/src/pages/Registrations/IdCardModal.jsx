import { useState } from 'react';
import Button from '../../components/ui/Button';
import { registrationApi } from '../../lib/registrationApi';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const PRESET_ROLES = ['DELEGATE', 'FACULTY', 'ORGANISING TEAM'];

export default function IdCardModal({ registration, onClose, onUpdated }) {
  if (!registration) return null;

  const defaultRole = (() => {
    const raw = String(
      registration.badgeRole ||
      registration.role ||
      registration.attendee?.category ||
      ''
    ).toUpperCase();
    if (raw.includes('FACULTY')) return 'FACULTY';
    if (raw.includes('ORGANIS') || raw.includes('ORGANIZ')) return 'ORGANISING TEAM';
    return 'DELEGATE';
  })();

  const originalName = registration.attendee?.name || '';

  const [role, setRole] = useState(defaultRole);
  const [name, setName] = useState(originalName);
  const [template, setTemplate] = useState(false); // false = clean print overlay, true = simulation
  const [saveToDb, setSaveToDb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const regCode = registration.registrationCode || registration.id;
  const regId = registration.id || registration._id || regCode;
  const identifier = registration.qrToken || regCode;

  const getPdfUrl = (forTemplate = template) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (name) params.set('name', name);
    if (forTemplate) params.set('template', 'true');
    return `${API_BASE}/api/v1/tickets/${identifier}/badge.pdf?${params.toString()}`;
  };

  const handleOpenPrintTab = () => {
    const url = getPdfUrl(template);
    window.open(url, '_blank');
  };

  const handleDownload = async () => {
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      if (saveToDb && name.trim()) {
        const cleanDbName = name.replace(/\s+/g, ' ').trim();
        if (cleanDbName !== originalName) {
          await registrationApi.update(regId, {
            attendee: { name: cleanDbName },
          });
          if (onUpdated) {
            onUpdated({
              ...registration,
              attendee: { ...registration.attendee, name: cleanDbName },
            });
          }
        }
      }

      const safeName = (name.replace(/\s+/g, '_').trim() || regCode).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${regCode}-${role}-${safeName}-ID-CARD.pdf`;

      await registrationApi.downloadBadgePdf(
        regId,
        { role: role.trim(), name: name.trim(), template },
        filename
      );

      setSuccessMsg('ID Card PDF downloaded successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to download ID card PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            background: 'linear-gradient(to right, #fdf2f8, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#831843',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🪪</span> Print / Download ID Card
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Standard 10.2 cm × 15.2 cm badge stock (7.5 cm center printable zone)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#94a3b8',
              lineHeight: 1,
              padding: '4px 8px',
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
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

          {successMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                fontSize: '0.85rem',
                border: '1px solid #bbf7d0',
                fontWeight: 600,
              }}
            >
              ✓ {successMsg}
            </div>
          )}

          {/* Attendee Summary Pill */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>REGISTRATION ID</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                {regCode}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>CHECK-IN STATUS</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {registration.checkedInAt || (registration.checkins && registration.checkins.length > 0) ? (
                  <span style={{ color: '#16a34a' }}>🚪 Entry Checked-in</span>
                ) : (
                  <span style={{ color: '#d97706' }}>⏳ Pending Check-in</span>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>COMPANY / PASS</div>
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                {registration.company?.name || registration.ticketType?.name || 'Delegate Pass'}
              </div>
            </div>
          </div>

          {/* Field 1: Role / Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Badge Title / Role Header <span style={{ color: '#be185d' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {PRESET_ROLES.map((r) => {
                const isSelected = role.trim().toUpperCase() === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #be185d' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#fdf2f8' : '#ffffff',
                      color: isSelected ? '#9d174d' : '#475569',
                      transition: 'all 120ms',
                    }}
                  >
                    {r === 'DELEGATE' ? '🎖️ DELEGATE' : r === 'FACULTY' ? '👨‍⚕️ FACULTY' : '🎗️ ORGANISING TEAM'}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value.toUpperCase())}
              placeholder="Or type any custom role (e.g. VIP, SPEAKER, COMMITTEE)"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#be185d',
                outline: 'none',
              }}
            />
          </div>

          {/* Field 2: Doctor / Attendee Name */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Attendee Name on ID Card <span style={{ color: '#be185d' }}>*</span>
              </label>
              {name.trim() !== originalName && (
                <button
                  type="button"
                  onClick={() => setName(originalName)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Reset to "{originalName}"
                </button>
              )}
            </div>
            <textarea
              rows={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={'e.g. Dr Esther Rani\nStella Bhakiyathai.E'}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
                minHeight: '62px',
                lineHeight: 1.4,
                fontFamily: 'inherit',
              }}
            />
            <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Press <strong>Enter</strong> to split name across Line 1 and Line 2. Single-line long names will auto-balance.
            </p>
          </div>

          {/* Field 3: Print Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Print Output Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: !template ? '2px solid #be185d' : '1px solid #cbd5e1',
                  backgroundColor: !template ? '#fdf2f8' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="printTemplate"
                  checked={!template}
                  onChange={() => setTemplate(false)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                    🖨️ Clean Print Overlay
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                    For pre-printed badge stock (leaves top 2.2 cm & bottom 5.2 cm blank)
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: template ? '2px solid #6366f1' : '1px solid #cbd5e1',
                  backgroundColor: template ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="printTemplate"
                  checked={template}
                  onChange={() => setTemplate(true)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                    🖥️ Simulation Preview
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                    Includes simulated header & footer for checking visual alignment
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Optional: Save to record */}
          {name.trim() !== originalName && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#475569' }}>
              <input
                type="checkbox"
                checked={saveToDb}
                onChange={(e) => setSaveToDb(e.target.checked)}
              />
              <span>Also update attendee name in database record</span>
            </label>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPrintTab}
              disabled={busy || !name.trim()}
              title="Open PDF in new tab to print directly via Ctrl+P"
            >
              🖨️ Preview / Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              disabled={busy || !name.trim()}
              style={{
                backgroundColor: '#be185d',
                borderColor: '#9d174d',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              {busy ? 'Generating…' : '⬇️ Download PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
