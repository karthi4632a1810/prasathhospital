import { useState } from 'react';
import Button from '../../components/ui/Button';
import { registrationApi } from '../../lib/registrationApi';

const PRESET_ROLES = ['DELEGATE', 'FACULTY', 'PG STUDENT', 'ORGANISING TEAM'];

export default function EditRegistrationModal({ registration, onClose, onUpdated }) {
  if (!registration) return null;

  const initialAtt = registration.attendee || {};

  const initialRole = (() => {
    const raw = String(
      registration.badgeRole ||
      registration.role ||
      initialAtt.category ||
      ''
    ).toUpperCase();
    if (raw.includes('FACULTY')) return 'FACULTY';
    if (raw.includes('ORGANIS') || raw.includes('ORGANIZ')) return 'ORGANISING TEAM';
    if (raw.includes('PG') || raw.includes('STUDENT')) return 'PG STUDENT';
    return raw || 'DELEGATE';
  })();

  const initialBadgeNo = (() => {
    if (registration.badgeNo) return String(registration.badgeNo);
    if (registration.badgeNumber) return String(registration.badgeNumber);
    const code = registration.registrationCode || registration.code || '';
    const match = String(code).match(/(\d+)$/);
    if (match) return match[1].padStart(4, '0');
    return '';
  })();

  const rawCouncil = String(initialAtt.medicalCouncilRegNo || '').trim();
  const initialHasTnmc =
    rawCouncil !== '' &&
    !['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', 'NOTAPPLICABLE', '-'].includes(
      rawCouncil.toUpperCase()
    );

  const [name, setName] = useState(initialAtt.name || registration.name || '');
  const [phone, setPhone] = useState(initialAtt.phone || '');
  const [email, setEmail] = useState(initialAtt.email || '');
  const [hasTnmc, setHasTnmc] = useState(initialHasTnmc);
  const [tnmcNumber, setTnmcNumber] = useState(initialHasTnmc ? rawCouncil : '');
  const [role, setRole] = useState(initialRole);
  const [badgeNo, setBadgeNo] = useState(initialBadgeNo);
  const [institution, setInstitution] = useState(initialAtt.institution || '');
  const [designation, setDesignation] = useState(initialAtt.designation || '');
  const [city, setCity] = useState(initialAtt.city || 'Chennai');
  const [state, setState] = useState(initialAtt.state || 'Tamil Nadu');
  const [country, setCountry] = useState(initialAtt.country || 'India');
  const [notes, setNotes] = useState(registration.notes || '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const regCode = registration.registrationCode || registration.code || registration.id;
  const regId = registration.id || registration._id || regCode;

  const handleBadgeNoBlur = () => {
    const trimmed = String(badgeNo || '').trim();
    if (/^\d+$/.test(trimmed)) {
      setBadgeNo(trimmed.padStart(4, '0'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide the attendee name.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccessMsg('');

    try {
      const formattedBadgeNo = String(badgeNo || '').trim();
      const finalBadgeNo = /^\d+$/.test(formattedBadgeNo)
        ? formattedBadgeNo.padStart(4, '0')
        : formattedBadgeNo;

      const payload = {
        badgeNo: finalBadgeNo,
        badgeRole: role.trim().toUpperCase(),
        role: role.trim().toUpperCase(),
        notes: notes.trim(),
        attendee: {
          name: name.replace(/\s+/g, ' ').trim(),
          phone: phone.replace(/[\s()-]/g, '').trim(),
          email: email.trim().toLowerCase(),
          medicalCouncilRegNo: hasTnmc && tnmcNumber.trim() ? tnmcNumber.trim() : '',
          institution: institution.trim(),
          designation: designation.trim(),
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          category: role.trim().toUpperCase(),
        },
      };

      const res = await registrationApi.update(regId, payload);
      setSuccessMsg('Registration & fixed ID card number updated successfully!');

      if (onUpdated) {
        onUpdated(res.data);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Failed to update registration.');
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
        zIndex: 10000,
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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>✏️</span> Edit Registration
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                {regCode}
              </span>
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Update attendee info and set the fixed ID card number for this user.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              lineHeight: 1,
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
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

          {/* SECTION: ID Card & Role */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: '#475569',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🪪</span> Fixed ID Card Badge &amp; Category
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#059669',
                  backgroundColor: '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid #a7f3d0',
                }}
              >
                🔒 Fixed once set
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  🔢 ID Card Number (Badge No)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={badgeNo}
                    onChange={(e) => setBadgeNo(e.target.value)}
                    onBlur={handleBadgeNoBlur}
                    placeholder="e.g. 0042"
                    maxLength={10}
                    style={{
                      width: '130px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '2px solid #6366f1',
                      fontSize: '1.05rem',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#312e81',
                      backgroundColor: '#ffffff',
                      textAlign: 'center',
                      letterSpacing: '0.1em',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                    Permanent ID badge number. Never reshuffled.
                  </span>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  🎖️ Badge Role / Category
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  {PRESET_ROLES.map((r) => {
                    const isSel = role.trim().toUpperCase() === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSel ? '1.5px solid #be185d' : '1px solid #cbd5e1',
                          backgroundColor: isSel ? '#fdf2f8' : '#ffffff',
                          color: isSel ? '#9d174d' : '#475569',
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value.toUpperCase())}
                  placeholder="DELEGATE, FACULTY, etc."
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#be185d',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION: Attendee Core Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Attendee Full Name <span style={{ color: '#be185d' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. John Doe"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Mobile Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Email Address
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.com"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* SECTION: TNMC / Medical Council */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                Medical Council Registration Mode
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setHasTnmc(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: hasTnmc ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: hasTnmc ? '#eff6ff' : '#ffffff',
                    color: hasTnmc ? '#1d4ed8' : '#64748b',
                  }}
                >
                  🩺 TNMC Registered
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasTnmc(false);
                    setTnmcNumber('');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: !hasTnmc ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                    backgroundColor: !hasTnmc ? '#fffbeb' : '#ffffff',
                    color: !hasTnmc ? '#b45309' : '#64748b',
                  }}
                >
                  🚫 Non-TNMC
                </button>
              </div>
            </div>

            {hasTnmc ? (
              <div>
                <input
                  type="text"
                  value={tnmcNumber}
                  onChange={(e) => setTnmcNumber(e.target.value)}
                  placeholder="e.g. 123456 or KMC/00270/2018"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1.5px solid #93c5fd',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#1e3a8a',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Used for TNMC credit hours sync and certificates.
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#b45309', fontStyle: 'italic' }}>
                ⚡ Registered as Non-TNMC (Trainee, Out-of-State, or Embryologist).
              </div>
            )}
          </div>

          {/* SECTION: Professional & Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Hospital / Institution
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
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Consultant"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
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
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Tamil Nadu"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* SECTION: Internal Staff Notes */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Internal Staff Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Desk notes or special instructions..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                color: '#0f172a',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Modal Footer */}
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={busy || !name.trim()}
              style={{
                backgroundColor: '#059669',
                borderColor: '#047857',
                color: '#ffffff',
                fontWeight: 700,
                padding: '8px 20px',
              }}
            >
              {busy ? 'Saving Changes…' : '💾 Save Changes & Lock ID'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
