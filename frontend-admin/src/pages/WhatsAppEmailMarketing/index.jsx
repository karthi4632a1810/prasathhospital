import { useState, useEffect, useMemo } from 'react';
import { marketingCampaignApi } from '../../lib/marketingCampaignApi';
import Button from '../../components/ui/Button';
import './WhatsAppEmailMarketing.css';

export default function WhatsAppEmailMarketing() {
  const [activeTab, setActiveTab] = useState('delegate_reminder'); // 'delegate_reminder' | 'session_approve' | 'history'

  // Audience Data
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [tnmcFilter, setTnmcFilter] = useState('ALL'); // 'ALL' | 'TNMC' | 'NON_TNMC'

  // Sessions from active event agenda
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Channel selections
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  // Scheduling options
  const [scheduleMode, setScheduleMode] = useState('immediate'); // 'immediate' | 'scheduled'
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Tab 1: Delegate Reminder Form
  const [tab1TemplateId, setTab1TemplateId] = useState('ciim_delegate_reminder_1');
  const [tab1CustomMessage, setTab1CustomMessage] = useState('');

  // Tab 2: Session Approval Form
  const [tab2TemplateId, setTab2TemplateId] = useState('ciim_session_approve_1');
  const [customSessionTitle, setCustomSessionTitle] = useState('');
  const [customSessionTime, setCustomSessionTime] = useState('');
  const [customSessionDate, setCustomSessionDate] = useState('21 Nov 2026');
  const [customSessionSpeaker, setCustomSessionSpeaker] = useState('');
  const [customSessionTrack, setCustomSessionTrack] = useState('Main Auditorium');
  const [tab2CustomMessage, setTab2CustomMessage] = useState('');

  // Campaign History
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Dispatch Action State
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }

  // Load initial recipients & sessions
  useEffect(() => {
    loadRecipients();
    loadSessions();
    loadCampaigns();
  }, []);

  async function loadRecipients() {
    setLoadingRecipients(true);
    try {
      const res = await marketingCampaignApi.getRecipients();
      const list = res.data?.recipients || [];
      setRecipients(list);
      // Default to selecting all confirmed delegates
      setSelectedIds(new Set(list.map((r) => r.id)));
    } catch (err) {
      console.error('Failed to load recipients', err);
    } finally {
      setLoadingRecipients(false);
    }
  }

  async function loadSessions() {
    try {
      const res = await marketingCampaignApi.getSessions();
      const list = res.data?.sessions || [];
      setSessions(list);
      if (list.length > 0) {
        setSelectedSessionId(list[0].id);
        setCustomSessionTitle(list[0].title);
        setCustomSessionTime(`${list[0].startTime} - ${list[0].endTime}`);
        setCustomSessionDate(list[0].dayDate || '21 Nov 2026');
        setCustomSessionSpeaker((list[0].speakerNames || []).join(', '));
        setCustomSessionTrack(list[0].track || 'Main Auditorium');
      }
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try {
      const res = await marketingCampaignApi.getCampaigns();
      setCampaigns(res.data?.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  // Handle Session Change
  function handleSessionSelect(e) {
    const sId = e.target.value;
    setSelectedSessionId(sId);
    const chosen = sessions.find((s) => s.id === sId);
    if (chosen) {
      setCustomSessionTitle(chosen.title);
      setCustomSessionTime(`${chosen.startTime} - ${chosen.endTime}`);
      setCustomSessionDate(chosen.dayDate || '21 Nov 2026');
      setCustomSessionSpeaker((chosen.speakerNames || []).join(', '));
      setCustomSessionTrack(chosen.track || 'Main Auditorium');
    }
  }

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    let result = recipients;

    if (tnmcFilter === 'TNMC') {
      result = result.filter((r) => Boolean(r.tnmcNumber && r.tnmcNumber.trim()));
    } else if (tnmcFilter === 'NON_TNMC') {
      result = result.filter((r) => !r.tnmcNumber || !r.tnmcNumber.trim());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.registrationCode.toLowerCase().includes(q) ||
          (r.tnmcNumber && r.tnmcNumber.toLowerCase().includes(q))
      );
    }

    return result;
  }, [recipients, tnmcFilter, searchQuery]);

  // Select / Deselect helpers
  function toggleRecipient(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredRecipients.map((r) => r.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  // Submit Campaign
  async function handleDispatch(e) {
    e.preventDefault();
    setFeedback(null);

    const channels = [];
    if (sendWhatsApp) channels.push('whatsapp');
    if (sendEmail) channels.push('email');

    if (!channels.length) {
      setFeedback({ type: 'error', text: 'Please select at least one channel (WhatsApp or Email).' });
      return;
    }

    const selectedRecipients = recipients.filter((r) => selectedIds.has(r.id));
    if (!selectedRecipients.length) {
      setFeedback({ type: 'error', text: 'Please select at least one delegate from the list.' });
      return;
    }

    const isTab1 = activeTab === 'delegate_reminder';
    const templateId = isTab1 ? tab1TemplateId : tab2TemplateId;

    if (!templateId.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a valid Template ID.' });
      return;
    }

    if (scheduleMode === 'scheduled' && !scheduledDateTime) {
      setFeedback({ type: 'error', text: 'Please choose a date and time for scheduled delivery.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tab: activeTab,
        campaignName: isTab1
          ? `Delegate Reminder (${selectedRecipients.length} delegates)`
          : `Session Schedule: ${customSessionTitle || 'Session'} (${selectedRecipients.length} delegates)`,
        templateId: templateId.trim(),
        channels,
        scheduleMode,
        scheduledFor: scheduleMode === 'scheduled' ? new Date(scheduledDateTime).toISOString() : null,
        sessionDetails: {
          sessionTitle: customSessionTitle,
          sessionTime: customSessionTime,
          sessionDate: customSessionDate,
          speakerNames: customSessionSpeaker ? customSessionSpeaker.split(',').map((s) => s.trim()) : [],
          track: customSessionTrack,
        },
        whatsappOptions: {
          templateName: templateId.trim(),
        },
        emailOptions: {
          subject: isTab1
            ? 'CIIM 2026: Important Delegate Reminder & Schedule'
            : `CIIM 2026: Schedule Details for ${customSessionTitle}`,
          customMessage: isTab1 ? tab1CustomMessage : tab2CustomMessage,
        },
        recipients: selectedRecipients,
      };

      const res = await marketingCampaignApi.sendCampaign(payload);
      setFeedback({
        type: 'success',
        text: res.message || 'Campaign submitted successfully!',
      });
      loadCampaigns();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to submit campaign. Please verify connection and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Cancel campaign
  async function handleCancelCampaign(id) {
    if (!window.confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await marketingCampaignApi.cancelCampaign(id);
      loadCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="wem-page">
      {/* Top Page Header */}
      <div className="wem-header">
        <div>
          <h1 className="wem-header__title">WhatsApp &amp; Email Marketing</h1>
          <p className="wem-header__desc">
            Broadcast WhatsApp and Email notifications to registered delegates, dispatch official
            reminders, or schedule automated alerts for conference session times.
          </p>
        </div>
        <div className="wem-badges">
          <span className="wem-badge is-green">
            <span>●</span> WhatsApp (WATI) Connected
          </span>
          <span className="wem-badge is-purple">
            <span>●</span> SMTP Mailer Active
          </span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="wem-tabs">
        <button
          type="button"
          className={`wem-tab${activeTab === 'delegate_reminder' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('delegate_reminder')}
        >
          <span>1. Delegate Reminder</span>
          <span className="wem-tab__tag">ciim_delegate_reminder_1</span>
        </button>
        <button
          type="button"
          className={`wem-tab${activeTab === 'session_approve' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('session_approve')}
        >
          <span>2. Session Approval &amp; Schedule</span>
          <span className="wem-tab__tag">Session Agenda Time</span>
        </button>
        <button
          type="button"
          className={`wem-tab${activeTab === 'history' ? ' is-active' : ''}`}
          onClick={() => {
            setActiveTab('history');
            loadCampaigns();
          }}
        >
          <span>Campaign History &amp; Schedules</span>
          <span className="wem-tab__tag">{campaigns.length}</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`wem-notice ${feedback.type === 'success' ? 'is-success' : 'is-warning'}`}>
          <strong>{feedback.type === 'success' ? '✓ Success: ' : '⚠ Error: '}</strong>
          {feedback.text}
        </div>
      )}

      {/* TAB 3: History & Scheduled Campaigns */}
      {activeTab === 'history' ? (
        <div className="wem-audience">
          <div className="wem-audience__toolbar">
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink-900)' }}>
              Dispatched &amp; Scheduled Campaigns
            </h3>
            <Button variant="secondary" onClick={loadCampaigns} disabled={loadingCampaigns}>
              {loadingCampaigns ? 'Refreshing…' : '↻ Refresh Status'}
            </Button>
          </div>

          {!campaigns.length ? (
            <p style={{ color: 'var(--ink-500)', padding: '24px 0', textAlign: 'center' }}>
              No marketing campaigns dispatched yet. Use Tab 1 or Tab 2 to launch your first campaign.
            </p>
          ) : (
            <div className="wem-campaign-list">
              {campaigns.map((camp) => (
                <div className="wem-campaign-item" key={camp._id}>
                  <div>
                    <h4 className="wem-campaign-title">{camp.campaignName}</h4>
                    <div className="wem-campaign-meta">
                      <span>
                        <strong>Template:</strong> <code>{camp.templateId}</code>
                      </span>
                      <span>
                        <strong>Channels:</strong> {(camp.channels || []).join(' & ').toUpperCase()}
                      </span>
                      <span>
                        <strong>Total:</strong> {camp.totalRecipients || 0} delegates
                      </span>
                      <span>
                        <strong>Sent:</strong> {camp.sentCount || 0} | <strong>Failed:</strong>{' '}
                        {camp.failedCount || 0}
                      </span>
                      {camp.scheduledFor && (
                        <span>
                          <strong>Scheduled for:</strong>{' '}
                          {new Date(camp.scheduledFor).toLocaleString('en-IN')}
                        </span>
                      )}
                      <span>
                        <strong>Created by:</strong> {camp.dispatcherName || 'Admin'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`wem-status-pill is-${camp.status}`}>{camp.status}</span>
                    {['SCHEDULED', 'RUNNING'].includes(camp.status) && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancelCampaign(camp._id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB 1 & TAB 2 MAIN WORKFLOW */
        <form onSubmit={handleDispatch}>
          <div className="wem-grid">
            {/* Left Column: Template & Schedule Configuration Card */}
            <div>
              <div className="wem-card">
                <h3 className="wem-card__title">
                  {activeTab === 'delegate_reminder'
                    ? '1. Reminder Configuration'
                    : '2. Session Schedule Setup'}
                </h3>

                {/* Tab 1 Banner */}
                {activeTab === 'delegate_reminder' && (
                  <div className="wem-notice is-info">
                    <span>ℹ</span>
                    <div>
                      <strong>Delegate Reminder Dispatch</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
                        Configured with template <code>ciim_delegate_reminder_1</code>. You can send
                        today immediately or schedule for a specific date and time.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab 2 Banner */}
                {activeTab === 'session_approve' && (
                  <div className="wem-notice is-warning">
                    <span>💡</span>
                    <div>
                      <strong>Session Approval &amp; Agenda Scheduling</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
                        Select any session from the CIIM 2026 conference agenda. When your Meta/WATI
                        template is approved, enter the template ID below!
                      </p>
                    </div>
                  </div>
                )}

                {/* Channel Selector */}
                <div className="wem-field">
                  <span className="wem-field__label">Delivery Channels</span>
                  <div className="wem-channels">
                    <label
                      className={`wem-channel-box${sendWhatsApp ? ' is-checked' : ''}`}
                      onClick={() => setSendWhatsApp(!sendWhatsApp)}
                    >
                      <input
                        type="checkbox"
                        checked={sendWhatsApp}
                        onChange={() => {}}
                        aria-label="WhatsApp Channel"
                      />
                      <div className="wem-channel-box__text">
                        <span className="wem-channel-box__name">WhatsApp</span>
                        <span className="wem-channel-box__sub">WATI Template</span>
                      </div>
                    </label>

                    <label
                      className={`wem-channel-box${sendEmail ? ' is-checked' : ''}`}
                      onClick={() => setSendEmail(!sendEmail)}
                    >
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={() => {}}
                        aria-label="Email Channel"
                      />
                      <div className="wem-channel-box__text">
                        <span className="wem-channel-box__name">Email</span>
                        <span className="wem-channel-box__sub">HTML Mailer</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Template ID Field */}
                {activeTab === 'delegate_reminder' ? (
                  <div className="wem-field">
                    <label className="wem-field__label" htmlFor="tab1-template-id">
                      WATI Template ID
                    </label>
                    <input
                      id="tab1-template-id"
                      className="wem-field__input"
                      type="text"
                      value={tab1TemplateId}
                      onChange={(e) => setTab1TemplateId(e.target.value)}
                      placeholder="ciim_delegate_reminder_1"
                      required
                    />
                    <span className="wem-field__hint">
                      Preset to <code>ciim_delegate_reminder_1</code> for today&apos;s delegate reminder.
                    </span>
                  </div>
                ) : (
                  <div className="wem-field">
                    <label className="wem-field__label" htmlFor="tab2-template-id">
                      Approved Template ID (Editable)
                    </label>
                    <input
                      id="tab2-template-id"
                      className="wem-field__input"
                      type="text"
                      value={tab2TemplateId}
                      onChange={(e) => setTab2TemplateId(e.target.value)}
                      placeholder="e.g. ciim_session_approve_1"
                      required
                    />
                    <span className="wem-field__hint">
                      Enter the template ID once approved by Meta/WATI.
                    </span>
                  </div>
                )}

                {/* Tab 2 Specific: Session Picker from Agenda */}
                {activeTab === 'session_approve' && (
                  <>
                    <div className="wem-field">
                      <label className="wem-field__label" htmlFor="session-picker">
                        Choose Session from Agenda ({sessions.length} sessions available)
                      </label>
                      <select
                        id="session-picker"
                        className="wem-field__select"
                        value={selectedSessionId}
                        onChange={handleSessionSelect}
                      >
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            [{s.startTime} - {s.endTime}] {s.title} ({s.speakerNames.join(', ') || 'Faculty'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="wem-field">
                      <label className="wem-field__label" htmlFor="session-title">
                        Session Title
                      </label>
                      <input
                        id="session-title"
                        className="wem-field__input"
                        type="text"
                        value={customSessionTitle}
                        onChange={(e) => setCustomSessionTitle(e.target.value)}
                        placeholder="Session Title"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="wem-field">
                        <label className="wem-field__label" htmlFor="session-time">
                          Time Slot
                        </label>
                        <input
                          id="session-time"
                          className="wem-field__input"
                          type="text"
                          value={customSessionTime}
                          onChange={(e) => setCustomSessionTime(e.target.value)}
                          placeholder="e.g. 09:30 - 10:15"
                        />
                      </div>
                      <div className="wem-field">
                        <label className="wem-field__label" htmlFor="session-date">
                          Date
                        </label>
                        <input
                          id="session-date"
                          className="wem-field__input"
                          type="text"
                          value={customSessionDate}
                          onChange={(e) => setCustomSessionDate(e.target.value)}
                          placeholder="e.g. 21 Nov 2026"
                        />
                      </div>
                    </div>

                    <div className="wem-field">
                      <label className="wem-field__label" htmlFor="session-speaker">
                        Speaker / Faculty Name
                      </label>
                      <input
                        id="session-speaker"
                        className="wem-field__input"
                        type="text"
                        value={customSessionSpeaker}
                        onChange={(e) => setCustomSessionSpeaker(e.target.value)}
                        placeholder="Speaker name"
                      />
                    </div>
                  </>
                )}

                {/* Dispatch Scheduling Controls */}
                <div className="wem-field">
                  <span className="wem-field__label">Dispatch Schedule</span>
                  <div className="wem-schedule-options">
                    <button
                      type="button"
                      className={`wem-schedule-btn${scheduleMode === 'immediate' ? ' is-active' : ''}`}
                      onClick={() => setScheduleMode('immediate')}
                    >
                      ⚡ Send Immediately (Today)
                    </button>
                    <button
                      type="button"
                      className={`wem-schedule-btn${scheduleMode === 'scheduled' ? ' is-active' : ''}`}
                      onClick={() => setScheduleMode('scheduled')}
                    >
                      ⏰ Schedule for Session Time
                    </button>
                  </div>
                </div>

                {scheduleMode === 'scheduled' && (
                  <div className="wem-field">
                    <label className="wem-field__label" htmlFor="scheduled-datetime">
                      Schedule Date &amp; Time
                    </label>
                    <input
                      id="scheduled-datetime"
                      className="wem-field__input"
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      required={scheduleMode === 'scheduled'}
                    />
                    <span className="wem-field__hint">
                      Messages will be dispatched automatically at this scheduled time.
                    </span>
                  </div>
                )}

                {/* Optional Custom Note */}
                <div className="wem-field">
                  <label className="wem-field__label" htmlFor="custom-message">
                    Custom Note / Special Instructions (Optional)
                  </label>
                  <textarea
                    id="custom-message"
                    className="wem-field__textarea"
                    rows="3"
                    value={activeTab === 'delegate_reminder' ? tab1CustomMessage : tab2CustomMessage}
                    onChange={(e) =>
                      activeTab === 'delegate_reminder'
                        ? setTab1CustomMessage(e.target.value)
                        : setTab2CustomMessage(e.target.value)
                    }
                    placeholder="Enter any additional announcement or note to include in the message..."
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Registered User Selection Table */}
            <div>
              <div className="wem-audience">
                <div className="wem-audience__toolbar">
                  {/* Search Box */}
                  <div className="wem-search-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search registered delegates by name, phone, email, or TNMC..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* TNMC Filter Chips */}
                  <div className="wem-filter-chips">
                    <button
                      type="button"
                      className={`wem-chip${tnmcFilter === 'ALL' ? ' is-active' : ''}`}
                      onClick={() => setTnmcFilter('ALL')}
                    >
                      All ({recipients.length})
                    </button>
                    <button
                      type="button"
                      className={`wem-chip${tnmcFilter === 'TNMC' ? ' is-active' : ''}`}
                      onClick={() => setTnmcFilter('TNMC')}
                    >
                      TNMC Doctors
                    </button>
                    <button
                      type="button"
                      className={`wem-chip${tnmcFilter === 'NON_TNMC' ? ' is-active' : ''}`}
                      onClick={() => setTnmcFilter('NON_TNMC')}
                    >
                      Without TNMC
                    </button>
                  </div>
                </div>

                {/* Selection Count and Batch Buttons */}
                <div className="wem-audience__actions">
                  <span>
                    Selected:{' '}
                    <span className="wem-audience__select-count">
                      {selectedCount} of {recipients.length}
                    </span>{' '}
                    delegates
                  </span>
                  <span>•</span>
                  <Button variant="secondary" size="sm" onClick={handleSelectAll}>
                    Select All ({filteredRecipients.length})
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleDeselectAll}>
                    Deselect All
                  </Button>
                </div>

                {/* Recipients Table */}
                {loadingRecipients ? (
                  <p style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
                    Loading registered delegates…
                  </p>
                ) : (
                  <div className="wem-table-wrap">
                    <table className="wem-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={
                                filteredRecipients.length > 0 &&
                                filteredRecipients.every((r) => selectedIds.has(r.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleSelectAll();
                                } else {
                                  handleDeselectAll();
                                }
                              }}
                              aria-label="Select all"
                            />
                          </th>
                          <th>#</th>
                          <th>Delegate Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Pass Type</th>
                          <th>TNMC No.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((r) => {
                          const isSelected = selectedIds.has(r.id);
                          return (
                            <tr
                              key={r.id}
                              className={isSelected ? 'is-selected' : ''}
                              onClick={() => toggleRecipient(r.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRecipient(r.id)}
                                />
                              </td>
                              <td style={{ fontWeight: 600, color: 'var(--ink-400)' }}>
                                {r.badgeNo || r.index}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--ink-900)' }}>
                                {r.name}
                              </td>
                              <td>{r.phone}</td>
                              <td>{r.email || <span className="wem-no-tnmc">None</span>}</td>
                              <td>{r.ticketType}</td>
                              <td>
                                {r.tnmcNumber ? (
                                  <span className="wem-tnmc-badge">{r.tnmcNumber}</span>
                                ) : (
                                  <span className="wem-no-tnmc">No TNMC</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sticky Dispatch Bar */}
              <div className="wem-dispatch-bar">
                <div className="wem-dispatch-bar__info">
                  <h4>
                    <span>🚀</span> Ready to Dispatch to {selectedCount} Registered Delegates
                  </h4>
                  <p>
                    Channels:{' '}
                    <strong>
                      {[sendWhatsApp && 'WhatsApp (WATI)', sendEmail && 'Email'].filter(Boolean).join(' + ') ||
                        'None'}
                    </strong>{' '}
                    • Mode:{' '}
                    <strong>
                      {scheduleMode === 'immediate'
                        ? 'Immediate (Send Today)'
                        : `Scheduled for ${scheduledDateTime || 'Selected Time'}`}
                    </strong>{' '}
                    • Template:{' '}
                    <code>{activeTab === 'delegate_reminder' ? tab1TemplateId : tab2TemplateId}</code>
                  </p>
                </div>

                <button
                  type="submit"
                  className="wem-btn-dispatch"
                  disabled={submitting || selectedCount === 0 || (!sendWhatsApp && !sendEmail)}
                >
                  {submitting
                    ? 'Submitting Campaign…'
                    : scheduleMode === 'immediate'
                    ? `🚀 Send Now to ${selectedCount} Delegates`
                    : `⏰ Schedule Dispatch (${selectedCount})`}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
