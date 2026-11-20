import { useState } from 'react';
import Button from '../../components/ui/Button';
import { registrationApi } from '../../lib/registrationApi';

const PRESET_ROLES = [
  { label: '🎖️ DELEGATE', value: 'DELEGATE' },
  { label: '👨‍⚕️ FACULTY', value: 'FACULTY' },
  { label: '🎓 PG STUDENT', value: 'PG STUDENT' },
  { label: '🎗️ ORGANISING TEAM', value: 'ORGANISING TEAM' },
];

export default function InstantRegistrationModal({ eventId, onClose, onCreated, onOpenIdCard }) {
  const [hasTnmc, setHasTnmc] = useState(true);
  const [medicalCouncilRegNo, setMedicalCouncilRegNo] = useState('');
  const [name, setName] = useState('Dr. ');
  const [role, setRole] = useState('DELEGATE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('Chennai');
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdReg, setCreatedReg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (!cleanName || cleanName === 'Dr.' || cleanName === 'Dr') {
      setError('Please enter the attendee’s full doctor/delegate name.');
      return;
    }

    const cleanPhone = phone.replace(/[\s()-]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (hasTnmc && !medicalCouncilRegNo.trim()) {
      setError('Please enter the TMNC / Medical Council registration number or choose "No TMNC".');
      return;
    }

    setBusy(true);
    try {
      const res = await registrationApi.create({
        eventId,
        name: cleanName,
        phone: cleanPhone,
        email: email.trim() || undefined,
        medicalCouncilRegNo: hasTnmc ? medicalCouncilRegNo.trim() : '',
        hasTnmc,
        role,
        category: role,
        institution: institution.trim() || undefined,
        city: city.trim() || 'Chennai',
        autoCheckIn,
      });

      const newRegistration = res.data;
      setCreatedReg(newRegistration);
      if (onCreated) {
        onCreated(newRegistration);
      }
    } catch (err) {
      setError(err.message || 'Failed to create instant registration.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetForAnother = () => {
    setCreatedReg(null);
    setName('Dr. ');
    setPhone('');
    setEmail('');
    setMedicalCouncilRegNo('');
    setInstitution('');
    setError('');
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
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '580px',
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
            background: 'linear-gradient(to right, #ecfdf5, #f8fafc)',
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
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚡</span> Instant Desk Registration
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              On-spot attendee check-in with TMNC or Non-TMNC badge generation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
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

          {/* Success State View */}
          {createdReg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  margin: '0 auto',
                  border: '2px solid #a7f3d0',
                }}
              >
                ✓
              </div>

              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.2rem', color: '#065f46', fontWeight: 800 }}>
                  Registration Successful!
                </h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                  Attendee has been confirmed and registered in the system.
                </p>
              </div>

              {/* Attendee Summary Badge Card */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>BADGE NUMBER</span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      color: '#4338ca',
                      backgroundColor: '#eef2ff',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      border: '1px solid #c7d2fe',
                    }}
                  >
                    #{createdReg.badgeNo || '0001'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>ATTENDEE NAME</span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    {createdReg.attendee?.name || createdReg.name}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>REGISTRATION ID</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                    {createdReg.registrationCode || createdReg.id}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>CATEGORY / ROLE</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: '#9d174d',
                      backgroundColor: '#fdf2f8',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {createdReg.role || createdReg.attendee?.category || 'DELEGATE'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>TMNC STATUS</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {createdReg.attendee?.medicalCouncilRegNo ? (
                      <span style={{ color: '#059669' }}>
                        🩺 {createdReg.attendee.medicalCouncilRegNo}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>🚫 Non-TMNC</span>
                    )}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>DESK CHECK-IN</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669' }}>
                    🚪 Checked-In at Desk
                  </span>
                </div>
              </div>

              {/* Action Buttons in Success View */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (onOpenIdCard) {
                      onOpenIdCard(createdReg);
                    }
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    backgroundColor: '#be185d',
                    borderColor: '#9d174d',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.95rem',
                    padding: '12px 16px',
                  }}
                >
                  <span>🪪</span>
                  <span>Print / Download ID Card</span>
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleResetForAnother}
                  style={{ fontWeight: 600, padding: '12px 16px' }}
                >
                  ➕ Register Another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* TMNC vs NO TMNC Mode Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Medical Council Registration Mode <span style={{ color: '#be185d' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setHasTnmc(true)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: hasTnmc ? '2px solid #059669' : '1px solid #cbd5e1',
                      backgroundColor: hasTnmc ? '#ecfdf5' : '#ffffff',
                      color: hasTnmc ? '#065f46' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 120ms',
                    }}
                  >
                    <span>🩺 TMNC Registered</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: hasTnmc ? '#047857' : '#94a3b8' }}>
                      Tamil Nadu Medical Council
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHasTnmc(false);
                      setMedicalCouncilRegNo('');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: !hasTnmc ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                      backgroundColor: !hasTnmc ? '#eff6ff' : '#ffffff',
                      color: !hasTnmc ? '#1e40af' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 120ms',
                    }}
                  >
                    <span>🚫 No TMNC</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: !hasTnmc ? '#1d4ed8' : '#94a3b8' }}>
                      Other State / Trainee / Delegate
                    </span>
                  </button>
                </div>
              </div>

              {/* Conditional TMNC Input */}
              {hasTnmc && (
                <div style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
                    TMNC Registration Number <span style={{ color: '#be185d' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={medicalCouncilRegNo}
                    onChange={(e) => setMedicalCouncilRegNo(e.target.value.toUpperCase())}
                    placeholder="e.g. KMC/00270/2018 or 123456"
                    required={hasTnmc}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1.5px solid #86efac',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#14532d',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  <div style={{ fontSize: '0.74rem', color: '#16a34a', marginTop: '4px' }}>
                    Required for TNMC credit hours attendance sync and official certificates.
                  </div>
                </div>
              )}

              {/* Role / Category Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Badge Role / Category <span style={{ color: '#be185d' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {PRESET_ROLES.map((r) => {
                    const isSelected = role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #be185d' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? '#fdf2f8' : '#ffffff',
                          color: isSelected ? '#9d174d' : '#475569',
                          textAlign: 'left',
                          transition: 'all 120ms',
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attendee Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Attendee Full Name <span style={{ color: '#be185d' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Sneha Rajan"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Mobile Phone & Email (Side by Side) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Mobile Number <span style={{ color: '#be185d' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Email <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.com"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Institution & City */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Hospital / Institution <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. Prashanth Super Speciality Hospital"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Chennai"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Auto Check-in Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoCheckIn}
                  onChange={(e) => setAutoCheckIn(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                />
                <span>🚪 Check-in attendee immediately at desk (Entry Pass Confirmed)</span>
              </label>

              {/* Footer Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '6px',
                }}
              >
                <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={busy}
                  style={{
                    backgroundColor: '#059669',
                    borderColor: '#047857',
                    fontWeight: 700,
                    minWidth: '160px',
                  }}
                >
                  {busy ? 'Registering…' : '⚡ Register Attendee'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
