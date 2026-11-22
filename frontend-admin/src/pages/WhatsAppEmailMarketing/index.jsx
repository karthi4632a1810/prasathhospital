import { useState, useEffect, useMemo, useRef } from 'react';
import { marketingCampaignApi } from '../../lib/marketingCampaignApi';
import { whatsappMarketingApi } from '../../lib/whatsappMarketingApi';
import Button from '../../components/ui/Button';
import './WhatsAppEmailMarketing.css';

const DEFAULT_WATI_TEMPLATES = [
  {
    id: 'ciim2026_day_session_alert',
    name: 'ciim2026_day_session_alert',
    label: 'CIIM 2026: Day Session Alert (2 Params: Session & Faculty)',
    category: 'UTILITY',
    params: ['1', '2'],
    paramLabels: ['Session Name', 'Faculty Name'],
    body: `*CIIM 2026 – Session Alert* 📢\n\nThe following scientific session will commence shortly:\n\n📌 *Session:* {{1}}\n👨‍⚕️ *Faculty:* {{2}}\n\nPlease take your seat in the hall.\n\nWarm regards,\nOrganising Committee - CIIM 2026`,
  },
  {
    id: 'ciim2026_session_alert_5min',
    name: 'ciim2026_session_alert_5min',
    label: 'CIIM 2026: 5-Minute Session Alert (4 Params: Name, Session, Speaker, Hall)',
    category: 'UTILITY',
    params: ['1', '2', '3', '4'],
    body: `*CIIM 2026 – Session Alert*\n\nDear Dr. {{1}},\n\nThe following scientific session will commence in 5 minutes:\n\nSession: {{2}}\nSpeaker: {{3}}\nHall: {{4}}\n\nPlease take your seat in the auditorium.\n\nRegards,\nOrganising Committee - CIIM 2026`,
  },
  {
    id: 'ciim_delegate_reminder_1',
    name: 'ciim_delegate_reminder_1',
    label: 'CIIM 2026: Delegate Event Pass Reminder',
    category: 'UTILITY',
    params: ['1'],
    body: `CIIM 2026 Delegate Reminder.\n\nDear Dr. {{1}},\n\nYour event pass is ready. Please present your badge QR at the entrance counter.\n\nRegards,\nOrganising Committee`,
  },
  {
    id: 'ciim2026_2what_works',
    name: 'ciim2026_2what_works',
    label: 'CIIM 2026: What Works & What Doesn’t (Marketing)',
    category: 'MARKETING',
    params: ['Name'],
    body: `A Personal Invitation to CIIM 2026 – Controversies in Infertility Management! ✨\n\nDear Dr. {{Name}},\n\nJoin us for groundbreaking discussions and debates at Chennai.\n\nWarm regards,\nDr. Geetha Haripriya`,
  },
  {
    id: 'ciim2026_participant_qanda_v2',
    name: 'ciim2026_participant_qanda_v2',
    label: 'CIIM 2026: Participant Q&A (Utility)',
    category: 'UTILITY',
    params: ['Name'],
    body: `CIIM 2026 – Controversies in Infertility Management\n\nDear Dr. {{Name}},\n\nDo you have questions for the scientific faculty? Submit your questions now.\n\nRegards,\nScientific Committee`,
  },
];

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

  // Modal: Bulk Schedule All Sessions (Day 1 / Day 2)
  const [showScheduleAllModal, setShowScheduleAllModal] = useState(false);
  const [scheduleAllTargetDate, setScheduleAllTargetDate] = useState('2026-11-22'); // Default: Day 2 (Today)
  const [scheduleAllDayIndex, setScheduleAllDayIndex] = useState(1); // 1 = Day 2 (Today)
  const [scheduleAllLeadTime, setScheduleAllLeadTime] = useState(5); // 5 mins before default (Meta approved)
  const [scheduleAllSendWhatsApp, setScheduleAllSendWhatsApp] = useState(true);
  const [scheduleAllSendEmail, setScheduleAllSendEmail] = useState(true);
  const [scheduleAllTemplateId, setScheduleAllTemplateId] = useState('ciim2026_session_alert_5min');
  const [submittingScheduleAll, setSubmittingScheduleAll] = useState(false);
  const [tab2DayFilter, setTab2DayFilter] = useState('DAY_2'); // Tab 2 Day Filter

  // Modal: Manual Schedule Setup with inputs & date-time
  const [showManualScheduleModal, setShowManualScheduleModal] = useState(false);
  const [manualCampaignName, setManualCampaignName] = useState('');
  const [manualScheduledFor, setManualScheduledFor] = useState('');
  const [manualTemplateId, setManualTemplateId] = useState('ciim2026_session_alert_5min');
  const [manualSendWhatsApp, setManualSendWhatsApp] = useState(true);
  const [manualSendEmail, setManualSendEmail] = useState(true);
  const [manualSessionTitle, setManualSessionTitle] = useState('');
  const [manualSessionTime, setManualSessionTime] = useState('');
  const [manualSessionDate, setManualSessionDate] = useState('22 Nov 2026');
  const [manualSessionSpeaker, setManualSessionSpeaker] = useState('');
  const [manualSessionTrack, setManualSessionTrack] = useState('Main Auditorium');
  const [manualCustomMessage, setManualCustomMessage] = useState('');
  const [manualAudienceType, setManualAudienceType] = useState('ALL'); // 'ALL' | 'CHECKED_IN' | 'TNMC' | 'NON_TNMC'
  const [submittingManualSchedule, setSubmittingManualSchedule] = useState(false);

  // Day filter & WATI Params & Preview State for Manual Schedule
  const [agendaDayFilter, setAgendaDayFilter] = useState('DAY_2'); // 'DAY_2' | 'DAY_1' | 'ALL'
  const [watiTemplates, setWatiTemplates] = useState([]);
  const [manualCustomParams, setManualCustomParams] = useState([]); // [{ key: '', value: '' }]
  const [sampleRecipientName, setSampleRecipientName] = useState('Dr. Karthikeyan Dev');

  // Modal: Edit Scheduled Campaign (before schedule started)
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [editCampaignName, setEditCampaignName] = useState('');
  const [editScheduledFor, setEditScheduledFor] = useState('');
  const [editTemplateId, setEditTemplateId] = useState('ciim2026_session_alert_5min');
  const [editSendWhatsApp, setEditSendWhatsApp] = useState(true);
  const [editSendEmail, setEditSendEmail] = useState(true);
  const [editSessionTitle, setEditSessionTitle] = useState('');
  const [editSessionTime, setEditSessionTime] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionSpeaker, setEditSessionSpeaker] = useState('');
  const [editSessionTrack, setEditSessionTrack] = useState('');
  const [editCustomMessage, setEditCustomMessage] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

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
  const [tab2TemplateId, setTab2TemplateId] = useState('ciim2026_session_alert_5min');
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
        // Default to first session of Day 2 as today is Day 2 (Nov 22)
        const day2First = list.find((s) => s.dayIndex === 1 || s.dayLabel?.includes('Day 2') || s.dayDate?.includes('22'));
        const initial = day2First || list[0];
        setSelectedSessionId(initial.id);
        setCustomSessionTitle(initial.title);
        setCustomSessionTime(`${initial.startTime} - ${initial.endTime}`);
        setCustomSessionDate(initial.dayDate || '22 Nov 2026');
        setCustomSessionSpeaker((initial.speakerNames || []).join(', '));
        setCustomSessionTrack(initial.track || 'Main Auditorium');
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
      setCustomSessionDate(chosen.dayDate || (chosen.dayIndex === 1 ? '22 Nov 2026' : '21 Nov 2026'));
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

  // Action: Schedule All Sessions for Selected Day
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
        text: res.message || `Scheduled ${res.count} sessions for Day ${scheduleAllDayIndex + 1}!`,
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

  // Helper to convert date to YYYY-MM-DDTHH:mm in local time for datetime-local input
  function toLocalDatetimeInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const offsetMs = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offsetMs);
    return local.toISOString().slice(0, 16);
  }

  // Load WATI config on mount
  useEffect(() => {
    whatsappMarketingApi
      .getConfig()
      .then((res) => {
        if (res?.data?.templates?.length) {
          setWatiTemplates(res.data.templates);
        }
      })
      .catch((err) => {
        console.warn('Could not load WATI marketing config:', err);
      });
  }, []);

  const allWatiTemplates = useMemo(() => {
    const list = [...(watiTemplates || [])];
    DEFAULT_WATI_TEMPLATES.forEach((def) => {
      if (!list.some((t) => t.id === def.id || t.name === def.name)) {
        list.push(def);
      }
    });
    return list;
  }, [watiTemplates]);

  const filteredAgendaSessions = useMemo(() => {
    if (agendaDayFilter === 'DAY_1') {
      return sessions.filter(
        (s) => s.dayIndex === 0 || s.dayLabel?.includes('Day 1') || s.dayDate?.includes('21')
      );
    }
    if (agendaDayFilter === 'DAY_2') {
      return sessions.filter(
        (s) => s.dayIndex === 1 || s.dayLabel?.includes('Day 2') || s.dayDate?.includes('22')
      );
    }
    return sessions;
  }, [sessions, agendaDayFilter]);

  const selectedWatiTemplate = useMemo(() => {
    return (
      allWatiTemplates.find((t) => t.id === manualTemplateId || t.name === manualTemplateId) ||
      allWatiTemplates[0] ||
      DEFAULT_WATI_TEMPLATES[0]
    );
  }, [allWatiTemplates, manualTemplateId]);

  function formatWhatsAppPreview(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
    escaped = escaped.replace(/~([^~]+)~/g, '<del>$1</del>');
    escaped = escaped.replace(/\n/g, '<br />');
    return escaped;
  }

  const previewFormattedText = useMemo(() => {
    const rawBody =
      selectedWatiTemplate?.body ||
      `*CIIM 2026 – Session Alert*\n\nDear Dr. {{1}},\n\nThe following scientific session will commence in 5 minutes:\n\nSession: {{2}}\nSpeaker: {{3}}\nHall: {{4}}\n\nPlease take your seat in the auditorium.\n\nRegards,\nOrganising Committee - CIIM 2026`;

    const isTwoParamTemplate =
      manualTemplateId === 'ciim2026_day_session_alert' ||
      selectedWatiTemplate?.id === 'ciim2026_day_session_alert' ||
      (selectedWatiTemplate?.params?.length === 2 && !selectedWatiTemplate?.params?.includes('3'));

    const paramMap = isTwoParamTemplate
      ? {
          '1': manualSessionTitle || '[Session Name]',
          '2': manualSessionSpeaker || '[Faculty / Speaker Name]',
          'session_name': manualSessionTitle || '[Session Name]',
          'faculty_name': manualSessionSpeaker || '[Faculty / Speaker Name]',
          'Session': manualSessionTitle || '[Session Name]',
          'Faculty': manualSessionSpeaker || '[Faculty / Speaker Name]',
          'Speaker': manualSessionSpeaker || '[Faculty / Speaker Name]',
        }
      : {
          '1': sampleRecipientName || 'Dr. Karthikeyan Dev',
          'Name': sampleRecipientName || 'Dr. Karthikeyan Dev',
          'DrName': sampleRecipientName || 'Dr. Karthikeyan Dev',
          '2': manualSessionTitle || '[Session Title]',
          'Session': manualSessionTitle || '[Session Title]',
          '3': manualSessionSpeaker || '[Speaker Name]',
          'Speaker': manualSessionSpeaker || '[Speaker Name]',
          '4': manualSessionTrack || '[Hall Name]',
          'Hall': manualSessionTrack || '[Hall Name]',
          'Time': manualSessionTime || '[Time Slot]',
          'Date': manualSessionDate || '[22 Nov 2026]',
        };

    manualCustomParams.forEach((cp) => {
      if (cp.key && cp.key.trim()) {
        paramMap[cp.key.trim()] = cp.value || `[${cp.key.trim()}]`;
      }
    });

    let rendered = rawBody;
    Object.entries(paramMap).forEach(([k, v]) => {
      const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
      rendered = rendered.replace(re, v);
    });

    return rendered;
  }, [
    selectedWatiTemplate,
    sampleRecipientName,
    manualSessionTitle,
    manualSessionSpeaker,
    manualSessionTrack,
    manualSessionTime,
    manualSessionDate,
    manualCustomParams,
  ]);

  // Handle Session Select from dropdown in Manual Setup
  const handleAgendaSessionSelect = (sessionId) => {
    const sel = sessions.find((s) => s.id === sessionId);
    if (!sel) return;

    setManualCampaignName(`Session Alert: ${sel.title}`);
    setManualSessionTitle(sel.title);
    setManualSessionTime(`${sel.startTime} - ${sel.endTime}`);
    setManualSessionDate(sel.dayDate || '22 Nov 2026');
    setManualSessionSpeaker((sel.speakerNames || []).join(', '));
    setManualSessionTrack(sel.track || 'Main Auditorium');

    if (sel.startTime) {
      const isDay1 = sel.dayIndex === 0 || sel.dayDate?.includes('21');
      const datePart = isDay1 ? '2026-11-21' : '2026-11-22';
      const [hStr, mStr] = sel.startTime.split(':');
      let h = parseInt(hStr, 10);
      let m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        m -= 5;
        if (m < 0) {
          m += 60;
          h -= 1;
        }
        const timeStr = `${String(Math.max(0, h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setManualScheduledFor(`${datePart}T${timeStr}`);
      }
    }
  };

  // Open Bulk Schedule All Sessions Modal with day selection
  function openScheduleAllModal(dayIdx = 1) {
    setScheduleAllDayIndex(dayIdx);
    setScheduleAllTargetDate(dayIdx === 1 ? '2026-11-22' : '2026-11-21');
    setShowScheduleAllModal(true);
  }

  const scheduleAllSessionsList = useMemo(() => {
    return sessions.filter((s) => {
      if (s.type === 'break' || s.title?.toLowerCase().includes('break')) return false;
      if (scheduleAllDayIndex === 0) {
        return s.dayIndex === 0 || s.dayLabel?.includes('Day 1') || s.dayDate?.includes('21');
      }
      return s.dayIndex === 1 || s.dayLabel?.includes('Day 2') || s.dayDate?.includes('22');
    });
  }, [sessions, scheduleAllDayIndex]);

  const day1SessionCount = useMemo(() => {
    return sessions.filter((s) => {
      if (s.type === 'break' || s.title?.toLowerCase().includes('break')) return false;
      return s.dayIndex === 0 || s.dayLabel?.includes('Day 1') || s.dayDate?.includes('21');
    }).length;
  }, [sessions]);

  const day2SessionCount = useMemo(() => {
    return sessions.filter((s) => {
      if (s.type === 'break' || s.title?.toLowerCase().includes('break')) return false;
      return s.dayIndex === 1 || s.dayLabel?.includes('Day 2') || s.dayDate?.includes('22');
    }).length;
  }, [sessions]);

  const tab2FilteredSessions = useMemo(() => {
    if (tab2DayFilter === 'DAY_1') {
      return sessions.filter(
        (s) => s.dayIndex === 0 || s.dayLabel?.includes('Day 1') || s.dayDate?.includes('21')
      );
    }
    if (tab2DayFilter === 'DAY_2') {
      return sessions.filter(
        (s) => s.dayIndex === 1 || s.dayLabel?.includes('Day 2') || s.dayDate?.includes('22')
      );
    }
    return sessions;
  }, [sessions, tab2DayFilter]);

  function computeDispatchPreview(startTime, targetDate, leadMinutes) {
    if (!startTime) return '';
    try {
      const [hh, mm] = startTime.split(':').map((v) => parseInt(v, 10) || 0);
      const dateObj = new Date(`${targetDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
      if (isNaN(dateObj.getTime())) return startTime;
      const dispatchTime = new Date(dateObj.getTime() - leadMinutes * 60 * 1000);
      return dispatchTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return startTime;
    }
  }

  // Open Manual Schedule Setup Modal with sensible defaults
  function handleOpenManualScheduleModal() {
    setAgendaDayFilter('DAY_2');
    const day2Sessions = sessions.filter(
      (s) => s.dayIndex === 1 || s.dayLabel?.includes('Day 2') || s.dayDate?.includes('22')
    );
    const defaultSession = day2Sessions[0] || sessions[0];

    let scheduledIsoLocal = '';
    if (defaultSession?.startTime) {
      const isDay1 = defaultSession.dayIndex === 0 || defaultSession.dayDate?.includes('21');
      const datePart = isDay1 ? '2026-11-21' : '2026-11-22';
      const [hStr, mStr] = defaultSession.startTime.split(':');
      let h = parseInt(hStr, 10);
      let m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        m -= 5;
        if (m < 0) {
          m += 60;
          h -= 1;
        }
        scheduledIsoLocal = `${datePart}T${String(Math.max(0, h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    if (!scheduledIsoLocal) {
      const nextHalfHour = new Date(Date.now() + 15 * 60 * 1000);
      scheduledIsoLocal = toLocalDatetimeInput(nextHalfHour);
    }

    setManualScheduledFor(scheduledIsoLocal);
    setManualCampaignName(defaultSession ? `Session Alert: ${defaultSession.title}` : 'Session Alert Broadcast');
    setManualSessionTitle(defaultSession?.title || 'Adjuvants in Improving Fertility');
    setManualSessionTime(defaultSession ? `${defaultSession.startTime} - ${defaultSession.endTime}` : '08:30 - 08:40 AM');
    setManualSessionDate(defaultSession?.dayDate || '22 Nov 2026');
    setManualSessionSpeaker((defaultSession?.speakerNames || []).join(', '));
    setManualSessionTrack(defaultSession?.track || 'Main Auditorium');
    setManualCustomMessage('');
    setManualAudienceType('ALL');
    setManualTemplateId('ciim2026_session_alert_5min');
    setManualCustomParams([]);
    setShowManualScheduleModal(true);
  }

  // Submit Manual Schedule Setup
  async function handleManualScheduleSubmit(e) {
    e.preventDefault();
    const channels = [];
    if (manualSendWhatsApp) channels.push('whatsapp');
    if (manualSendEmail) channels.push('email');
    if (!channels.length) {
      alert('Please select at least one channel (WhatsApp or Email).');
      return;
    }

    if (!manualScheduledFor) {
      alert('Please select a scheduled date and time.');
      return;
    }

    // Filter recipients based on audience choice
    let targetRecipients = recipients;
    if (manualAudienceType === 'CHECKED_IN') {
      targetRecipients = recipients.filter((r) => r.isCheckedIn || r.checkedInAt);
    } else if (manualAudienceType === 'TNMC') {
      targetRecipients = recipients.filter((r) => Boolean(r.tnmcNumber && r.tnmcNumber.trim()));
    } else if (manualAudienceType === 'NON_TNMC') {
      targetRecipients = recipients.filter((r) => !r.tnmcNumber || !r.tnmcNumber.trim());
    }

    if (!targetRecipients.length) {
      alert('No recipients matched the selected audience filter.');
      return;
    }

    // Build custom params object
    const customParamsObj = {};
    manualCustomParams.forEach((cp) => {
      if (cp.key && cp.key.trim()) {
        customParamsObj[cp.key.trim()] = cp.value || '';
      }
    });

    setSubmittingManualSchedule(true);
    try {
      const payload = {
        tab: 'session_approve',
        campaignName: manualCampaignName.trim() || `Scheduled: ${manualSessionTitle || 'Session'}`,
        templateId: manualTemplateId.trim(),
        channels,
        scheduleMode: 'scheduled',
        scheduledFor: new Date(manualScheduledFor).toISOString(),
        sessionDetails: {
          sessionTitle: manualSessionTitle.trim(),
          sessionTime: manualSessionTime.trim(),
          sessionDate: manualSessionDate.trim(),
          speakerNames: manualSessionSpeaker ? manualSessionSpeaker.split(',').map((s) => s.trim()).filter(Boolean) : [],
          track: manualSessionTrack.trim(),
        },
        whatsappOptions: {
          templateName: manualTemplateId.trim(),
          customParams: Object.keys(customParamsObj).length > 0 ? customParamsObj : undefined,
        },
        emailOptions: {
          subject: `CIIM 2026: Schedule Details for ${manualSessionTitle || manualCampaignName}`,
          customMessage: manualCustomMessage.trim(),
        },
        recipients: targetRecipients,
      };

      const res = await marketingCampaignApi.sendCampaign(payload);
      setFeedback({
        type: 'success',
        text: res.message || 'Campaign scheduled successfully!',
      });
      setShowManualScheduleModal(false);
      setActiveTab('live_monitor');
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to schedule campaign.');
    } finally {
      setSubmittingManualSchedule(false);
    }
  }

  // Open Edit Scheduled Campaign Modal (only allowed before campaign starts)
  function handleOpenEditModal(sc) {
    setEditingCampaign(sc);
    setEditCampaignName(sc.campaignName || '');
    setEditScheduledFor(toLocalDatetimeInput(sc.scheduledFor));
    setEditTemplateId(sc.templateId || 'ciim2026_session_alert_5min');
    setEditSendWhatsApp((sc.channels || []).includes('whatsapp'));
    setEditSendEmail((sc.channels || []).includes('email'));
    setEditSessionTitle(sc.sessionDetails?.sessionTitle || '');
    setEditSessionTime(sc.sessionDetails?.sessionTime || '');
    setEditSessionDate(sc.sessionDetails?.sessionDate || '');
    setEditSessionSpeaker((sc.sessionDetails?.speakerNames || []).join(', '));
    setEditSessionTrack(sc.sessionDetails?.track || 'Main Auditorium');
    setEditCustomMessage(sc.emailOptions?.customMessage || '');
  }

  // Save changes to an existing scheduled campaign
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingCampaign) return;

    const channels = [];
    if (editSendWhatsApp) channels.push('whatsapp');
    if (editSendEmail) channels.push('email');
    if (!channels.length) {
      alert('Please select at least one channel (WhatsApp or Email).');
      return;
    }

    if (!editScheduledFor) {
      alert('Please enter a valid schedule date and time.');
      return;
    }

    setSubmittingEdit(true);
    try {
      const payload = {
        campaignName: editCampaignName.trim(),
        scheduledFor: new Date(editScheduledFor).toISOString(),
        channels,
        templateId: editTemplateId.trim(),
        sessionDetails: {
          sessionTitle: editSessionTitle.trim(),
          sessionTime: editSessionTime.trim(),
          sessionDate: editSessionDate.trim(),
          speakerNames: editSessionSpeaker ? editSessionSpeaker.split(',').map((s) => s.trim()).filter(Boolean) : [],
          track: editSessionTrack.trim(),
        },
        emailOptions: {
          subject: `CIIM 2026: ${editSessionTitle || editCampaignName}`,
          customMessage: editCustomMessage.trim(),
        },
        whatsappOptions: {
          templateName: editTemplateId.trim(),
        },
        customMessage: editCustomMessage.trim(),
      };

      const res = await marketingCampaignApi.updateCampaign(editingCampaign._id, payload);
      setFeedback({
        type: 'success',
        text: res.message || 'Scheduled campaign updated successfully!',
      });
      setEditingCampaign(null);
      fetchLiveMonitor();
    } catch (err) {
      alert(err.message || 'Failed to update scheduled campaign.');
    } finally {
      setSubmittingEdit(false);
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

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="wem-btn-schedule-all"
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#047857',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                }}
                onClick={handleOpenManualScheduleModal}
              >
                <span>➕</span>
                <span>Manual Schedule Setup</span>
              </button>
              <button
                type="button"
                className="wem-btn-schedule-all"
                style={{
                  background: 'linear-gradient(135deg, #eb3f67 0%, #d4af37 100%)',
                  boxShadow: '0 4px 16px rgba(235, 63, 103, 0.4)',
                }}
                onClick={() => openScheduleAllModal(1)}
                title="Schedule all sessions for Day 2 (Sunday, 22 Nov - Today)"
              >
                <span>📅</span>
                <span>Schedule Day 2 Sessions (Today)</span>
              </button>
              <button
                type="button"
                className="wem-btn-schedule-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  boxShadow: 'none',
                }}
                onClick={() => openScheduleAllModal(0)}
                title="Schedule sessions for Day 1 (Saturday, 21 Nov)"
              >
                <span>📅</span>
                <span>Schedule Day 1 Sessions</span>
              </button>
            </div>
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
                          <span style={{ color: '#166534', fontWeight: 600 }}>
                            Sent: {job.sentCount}
                            {(job.whatsappSentCount > 0 || job.emailSentCount > 0) && (
                              <small style={{ fontWeight: 'normal', color: 'var(--ink-500)', marginLeft: '6px' }}>
                                (WA: {job.whatsappSentCount || 0}, Email: {job.emailSentCount || 0})
                              </small>
                            )}
                            {' '}|{' '}
                            <span style={{ color: job.failedCount > 0 ? '#b91c1c' : 'inherit' }}>
                              Failed: {job.failedCount}
                            </span>
                          </span>
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
                                  {log.whatsappStatus === 'SENT' && (
                                    <span style={{ color: '#16a34a', marginRight: '6px', fontWeight: 700 }} title="WhatsApp Delivered">
                                      [WA ✓]
                                    </span>
                                  )}
                                  {log.whatsappStatus === 'FAILED' && (
                                    <span
                                      style={{ color: '#dc2626', marginRight: '6px', fontWeight: 700, fontSize: '0.75rem' }}
                                      title={`WhatsApp Failed: ${log.whatsappError || 'Error'}`}
                                    >
                                      [WA ✗]
                                    </span>
                                  )}
                                  {log.emailStatus === 'SENT' && (
                                    <span style={{ color: '#2563eb', marginRight: '6px', fontWeight: 700 }} title="Email Delivered">
                                      [Email ✓]
                                    </span>
                                  )}
                                  {log.emailStatus === 'FAILED' && (
                                    <span
                                      style={{ color: '#dc2626', marginRight: '6px', fontWeight: 700, fontSize: '0.75rem' }}
                                      title={`Email Failed: ${log.emailError || 'Error'}`}
                                    >
                                      [Email ✗]
                                    </span>
                                  )}
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Button size="sm" variant="secondary" onClick={() => openScheduleAllModal(1)}>
                      📅 Schedule Day 2
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => fetchLiveMonitor()}>
                      ↻ Refresh
                    </Button>
                  </div>
                </div>

                {!liveData.scheduledCampaigns || liveData.scheduledCampaigns.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink-500)' }}>
                    <p style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>📅</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>No sessions scheduled in queue.</p>
                    <p style={{ margin: '6px 0 16px 0', fontSize: '0.84rem' }}>
                      Set up custom schedules manually with specific date &amp; time inputs, or schedule all sessions automatically!
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Button
                        variant="primary"
                        onClick={handleOpenManualScheduleModal}
                        style={{ backgroundColor: '#059669', borderColor: '#047857' }}
                      >
                        ➕ Manual Schedule Setup
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => openScheduleAllModal(1)}
                        style={{ background: 'linear-gradient(135deg, #eb3f67 0%, #d4af37 100%)', border: 'none', color: '#fff' }}
                      >
                        📅 Schedule Day 2 Sessions (Today)
                      </Button>
                      <Button variant="secondary" onClick={() => openScheduleAllModal(0)}>
                        Schedule Day 1 Sessions
                      </Button>
                    </div>
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
                              {sc.scheduledFor ? new Date(sc.scheduledFor).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
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
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleLaunchScheduledNow(sc._id, sc.campaignName)}
                            >
                              ⚡ Launch Now
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleOpenEditModal(sc)}
                              style={{
                                backgroundColor: '#f0fdf4',
                                borderColor: '#86efac',
                                color: '#166534',
                                fontWeight: 700,
                              }}
                              title="Edit scheduled time, inputs, and message before it starts"
                            >
                              ✏️ Edit
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
                      placeholder="e.g. ciim2026_session_alert_5min"
                      required
                    />
                    <span className="wem-field__hint">
                      Preset to <code>ciim2026_session_alert_5min</code> (Meta approved utility template for 5-minute session alerts).
                    </span>
                  </div>
                )}

                {/* Tab 2 Specific: Session Picker from Agenda */}
                {activeTab === 'session_approve' && (
                  <>
                    <div className="wem-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <label className="wem-field__label" htmlFor="session-picker" style={{ margin: 0 }}>
                          Choose Session from Agenda ({tab2FilteredSessions.length} sessions)
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className={`wem-chip${tab2DayFilter === 'DAY_2' ? ' is-active' : ''}`}
                            onClick={() => setTab2DayFilter('DAY_2')}
                            style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                          >
                            🌟 Day 2 (Today)
                          </button>
                          <button
                            type="button"
                            className={`wem-chip${tab2DayFilter === 'DAY_1' ? ' is-active' : ''}`}
                            onClick={() => setTab2DayFilter('DAY_1')}
                            style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                          >
                            Day 1 (21 Nov)
                          </button>
                          <button
                            type="button"
                            className={`wem-chip${tab2DayFilter === 'ALL' ? ' is-active' : ''}`}
                            onClick={() => setTab2DayFilter('ALL')}
                            style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                          >
                            All
                          </button>
                        </div>
                      </div>
                      <select
                        id="session-picker"
                        className="wem-field__select"
                        value={selectedSessionId}
                        onChange={handleSessionSelect}
                      >
                        {tab2FilteredSessions.map((s) => (
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
          MODAL: BULK SCHEDULE ALL SESSIONS (DAY 1 / DAY 2 TIMED SCHEDULER)
         ========================================================================= */}
      {showScheduleAllModal && (
        <div className="wem-modal-overlay" onClick={() => setShowScheduleAllModal(false)}>
          <div className="wem-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="wem-modal-header">
              <div>
                <h3 className="wem-modal-title">
                  📅 Bulk Schedule Sessions — {scheduleAllDayIndex === 1 ? 'Day 2 (Today, 22 Nov)' : 'Day 1 (21 Nov)'}
                </h3>
                <p className="wem-modal-sub">
                  Automatically calculate start times and schedule timed WhatsApp &amp; Email reminders for all scientific sessions of{' '}
                  <strong>{scheduleAllDayIndex === 1 ? 'Day 2 (Today)' : 'Day 1'}</strong>.
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
              {/* Day Selection Segmented Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleAllDayIndex(1);
                    setScheduleAllTargetDate('2026-11-22');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: scheduleAllDayIndex === 1 ? '2px solid #eb3f67' : '1px solid #cbd5e1',
                    backgroundColor: scheduleAllDayIndex === 1 ? '#fff1f2' : '#ffffff',
                    color: scheduleAllDayIndex === 1 ? '#be123c' : '#475569',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: scheduleAllDayIndex === 1 ? '0 2px 8px rgba(235, 63, 103, 0.15)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🌟</span>
                    <span>Day 2 — Sunday, 22 Nov (Today)</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: scheduleAllDayIndex === 1 ? '#9f1239' : '#64748b', marginTop: '3px' }}>
                    Andrology &amp; ART • {day2SessionCount} Sessions
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleAllDayIndex(0);
                    setScheduleAllTargetDate('2026-11-21');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: scheduleAllDayIndex === 0 ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    backgroundColor: scheduleAllDayIndex === 0 ? '#eff6ff' : '#ffffff',
                    color: scheduleAllDayIndex === 0 ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: scheduleAllDayIndex === 0 ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅</span>
                    <span>Day 1 — Saturday, 21 Nov</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: scheduleAllDayIndex === 0 ? '#1e40af' : '#64748b', marginTop: '3px' }}>
                    Infertility • {day1SessionCount} Sessions
                  </div>
                </button>
              </div>

              {/* Target Date & Lead Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

                <div className="wem-field">
                  <label className="wem-field__label">Dispatch Timing Offset</label>
                  <select
                    className="wem-field__select"
                    value={scheduleAllLeadTime}
                    onChange={(e) => setScheduleAllLeadTime(parseInt(e.target.value, 10))}
                  >
                    <option value={5}>5 Minutes Before Each Session (Recommended)</option>
                    <option value={10}>10 Minutes Before Each Session</option>
                    <option value={15}>15 Minutes Before Each Session</option>
                    <option value={30}>30 Minutes Before Each Session</option>
                    <option value={0}>At Exact Session Start Time</option>
                  </select>
                </div>
              </div>

              {/* Delivery Channels */}
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
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <select
                    className="wem-field__select"
                    value={scheduleAllTemplateId}
                    onChange={(e) => setScheduleAllTemplateId(e.target.value)}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  >
                    <option value="ciim2026_day_session_alert">
                      ciim2026_day_session_alert (2 Params: Session & Faculty)
                    </option>
                    <option value="ciim2026_session_alert_5min">
                      ciim2026_session_alert_5min (4 Params: Name, Session, Speaker, Hall)
                    </option>
                  </select>
                </div>
                <input
                  type="text"
                  className="wem-field__input"
                  value={scheduleAllTemplateId}
                  onChange={(e) => setScheduleAllTemplateId(e.target.value)}
                  placeholder="e.g. ciim2026_day_session_alert"
                  required
                />
                <span className="wem-field__hint">
                  Selected template: <code>{scheduleAllTemplateId}</code>
                </span>
              </div>

              {/* Live Preview List of Sessions to be Scheduled */}
              <div className="wem-field" style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="wem-field__label" style={{ margin: 0 }}>
                    📋 Scientific Sessions to Queue ({scheduleAllSessionsList.length} Sessions)
                  </label>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Offset: {scheduleAllLeadTime} mins before start
                  </span>
                </div>
                <div
                  style={{
                    maxHeight: '170px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {scheduleAllSessionsList.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                      No scientific sessions found for this day.
                    </div>
                  ) : (
                    scheduleAllSessionsList.map((s, idx) => {
                      const dispatchTime = computeDispatchPreview(s.startTime, scheduleAllTargetDate, scheduleAllLeadTime);
                      return (
                        <div
                          key={s.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #f1f5f9',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', minWidth: '85px' }}>
                              [{s.startTime} - {s.endTime}]
                            </span>
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#334155' }}>
                              {s.title}
                            </span>
                          </div>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#ecfdf5',
                              color: '#065f46',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              whiteSpace: 'nowrap',
                              marginLeft: '8px',
                            }}
                          >
                            ⏰ Dispatch: {dispatchTime}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="wem-notice is-info" style={{ marginTop: '12px' }}>
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
                <Button
                  variant="primary"
                  type="submit"
                  disabled={submittingScheduleAll || scheduleAllSessionsList.length === 0}
                  style={{
                    background: scheduleAllDayIndex === 1 ? 'linear-gradient(135deg, #eb3f67 0%, #d4af37 100%)' : '#2563eb',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  {submittingScheduleAll
                    ? 'Scheduling Sessions…'
                    : `🚀 Confirm & Schedule All ${scheduleAllSessionsList.length} Sessions for Day ${scheduleAllDayIndex + 1}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual Schedule Setup with 2-Column Live WATI Preview */}
      {showManualScheduleModal && (
        <div className="wem-modal-overlay" onClick={() => setShowManualScheduleModal(false)}>
          <div
            className="wem-modal-dialog wem-modal-dialog--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wem-modal-header">
              <div>
                <h3 className="wem-modal-title">📅 Manual Schedule Setup &amp; Live WATI Preview</h3>
                <p className="wem-modal-sub">
                  Select Day 2 agenda session, customize WATI template parameters, and preview the live message before broadcast.
                </p>
              </div>
              <button
                type="button"
                className="wem-modal-close"
                onClick={() => setShowManualScheduleModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--ink-500)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualScheduleSubmit}>
              <div className="wem-modal-grid-2col">
                {/* Left Column: Schedule & WATI Configuration */}
                <div className="wem-form-col">
                  {/* Quick Pre-fill from Agenda with Day 2 filter */}
                  {sessions.length > 0 && (
                    <div className="wem-field">
                      <label className="wem-field__label">Quick Pre-fill from Event Agenda</label>

                      {/* Day 1 vs Day 2 Filter Chips */}
                      <div className="wem-agenda-day-tabs">
                        <button
                          type="button"
                          className={`wem-agenda-day-tab${agendaDayFilter === 'DAY_2' ? ' is-active' : ''}`}
                          onClick={() => setAgendaDayFilter('DAY_2')}
                        >
                          🌟 Day 2 (Today — 22 Nov)
                        </button>
                        <button
                          type="button"
                          className={`wem-agenda-day-tab${agendaDayFilter === 'DAY_1' ? ' is-active' : ''}`}
                          onClick={() => setAgendaDayFilter('DAY_1')}
                        >
                          Day 1 (21 Nov)
                        </button>
                        <button
                          type="button"
                          className={`wem-agenda-day-tab${agendaDayFilter === 'ALL' ? ' is-active' : ''}`}
                          onClick={() => setAgendaDayFilter('ALL')}
                        >
                          All Sessions ({sessions.length})
                        </button>
                      </div>

                      <select
                        className="wem-field__select"
                        onChange={(e) => handleAgendaSessionSelect(e.target.value)}
                        defaultValue=""
                      >
                        <option value="">
                          -- Choose {agendaDayFilter === 'DAY_2' ? 'Day 2' : (agendaDayFilter === 'DAY_1' ? 'Day 1' : '')} session to pre-fill --
                        </option>
                        {filteredAgendaSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.startTime} - {s.endTime} | {s.title} ({s.track || 'Main Auditorium'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Campaign Name */}
                  <div className="wem-field">
                    <label className="wem-field__label">Campaign / Session Alert Name</label>
                    <input
                      type="text"
                      className="wem-field__input"
                      value={manualCampaignName}
                      onChange={(e) => setManualCampaignName(e.target.value)}
                      placeholder="e.g. Session Alert: Advancements in IVF Lab"
                      required
                    />
                  </div>

                  {/* Scheduled Date and Time */}
                  <div className="wem-field">
                    <label className="wem-field__label">Scheduled Date &amp; Time (Local IST)</label>
                    <input
                      type="datetime-local"
                      className="wem-field__input"
                      value={manualScheduledFor}
                      onChange={(e) => setManualScheduledFor(e.target.value)}
                      required
                    />
                    <span className="wem-field__hint">
                      Runner will dispatch when this time is reached. Auto-calculated to 5 mins before session start.
                    </span>
                  </div>

                  {/* Delivery Channels */}
                  <div className="wem-field">
                    <span className="wem-field__label">Delivery Channels</span>
                    <div className="wem-channels">
                      <label
                        className={`wem-channel-box${manualSendWhatsApp ? ' is-checked' : ''}`}
                        onClick={() => setManualSendWhatsApp(!manualSendWhatsApp)}
                      >
                        <input
                          type="checkbox"
                          checked={manualSendWhatsApp}
                          onChange={() => {}}
                        />
                        <div className="wem-channel-box__text">
                          <span className="wem-channel-box__name">WhatsApp</span>
                          <span className="wem-channel-box__sub">WATI Template</span>
                        </div>
                      </label>

                      <label
                        className={`wem-channel-box${manualSendEmail ? ' is-checked' : ''}`}
                        onClick={() => setManualSendEmail(!manualSendEmail)}
                      >
                        <input
                          type="checkbox"
                          checked={manualSendEmail}
                          onChange={() => {}}
                        />
                        <div className="wem-channel-box__text">
                          <span className="wem-channel-box__name">Email</span>
                          <span className="wem-channel-box__sub">HTML Mailer</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Audience Selector */}
                  <div className="wem-field">
                    <label className="wem-field__label">Audience Target</label>
                    <select
                      className="wem-field__select"
                      value={manualAudienceType}
                      onChange={(e) => setManualAudienceType(e.target.value)}
                    >
                      <option value="ALL">All Registered Delegates ({recipients.length})</option>
                      <option value="CHECKED_IN">
                        Checked-In Only ({recipients.filter((r) => r.isCheckedIn || r.checkedInAt).length})
                      </option>
                      <option value="TNMC">
                        TNMC Registered Doctors ({recipients.filter((r) => r.tnmcNumber && r.tnmcNumber.trim()).length})
                      </option>
                      <option value="NON_TNMC">
                        Non-TNMC Delegates ({recipients.filter((r) => !r.tnmcNumber || !r.tnmcNumber.trim()).length})
                      </option>
                    </select>
                  </div>

                  {/* Session Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="wem-field" style={{ gridColumn: 'span 2' }}>
                      <label className="wem-field__label">Session Title</label>
                      <input
                        type="text"
                        className="wem-field__input"
                        value={manualSessionTitle}
                        onChange={(e) => setManualSessionTitle(e.target.value)}
                        placeholder="e.g. Advancements in IVF Lab"
                        required
                      />
                    </div>
                    <div className="wem-field">
                      <label className="wem-field__label">Time Slot</label>
                      <input
                        type="text"
                        className="wem-field__input"
                        value={manualSessionTime}
                        onChange={(e) => setManualSessionTime(e.target.value)}
                        placeholder="e.g. 08:40 - 08:50 AM"
                        required
                      />
                    </div>
                    <div className="wem-field">
                      <label className="wem-field__label">Date</label>
                      <input
                        type="text"
                        className="wem-field__input"
                        value={manualSessionDate}
                        onChange={(e) => setManualSessionDate(e.target.value)}
                        placeholder="e.g. 22 Nov 2026"
                        required
                      />
                    </div>
                    <div className="wem-field">
                      <label className="wem-field__label">Speaker Name(s)</label>
                      <input
                        type="text"
                        className="wem-field__input"
                        value={manualSessionSpeaker}
                        onChange={(e) => setManualSessionSpeaker(e.target.value)}
                        placeholder="e.g. Dr. K. Prasath, Dr. V. Jayaraman"
                      />
                    </div>
                    <div className="wem-field">
                      <label className="wem-field__label">Hall / Track</label>
                      <input
                        type="text"
                        className="wem-field__input"
                        value={manualSessionTrack}
                        onChange={(e) => setManualSessionTrack(e.target.value)}
                        placeholder="e.g. Main Auditorium"
                      />
                    </div>
                  </div>

                  {/* WATI Template Selection & Parameters */}
                  {manualSendWhatsApp && (
                    <div className="wem-field">
                      <label className="wem-field__label">WATI WhatsApp Template</label>
                      <select
                        className="wem-field__select"
                        value={manualTemplateId}
                        onChange={(e) => setManualTemplateId(e.target.value)}
                      >
                        {allWatiTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label || t.name} ({t.id})
                          </option>
                        ))}
                      </select>

                      {/* WATI Template Parameters Editor */}
                      <div className="wem-params-box" style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4c1d95', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>⚙️ WATI Template Parameters</span>
                          <span style={{ fontSize: '0.74rem', color: '#7c3aed', fontWeight: 600 }}>
                            {selectedWatiTemplate?.params?.length || 4} Parameters Mapped
                          </span>
                        </div>

                        {/* 2 Params for ciim2026_day_session_alert */}
                        {manualTemplateId === 'ciim2026_day_session_alert' ? (
                          <>
                            <div className="wem-param-row">
                              <span className="wem-param-label">Param 1 (Session Name):</span>
                              <input
                                type="text"
                                className="wem-field__input"
                                value={manualSessionTitle}
                                onChange={(e) => setManualSessionTitle(e.target.value)}
                                placeholder="e.g. Ovulation Induction Protocols"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                            <div className="wem-param-row">
                              <span className="wem-param-label">Param 2 (Faculty Name):</span>
                              <input
                                type="text"
                                className="wem-field__input"
                                value={manualSessionSpeaker}
                                onChange={(e) => setManualSessionSpeaker(e.target.value)}
                                placeholder="e.g. Dr. Geetha Haripriya"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                          </>
                        ) : manualTemplateId === 'ciim2026_session_alert_5min' ? (
                          <>
                            <div className="wem-param-row">
                              <span className="wem-param-label">Param 1 (Name):</span>
                              <input
                                type="text"
                                className="wem-field__input"
                                value="[Recipient Name (Dr. ...)]"
                                disabled
                                style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.85rem' }}
                              />
                            </div>
                            <div className="wem-param-row">
                              <span className="wem-param-label">Param 2 (Session):</span>
                              <input
                                type="text"
                                className="wem-field__input"
                                value={manualSessionTitle}
                                onChange={(e) => setManualSessionTitle(e.target.value)}
                                placeholder="Session Name"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                            <div className="wem-param-row">
                              <span className="wem-param-label">Param 3 (Speaker):</span>
                              <input
                                type="text"
                                className="wem-field__input"
                                value={manualSessionSpeaker}
                                onChange={(e) => setManualSessionSpeaker(e.target.value)}
                                placeholder="Speaker Name"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                            <div className="wem-param-row">
                              <span className="wem-param-label">Param 4 (Hall):</span>
                              <input
                                type="text"
                                className="wem-field__input"
                                value={manualSessionTrack}
                                onChange={(e) => setManualSessionTrack(e.target.value)}
                                placeholder="Main Auditorium"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {selectedWatiTemplate?.params?.map((pName, idx) => (
                              <div key={pName} className="wem-param-row">
                                <span className="wem-param-label">Param {idx + 1} ({pName}):</span>
                                <input
                                  type="text"
                                  className="wem-field__input"
                                  placeholder={`Value for ${pName}`}
                                  value={
                                    ['name', '1', 'drname'].includes(pName.toLowerCase())
                                      ? '[Recipient Name]'
                                      : (manualCustomParams.find((cp) => cp.key === pName)?.value ?? '')
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setManualCustomParams((prev) => {
                                      const next = prev.filter((cp) => cp.key !== pName);
                                      next.push({ key: pName, value: val });
                                      return next;
                                    });
                                  }}
                                  disabled={['name', '1', 'drname'].includes(pName.toLowerCase())}
                                  style={{
                                    backgroundColor: ['name', '1', 'drname'].includes(pName.toLowerCase()) ? '#f1f5f9' : '#ffffff',
                                    fontSize: '0.85rem',
                                  }}
                                />
                              </div>
                            ))}
                          </>
                        )}

                        {/* Extra Custom Parameters */}
                        {manualCustomParams.filter(cp => !selectedWatiTemplate?.params?.includes(cp.key)).map((cp, idx) => (
                          <div key={idx} className="wem-param-row">
                            <input
                              type="text"
                              className="wem-field__input"
                              placeholder="Param Key"
                              value={cp.key}
                              onChange={(e) => {
                                const newKey = e.target.value;
                                setManualCustomParams((prev) => {
                                  const copy = [...prev];
                                  copy[idx].key = newKey;
                                  return copy;
                                });
                              }}
                              style={{ fontSize: '0.82rem' }}
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                className="wem-field__input"
                                placeholder="Param Value"
                                value={cp.value}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setManualCustomParams((prev) => {
                                    const copy = [...prev];
                                    copy[idx].value = newVal;
                                    return copy;
                                  });
                                }}
                                style={{ fontSize: '0.82rem', flex: 1 }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  setManualCustomParams((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                style={{ color: '#ef4444' }}
                              >
                                ✕
                              </Button>
                            </div>
                          </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() => {
                              setManualCustomParams((prev) => [...prev, { key: '', value: '' }]);
                            }}
                            style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                          >
                            ➕ Add Custom Param
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Optional Custom Note / Email Message */}
                  {manualSendEmail && (
                    <div className="wem-field">
                      <label className="wem-field__label">Optional Announcement / Email Note</label>
                      <textarea
                        className="wem-field__textarea"
                        value={manualCustomMessage}
                        onChange={(e) => setManualCustomMessage(e.target.value)}
                        rows={2}
                        placeholder="Add special instructions or note for the HTML mailer..."
                      />
                    </div>
                  )}
                </div>

                {/* Right Column: Live WATI Template WhatsApp Preview */}
                <div className="wem-preview-col">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#381b4e' }}>
                      💬 Live WhatsApp Message Preview
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#059669',
                        backgroundColor: '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      WATI Approved
                    </span>
                  </div>

                  {/* Realistic WhatsApp Phone Mockup */}
                  <div className="wem-wa-phone">
                    <div className="wem-wa-header">
                      <div className="wem-wa-avatar">🩺</div>
                      <div className="wem-wa-header-info">
                        <div className="wem-wa-header-name">
                          CIIM 2026 Alerts <span className="wem-wa-verified-badge">✓</span>
                        </div>
                        <div className="wem-wa-header-sub">Official Broadcast Channel · +91 99400 30935</div>
                      </div>
                    </div>

                    <div className="wem-wa-chat-body">
                      <div className="wem-wa-date-pill">Today, 22 Nov 2026</div>

                      <div className="wem-wa-bubble">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: formatWhatsAppPreview(previewFormattedText),
                          }}
                        />
                        <div className="wem-wa-bubble-footer">
                          <span>
                            {manualScheduledFor
                              ? new Date(manualScheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '08:35 AM'}
                          </span>
                          <span className="wem-wa-ticks">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary & Simulation Box */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      fontSize: '0.78rem',
                      color: '#475569',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Template ID:</strong>
                      <code style={{ color: '#4338ca', fontWeight: 700, fontSize: '0.8rem' }}>{selectedWatiTemplate?.name}</code>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Preview Recipient:</strong>
                      <input
                        type="text"
                        value={sampleRecipientName}
                        onChange={(e) => setSampleRecipientName(e.target.value)}
                        placeholder="Dr. Karthikeyan Dev"
                        style={{
                          fontSize: '0.78rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          width: '160px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Channels:</strong>
                      <span>
                        {manualSendWhatsApp && '📱 WhatsApp'}
                        {manualSendWhatsApp && manualSendEmail && ' + '}
                        {manualSendEmail && '📧 Email'}
                        {!manualSendWhatsApp && !manualSendEmail && '⚠️ None selected'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Target Audience:</strong>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>
                        {manualAudienceType === 'ALL' && `All Registered (${recipients.length})`}
                        {manualAudienceType === 'CHECKED_IN' && `Checked-In (${recipients.filter((r) => r.isCheckedIn || r.checkedInAt).length})`}
                        {manualAudienceType === 'TNMC' && `TNMC Doctors (${recipients.filter((r) => r.tnmcNumber && r.tnmcNumber.trim()).length})`}
                        {manualAudienceType === 'NON_TNMC' && `Non-TNMC (${recipients.filter((r) => !r.tnmcNumber || !r.tnmcNumber.trim()).length})`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '20px',
                  borderTop: '1px solid var(--ink-200)',
                  paddingTop: '16px',
                }}
              >
                <Button variant="secondary" onClick={() => setShowManualScheduleModal(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submittingManualSchedule}>
                  {submittingManualSchedule ? 'Scheduling Campaign…' : '⏰ Confirm & Schedule Campaign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Scheduled Campaign (Before Started) */}
      {editingCampaign && (
        <div className="wem-modal-overlay" onClick={() => setEditingCampaign(null)}>
          <div className="wem-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wem-modal-header">
              <div>
                <h3 className="wem-modal-title">✏️ Edit Scheduled Campaign</h3>
                <p className="wem-modal-sub">
                  Adjust broadcast date, time, session parameters or channels before dispatch begins.
                </p>
              </div>
              <button
                type="button"
                className="wem-modal-close"
                onClick={() => setEditingCampaign(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--ink-500)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {editingCampaign.countdownSeconds != null && (
                <div className="wem-notice is-info" style={{ marginBottom: '14px' }}>
                  <span>⏳</span>
                  <div>
                    <strong>Status: SCHEDULED</strong> —{' '}
                    <span>{formatCountdown(editingCampaign.countdownSeconds)}</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-600)', marginTop: '2px' }}>
                      You can modify the schedule time or content freely until dispatch begins.
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Name */}
              <div className="wem-field">
                <label className="wem-field__label">Campaign Name</label>
                <input
                  type="text"
                  className="wem-field__input"
                  value={editCampaignName}
                  onChange={(e) => setEditCampaignName(e.target.value)}
                  required
                />
              </div>

              {/* Scheduled Date & Time */}
              <div className="wem-field">
                <label className="wem-field__label">Scheduled Date &amp; Time (Local IST)</label>
                <input
                  type="datetime-local"
                  className="wem-field__input"
                  value={editScheduledFor}
                  onChange={(e) => setEditScheduledFor(e.target.value)}
                  required
                />
                <span className="wem-field__hint">
                  The campaign will be held and dispatched at this newly selected time.
                </span>
              </div>

              {/* Delivery Channels */}
              <div className="wem-field">
                <span className="wem-field__label">Delivery Channels</span>
                <div className="wem-channels">
                  <label
                    className={`wem-channel-box${editSendWhatsApp ? ' is-checked' : ''}`}
                    onClick={() => setEditSendWhatsApp(!editSendWhatsApp)}
                  >
                    <input
                      type="checkbox"
                      checked={editSendWhatsApp}
                      onChange={() => {}}
                    />
                    <div className="wem-channel-box__text">
                      <span className="wem-channel-box__name">WhatsApp</span>
                      <span className="wem-channel-box__sub">WATI Template</span>
                    </div>
                  </label>

                  <label
                    className={`wem-channel-box${editSendEmail ? ' is-checked' : ''}`}
                    onClick={() => setEditSendEmail(!editSendEmail)}
                  >
                    <input
                      type="checkbox"
                      checked={editSendEmail}
                      onChange={() => {}}
                    />
                    <div className="wem-channel-box__text">
                      <span className="wem-channel-box__name">Email</span>
                      <span className="wem-channel-box__sub">HTML Mailer</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Session Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="wem-field" style={{ gridColumn: 'span 2' }}>
                  <label className="wem-field__label">Session Title</label>
                  <input
                    type="text"
                    className="wem-field__input"
                    value={editSessionTitle}
                    onChange={(e) => setEditSessionTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="wem-field">
                  <label className="wem-field__label">Time Slot</label>
                  <input
                    type="text"
                    className="wem-field__input"
                    value={editSessionTime}
                    onChange={(e) => setEditSessionTime(e.target.value)}
                    required
                  />
                </div>
                <div className="wem-field">
                  <label className="wem-field__label">Date</label>
                  <input
                    type="text"
                    className="wem-field__input"
                    value={editSessionDate}
                    onChange={(e) => setEditSessionDate(e.target.value)}
                    required
                  />
                </div>
                <div className="wem-field">
                  <label className="wem-field__label">Speaker Name(s)</label>
                  <input
                    type="text"
                    className="wem-field__input"
                    value={editSessionSpeaker}
                    onChange={(e) => setEditSessionSpeaker(e.target.value)}
                  />
                </div>
                <div className="wem-field">
                  <label className="wem-field__label">Hall / Track</label>
                  <input
                    type="text"
                    className="wem-field__input"
                    value={editSessionTrack}
                    onChange={(e) => setEditSessionTrack(e.target.value)}
                  />
                </div>
              </div>

              {/* Template ID */}
              <div className="wem-field">
                <label className="wem-field__label">WhatsApp Template ID</label>
                <input
                  type="text"
                  className="wem-field__input"
                  value={editTemplateId}
                  onChange={(e) => setEditTemplateId(e.target.value)}
                  required
                />
              </div>

              {/* Custom Note */}
              <div className="wem-field">
                <label className="wem-field__label">Optional Custom Note / Email Message</label>
                <textarea
                  className="wem-field__textarea"
                  value={editCustomMessage}
                  onChange={(e) => setEditCustomMessage(e.target.value)}
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <Button variant="secondary" onClick={() => setEditingCampaign(null)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submittingEdit}>
                  {submittingEdit ? 'Saving…' : '💾 Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
