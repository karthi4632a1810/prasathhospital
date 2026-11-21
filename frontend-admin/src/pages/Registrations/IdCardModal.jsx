import { useState } from 'react';
import Button from '../../components/ui/Button';
import { registrationApi } from '../../lib/registrationApi';
import { idCardStudioApi } from '../../lib/idCardStudioApi';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const PRESET_ROLES = ['DELEGATE', 'FACULTY', 'ORGANISING TEAM'];

export default function IdCardModal({ registration, onClose, onUpdated, initialShowQr = true }) {
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

  const originalName = registration.attendee?.name || registration.name || '';

  const defaultBadgeNo = (() => {
    if (registration.badgeNo) return String(registration.badgeNo);
    if (registration.badgeNumber) return String(registration.badgeNumber);
    if (registration.index) return String(registration.index).padStart(4, '0');
    const code = registration.code || registration.registrationCode || '';
    const match = String(code).match(/(\d+)$/);
    if (match) return match[1].padStart(4, '0');
    return '0001';
  })();

  const [role, setRole] = useState(defaultRole);
  const [name, setName] = useState(originalName);
  const [template, setTemplate] = useState(false); // false = clean print overlay, true = simulation
  const [showQr, setShowQr] = useState(
    registration.showQr !== undefined ? registration.showQr : initialShowQr !== false
  );
  const [showBadgeNo, setShowBadgeNo] = useState(
    registration.showBadgeNo !== undefined ? registration.showBadgeNo : true
  );
  const [badgeNo, setBadgeNo] = useState(defaultBadgeNo);
  const [saveToDb, setSaveToDb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const regCode = registration.registrationCode || registration.code || registration.id;
  const regId = registration.id || registration._id || regCode;
  const identifier = registration.qrToken || regCode;

  const isDbRegistration = Boolean(
    registration._id ||
    (registration.id && /^[0-9a-fA-F]{24}$/.test(registration.id)) ||
    (registration.registrationCode && String(registration.registrationCode).startsWith('REG-'))
  );

  const handleBadgeNoBlur = () => {
    const trimmed = String(badgeNo || '').trim();
    if (/^\d+$/.test(trimmed)) {
      setBadgeNo(trimmed.padStart(4, '0'));
    }
  };

  const handleSaveAndLockBadge = async () => {
    if (!isDbRegistration) return;
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      const cleanDbName = name.replace(/\s+/g, ' ').trim() || originalName;
      const cleanBadgeNo = String(badgeNo || '').trim();
      const finalBadgeNo = /^\d+$/.test(cleanBadgeNo) ? cleanBadgeNo.padStart(4, '0') : cleanBadgeNo;
      const finalRole = role.trim().toUpperCase();

      const res = await registrationApi.update(regId, {
        badgeNo: finalBadgeNo,
        badgeRole: finalRole,
        role: finalRole,
        attendee: {
          name: cleanDbName,
          category: finalRole,
        },
      });

      setBadgeNo(finalBadgeNo);
      setSuccessMsg(`ID Card Badge #${finalBadgeNo} & Role ${finalRole} permanently locked to this attendee!`);

      if (onUpdated) {
        onUpdated(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to save and lock ID card number.');
    } finally {
      setBusy(false);
    }
  };

  const getPdfUrl = (forTemplate = template) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (name) params.set('name', name);
    if (forTemplate) params.set('template', 'true');
    if (!showQr) params.set('showQr', 'false');
    if (!showBadgeNo) params.set('showBadgeNo', 'false');
    if (showBadgeNo && badgeNo) params.set('badgeNo', badgeNo);
    return `${API_BASE}/api/v1/tickets/${identifier}/badge.pdf?${params.toString()}`;
  };

  const handleOpenPrintTab = () => {
    if (isDbRegistration) {
      const url = getPdfUrl(template);
      window.open(url, '_blank');
    } else {
      idCardStudioApi.openSinglePdfTab({
        name: name.trim(),
        role: role.trim(),
        code: regCode,
        badgeNo: badgeNo.trim(),
        template,
        showQr,
        showBadgeNo,
      });
    }
  };

  const handleDownload = async (format = 'pdf') => {
    setBusy(true);
    setError('');
    setSuccessMsg('');
    const ext = (format || 'pdf').toLowerCase().replace(/^\./, '');
    try {
      if (isDbRegistration && saveToDb) {
        const cleanDbName = name.replace(/\s+/g, ' ').trim() || originalName;
        const cleanBadgeNo = String(badgeNo || '').trim();
        const finalBadgeNo = /^\d+$/.test(cleanBadgeNo) ? cleanBadgeNo.padStart(4, '0') : cleanBadgeNo;
        const finalRole = role.trim().toUpperCase();

        const res = await registrationApi.update(regId, {
          badgeNo: finalBadgeNo,
          badgeRole: finalRole,
          role: finalRole,
          attendee: {
            name: cleanDbName,
            category: finalRole,
          },
        });
        if (onUpdated) {
          onUpdated(res.data);
        }
      }

      const safeName = (name.replace(/\s+/g, '_').trim() || regCode).replace(/[^a-zA-Z0-9_-]/g, '_');
      const qrSuffix = !showQr ? '-NO-QR' : '';
      const numPrefix = showBadgeNo && badgeNo ? `${badgeNo}-` : '';
      const filename = `${numPrefix}${regCode}-${role}-${safeName}-ID-CARD${qrSuffix}.${ext}`;

      if (isDbRegistration) {
        await registrationApi.downloadBadge(
          regId,
          { role: role.trim(), name: name.trim(), template, showQr, showBadgeNo, badgeNo, format: ext },
          filename
        );
      } else {
        await idCardStudioApi.downloadSingleFile(
          {
            name: name.trim(),
            role: role.trim(),
            code: regCode,
            badgeNo,
            template,
            showQr,
            showBadgeNo,
            format: ext,
          },
          filename
        );
      }

      setSuccessMsg(`ID Card ${ext.toUpperCase()} downloaded successfully!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || `Failed to download ID card ${ext.toUpperCase()}.`);
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
              fontSize: 22,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                  {regCode}
                </span>
                {registration.badgeNo && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      color: '#4338ca',
                      backgroundColor: '#eef2ff',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid #c7d2fe',
                    }}
                    title="Order based on who registered first"
                  >
                    #{registration.badgeNo}
                  </span>
                )}
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
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ↺ Reset to "{originalName}"
                </button>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Sneha Rajan"
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
            {name.length > 22 && (
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#d97706', fontWeight: 600 }}>
                💡 Tip: Long name will automatically wrap or scale to 18 pt to fit standard badge stock.
              </p>
            )}
          </div>

          {/* Field 2b: 4-Digit Badge Number */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔢</span> 4-Digit Badge Number (Between Name &amp; QR)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowBadgeNo(true)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: showBadgeNo ? '2px solid #4338ca' : '1px solid #cbd5e1',
                    backgroundColor: showBadgeNo ? '#eef2ff' : '#ffffff',
                    color: showBadgeNo ? '#3730a3' : '#64748b',
                    transition: 'all 120ms',
                  }}
                >
                  🔢 Show: ON
                </button>
                <button
                  type="button"
                  onClick={() => setShowBadgeNo(false)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: !showBadgeNo ? '2px solid #d97706' : '1px solid #cbd5e1',
                    backgroundColor: !showBadgeNo ? '#fffbeb' : '#ffffff',
                    color: !showBadgeNo ? '#b45309' : '#64748b',
                    transition: 'all 120ms',
                  }}
                >
                  🚫 Hide: OFF
                </button>
              </div>
            </div>

            {showBadgeNo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Number:</span>
                  <input
                    type="text"
                    value={badgeNo}
                    onChange={(e) => setBadgeNo(e.target.value)}
                    onBlur={handleBadgeNoBlur}
                    placeholder="e.g. 1001"
                    maxLength={10}
                    style={{
                      width: '120px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #6366f1',
                      fontSize: '1.05rem',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#312e81',
                      backgroundColor: '#ffffff',
                      textAlign: 'center',
                      letterSpacing: '0.12em',
                      outline: 'none',
                    }}
                  />
                  {isDbRegistration && (
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={handleSaveAndLockBadge}
                      disabled={busy}
                      style={{
                        backgroundColor: '#eef2ff',
                        borderColor: '#c7d2fe',
                        color: '#3730a3',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        padding: '6px 12px',
                      }}
                      title="Permanently save and lock this ID card number and role to this attendee in the database"
                    >
                      {busy ? 'Saving…' : '🔒 Lock & Save ID'}
                    </Button>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', flex: 1, minWidth: '180px' }}>
                  Printed on badge. Fixed once locked to this user.
                </p>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                4-Digit badge number is hidden. Badge will print without number.
              </div>
            )}
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

          {/* Field 4: QR Code Inclusion Toggle */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Check-in QR Code
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: showQr ? '2px solid #059669' : '1px solid #cbd5e1',
                  backgroundColor: showQr ? '#ecfdf5' : '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: showQr ? '#065f46' : '#475569',
                }}
              >
                <input
                  type="radio"
                  name="modalShowQr"
                  checked={showQr}
                  onChange={() => setShowQr(true)}
                />
                <span>📱 Include QR Code</span>
              </label>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: !showQr ? '2px solid #d97706' : '1px solid #cbd5e1',
                  backgroundColor: !showQr ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: !showQr ? '#92400e' : '#475569',
                }}
              >
                <input
                  type="radio"
                  name="modalShowQr"
                  checked={!showQr}
                  onChange={() => setShowQr(false)}
                />
                <span>🚫 Hide QR (Name &amp; Role Only)</span>
              </label>
            </div>
          </div>

          {/* Optional: Save to record */}
          {isDbRegistration && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#475569' }}>
              <input
                type="checkbox"
                checked={saveToDb}
                onChange={(e) => setSaveToDb(e.target.checked)}
              />
              <span>Also update attendee name, role, and ID badge number in database</span>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPrintTab}
              disabled={busy || !name.trim()}
              title="Open PDF in new tab to print directly via Ctrl+P"
            >
              🖨️ Print Tab
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload('png')}
              disabled={busy || !name.trim()}
              title="Download high-resolution PNG image"
              style={{
                fontWeight: 600,
                color: '#0284c7',
                borderColor: '#bae6fd',
                backgroundColor: '#f0f9ff',
              }}
            >
              🖼️ PNG
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload('jpg')}
              disabled={busy || !name.trim()}
              title="Download JPG image"
              style={{
                fontWeight: 600,
                color: '#b45309',
                borderColor: '#fde68a',
                backgroundColor: '#fffbeb',
              }}
            >
              📷 JPG
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownload('pdf')}
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
