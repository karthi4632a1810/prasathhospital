import { useState, useEffect, useMemo } from 'react';
import { communicationsApi } from '../../lib/communicationsApi';
import Button from '../../components/ui/Button';
import './Communications.css';

const DEFAULT_IMAGE_PRESETS = [
  {
    id: 'qr_gold',
    label: 'Option 1: Royal Gold QR Code',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/option1_royal_gold_verified.png',
    type: 'qr',
  },
  {
    id: 'poster',
    label: 'Official Thank You Poster Banner',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg',
    type: 'poster',
  },
  {
    id: 'qr_gradient',
    label: 'Theme Gradient QR Code',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/sample_royal_qr.png',
    type: 'qr',
  },
];

const DEFAULT_TEMPLATES = [
  {
    id: 'ciim2026_registration_4',
    name: 'ciim2026_registration_4',
    label: 'Registration 4 (QR Header + Ticket Link)',
    description: 'Header with QR Code, delegate name, conference dates/venue, and ticket link.',
    defaultImageType: 'qr_gold',
    defaultExtraMode: 'link',
  },
  {
    id: 'ciim2026_registration_thankyou',
    name: 'ciim2026_registration_thankyou',
    label: 'Thank You Registration Template',
    description: 'Header with official conference poster, welcome letter, and custom extra parameter.',
    defaultImageType: 'poster',
    defaultExtraMode: 'dots',
  },
  {
    id: 'ciim2026_registration_1',
    name: 'ciim2026_registration_1',
    label: 'Registration 1 (QR Code Header)',
    description: 'Standard confirmed registration template with QR image header.',
    defaultImageType: 'qr_gold',
    defaultExtraMode: 'none',
  },
];

