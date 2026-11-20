import { useState } from 'react';
import Button from '../../components/ui/Button';
import { registrationApi } from '../../lib/registrationApi';
import { getToken } from '../../lib/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export default function CertificateModal({ registration, onClose, onUpdated }) {
  if (!registration) return null;

  const originalName = registration.attendee?.name || '';
  const [name, setName] = useState(originalName);
  const [saveToDb, setSaveToDb] = useState(false);
  const [busyFormat, setBusyFormat] = useState(null); // 'png' | 'jpg' | 'pdf' | null
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const regCode = registration.registrationCode || registration.id;
  const regId = registration.id || registration._id || regCode;

  const getCertificateUrl = (fmt = 'png', isPreview = true) => {
    const params = new URLSearchParams();
    if (name.trim()) params.set('name', name.trim());
    if (isPreview) params.set('preview', 'true');
    params.set('format', fmt);
    const token = getToken();
    if (token) params.set('token', token);
    return `${API_BASE}/api/v1/admin/registrations/${regId}/certificate.${fmt}?${params.toString()}`;
  };

  const handleOpenPrintTab = () => {
    const url = getCertificateUrl('pdf', true);
    window.open(url, '_blank');
  };

  const handleDownload = async (format) => {
    setBusyFormat(format);
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
      const filename = `CIIM2026-CERTIFICATE-${regCode}-${safeName}.${format}`;

      await registrationApi.downloadCertificate(
        regId,
        { name: name.trim(), format },
        filename
      );

      setSuccessMsg(`Certificate ${format.toUpperCase()} downloaded successfully!`);
      setTimeout(() => {
        setSuccessMsg('');
      }, 3500);
    } catch (err) {
      setError(err.message || `Failed to download certificate as ${format.toUpperCase()}.`);
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
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
          maxWidth: '720px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
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
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#831843',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>📜</span> Certificate of Participation
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              CIIM 2026 · Prashanth Fertility Hospital &amp; TAPISAR · 4 Credit Points Awarded
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
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
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                fontSize: '0.85rem',
                border: '1px solid #fecaca',
                fontWeight: 600,
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

          {/* Attendee Info Summary Pill */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                REGISTRATION ID
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    color: '#0f172a',
                  }}
                >
                  {regCode}
                </span>
                {registration.badgeNo && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      color: '#4338ca',
                      backgroundColor: '#eef2ff',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid #c7d2fe',
                    }}
                  >
                    #{registration.badgeNo}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                PASS CATEGORY
              </div>
              <div style={{ fontSize: '0.84rem', color: '#334155', fontWeight: 600 }}>
                {registration.company?.name ||
                  registration.ticketType?.name ||
                  registration.badgeRole ||
                  'Delegate Pass'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                CHECK-IN STATUS
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                {registration.checkedInAt ||
                (registration.checkins && registration.checkins.length > 0) ? (
                  <span style={{ color: '#16a34a' }}>🚪 Checked-in</span>
                ) : (
                  <span style={{ color: '#d97706' }}>⏳ Registered</span>
                )}
              </div>
            </div>
          </div>

          {/* Attendee Name on Certificate Field */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Attendee Name on Certificate <span style={{ color: '#be185d' }}>*</span>
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
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr Sindhuja Balakrishnan"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
              }}
            />
            {name.trim() !== originalName && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: '#475569',
                  marginTop: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={saveToDb}
                  onChange={(e) => setSaveToDb(e.target.checked)}
                />
                <span>Also update attendee name in registration record</span>
              </label>
            )}
          </div>

          {/* Visual Certificate Preview Card */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              <span>LIVE CERTIFICATE PREVIEW</span>
              <span>1600 × 1131 px (A4 Landscape)</span>
            </div>
            <div
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                backgroundColor: '#ffffff',
                maxHeight: '260px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={getCertificateUrl('png', true)}
                alt="Certificate Live Preview"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '260px',
                  objectFit: 'contain',
                  display: 'block',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>

        {/* Modal Actions Footer: Format Downloads */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={Boolean(busyFormat)}>
            Cancel
          </Button>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPrintTab}
              disabled={Boolean(busyFormat) || !name.trim()}
              title="Open full-res PDF in new browser tab to view or print (Ctrl+P)"
            >
              🖨️ Preview / Print
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload('png')}
              disabled={Boolean(busyFormat) || !name.trim()}
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#0284c7',
                color: '#0284c7',
                fontWeight: 700,
              }}
              title="Download high-resolution PNG image"
            >
              {busyFormat === 'png' ? 'Generating…' : '⬇️ PNG'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload('jpg')}
              disabled={Boolean(busyFormat) || !name.trim()}
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#d97706',
                color: '#b45309',
                fontWeight: 700,
              }}
              title="Download compressed JPEG image"
            >
              {busyFormat === 'jpg' ? 'Generating…' : '⬇️ JPG'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownload('pdf')}
              disabled={Boolean(busyFormat) || !name.trim()}
              style={{
                backgroundColor: '#be185d',
                borderColor: '#9d174d',
                color: '#ffffff',
                fontWeight: 700,
              }}
              title="Download official A4-landscape PDF certificate"
            >
              {busyFormat === 'pdf' ? 'Generating…' : '⬇️ PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
