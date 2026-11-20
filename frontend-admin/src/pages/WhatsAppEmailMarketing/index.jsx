import { useState, useEffect, useMemo, useRef } from 'react';
import { marketingCampaignApi } from '../../lib/marketingCampaignApi';
import Button from '../../components/ui/Button';
import './WhatsAppEmailMarketing.css';

export default function WhatsAppEmailMarketing() {
  const [activeTab, setActiveTab] = useState('live_monitor'); // 'live_monitor' | 'delegate_reminder' | 'session_approve'

  // Live Monitor Data
  const [liveData, setLiveData] = useState({
    activeJobs: [],
    scheduledCampaigns: [],
    recentCampaigns: [],
    summary: { activeWorkersCount: 0, scheduledCount: 0, totalSentToday: 0, totalFailedToday: 0 },
  });
  const [loadingLive, setLoadingLive] = useState(false);

  // Modal: Schedule All Sessions for Tomorrow
  const [showScheduleAllModal, setShowScheduleAllModal] = useState(false);
  const [scheduleAllTargetDate, setScheduleAllTargetDate] = useState('2026-11-21'); // Tomorrow: Day 1
  const [scheduleAllDayIndex, setScheduleAllDayIndex] = useState(0); // 0 = Day 1
  const [scheduleAllLeadTime, setScheduleAllLeadTime] = useState(15); // 15 mins before
  const [scheduleAllSendWhatsApp, setScheduleAllSendWhatsApp] = useState(true);
  const [scheduleAllSendEmail, setScheduleAllSendEmail] = useState(true);
  const [scheduleAllTemplateId, setScheduleAllTemplateId] = useState('ciim_session_approve_1');
  const [submittingScheduleAll, setSubmittingScheduleAll] = useState(false);

  // Audience Data for single campaigns
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

  // Tab 2: Delegate Reminder Form
  const [tab1TemplateId, setTab1TemplateId] = useState('ciim_delegate_reminder_1');
  const [tab1CustomMessage, setTab1CustomMessage] = useState('');

  // Tab 3: Single Session Approval Form
  const [tab2TemplateId, setTab2TemplateId] = useState('ciim_session_approve_1');
  const [customSessionTitle, setCustomSessionTitle] = useState('');
  const [customSessionTime, setCustomSessionTime] = useState('');
  const [customSessionDate, setCustomSessionDate] = useState('21 Nov 2026');
  const [customSessionSpeaker, setCustomSessionSpeaker] = useState('');
  const [customSessionTrack, setCustomSessionTrack] = useState('Main Auditorium');
  const [tab2CustomMessage, setTab2CustomMessage] = useState('');

  // Dispatch Action State
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }

  // Auto-polling for Live Monitor every 2.5s
  useEffect(() => {
    fetchLiveMonitor();
    const interval = setInterval(() => {
      fetchLiveMonitor(true);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Initial load of audience & sessions
  useEffect(() => {
    loadRecipients();
    loadSessions();
  }, []);

  async function fetchLiveMonitor(silent = false) {
    if (!silent) setLoadingLive(true);
    try {
      const res = await marketingCampaignApi.getLiveMonitor();
      if (res.data) {
        setLiveData(res.data);
      }
    } catch (err) {
      if (!silent) console.error('Failed to fetch live monitor', err);
    } finally {
      if (!silent) setLoadingLive(false);
    }
  }

  async function loadRecipients() {
    setLoadingRecipients(true);
    try {
      const res = await marketingCampaignApi.getRecipients();
      const list = res.data?.recipients || [];
      setRecipients(list);
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

  // Actions on Live Monitor
  async function handleLaunchScheduledNow(id, name) {
    if (!window.confirm(`Launch campaign "${name}" immediately now?`)) return;
    try {
      await marketingCampaignApi.launchScheduledNow(id);
      setFeedback({ type: 'success', text: `Campaign "${name}" launched immediately!` });
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to launch');
    }
  }

  async function handlePauseCampaign(id) {
    try {
      await marketingCampaignApi.pauseCampaign(id);
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to pause');
    }
  }

  async function handleResumeCampaign(id) {
    try {
      await marketingCampaignApi.resumeCampaign(id);
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to resume');
    }
  }

  async function handleCancelCampaign(id) {
    if (!window.confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await marketingCampaignApi.cancelCampaign(id);
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  }

  // Action: Schedule All Sessions for Tomorrow
  async function handleScheduleAllSubmit(e) {
    e.preventDefault();
    const channels = [];
    if (scheduleAllSendWhatsApp) channels.push('whatsapp');
    if (scheduleAllSendEmail) channels.push('email');

    if (!channels.length) {
      alert('Please select at least one channel (WhatsApp or Email).');
      return;
    }

    setSubmittingScheduleAll(true);
    try {
      const res = await marketingCampaignApi.scheduleAllSessions({
        targetDate: scheduleAllTargetDate,
        dayIndex: scheduleAllDayIndex,
        leadTimeMinutes: scheduleAllLeadTime,
        channels,
        templateId: scheduleAllTemplateId,
      });

      setFeedback({
        type: 'success',
        text: res.message || `Scheduled ${res.count} sessions for tomorrow!`,
      });
      setShowScheduleAllModal(false);
      setActiveTab('live_monitor');
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to schedule sessions.');
    } finally {
      setSubmittingScheduleAll(false);
    }
  }

  // Action: Single Campaign Dispatch
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
      setActiveTab('live_monitor');
      fetchLiveMonitor();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to submit campaign. Please verify connection and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function formatCountdown(seconds) {
    if (seconds <= 0) return 'Due now (starting...)';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `Starts in ${h}h ${m}m ${s}s`;
    }
    return `Starts in ${m}m ${s}s`;
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="wem-page">
      {/* Top Page Header */}
      <div className="wem-header">
        <div>
          <h1 className="wem-header__title">WhatsApp &amp; Email Marketing</h1>
          <p className="wem-header__desc">
            Live monitor active dispatches, schedule all tomorrow&apos;s sessions with automated reminders,
            or launch instant broadcast campaigns to registered delegates.
          </p>
        </div>
        <div className="wem-badges">
          <span className="wem-badge is-live">
            <span className="wem-badge-dot"></span> Live Polling Active (2.5s)
          </span>
          <span className="wem-badge is-green">
            <span>●</span> WATI WhatsApp Online
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
          className={`wem-tab${activeTab === 'live_monitor' ? ' is-active' : ''}`}
          onClick={() => {
            setActiveTab('live_monitor');
            fetchLiveMonitor();
          }}
        >
          <span>📡 Live Monitor &amp; Scheduled Queue</span>
          <span className="wem-tab__tag">
            {liveData.activeJobs?.length ? `${liveData.activeJobs.length} Running` : `${liveData.scheduledCampaigns?.length || 0} Scheduled`}
          </span>
        </button>
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
          <span>2. Single Session Schedule</span>
          <span className="wem-tab__tag">Agenda Slot</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`wem-notice ${feedback.type === 'success' ? 'is-success' : 'is-warning'}`}>
          <strong>{feedback.type === 'success' ? '✓ Success: ' : '⚠ Notice: '}</strong>
          {feedback.text}
        </div>
      )}

      {/* =========================================================================
          TAB 1: LIVE MONITOR & SCHEDULED QUEUE
         ========================================================================= */}
      {activeTab === 'live_monitor' && (
        <div>
          {/* Top Metric Bar & Schedule All Button */}
          <div className="wem-monitor-bar">
            <div className="wem-monitor-stats">
              <div className="wem-monitor-stat">
                <span className="wem-monitor-stat__val">{liveData.activeJobs?.length || 0}</span>
                <span className="wem-monitor-stat__label">Active Workers</span>
              </div>
              <div className="wem-monitor-stat">
                <span className="wem-monitor-stat__val" style={{ color: '#fde047' }}>
                  {liveData.scheduledCampaigns?.length || 0}
                </span>
                <span className="wem-monitor-stat__label">Sessions Scheduled</span>
              </div>
              <div className="wem-monitor-stat">
                <span className="wem-monitor-stat__val" style={{ color: '#4ade80' }}>
                  {liveData.summary?.totalSentToday || 0}
                </span>
                <span className="wem-monitor-stat__label">Dispatched Today</span>
              </div>
              <div className="wem-monitor-stat">
                <span className="wem-monitor-stat__val" style={{ color: '#f87171' }}>
                  {liveData.summary?.totalFailedToday || 0}
                </span>
                <span className="wem-monitor-stat__label">Failed / Retries</span>
              </div>
            </div>

            <button
              type="button"
              className="wem-btn-schedule-all"
              onClick={() => setShowScheduleAllModal(true)}
            >
              <span>📅</span>
              <span>Schedule All Sessions for Tomorrow (Day 1)</span>
            </button>
          </div>

          <div className="wem-live-grid">
            {/* Left Column: Live Running Instant Dispatches */}
            <div>
              <div className="wem-live-card">
                <div className="wem-live-card__header">
                  <h3 className="wem-live-card__title">
                    <span>🚀</span> Live Instant Dispatches
                  </h3>
                  {liveData.activeJobs?.length > 0 && (
                    <span className="wem-badge is-live">
                      <span className="wem-badge-dot"></span> Processing Live
                    </span>
                  )}
                </div>

                {!liveData.activeJobs || liveData.activeJobs.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink-500)' }}>
                    <p style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>☕</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>No instant dispatches running right now.</p>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem' }}>
                      Launch an instant campaign from Tab 1 or 2, or watch upcoming scheduled session
                      timers on the right.
                    </p>
                  </div>
                ) : (
                  liveData.activeJobs.map((job) => (
                    <div
                      key={job.campaignId}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: '#faf7f9',
                        border: '1px solid #ebd3e2',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#381b4e' }}>
                            {job.campaignName}
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--ink-500)' }}>
                            Template: <code>{job.templateId}</code> • Channels:{' '}
                            {(job.channels || []).join(' & ').toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {job.status === 'RUNNING' ? (
                            <Button size="sm" variant="secondary" onClick={() => handlePauseCampaign(job.campaignId)}>
                              ⏸ Pause
                            </Button>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => handleResumeCampaign(job.campaignId)}>
                              ▶ Resume
                            </Button>
                          )}
                          <Button size="sm" variant="danger" onClick={() => handleCancelCampaign(job.campaignId)}>
                            ❌ Cancel
                          </Button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="wem-progress-box">
                        <div className="wem-progress-info">
                          <span>
                            Progress: {job.percentage}% ({job.processedCount} of {job.totalRecipients})
                          </span>
                          <span style={{ color: '#166534' }}>Sent: {job.sentCount} | Failed: {job.failedCount}</span>
                        </div>
                        <div className="wem-progress-track">
                          <div className="wem-progress-fill" style={{ width: `${job.percentage}%` }}></div>
                        </div>
                        <div className="wem-speed-metrics">
                          <span>⚡ Speed: <strong>{job.speed} msg/sec</strong></span>
                          <span>⏳ ETA: <strong>~{job.etaSeconds}s remaining</strong></span>
                          <span>⏱ Elapsed: <strong>{job.elapsedSeconds}s</strong></span>
                        </div>
                      </div>

                      {/* Real-time Recipient Stream */}
                      {job.recentLogs && job.recentLogs.length > 0 && (
                        <div>
                          <p style={{ margin: '10px 0 4px 0', fontSize: '0.78rem', fontWeight: 700, color: '#381b4e' }}>
                            Live Delivery Activity Stream:
                          </p>
                          <div className="wem-stream-feed">
                            {job.recentLogs.map((log, lIdx) => (
                              <div
                                key={lIdx}
                                className={`wem-stream-row ${log.success ? 'is-success' : 'is-failed'}`}
                              >
                                <span>
                                  <strong>{log.name}</strong> ({log.phone})
                                </span>
                                <span>
                                  {log.whatsappStatus === 'SENT' && <span style={{ color: '#16a34a', marginRight: '6px' }}>[WA ✓]</span>}
                                  {log.emailStatus === 'SENT' && <span style={{ color: '#2563eb' }}>[Email ✓]</span>}
                                  <small style={{ marginLeft: '8px', color: 'var(--ink-400)' }}>{log.time}</small>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Live Scheduled Campaigns Queue */}
            <div>
              <div className="wem-live-card">
                <div className="wem-live-card__header">
                  <h3 className="wem-live-card__title">
                    <span>⏰</span> Scheduled Sessions Queue ({liveData.scheduledCampaigns?.length || 0})
                  </h3>
                  <Button size="sm" variant="secondary" onClick={() => fetchLiveMonitor()}>
                    ↻ Refresh
                  </Button>
                </div>

                {!liveData.scheduledCampaigns || liveData.scheduledCampaigns.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink-500)' }}>
                    <p style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>📅</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>No sessions scheduled in queue.</p>
                    <p style={{ margin: '6px 0 16px 0', fontSize: '0.84rem' }}>
                      Click the button below to schedule all 19 Day 1 sessions for tomorrow automatically!
                    </p>
                    <Button variant="primary" onClick={() => setShowScheduleAllModal(true)}>
                      Schedule All Sessions for Tomorrow
                    </Button>
                  </div>
                ) : (
                  <div className="wem-scheduled-list">
                    {liveData.scheduledCampaigns.map((sc) => (
                      <div className="wem-scheduled-item" key={sc._id}>
                        <div className="wem-scheduled-item__left">
                          <h4 className="wem-scheduled-title">{sc.campaignName}</h4>
                          <div className="wem-scheduled-sub">
                            <span>
                              🕒 <strong>Scheduled:</strong>{' '}
                              {sc.scheduledFor ? new Date(sc.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </span>
                            <span>
                              👥 <strong>Audience:</strong> {sc.totalRecipients} delegates
                            </span>
                            <span>
                              📲 <strong>Channels:</strong> {(sc.channels || []).join(' + ').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <span className="wem-countdown-pill">
                            ⏳ {formatCountdown(sc.countdownSeconds)}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleLaunchScheduledNow(sc._id, sc.campaignName)}
                            >
                              ⚡ Launch Now
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleCancelCampaign(sc._id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2 & TAB 3: SINGLE CAMPAIGN DISPATCH (REMINDER / SESSION)
         ========================================================================= */}
      {activeTab !== 'live_monitor' && (
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

                {activeTab === 'delegate_reminder' ? (
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
                ) : (
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
                        onChange={() => { }}
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
                        onChange={() => { }}
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
                          placeholder="e.g. 08:30 - 08:40"
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

      {/* =========================================================================
          MODAL: SCHEDULE ALL SESSIONS FOR TOMORROW (BATCH TIMED SCHEDULER)
         ========================================================================= */}
      {showScheduleAllModal && (
        <div className="wem-modal-overlay" onClick={() => setShowScheduleAllModal(false)}>
          <div className="wem-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wem-modal-header">
              <div>
                <h3 className="wem-modal-title">📅 Schedule All Sessions for Tomorrow</h3>
                <p className="wem-modal-sub">
                  Automatically schedule timed WhatsApp &amp; Email reminders for every session of Day 1.
                </p>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}
                onClick={() => setShowScheduleAllModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleAllSubmit}>
              {/* Day & Date Selection */}
              <div className="wem-field">
                <label className="wem-field__label">Conference Day</label>
                <select
                  className="wem-field__select"
                  value={scheduleAllDayIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setScheduleAllDayIndex(idx);
                    setScheduleAllTargetDate(idx === 0 ? '2026-11-21' : '2026-11-22');
                  }}
                >
                  <option value={0}>Day 1 — Infertility Controversies (19 Sessions) — Saturday, 21 Nov 2026 (Tomorrow)</option>
                  <option value={1}>Day 2 — Andrology &amp; Precision ART (18 Sessions) — Sunday, 22 Nov 2026</option>
                </select>
              </div>

              <div className="wem-field">
                <label className="wem-field__label">Target Date</label>
                <input
                  type="date"
                  className="wem-field__input"
                  value={scheduleAllTargetDate}
                  onChange={(e) => setScheduleAllTargetDate(e.target.value)}
                  required
                />
              </div>

              {/* Lead Time Offset */}
              <div className="wem-field">
                <label className="wem-field__label">Dispatch Timing Offset</label>
                <select
                  className="wem-field__select"
                  value={scheduleAllLeadTime}
                  onChange={(e) => setScheduleAllLeadTime(parseInt(e.target.value, 10))}
                >
                  <option value={15}>15 Minutes Before Each Session (Recommended)</option>
                  <option value={30}>30 Minutes Before Each Session</option>
                  <option value={10}>10 Minutes Before Each Session</option>
                  <option value={0}>At Exact Session Start Time</option>
                </select>
                <span className="wem-field__hint">
                  E.g. A session starting at 08:30 AM will be dispatched at 08:15 AM automatically.
                </span>
              </div>

              {/* Channel Selector */}
              <div className="wem-field">
                <span className="wem-field__label">Delivery Channels</span>
                <div className="wem-channels">
                  <label
                    className={`wem-channel-box${scheduleAllSendWhatsApp ? ' is-checked' : ''}`}
                    onClick={() => setScheduleAllSendWhatsApp(!scheduleAllSendWhatsApp)}
                  >
                    <input
                      type="checkbox"
                      checked={scheduleAllSendWhatsApp}
                      onChange={() => { }}
                    />
                    <div className="wem-channel-box__text">
                      <span className="wem-channel-box__name">WhatsApp</span>
                      <span className="wem-channel-box__sub">WATI Template</span>
                    </div>
                  </label>

                  <label
                    className={`wem-channel-box${scheduleAllSendEmail ? ' is-checked' : ''}`}
                    onClick={() => setScheduleAllSendEmail(!scheduleAllSendEmail)}
                  >
                    <input
                      type="checkbox"
                      checked={scheduleAllSendEmail}
                      onChange={() => { }}
                    />
                    <div className="wem-channel-box__text">
                      <span className="wem-channel-box__name">Email</span>
                      <span className="wem-channel-box__sub">HTML Mailer</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Template ID */}
              <div className="wem-field">
                <label className="wem-field__label">Template ID</label>
                <input
                  type="text"
                  className="wem-field__input"
                  value={scheduleAllTemplateId}
                  onChange={(e) => setScheduleAllTemplateId(e.target.value)}
                  placeholder="ciim_session_approve_1"
                  required
                />
                <span className="wem-field__hint">
                  Preset to <code>ciim_session_approve_1</code> (editable anytime).
                </span>
              </div>

              <div className="wem-notice is-info">
                <span>ℹ</span>
                <div>
                  <strong>Audience:</strong> Will schedule personalized session reminders for all{' '}
                  <strong>{recipients.length} confirmed delegates</strong>.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <Button variant="secondary" onClick={() => setShowScheduleAllModal(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submittingScheduleAll}>
                  {submittingScheduleAll ? 'Scheduling Sessions…' : '🚀 Confirm & Schedule All Sessions for Tomorrow'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