export default function Communications() {
  const [activeTab, setActiveTab] = useState('whatsapp'); // 'whatsapp' | 'email' | 'config'
  const [serverConfig, setServerConfig] = useState(null);

  // WhatsApp Form State
  const [waPhone, setWaPhone] = useState('9962460782');
  const [waName, setWaName] = useState('Dr. Karthikeyan');
  const [waTemplate, setWaTemplate] = useState('ciim2026_registration_4');
  const [waImageType, setWaImageType] = useState('qr_gold');
  const [waCustomImageUrl, setWaCustomImageUrl] = useState('');
  const [waExtraMode, setWaExtraMode] = useState('link'); // 'link' | 'dots' | 'custom' | 'none'
  const [waCustomExtra, setWaCustomExtra] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState(null);
  const [waError, setWaError] = useState('');

  // Email Form State
  const [emailTo, setEmailTo] = useState('infociim@pfrcivf.com');
  const [emailName, setEmailName] = useState('Dr. Karthikeyan');
  const [emailTicketLink, setEmailTicketLink] = useState(
    'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN'
  );
  const [emailSubject, setEmailSubject] = useState(
    "You're In! Welcome to CIIM 2026 | A New Era in Infertility Care"
  );
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [previewTab, setPreviewTab] = useState('visual'); // 'visual' | 'text'

  // Load config on mount
  useEffect(() => {
    communicationsApi
      .getConfig()
      .then((res) => {
        if (res?.data) {
          setServerConfig(res.data);
          if (res.data.whatsapp?.defaultPhone) {
            setWaPhone(res.data.whatsapp.defaultPhone);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load communications config:', err);
      });
  }, []);

  // When template changes, auto-set appropriate image & extra defaults
  const handleTemplateChange = (tmplId) => {
    setWaTemplate(tmplId);
    if (tmplId === 'ciim2026_registration_thankyou') {
      setWaImageType('poster');
      setWaExtraMode('dots');
    } else if (tmplId === 'ciim2026_registration_4') {
      setWaImageType('qr_gold');
      setWaExtraMode('link');
    } else {
      setWaImageType('qr_gold');
      setWaExtraMode('none');
    }
  };

  // Compute final WhatsApp image URL
  const selectedImageUrl = useMemo(() => {
    if (waImageType === 'custom') return waCustomImageUrl;
    const found = DEFAULT_IMAGE_PRESETS.find((p) => p.id === waImageType);
    return found ? found.url : DEFAULT_IMAGE_PRESETS[0].url;
  }, [waImageType, waCustomImageUrl]);

  // Compute extra parameter value
  const computedExtra = useMemo(() => {
    if (waExtraMode === 'dots') return '...';
    if (waExtraMode === 'link') {
      return 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN';
    }
    if (waExtraMode === 'custom') return waCustomExtra;
    return '';
  }, [waExtraMode, waCustomExtra]);

  // Fetch / update email preview
  useEffect(() => {
    communicationsApi
      .previewEmail({
        name: emailName,
        ticketLink: emailTicketLink,
      })
      .then((res) => {
        if (res?.data?.html) {
          setEmailPreviewHtml(res.data.html);
        }
      })
      .catch(() => {});
  }, [emailName, emailTicketLink]);

  // Send WhatsApp Test Message
  const handleSendWhatsApp = async (e) => {
    e.preventDefault();
    setWaSending(true);
    setWaResult(null);
    setWaError('');

    try {
      const res = await communicationsApi.sendTestWhatsApp({
        phone: waPhone,
        templateName: waTemplate,
        name: waName,
        extra: computedExtra,
        imageType: waImageType,
        customImageUrl: waCustomImageUrl,
      });
      setWaResult(res.data || res);
    } catch (err) {
      setWaError(err.message || 'Failed to dispatch WhatsApp template');
    } finally {
      setWaSending(false);
    }
  };

  // Send Email Test Message
  const handleSendEmail = async (e) => {
    e.preventDefault();
    setEmailSending(true);
    setEmailResult(null);
    setEmailError('');

    try {
      const res = await communicationsApi.sendTestEmail({
        to: emailTo,
        name: emailName,
        ticketLink: emailTicketLink,
        subject: emailSubject,
      });
      setEmailResult(res.data || res);
    } catch (err) {
      setEmailError(err.message || 'Failed to dispatch test email');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="comm-page">
      {/* Top Header */}
      <div className="comm-header">
        <div>
          <h1 className="comm-header__title">WATI &amp; Email Communications</h1>
          <p className="comm-header__desc">
            Test and trigger live WhatsApp template messages and Google Workspace SMTP luxury invitations
            with custom delegate parameters.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="comm-status-bar">
          <div className="comm-status-pill" data-status={serverConfig?.whatsapp?.configured ? 'active' : 'idle'}>
            <span className="comm-status-dot" />
            WATI WhatsApp: {serverConfig?.whatsapp?.configured ? 'Active' : 'Standby'}
          </div>
          <div className="comm-status-pill" data-status={serverConfig?.email?.configured ? 'active' : 'idle'}>
            <span className="comm-status-dot" />
            SMTP Email: {serverConfig?.email?.configured ? 'infociim@pfrcivf.com' : 'Pending'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="comm-tabs">
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'whatsapp' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          📱 WATI WhatsApp Templates
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'email' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          ✉️ Luxury Invitation Email
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === 'config' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Endpoints &amp; Assets
        </button>
      </div>

      {/* TAB 1: WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <div className="comm-grid">
          {/* Left: Input Form */}
          <div className="comm-card">
            <h2 className="comm-card__title">WhatsApp Template Dispatcher</h2>
            <p className="comm-card__desc">
              Send test templates to any mobile number with real-time parameter binding and image header updates.
            </p>

            {waResult && (
              <div className="comm-feedback comm-feedback--success">
                <span>✅ Message delivered successfully! Message ID: <strong>{waResult.messageId}</strong></span>
              </div>
            )}
            {waError && (
              <div className="comm-feedback comm-feedback--error">
                <span>⚠️ {waError}</span>
              </div>
            )}

            <form onSubmit={handleSendWhatsApp}>
              {/* Phone Input */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="wa-phone">
                  Test Recipient Mobile Number *
                </label>
                <input
                  id="wa-phone"
                  type="text"
                  className="comm-input"
                  placeholder="e.g. 9962460782 or 919962460782"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  required
                />
                <p className="comm-form-hint">
                  Supports 10-digit Indian numbers or international formats with country code (+91).
                </p>
              </div>

              {/* Delegate Name Input */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="wa-name">
                  Delegate Name (Param {'{{Name}}'} / {'{{DrName}}'}) *
                </label>
                <input
                  id="wa-name"
                  type="text"
                  className="comm-input"
                  placeholder="e.g. Dr. Karthikeyan"
                  value={waName}
                  onChange={(e) => setWaName(e.target.value)}
                  required
                />
              </div>

              {/* Template Selection */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="wa-template">
                  Select Approved WATI Template *
                </label>
                <select
                  id="wa-template"
                  className="comm-select"
                  value={waTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {DEFAULT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="comm-form-hint">
                  {DEFAULT_TEMPLATES.find((t) => t.id === waTemplate)?.description}
                </p>
              </div>

              {/* Header Image Preset Selection */}
              <div className="comm-form-group">
                <label className="comm-form-label">
                  Header Image (Poster or Standalone QR)
                </label>
                <div className="comm-preset-grid">
                  {DEFAULT_IMAGE_PRESETS.map((p) => (
                    <div
                      key={p.id}
                      className={`comm-preset-card ${waImageType === p.id ? 'is-selected' : ''}`}
                      onClick={() => setWaImageType(p.id)}
                    >
                      <img src={p.url} alt={p.label} className="comm-preset-thumb" />
                      <span className="comm-preset-label">{p.label}</span>
                    </div>
                  ))}
                  <div
                    className={`comm-preset-card ${waImageType === 'custom' ? 'is-selected' : ''}`}
                    onClick={() => setWaImageType('custom')}
                  >
                    <div className="comm-preset-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      🌐
                    </div>
                    <span className="comm-preset-label">Custom URL</span>
                  </div>
                </div>

                {waImageType === 'custom' && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="url"
                      className="comm-input"
                      placeholder="https://example.com/image.png"
                      value={waCustomImageUrl}
                      onChange={(e) => setWaCustomImageUrl(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Extra Parameter Selection */}
              <div className="comm-form-group">
                <label className="comm-form-label">
                  Extra Parameter ({'{{extra}}'}) Selection
                </label>
                <div className="comm-extra-choices">
                  <label className="comm-radio-label">
                    <input
                      type="radio"
                      name="wa-extra"
                      value="link"
                      checked={waExtraMode === 'link'}
                      onChange={() => setWaExtraMode('link')}
                    />
                    <span>
                      <strong>Ticket Link (with line breaks)</strong> — <code>https://ciim.prashanthfertility.com/tickets/...</code>
                    </span>
                  </label>
                  <label className="comm-radio-label">
                    <input
                      type="radio"
                      name="wa-extra"
                      value="dots"
                      checked={waExtraMode === 'dots'}
                      onChange={() => setWaExtraMode('dots')}
                    />
                    <span>
                      <strong>Ellipsis dots (...)</strong> — Recommended for Thank You template
                    </span>
                  </label>
                  <label className="comm-radio-label">
                    <input
                      type="radio"
                      name="wa-extra"
                      value="custom"
                      checked={waExtraMode === 'custom'}
                      onChange={() => setWaExtraMode('custom')}
                    />
                    <span>
                      <strong>Custom Parameter</strong>
                    </span>
                  </label>
                </div>

                {waExtraMode === 'custom' && (
                  <div style={{ marginTop: '10px' }}>
                    <input
                      type="text"
                      className="comm-input"
                      placeholder="Enter custom text or URL"
                      value={waCustomExtra}
                      onChange={(e) => setWaCustomExtra(e.target.value)}
                    />
                  </div>
                )}
                <p className="comm-form-hint">
                  Note: Line breaks are formatted safely with Unicode separators to prevent Meta WhatsApp errors.
                </p>
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: '24px' }}>
                <Button type="submit" variant="primary" disabled={waSending}>
                  {waSending ? 'Dispatching to WATI...' : '🚀 Send WhatsApp Test Message'}
                </Button>
              </div>
            </form>
          </div>

          {/* Right: Live Mobile Mockup Preview */}
          <div className="comm-preview-container">
            <div className="comm-wa-mockup">
              {/* WhatsApp Header */}
              <div className="comm-wa-mockup__header">
                <div className="comm-wa-mockup__avatar">
                  <img
                    src="https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg"
                    alt="CIIM 2026"
                  />
                </div>
                <div>
                  <div className="comm-wa-mockup__name">CIIM 2026 Conference</div>
                  <div className="comm-wa-mockup__badge">Official WhatsApp Business Account</div>
                </div>
              </div>

              {/* WhatsApp Chat Body */}
              <div className="comm-wa-mockup__body">
                <div className="comm-wa-bubble">
                  {/* Header Image */}
                  <div className="comm-wa-bubble__img-wrap">
                    <img
                      src={selectedImageUrl}
                      alt="Header visual"
                      className="comm-wa-bubble__img"
                      onError={(e) => {
                        e.target.src = DEFAULT_IMAGE_PRESETS[0].url;
                      }}
                    />
                  </div>

                  {/* Bubble Text */}
                  <div className="comm-wa-bubble__text">
                    {waTemplate === 'ciim2026_registration_thankyou' ? (
                      <>
                        <strong>Dear {waName || 'Dr. Karthikeyan'},</strong>
                        <br /><br />
                        Thank you for registering for <strong>CIIM 2026</strong> — Controversies in Infertility Management!
                        <br /><br />
                        We are thrilled to confirm your participation in this landmark scientific conference.
                        <br /><br />
                        {computedExtra && computedExtra !== '...' ? (
                          <>
                            {computedExtra}
                            <br /><br />
                          </>
                        ) : null}
                        Warm regards,<br />
                        <strong>Team CIIM 2026</strong><br />
                        Prashanth Fertility Research Centre
                      </>
                    ) : (
                      <>
                        <strong>Dear {waName || 'Dr. Karthikeyan'},</strong>
                        <br /><br />
                        Your registration for <strong>CIIM 2026</strong> has been confirmed.
                        <br /><br />
                        📅 <strong>Dates:</strong> 21st &amp; 22nd November 2026<br />
                        📍 <strong>Venue:</strong> The Leela Palace, Chennai<br />
                        🌐 <strong>Format:</strong> In-Person &amp; Live Tele-Transmission
                        <br /><br />
                        {computedExtra ? (
                          <>
                            🎟️ <strong>Your Ticket Link:</strong><br />
                            <a href="#test" style={{ color: '#00a884', wordBreak: 'break-all' }}>
                              {computedExtra}
                            </a>
                            <br /><br />
                          </>
                        ) : null}
                        Please present your QR code at the registration counter for entry.
                        <br /><br />
                        Warm regards,<br />
                        <strong>Prashanth Fertility Research Centre</strong>
                      </>
                    )}
                  </div>

                  <div className="comm-wa-bubble__time">
                    <span>12:00 PM</span>
                    <span>✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMAIL */}
      {activeTab === 'email' && (
        <div className="comm-grid">
          {/* Left: Email Form */}
          <div className="comm-card">
            <h2 className="comm-card__title">Luxury Invitation Email Dispatcher</h2>
            <p className="comm-card__desc">
              Send the official CIIM 2026 high-end responsive invitation email via Google Workspace SMTP.
            </p>

            {emailResult && (
              <div className="comm-feedback comm-feedback--success">
                <span>
                  ✅ Email dispatched successfully! Delivery reference: <strong>{emailResult.messageId}</strong>
                </span>
              </div>
            )}
            {emailError && (
              <div className="comm-feedback comm-feedback--error">
                <span>⚠️ {emailError}</span>
              </div>
            )}

            <form onSubmit={handleSendEmail}>
              {/* Recipient Email */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="email-to">
                  Recipient Email Address *
                </label>
                <input
                  id="email-to"
                  type="email"
                  className="comm-input"
                  placeholder="doctor@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  required
                />
              </div>

              {/* Delegate Name */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="email-name">
                  Delegate Name *
                </label>
                <input
                  id="email-name"
                  type="text"
                  className="comm-input"
                  placeholder="Dr. Karthikeyan"
                  value={emailName}
                  onChange={(e) => setEmailName(e.target.value)}
                  required
                />
              </div>

              {/* Ticket Link */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="email-link">
                  Ticket / Pass Link Parameter
                </label>
                <input
                  id="email-link"
                  type="url"
                  className="comm-input"
                  placeholder="https://ciim.prashanthfertility.com/tickets/..."
                  value={emailTicketLink}
                  onChange={(e) => setEmailTicketLink(e.target.value)}
                />
                <p className="comm-form-hint">
                  Included in the luxury Pass CTA button and text link in the email body.
                </p>
              </div>

              {/* Subject Line */}
              <div className="comm-form-group">
                <label className="comm-form-label" htmlFor="email-subject">
                  Subject Line
                </label>
                <input
                  id="email-subject"
                  type="text"
                  className="comm-input"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  required
                />
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: '24px' }}>
                <Button type="submit" variant="primary" disabled={emailSending}>
                  {emailSending ? 'Sending via SMTP...' : '✉️ Send Test Invitation Email'}
                </Button>
              </div>
            </form>
          </div>

          {/* Right: Live Email Preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-700)' }}>
                Live Responsive Email Preview
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--ink-200)',
                    background: previewTab === 'visual' ? 'var(--brand-600)' : '#fff',
                    color: previewTab === 'visual' ? '#fff' : 'var(--ink-700)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreviewTab('visual')}
                >
                  Visual
                </button>
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--ink-200)',
                    background: previewTab === 'text' ? 'var(--brand-600)' : '#fff',
                    color: previewTab === 'text' ? '#fff' : 'var(--ink-700)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreviewTab('text')}
                >
                  Plain Text
                </button>
              </div>
            </div>

            <div className="comm-email-frame-wrap">
              {previewTab === 'visual' ? (
                <iframe
                  title="Live Email Preview"
                  className="comm-email-frame"
                  srcDoc={emailPreviewHtml}
                />
              ) : (
                <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', maxHeight: '600px', overflowY: 'auto' }}>
                  {`SUB: ${emailSubject}\n\nDear ${emailName},\n\nA historic first. A new surgical era. An extraordinary scientific journey.\n\nWe are delighted to welcome you to CIIM 2026 – Controversies in Infertility Management!\n\nYour registration is confirmed, and you are now part of a landmark gathering dedicated to pushing the boundaries of infertility care, advancing surgical precision, and elevating ART outcomes.\n\nYOUR CONFERENCE AWAITS:\n- Dates: 21st & 22nd November 2026\n- Venue: The Leela Palace, Chennai\n- Format: In-Person & Live Tele-Transmission\n\nTHEME:\nBreaking Boundaries, Elevating Surgical Precision & ART Outcomes\n\nYOUR DELEGATE PASS & QR CODE:\n${emailTicketLink}\n\nWarm regards,\nTeam CIIM 2026\nPrashanth Fertility Research Centre\ninfociim@pfrcivf.com | https://ciim.prashanthfertility.com`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIG & PRESETS */}
      {activeTab === 'config' && (
        <div className="comm-card">
          <h2 className="comm-card__title">System Configuration &amp; Image Assets</h2>
          <p className="comm-card__desc">
            Direct endpoints and asset CDN URLs configured in the environment.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {/* WATI Card */}
            <div style={{ border: '1px solid var(--ink-200)', borderRadius: '10px', padding: '16px', background: '#fafbfc' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px', color: '#166534' }}>
                📱 WATI WhatsApp Gateway
              </h3>
              <p style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
                <strong>Provider:</strong> {serverConfig?.whatsapp?.provider || 'wati'}
              </p>
              <p style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
                <strong>Base URL:</strong> {serverConfig?.whatsapp?.baseUrl || 'https://live-mt-server.wati.io/1080787'}
              </p>
              <p style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
                <strong>Active Template:</strong> {serverConfig?.whatsapp?.currentTemplate || 'ciim2026_registration_4'}
              </p>
            </div>

            {/* SMTP Card */}
            <div style={{ border: '1px solid var(--ink-200)', borderRadius: '10px', padding: '16px', background: '#fafbfc' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px', color: '#1e40af' }}>
                ✉️ Google Workspace SMTP
              </h3>
              <p style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
                <strong>Host:</strong> {serverConfig?.email?.smtpHost || 'smtp.gmail.com'}
              </p>
              <p style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
                <strong>Port:</strong> {serverConfig?.email?.smtpPort || 587} (TLS)
              </p>
              <p style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
                <strong>User / From:</strong> {serverConfig?.email?.smtpUser || 'infociim@pfrcivf.com'}
              </p>
            </div>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '28px 0 12px', color: 'var(--ink-900)' }}>
            Verified Asset URLs (CDN &amp; Raw GitHub)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DEFAULT_IMAGE_PRESETS.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid var(--ink-200)',
                  borderRadius: '8px',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={p.url} alt={p.label} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.label}</div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>{p.url}</code>
                  </div>
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.8rem', color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 600 }}
                >
                  View ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
