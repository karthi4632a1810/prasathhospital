import { useState } from 'react';
import Button from '../../components/ui/Button';
import { idCardStudioApi } from '../../lib/idCardStudioApi';

const PRESET_ROLES = [
  { label: '👨‍⚕️ FACULTY', value: 'FACULTY' },
  { label: '🎖️ DELEGATE', value: 'DELEGATE' },
  { label: '🎗️ ORGANISING TEAM', value: 'ORGANISING TEAM' },
];

export default function InstantBadgeModal({
  defaultRole = 'FACULTY',
  nextBadgeNo = '0001',
  onClose,
  onAddToStudio,
}) {
  const [role, setRole] = useState(defaultRole);
  const [customRole, setCustomRole] = useState('');
  const [name, setName] = useState('Dr. ');
  const [showBadgeNo, setShowBadgeNo] = useState(true);
  const [badgeNo, setBadgeNo] = useState(nextBadgeNo);
  const [showQr, setShowQr] = useState(true);
  const [isSimulation, setIsSimulation] = useState(false);
  const [addToTable, setAddToTable] = useState(true);
  const [busyAction, setBusyAction] = useState(null); // 'pdf' | 'png' | 'jpg' | 'print'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeRole = customRole.trim() ? customRole.trim().toUpperCase() : role;

  const handleBadgeNoBlur = () => {
    const trimmed = String(badgeNo || '').trim();
    if (/^\d+$/.test(trimmed)) {
      setBadgeNo(trimmed.padStart(4, '0'));
    }
  };

  const handleDownload = async (format = 'pdf') => {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (!cleanName || cleanName === 'Dr.' || cleanName === 'Dr') {
      setError('Please enter the doctor or attendee name.');
      return;
    }

    setBusyAction(format);
    setError('');
    setSuccess('');

    const ext = (format || 'pdf').toLowerCase().replace(/^\./, '');
    const safeName = cleanName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
    const qrSuffix = !showQr ? '-NO-QR' : '';
    const numPrefix = showBadgeNo && badgeNo ? `${badgeNo}-` : '';
    const filename = `${numPrefix}${activeRole}-${safeName}-ID-CARD${qrSuffix}.${ext}`;

    try {
      await idCardStudioApi.downloadSingleFile(
        {
          name: cleanName,
          role: activeRole,
          code: `ID-${Date.now().toString().slice(-4)}`,
          badgeNo: showBadgeNo ? badgeNo : '',
          template: isSimulation,
          showQr,
          showBadgeNo,
          format: ext,
        },
        filename
      );

      setSuccess(`Downloaded ID card ${ext.toUpperCase()} successfully!`);

      // If user kept 'Add to studio table' checked
      if (addToTable && onAddToStudio) {
        onAddToStudio({
          id: `INST-${Date.now()}`,
          name: cleanName,
          role: activeRole,
          code: `INST-${badgeNo || '01'}`,
          badgeNo: showBadgeNo ? badgeNo : '',
        });
      }

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message || `Failed to download ${ext.toUpperCase()}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrintTab = async () => {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (!cleanName || cleanName === 'Dr.' || cleanName === 'Dr') {
      setError('Please enter the doctor or attendee name.');
      return;
    }

    setBusyAction('print');
    setError('');
    try {
      await idCardStudioApi.openSinglePdfTab({
        name: cleanName,
        role: activeRole,
        code: `ID-${Date.now().toString().slice(-4)}`,
        badgeNo: showBadgeNo ? badgeNo : '',
        template: isSimulation,
        showQr,
        showBadgeNo,
      });

      if (addToTable && onAddToStudio) {
        onAddToStudio({
          id: `INST-${Date.now()}`,
          name: cleanName,
          role: activeRole,
          code: `INST-${badgeNo || '01'}`,
          badgeNo: showBadgeNo ? badgeNo : '',
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to open print preview.');
    } finally {
      setBusyAction(null);
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
        if (e.target === e.currentTarget && !busyAction) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
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
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#831843',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚡</span> Instant ID Card Creator
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Instant ID card for Delegate or Faculty (with/without 4-digit #, with/without QR, in PNG, JPG, or PDF)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busyAction)}
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
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          {success && (
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
              ✓ {success}
            </div>
          )}

          {/* 1. Role Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Badge Role / Category Header <span style={{ color: '#be185d' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {PRESET_ROLES.map((r) => {
                const isSelected = role === r.value && !customRole.trim();
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRole(r.value);
                      setCustomRole('');
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #be185d' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#fdf2f8' : '#ffffff',
                      color: isSelected ? '#9d174d' : '#475569',
                      transition: 'all 120ms',
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="Or custom role (e.g. VIP, CHAIRPERSON, SPEAKER, VOLUNTEER)"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#9d174d',
                outline: 'none',
              }}
            />
          </div>

          {/* 2. Attendee Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Doctor / Attendee Full Name <span style={{ color: '#be185d' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Sneha Rajan"
              autoFocus
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
                💡 Tip: Long names will automatically balance across 2 lines to fit standard badge stock.
              </p>
            )}
          </div>

          {/* 3. 4-Digit Badge Number Toggle & Input */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔢</span> 4-Digit Badge Number Option
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
                  🔢 With Number (ON)
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
                  🚫 Without Number (OFF)
                </button>
              </div>
            </div>

            {showBadgeNo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>4-Digit Number:</span>
                <input
                  type="text"
                  value={badgeNo}
                  onChange={(e) => setBadgeNo(e.target.value)}
                  onBlur={handleBadgeNoBlur}
                  placeholder="e.g. 1001"
                  maxLength={10}
                  style={{
                    width: '110px',
                    padding: '6px 12px',
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
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Positioned centered between name and QR code.
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                Badge number is disabled. Name and role will print cleanly without a number.
              </div>
            )}
          </div>

          {/* 4. QR Code Toggle */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📱</span> Check-in QR Code Option
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowQr(true)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: showQr ? '2px solid #059669' : '1px solid #cbd5e1',
                  backgroundColor: showQr ? '#ecfdf5' : '#ffffff',
                  color: showQr ? '#065f46' : '#64748b',
                  transition: 'all 120ms',
                }}
              >
                📱 With QR (ON)
              </button>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: !showQr ? '2px solid #d97706' : '1px solid #cbd5e1',
                  backgroundColor: !showQr ? '#fffbeb' : '#ffffff',
                  color: !showQr ? '#b45309' : '#64748b',
                  transition: 'all 120ms',
                }}
              >
                🚫 Without QR (OFF)
              </button>
            </div>
          </div>

          {/* 5. Print Mode (Clean Overlay vs Simulation) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Card Background Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsSimulation(false)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: !isSimulation ? '2px solid #be185d' : '1px solid #cbd5e1',
                  backgroundColor: !isSimulation ? '#fdf2f8' : '#ffffff',
                  color: !isSimulation ? '#9d174d' : '#64748b',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  textAlign: 'left',
                }}
              >
                <div>🖨️ Clean Print Overlay</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                  For pre-printed physical stock (leaves top 2.2 cm & bottom 5.2 cm blank)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsSimulation(true)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: isSimulation ? '2px solid #6366f1' : '1px solid #cbd5e1',
                  backgroundColor: isSimulation ? '#eef2ff' : '#ffffff',
                  color: isSimulation ? '#3730a3' : '#64748b',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  textAlign: 'left',
                }}
              >
                <div>🖥️ Simulation Preview</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                  Renders CIIM 2026 header & footer design for full-card image
                </div>
              </button>
            </div>
          </div>

          {/* 6. Option to also append to Studio Table */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#475569' }}>
            <input
              type="checkbox"
              checked={addToTable}
              onChange={(e) => setAddToTable(e.target.checked)}
              style={{ accentColor: '#be185d' }}
            />
            <span>Also keep this attendee in the Studio Table for batch printing</span>
          </label>
        </div>

        {/* Modal Actions Footer: PDF, PNG, JPG, Print */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={Boolean(busyAction)}>
            Cancel
          </Button>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrintTab}
              disabled={Boolean(busyAction)}
              title="Open print preview in new browser tab"
            >
              {busyAction === 'print' ? 'Opening…' : '🖨️ Print Tab'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload('png')}
              disabled={Boolean(busyAction)}
              title="Download high-resolution PNG image"
              style={{
                fontWeight: 600,
                color: '#0284c7',
                borderColor: '#bae6fd',
                backgroundColor: '#f0f9ff',
              }}
            >
              {busyAction === 'png' ? 'Rendering PNG…' : '🖼️ Download PNG'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDownload('jpg')}
              disabled={Boolean(busyAction)}
              title="Download JPG badge image"
              style={{
                fontWeight: 600,
                color: '#b45309',
                borderColor: '#fde68a',
                backgroundColor: '#fffbeb',
              }}
            >
              {busyAction === 'jpg' ? 'Rendering JPG…' : '📷 Download JPG'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownload('pdf')}
              disabled={Boolean(busyAction)}
              style={{
                backgroundColor: '#be185d',
                borderColor: '#9d174d',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              {busyAction === 'pdf' ? 'Generating PDF…' : '⬇️ Download PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
