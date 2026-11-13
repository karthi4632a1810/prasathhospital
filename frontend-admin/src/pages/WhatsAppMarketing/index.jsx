import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { whatsappMarketingApi } from '../../lib/whatsappMarketingApi';
import { checkinApi } from '../../lib/checkinApi';
import Button from '../../components/ui/Button';
import './WhatsAppMarketing.css';

const DEFAULT_POSTER_URL =
  'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg';

const LOCAL_STORAGE_IMAGES_KEY = 'ciim_wam_uploaded_images';

const SAMPLE_DELEGATES = [
  { name: 'Dr. Karthikeyan', phone: '9962460782' },
  { name: 'Dr. Priya Sharma', phone: '9840123456' },
  { name: 'Dr. Rajesh Kumar', phone: '9841234567' },
  { name: 'Dr. Ananya Reddy', phone: '9884567890' },
  { name: 'Dr. Suresh Babu', phone: '9940123987' },
  { name: 'Dr. Meera Nambiar', phone: '9840987654' },
  { name: 'Dr. Vikram Seth', phone: '9789123456' },
  { name: 'Dr. Kavitha Raman', phone: '9841987654' },
  { name: 'Dr. Arunachalam S', phone: '9884123789' },
  { name: 'Dr. Divya Iyer', phone: '9940567123' },
  { name: 'Dr. Balaji Mohan', phone: '9840345678' },
  { name: 'Dr. Geetha Venkatesh', phone: '9789345678' },
];

function parseRangeString(rangeStr, totalRows) {
  if (!rangeStr || !rangeStr.trim() || totalRows <= 0) {
    return new Set();
  }

  const selected = new Set();
  const tokens = rangeStr.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    if (token.includes('-')) {
      const parts = token.split('-');
      if (parts.length === 2) {
        let start = parseInt(parts[0], 10);
        let end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          if (start > end) {
            const tmp = start;
            start = end;
            end = tmp;
          }
          start = Math.max(1, start);
          end = Math.min(totalRows, end);
          for (let i = start; i <= end; i++) {
            selected.add(i - 1);
          }
        }
      }
    } else {
      const singleNum = parseInt(token, 10);
      if (!isNaN(singleNum) && singleNum >= 1 && singleNum <= totalRows) {
        selected.add(singleNum - 1);
      }
    }
  }

  return selected;
}

export default function WhatsAppMarketing() {
  const [config, setConfig] = useState(null);

  // Main Page View Mode: 'DISPATCH' (create & send) | 'MONITOR' (saved campaign logs)
  const [activeViewMode, setActiveViewMode] = useState('DISPATCH');

  // Persistent Campaigns from Database
  const [campaignsList, setCampaignsList] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [activeCampaignData, setActiveCampaignData] = useState(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('ALL');
  const [campaignSearchFilter, setCampaignSearchFilter] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Template Search & Category Filter
  const [templateCategoryTab, setTemplateCategoryTab] = useState('ALL');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('ciim2026_2what_works');
  const [templateParamValues, setTemplateParamValues] = useState({});

  // Transferred Audience Alert
  const [transferNotice, setTransferNotice] = useState(null);

  // Image Selection
  const [imageType, setImageType] = useState('poster');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Audience Data
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawDataRows, setRawDataRows] = useState([]);
  const [savedAudience, setSavedAudience] = useState(() => {
    try {
      const cached = localStorage.getItem('ciim_saved_audience');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [loadingCampaignAudience, setLoadingCampaignAudience] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  // Event Registration Picker Modal State
  const [showEventPickerModal, setShowEventPickerModal] = useState(false);
  const [eventPickerEvents, setEventPickerEvents] = useState([]);
  const [eventPickerSelectedEvent, setEventPickerSelectedEvent] = useState('');
  const [eventPickerLoading, setEventPickerLoading] = useState(false);
  const [eventPickerList, setEventPickerList] = useState([]);
  const [eventPickerSearch, setEventPickerSearch] = useState('');
  const [eventPickerStatus, setEventPickerStatus] = useState('confirmed');
  const [eventPickerSelectedIds, setEventPickerSelectedIds] = useState(new Set());

  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});

  // Dispatch In-Session State
  const [contactStatuses, setContactStatuses] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [retryingId, setRetryingId] = useState(null);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Selection & Range
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Single Test Send
  const [testPhone, setTestPhone] = useState('9962460782');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  // Batch Broadcast Execution
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastResults, setBroadcastResults] = useState(null);
  const [broadcastError, setBroadcastError] = useState('');

  // Live 1-by-1 Broadcast Monitor State
  const [liveMonitorOpen, setLiveMonitorOpen] = useState(false);
  const [liveCampaignId, setLiveCampaignId] = useState(null);
  const [liveProgress, setLiveProgress] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncingDeliveries, setSyncingDeliveries] = useState(false);
  const [retryingAll, setRetryingAll] = useState(false);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Live progress poller for ongoing broadcast
  useEffect(() => {
    if (!liveCampaignId) return;

    let isMounted = true;
    let timer = null;

    const pollLiveProgress = async () => {
      try {
        const res = await whatsappMarketingApi.getLiveProgress(liveCampaignId);
        if (!isMounted) return;
        if (res?.data?.progress) {
          const p = res.data.progress;
          setLiveProgress(p);
          if (p.status === 'RUNNING' || p.status === 'PAUSED') {
            timer = setTimeout(pollLiveProgress, 1200);
          } else if (p.status === 'COMPLETED') {
            loadCampaigns();
            loadCampaignDetails(liveCampaignId);
          }
        }
      } catch {
        if (!isMounted) return;
        timer = setTimeout(pollLiveProgress, 2500);
      }
    };

    pollLiveProgress();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [liveCampaignId]);

  // Load saved uploaded images from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_IMAGES_KEY);
      if (saved) setUploadedImages(JSON.parse(saved));
    } catch {
      // Ignore
    }
  }, []);

  const saveUploadedImage = (newImg) => {
    setUploadedImages((prev) => {
      const updated = [newImg, ...prev.filter((img) => img.url !== newImg.url)].slice(0, 15);
      try {
        localStorage.setItem(LOCAL_STORAGE_IMAGES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  // Fetch campaigns from database
  const loadCampaigns = async () => {
    try {
      const res = await whatsappMarketingApi.getCampaigns();
      if (res?.data?.campaigns) {
        setCampaignsList(res.data.campaigns);
        // If no campaign selected yet, default to most recent
        if (!selectedCampaignId && res.data.campaigns.length > 0) {
          loadCampaignDetails(res.data.campaigns[0]._id);
        }
      }
    } catch (err) {
      console.warn('Could not load campaigns:', err);
    }
  };

  // Fetch full details of a specific campaign (including all recipient members)
  const loadCampaignDetails = async (campaignId) => {
    if (!campaignId) return;
    setLoadingCampaign(true);
    setSelectedCampaignId(campaignId);
    try {
      const res = await whatsappMarketingApi.getCampaignById(campaignId);
      if (res?.data?.campaign) {
        setActiveCampaignData(res.data.campaign);
        // Automatically check WATI live status in background if any message is not yet READ
        const needsSync = (res.data.campaign.recipients || []).some(
          (r) => r.status !== 'READ' && r.status !== 'FAILED'
        );
        if (needsSync) {
          handleRefreshCampaignStatuses(campaignId, true);
        }
      }
    } catch (err) {
      console.warn('Could not load campaign details:', err);
    } finally {
      setLoadingCampaign(false);
    }
  };

  // Initial Load: config and campaigns
  useEffect(() => {
    whatsappMarketingApi
      .getConfig()
      .then((res) => {
        if (res?.data) {
          setConfig(res.data);
          // If no transferred template was set, use backend primaryTemplate or ciim2026_2what_works
          const hasTransferred = sessionStorage.getItem('ciim_transfer_audience');
          if (!hasTransferred && res.data.primaryTemplate) {
            setSelectedTemplateId(res.data.primaryTemplate);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load marketing config:', err);
      });

    loadCampaigns();

    // Check for audience transferred directly from Registrations page
    try {
      const raw = sessionStorage.getItem('ciim_transfer_audience');
      if (raw) {
        sessionStorage.removeItem('ciim_transfer_audience');
        const parsed = JSON.parse(raw);
        if (parsed?.contacts?.length) {
          setupRowsAndHeaders(parsed.contacts, parsed.title);
          setUploadedFile({ name: parsed.title });
          if (parsed.templateId) {
            setSelectedTemplateId(parsed.templateId);
          }
          setTransferNotice({
            title: parsed.title,
            count: parsed.contacts.length,
            templateId: parsed.templateId || 'ciim2026_2what_works',
          });
        }
      }
    } catch (err) {
      console.warn('Failed to parse transferred audience', err);
    }
  }, []);

  const allTemplates = config?.templates || [];
  const activeTemplate =
    allTemplates.find((t) => t.id === selectedTemplateId) ||
    allTemplates.find((t) => t.id === 'ciim2026_2what_works') ||
    allTemplates[0] || {
      id: 'ciim2026_2what_works',
      name: 'ciim2026_2what_works',
      label: 'CIIM 2026: What Works & What Doesn’t (Marketing)',
      category: 'MARKETING',
      params: ['Name'],
      hasHeaderMedia: false,
    };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      if (templateCategoryTab !== 'ALL' && t.category !== templateCategoryTab) return false;
      if (templateSearch.trim()) {
        const q = templateSearch.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.label || '').toLowerCase().includes(q) ||
          (t.body || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTemplates, templateCategoryTab, templateSearch]);

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    const tmpl = allTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;

    const newParamValues = {};
    (tmpl.params || []).forEach((paramKey) => {
      const lower = paramKey.toLowerCase();
      if (lower.includes('name') || lower === 'drname' || lower === 'delegate') {
        newParamValues[paramKey] = 'Dr. Karthikeyan';
      } else if (lower.includes('extra') || lower.includes('link') || lower.includes('url')) {
        newParamValues[paramKey] = '...';
      } else {
        newParamValues[paramKey] = '';
      }
    });
    setTemplateParamValues(newParamValues);

    if (tmpl.hasHeaderMedia) {
      setImageType((prev) => (prev === 'none' ? 'poster' : prev));
    } else {
      setImageType('none');
    }

    if (availableHeaders.length > 0) {
      updateColumnMappingsForTemplate(tmpl, availableHeaders);
    }
  };

  const updateColumnMappingsForTemplate = (tmpl, headers) => {
    const mappings = {
      Phone:
        headers.find((h) => /^(phone|mobile|whatsapp|contact|phone_?no|cell)/i.test(h)) ||
        headers[1] ||
        headers[0],
    };

    (tmpl.params || []).forEach((paramKey) => {
      const lower = paramKey.toLowerCase();
      const match = headers.find((h) => {
        const hLower = h.toLowerCase();
        if (hLower === lower) return true;
        if (lower.includes('name') && /^(name|full_?name|doctor|delegate|dr)/i.test(h)) return true;
        if ((lower.includes('extra') || lower.includes('link')) && /^(extra|link|ticket|notes)/i.test(h))
          return true;
        return false;
      });
      mappings[paramKey] = match || headers[0] || '';
    });

    setColumnMappings(mappings);
  };

  const handleUploadNewImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await whatsappMarketingApi.uploadImage(file);
      const url = res?.data?.fullUrl || res?.data?.url;
      if (url) {
        const newImgObj = {
          name: file.name,
          url,
          uploadedAt: new Date().toLocaleTimeString(),
        };
        saveUploadedImage(newImgObj);
        setImageType(url);
      }
    } catch (err) {
      alert(`Image upload failed: ${err.message || 'Server error'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const resolvedImageUrl = useMemo(() => {
    if (imageType === 'none') return '';
    if (imageType === 'poster') return DEFAULT_POSTER_URL;
    if (imageType === 'custom') return customImageUrl.trim();
    if (imageType.startsWith('http://') || imageType.startsWith('https://')) return imageType;
    return DEFAULT_POSTER_URL;
  }, [imageType, customImageUrl]);

  const parsedContacts = useMemo(() => {
    if (!rawDataRows.length) return [];

    const phoneCol = columnMappings.Phone || 'Phone';
    const declaredParams = activeTemplate.params || ['Name'];

    return rawDataRows.map((row, index) => {
      const rawPhone = String(row[phoneCol] || row.Phone || row.phone || row.mobile || '').trim();
      const digitsOnly = rawPhone.replace(/[^\d]/g, '');
      const isValidPhone = digitsOnly.length >= 10;
      const normalizedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

      const rowParams = {};
      declaredParams.forEach((paramKey) => {
        const mappedCol = columnMappings[paramKey];
        const val =
          mappedCol && row[mappedCol] !== undefined
            ? String(row[mappedCol]).trim()
            : row[paramKey] !== undefined
            ? String(row[paramKey]).trim()
            : templateParamValues[paramKey] || '';
        rowParams[paramKey] = val;
      });

      const primaryNameParam = declaredParams.find((p) => /name/i.test(p)) || declaredParams[0];
      const delegateName =
        rowParams[primaryNameParam] ||
        row.Name ||
        row.name ||
        row.DrName ||
        `Recipient #${index + 1}`;

      const currentStatusInfo = contactStatuses[index] || {
        status: isValidPhone ? 'PENDING' : 'FAILED',
        error: isValidPhone ? null : 'Invalid phone number (must be at least 10 digits)',
      };

      return {
        id: index,
        rowNumber: index + 1,
        name: delegateName,
        rawPhone,
        phone: normalizedPhone,
        isValidPhone,
        params: rowParams,
        status: currentStatusInfo.status,
        error: currentStatusInfo.error,
        messageId: currentStatusInfo.messageId,
        lastUpdated: currentStatusInfo.lastUpdated,
        originalData: row,
      };
    });
  }, [rawDataRows, columnMappings, activeTemplate, templateParamValues, contactStatuses]);

  const statusCounts = useMemo(() => {
    const counts = { ALL: parsedContacts.length, READ: 0, DELIVERED: 0, SENT: 0, FAILED: 0, PENDING: 0 };
    parsedContacts.forEach((c) => {
      const s = c.status || 'PENDING';
      if (counts[s] !== undefined) counts[s]++;
      else counts.PENDING++;
    });
    return counts;
  }, [parsedContacts]);

  const filteredContacts = useMemo(() => {
    return parsedContacts.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          String(c.rowNumber) === q
        );
      }
      return true;
    });
  }, [parsedContacts, searchFilter, statusFilter]);

  // Filtered Past Broadcasts List (History Tab)
  const filteredCampaignsList = useMemo(() => {
    if (!historySearchQuery.trim()) return campaignsList;
    const q = historySearchQuery.toLowerCase();
    return campaignsList.filter(
      (c) =>
        (c.templateName || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        new Date(c.createdAt).toLocaleDateString().includes(q)
    );
  }, [campaignsList, historySearchQuery]);

  // Campaign Monitor Filtered Recipients (From Database Document)
  const campaignRecipients = activeCampaignData?.recipients || [];
  const campaignStatusCounts = useMemo(() => {
    const counts = { ALL: campaignRecipients.length, READ: 0, DELIVERED: 0, SENT: 0, FAILED: 0, PENDING: 0 };
    campaignRecipients.forEach((r) => {
      const s = (r.status || 'PENDING').toUpperCase();
      if (counts[s] !== undefined) counts[s]++;
      else counts.PENDING++;
    });
    return counts;
  }, [campaignRecipients]);

  const filteredCampaignRecipients = useMemo(() => {
    return campaignRecipients.filter((r) => {
      if (campaignStatusFilter !== 'ALL') {
        const itemStatus = (r.status || 'PENDING').toUpperCase();
        if (itemStatus !== campaignStatusFilter) return false;
      }
      if (campaignSearchFilter.trim()) {
        const q = campaignSearchFilter.toLowerCase();
        return (
          (r.name || '').toLowerCase().includes(q) ||
          (r.phone || '').includes(q) ||
          (r.normalizedPhone || '').includes(q) ||
          String(r.rowIndex) === q
        );
      }
      return true;
    });
  }, [campaignRecipients, campaignStatusFilter, campaignSearchFilter]);

  const handleApplyRange = (e) => {
    if (e) e.preventDefault();
    if (!parsedContacts.length) return;
    const newSelected = parseRangeString(rangeInput, parsedContacts.length);
    setSelectedIndices(newSelected);
  };

  const selectAll = () => {
    const all = new Set(parsedContacts.map((_, i) => i));
    setSelectedIndices(all);
    setRangeInput(parsedContacts.length > 0 ? `1-${parsedContacts.length}` : '');
  };

  const selectFirstN = (n) => {
    const limit = Math.min(n, parsedContacts.length);
    const set = new Set();
    for (let i = 0; i < limit; i++) set.add(i);
    setSelectedIndices(set);
    setRangeInput(limit > 0 ? `1-${limit}` : '');
  };

  const clearSelection = () => {
    setSelectedIndices(new Set());
    setRangeInput('');
  };

  const invertSelection = () => {
    const inverted = new Set();
    parsedContacts.forEach((_, i) => {
      if (!selectedIndices.has(i)) inverted.add(i);
    });
    setSelectedIndices(inverted);
  };

  const toggleRow = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const processUploadedFile = async (file) => {
    if (!file) return;
    setUploadedFile(file);
    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.json')) {
        const text = await file.text();
        let jsonContent = JSON.parse(text);
        if (!Array.isArray(jsonContent)) {
          if (Array.isArray(jsonContent.users)) jsonContent = jsonContent.users;
          else if (Array.isArray(jsonContent.contacts)) jsonContent = jsonContent.contacts;
          else if (Array.isArray(jsonContent.data)) jsonContent = jsonContent.data;
          else throw new Error('JSON file must contain an array of contact objects.');
        }
        setupRowsAndHeaders(jsonContent);
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (!rows.length) throw new Error('The uploaded spreadsheet has no data rows.');
        setupRowsAndHeaders(rows);
      }
    } catch (err) {
      alert(`Error reading file: ${err.message}`);
      setUploadedFile(null);
    }
  };

  const handleLoadSavedAudience = () => {
    if (!savedAudience || !savedAudience.rows || !savedAudience.rows.length) {
      alert('No saved audience found in your browser cache.');
      return;
    }
    setupRowsAndHeaders(savedAudience.rows, savedAudience.filename);
    setUploadedFile({ name: `${savedAudience.filename || 'Saved Contact List'} (${savedAudience.rows.length} contacts)` });
  };

  const handleLoadAudienceFromCampaign = async (campaignId) => {
    if (!campaignId) return;
    setLoadingCampaignAudience(true);
    try {
      const res = await whatsappMarketingApi.getCampaignById(campaignId);
      const c = res?.data?.campaign;
      if (!c || !c.recipients || !c.recipients.length) {
        alert('No recipient contacts found in this broadcast record.');
        return;
      }
      const rows = c.recipients.map((r) => ({
        Name: r.name || 'Delegate',
        Phone: r.phone || r.normalizedPhone || '',
        ...(r.params || {}),
      }));
      const fileName = `${c.title || c.templateName} (${rows.length} contacts)`;
      setUploadedFile({ name: fileName });
      setupRowsAndHeaders(rows, fileName);
      setShowCampaignPicker(false);
      alert(`Successfully loaded ${rows.length} contacts from "${c.title || c.templateName}"!`);
    } catch (err) {
      alert('Failed to load audience: ' + (err.message || 'Server error'));
    } finally {
      setLoadingCampaignAudience(false);
    }
  };

  const handleLoadEventRegistrations = async () => {
    setLoadingRegistrations(true);
    try {
      const res = await whatsappMarketingApi.getRegistrationsAudience();
      const contacts = res?.data?.contacts || [];
      if (!contacts.length) {
        alert('No confirmed registrations found in database.');
        return;
      }
      const fileName = `Confirmed Event Registrations (${contacts.length} delegates)`;
      setUploadedFile({ name: fileName });
      setupRowsAndHeaders(contacts, fileName);
      setSelectedTemplateId('ciim2026_2what_works');
      alert(`Successfully loaded ${contacts.length} confirmed delegates from event registrations!`);
    } catch (err) {
      alert('Failed to load registrations: ' + (err.message || 'Server error'));
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const openEventRegistrationPicker = async () => {
    setShowEventPickerModal(true);
    setEventPickerLoading(true);
    try {
      const res = await checkinApi.events();
      const evs = res?.data || [];
      setEventPickerEvents(evs);
      const defaultEv = evs[0]?.id || evs[0]?._id || '';
      setEventPickerSelectedEvent(defaultEv);
      await loadPickerRegistrations(defaultEv, eventPickerStatus);
    } catch (err) {
      alert('Failed to load events: ' + (err.message || 'Error'));
    } finally {
      setEventPickerLoading(false);
    }
  };

  const loadPickerRegistrations = async (evId, status) => {
    setEventPickerLoading(true);
    try {
      const res = await whatsappMarketingApi.getRegistrationsAudience({
        event: evId || undefined,
        status: status === 'all' ? undefined : status,
      });
      const contacts = res?.data?.contacts || [];
      setEventPickerList(contacts);
      const allIds = new Set(contacts.map((c) => c._id || c.RegistrationCode || String(c.Index)));
      setEventPickerSelectedIds(allIds);
    } catch (err) {
      alert('Failed to load event registrations: ' + (err.message || 'Error'));
    } finally {
      setEventPickerLoading(false);
    }
  };

  const handleEventPickerChange = async (evId) => {
    setEventPickerSelectedEvent(evId);
    await loadPickerRegistrations(evId, eventPickerStatus);
  };

  const handleEventPickerStatusChange = async (status) => {
    setEventPickerStatus(status);
    await loadPickerRegistrations(eventPickerSelectedEvent, status);
  };

  const handleConfirmEventAudience = () => {
    const selected = eventPickerList.filter((c) =>
      eventPickerSelectedIds.has(c._id || c.RegistrationCode || String(c.Index))
    );
    if (!selected.length) {
      alert('Please select at least one registered user to load into WhatsApp Marketing.');
      return;
    }
    const evObj = eventPickerEvents.find(
      (e) => (e.id || e._id) === eventPickerSelectedEvent
    );
    const fileName = `Event Registrations: ${evObj?.title || 'CIIM 2026'} (${selected.length} delegates)`;
    setUploadedFile({ name: fileName });
    setupRowsAndHeaders(selected, fileName);
    setSelectedTemplateId('ciim2026_2what_works');
    setShowEventPickerModal(false);
    alert(`Successfully loaded ${selected.length} registered delegates into the campaign!`);
  };

  const handleQuickLoadAllConfirmed = () => {
    if (!eventPickerList.length) return;
    const confirmed = eventPickerList.filter((c) => c.Status === 'confirmed' || !c.Status);
    const toLoad = confirmed.length ? confirmed : eventPickerList;
    const evObj = eventPickerEvents.find(
      (e) => (e.id || e._id) === eventPickerSelectedEvent
    );
    const fileName = `All Confirmed: ${evObj?.title || 'CIIM 2026'} (${toLoad.length} delegates)`;
    setUploadedFile({ name: fileName });
    setupRowsAndHeaders(toLoad, fileName);
    setSelectedTemplateId('ciim2026_2what_works');
    setShowEventPickerModal(false);
    alert(`Successfully loaded ${toLoad.length} confirmed delegates into the campaign!`);
  };

  const filteredPickerRegistrations = useMemo(() => {
    if (!eventPickerList || !eventPickerList.length) return [];
    const q = eventPickerSearch.trim().toLowerCase();
    if (!q) return eventPickerList;
    return eventPickerList.filter((c) => {
      return (
        (c.Name || '').toLowerCase().includes(q) ||
        (c.Phone || '').includes(q) ||
        (c.Email || '').toLowerCase().includes(q) ||
        (c.RegistrationCode || '').toLowerCase().includes(q) ||
        (c.Company || '').toLowerCase().includes(q) ||
        (c.Coupon || '').toLowerCase().includes(q)
      );
    });
  }, [eventPickerList, eventPickerSearch]);

  const setupRowsAndHeaders = (rows, customName = null) => {
    if (!rows || !rows.length) return;
    setRawDataRows(rows);

    const headers = Object.keys(rows[0]);
    setAvailableHeaders(headers);
    updateColumnMappingsForTemplate(activeTemplate, headers);

    setContactStatuses({});
    const all = new Set(rows.map((_, i) => i));
    setSelectedIndices(all);
    setRangeInput(`1-${rows.length}`);
    setBroadcastResults(null);
    try {
      const info = {
        filename: customName || uploadedFile?.name || 'Contact List (1400+ Users)',
        rowCount: rows.length,
        rows: rows,
        savedAt: new Date().toLocaleDateString(),
      };
      localStorage.setItem('ciim_saved_audience', JSON.stringify(info));
      setSavedAudience(info);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  const generateTemplateSampleData = () => {
    const declaredParams = activeTemplate.params || ['Name'];

    return SAMPLE_DELEGATES.map((del, idx) => {
      const sampleRow = { Phone: del.phone };
      declaredParams.forEach((paramKey) => {
        const lower = paramKey.toLowerCase();
        if (lower.includes('name') || lower === 'drname' || lower === 'delegate') {
          sampleRow[paramKey] = del.name;
        } else if (lower.includes('extra') || lower.includes('note')) {
          sampleRow[paramKey] = idx % 2 === 0 ? 'VIP Delegate' : 'Special Guest';
        } else if (lower.includes('date')) {
          sampleRow[paramKey] = '21 Nov 2026';
        } else if (lower.includes('venue') || lower.includes('branch') || lower.includes('location')) {
          sampleRow[paramKey] = 'The Leela Palace, Chennai';
        } else if (lower.includes('link') || lower.includes('url')) {
          sampleRow[paramKey] = 'https://ciim.prashanthfertility.com/';
        } else if (lower.includes('doctor')) {
          sampleRow[paramKey] = 'Dr. Geetha Haripriya';
        } else if (lower.includes('uhid')) {
          sampleRow[paramKey] = `UH100${20 + idx}`;
        } else {
          sampleRow[paramKey] = `Sample ${paramKey} ${idx + 1}`;
        }
      });
      return sampleRow;
    });
  };

  const downloadSampleExcel = () => {
    const sampleData = generateTemplateSampleData();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, `${activeTemplate.name}_sample.xlsx`);
  };

  const downloadSampleCsv = () => {
    const sampleData = generateTemplateSampleData();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTemplate.name}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJson = () => {
    const sampleData = generateTemplateSampleData();
    const jsonStr = JSON.stringify(sampleData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTemplate.name}_sample.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSampleIntoEditor = () => {
    const sampleData = generateTemplateSampleData();
    setupRowsAndHeaders(sampleData);
    setUploadedFile({ name: `${activeTemplate.name}_sample.xlsx (Preloaded)` });
  };

  const handleTestSend = async () => {
    setTestError('');
    setTestResult(null);
    setTestSending(true);

    try {
      const primaryNameParam = (activeTemplate.params || []).find((p) => /name/i.test(p)) || 'Name';
      const testNameVal = templateParamValues[primaryNameParam] || 'Dr. Karthikeyan';

      const res = await whatsappMarketingApi.sendTestSingle({
        phone: testPhone,
        templateName: selectedTemplateId,
        name: testNameVal,
        customParamsValues: templateParamValues,
        imageType: activeTemplate.hasHeaderMedia ? imageType : 'none',
        customImageUrl: resolvedImageUrl,
      });
      setTestResult(res?.data || { success: true });
    } catch (err) {
      setTestError(err.message || 'Failed to deliver test message.');
    } finally {
      setTestSending(false);
    }
  };

  // Resend / Retry for a specific contact (updates MongoDB campaign document)
  const handleRetryRecipient = async (recipient, campaignId = null, e = null) => {
    if (e) e.stopPropagation();
    const recId = recipient._id || recipient.id;
    setRetryingId(recId);

    try {
      const res = await whatsappMarketingApi.resendSingle({
        campaignId: campaignId || activeCampaignData?._id,
        recipientId: recipient._id,
        phone: recipient.phone || recipient.rawPhone,
        name: recipient.name,
        templateName: activeCampaignData?.templateName || selectedTemplateId,
        customParamsValues: recipient.params || templateParamValues,
        imageType: 'none',
        customImageUrl: '',
      });

      if (res?.data?.campaign) {
        setActiveCampaignData(res.data.campaign);
      } else if (res?.data?.sent) {
        // Fallback update in session
        setContactStatuses((prev) => ({
          ...prev,
          [recId]: {
            status: 'SENT',
            messageId: res.data.messageId,
            error: null,
            lastUpdated: new Date().toLocaleTimeString(),
          },
        }));
      }
      loadCampaigns();
    } catch (err) {
      alert('Resend failed: ' + err.message);
    } finally {
      setRetryingId(null);
    }
  };

  // Sync Live Status from WATI into database
  const handleRefreshCampaignStatuses = async (campaignId, isSilent = false) => {
    const targetId = campaignId || activeCampaignData?._id;
    if (!targetId) return;

    if (!isSilent) setSyncingStatuses(true);
    try {
      const res = await whatsappMarketingApi.checkStatuses({ campaignId: targetId });
      if (res?.data?.campaign) {
        setActiveCampaignData(res.data.campaign);
        setLastSyncTime(new Date().toLocaleTimeString());
        // Update campaign in history list so card numbers match immediately
        setCampaignsList((prev) =>
          prev.map((c) => (c._id === res.data.campaign._id ? { ...c, ...res.data.campaign } : c))
        );
        if (!isSilent) {
          const c = res.data.campaign;
          alert(
            `Live Status Synced from WATI!\n\n` +
            `✓✓ Read: ${c.readCount || 0}\n` +
            `✓✓ Delivered: ${c.deliveredCount || 0}\n` +
            `✓ Sent: ${c.sentCount || 0}\n` +
            `⚠️ Failed: ${c.failedCount || 0}`
          );
        }
      }
    } catch (err) {
      if (!isSilent) {
        alert('Status sync failed: ' + (err.message || 'WATI API error'));
      }
    } finally {
      if (!isSilent) setSyncingStatuses(false);
    }
  };

  // Delete a campaign permanently from MongoDB
  const handleDeleteCampaign = async (campaignId, e = null) => {
    if (e) e.stopPropagation();
    if (!campaignId) return;

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this broadcast record?\n\nThis will remove the campaign card and its member logs from the monitor screen.'
    );
    if (!confirmDelete) return;

    try {
      await whatsappMarketingApi.deleteCampaign(campaignId);
      setCampaignsList((prev) => prev.filter((c) => c._id !== campaignId));

      if (selectedCampaignId === campaignId || activeCampaignData?._id === campaignId) {
        const remaining = campaignsList.filter((c) => c._id !== campaignId);
        if (remaining.length > 0) {
          loadCampaignDetails(remaining[0]._id);
        } else {
          setSelectedCampaignId(null);
          setActiveCampaignData(null);
        }
      }
    } catch (err) {
      alert('Failed to delete campaign: ' + (err.message || 'Server error'));
    }
  };

  // Periodic background status sync while viewing monitor
  useEffect(() => {
    if (activeViewMode !== 'MONITOR' || !activeCampaignData?._id) return;

    const needsSync = (activeCampaignData.recipients || []).some(
      (r) => r.status !== 'READ' && r.status !== 'FAILED'
    );
    if (!needsSync) return;

    const interval = setInterval(() => {
      handleRefreshCampaignStatuses(activeCampaignData._id, true);
    }, 10000);

    return () => clearInterval(interval);
  }, [activeViewMode, activeCampaignData?._id, activeCampaignData?.recipients]);

  // Batch Broadcast Execution: starts asynchronous 1-by-1 live broadcast
  const executeBroadcast = async () => {
    setShowConfirmModal(false);
    setBroadcastError('');
    setBroadcastResults(null);

    const selectedContacts = parsedContacts.filter((c) => selectedIndices.has(c.id));
    if (!selectedContacts.length) {
      alert('Please select at least 1 contact row to broadcast.');
      return;
    }

    setBroadcasting(true);
    setBroadcastProgress(5);

    try {
      const payload = {
        title: `${activeTemplate.label || activeTemplate.name} (${selectedContacts.length} recipients)`,
        templateName: selectedTemplateId,
        imageType: activeTemplate.hasHeaderMedia ? imageType : 'none',
        customImageUrl: resolvedImageUrl,
        globalParams: templateParamValues,
        recipients: selectedContacts.map((c) => ({
          rowIndex: c.rowNumber,
          name: c.name,
          phone: c.phone,
          params: c.params,
          originalData: c.originalData,
        })),
        throttleMs: 100,
      };

      const res = await whatsappMarketingApi.sendBatch(payload);
      const newCampaignId = res?.data?.campaignId || res?.data?.campaign?._id;

      if (newCampaignId) {
        setLiveCampaignId(newCampaignId);
        setLiveProgress(
          res.data.initialProgress || {
            campaignId: newCampaignId,
            templateName: selectedTemplateId,
            title: payload.title,
            status: 'RUNNING',
            total: selectedContacts.length,
            processedCount: 0,
            sentCount: 0,
            deliveredCount: 0,
            readCount: 0,
            failedCount: 0,
            pendingCount: selectedContacts.length,
            percentage: 0,
            speed: 0,
            etaSeconds: 0,
            currentRecipient: null,
            recentLogs: [],
          }
        );
        setLiveMonitorOpen(true);
        loadCampaigns();
      }
    } catch (err) {
      setBroadcastError(err.message || 'Error occurred while broadcasting WhatsApp messages.');
      alert('Broadcast Launch Error: ' + (err.message || 'Server error occurred.'));
    } finally {
      setBroadcasting(false);
    }
  };

  const handlePauseBroadcast = async () => {
    if (!liveCampaignId) return;
    setActionLoading(true);
    try {
      const res = await whatsappMarketingApi.pauseCampaign(liveCampaignId);
      if (res?.data?.progress) setLiveProgress(res.data.progress);
    } catch (err) {
      alert('Failed to pause: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeBroadcast = async () => {
    if (!liveCampaignId) return;
    setActionLoading(true);
    try {
      const res = await whatsappMarketingApi.resumeCampaign(liveCampaignId);
      if (res?.data?.progress) setLiveProgress(res.data.progress);
    } catch (err) {
      alert('Failed to resume: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopBroadcast = async () => {
    if (!liveCampaignId) return;
    if (!window.confirm('Are you sure you want to stop this broadcast? Remaining unsent messages will not be dispatched.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await whatsappMarketingApi.stopCampaign(liveCampaignId);
      if (res?.data?.progress) setLiveProgress(res.data.progress);
      loadCampaigns();
      loadCampaignDetails(liveCampaignId);
    } catch (err) {
      alert('Failed to stop: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncCampaignDelivery = async (campaignIdToSync, silent = false) => {
    const targetId = campaignIdToSync || liveCampaignId || selectedCampaignId;
    if (!targetId) return;
    setSyncingDeliveries(true);
    try {
      const res = await whatsappMarketingApi.syncDelivery(targetId);
      if (res?.data) {
        if (liveProgress && liveCampaignId === targetId) {
          setLiveProgress((prev) =>
            prev
              ? {
                  ...prev,
                  deliveredCount: res.data.deliveredCount,
                  readCount: res.data.readCount,
                  sentCount: res.data.sentCount,
                  failedCount: res.data.failedCount,
                }
              : null
          );
        }
        loadCampaignDetails(targetId);
        loadCampaigns();
        if (!silent) {
          alert(`Handset Deliveries Synced!\n\n✓ Delivered: ${res.data.deliveredCount}\n✓ Read: ${res.data.readCount}`);
        }
      }
    } catch (err) {
      if (!silent) alert('Delivery sync failed: ' + err.message);
    } finally {
      setSyncingDeliveries(false);
    }
  };

  const handleRetryAllFailed = async (campaignIdToRetry) => {
    const targetId = campaignIdToRetry || activeCampaignData?._id;
    if (!targetId) return;

    const targetCampaign =
      activeCampaignData?._id === targetId ? activeCampaignData : campaignsList.find((c) => c._id === targetId);
    const failedCount =
      (activeCampaignData?._id === targetId ? campaignStatusCounts.FAILED : 0) ||
      targetCampaign?.failedCount ||
      (targetCampaign?.recipients?.filter((r) => (r.status || '').toUpperCase() === 'FAILED').length) ||
      0;

    if (failedCount === 0) {
      alert('There are no failed recipients in this broadcast to retry.');
      return;
    }

    const confirmRetry = window.confirm(
      `↻ Retry All ${failedCount} Failed Messages?\n\nAll failed messages will be dispatched sequentially (one-by-one) with live monitoring to protect deliverability.`
    );
    if (!confirmRetry) return;

    setRetryingAll(true);
    try {
      const res = await whatsappMarketingApi.retryFailed(targetId, { throttleMs: 120 });
      if (res?.data?.progress) {
        setLiveCampaignId(targetId);
        setLiveProgress(res.data.progress);
        setLiveMonitorOpen(true);
        loadCampaigns();
      }
    } catch (err) {
      alert('Failed to launch retry: ' + (err.message || 'Server error'));
    } finally {
      setRetryingAll(false);
    }
  };

  // Universal Export Function for Excel (.xlsx) and CSV (.csv)
  const exportCampaignData = (format = 'xlsx', onlyFiltered = false, customCampaign = null) => {
    const target = customCampaign || activeCampaignData;
    if (!target) return;

    let recipients = target.recipients || [];
    if (onlyFiltered && !customCampaign) {
      recipients = filteredCampaignRecipients;
    }

    if (!recipients.length) {
      alert('No recipients found to export for this selection.');
      return;
    }

    const exportData = recipients.map((r, i) => {
      const row = {
        '#': r.rowIndex || i + 1,
        'Recipient Name': r.name || 'Unknown',
        'Mobile Number': r.phone || r.normalizedPhone || '',
        'Delivery Status': r.status || 'PENDING',
        'Sent Time': r.sentAt ? new Date(r.sentAt).toLocaleString('en-GB') : '',
        'Delivered Time': r.deliveredAt ? new Date(r.deliveredAt).toLocaleString('en-GB') : '',
        'Read Time': r.readAt ? new Date(r.readAt).toLocaleString('en-GB') : '',
        'WATI Message ID': r.messageId || '',
        'Failure / Error': r.error || '',
      };

      if (r.params && typeof r.params === 'object') {
        Object.entries(r.params).forEach(([k, v]) => {
          row[`Param: ${k}`] = v;
        });
      }

      return row;
    });

    const isFiltered = onlyFiltered && (campaignStatusFilter !== 'ALL' || campaignSearchFilter.trim());
    const filterTag = isFiltered ? `_${campaignStatusFilter.toLowerCase()}` : '_all';
    const cleanTemplate = (target.templateName || 'broadcast').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateTag = new Date().toISOString().slice(0, 10);
    const fileName = `whatsapp_${cleanTemplate}${filterTag}_${recipients.length}members_${dateTag}`;

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Status');

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
  };

  const selectedCount = selectedIndices.size;
  const totalCount = parsedContacts.length;

  return (
    <div className="wam">
      {/* Transferred Audience Alert */}
      {transferNotice && (
        <div
          style={{
            background: 'linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: '1px solid #86efac',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.12)',
            animation: 'wamModalIn 0.2s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎉</span>
            <div>
              <strong style={{ color: '#166534', fontSize: '0.975rem' }}>
                Loaded {transferNotice.count} registered delegates from {transferNotice.title}!
              </strong>
              <p style={{ margin: '3px 0 0', fontSize: '0.825rem', color: '#15803d' }}>
                Template <code>{transferNotice.templateId}</code> is selected and ready for broadcast. Review recipients below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTransferNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#15803d',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1.1rem',
              padding: '4px 8px',
            }}
            title="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="wam__header">
        <div className="wam__header-left">
          <div className="wam__badge-row">
            <span className="wam__chip wam__chip--live">
              <span className="wam__chip-dot"></span> WATI Multi-Channel
            </span>
            <span className="wam__chip wam__chip--channel">
              Channel: 919940030935 (PRFC - Blast)
            </span>
            <span className="wam__chip wam__chip--total-templates">
              {allTemplates.length} Templates &bull; {campaignsList.length} Saved Broadcasts
            </span>
          </div>
          <h1 className="wam__title">WhatsApp Marketing & Persistent Campaign Monitor</h1>
          <p className="wam__subtitle">
            Broadcast personalized messages and <strong>persist every dispatch</strong> in database.
            Monitor member statuses (Sent, Delivered, Read, Failed) anytime—even after page refresh!
          </p>
        </div>

        {/* Top View Mode Switcher (New Dispatch vs Live Monitor & History) */}
        <div className="wam__view-switcher">
          <button
            type="button"
            className={`wam__view-btn ${activeViewMode === 'DISPATCH' ? 'is-active' : ''}`}
            onClick={() => setActiveViewMode('DISPATCH')}
          >
            &#128640; New Dispatch & Upload
          </button>
          <button
            type="button"
            className={`wam__view-btn ${activeViewMode === 'MONITOR' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveViewMode('MONITOR');
              loadCampaigns();
            }}
          >
            &#128203; Saved Broadcast Monitor ({campaignsList.length})
          </button>
          {liveCampaignId && liveProgress && (
            <button
              type="button"
              className="wam__view-btn wam__view-btn--live-active"
              onClick={() => setLiveMonitorOpen(true)}
            >
              <span className="wam__chip-dot"></span>
              {liveProgress.title?.includes('Retry') || liveProgress.isRetryJob
                ? `🔄 Retrying (${liveProgress.processedCount}/${liveProgress.total})`
                : `🔴 Live Monitor (${liveProgress.processedCount}/${liveProgress.total})`}
            </button>
          )}
        </div>
      </header>

      {/* VIEW MODE 1: DISPATCH / CREATE NEW BROADCAST */}
      {activeViewMode === 'DISPATCH' && (
        <div className="wam__grid">
          {/* Step 1: Choose Template & Dynamic Parameters */}
          <section className="wam__card wam__card--template">
            <div className="wam__card-header">
              <span className="wam__step-pill">Step 1</span>
              <div>
                <h2 className="wam__card-title">Choose WATI Template</h2>
                <p className="wam__card-desc">
                  Filter by Marketing or Utility, then configure parameters & header media below
                </p>
              </div>
            </div>

            {/* Template Category Tabs */}
            <div className="wam__cat-bar">
              <div className="wam__cat-tabs">
                <button
                  type="button"
                  className={`wam__cat-tab ${templateCategoryTab === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setTemplateCategoryTab('ALL')}
                >
                  All ({allTemplates.length})
                </button>
                <button
                  type="button"
                  className={`wam__cat-tab wam__cat-tab--mkt ${
                    templateCategoryTab === 'MARKETING' ? 'is-active' : ''
                  }`}
                  onClick={() => setTemplateCategoryTab('MARKETING')}
                >
                  Marketing ({config?.marketingCount || 0})
                </button>
                <button
                  type="button"
                  className={`wam__cat-tab wam__cat-tab--utl ${
                    templateCategoryTab === 'UTILITY' ? 'is-active' : ''
                  }`}
                  onClick={() => setTemplateCategoryTab('UTILITY')}
                >
                  Utility ({config?.utilityCount || 0})
                </button>
              </div>

              <input
                type="text"
                className="wam__input wam__input--tmpl-search"
                placeholder="&#128269; Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
            </div>

            {/* Template List Cards */}
            <div className="wam__template-selector">
              {filteredTemplates.map((tmpl) => (
                <label
                  key={tmpl.id}
                  className={`wam__template-card ${
                    selectedTemplateId === tmpl.id ? 'is-selected' : ''
                  } ${(tmpl.id === 'ciim2026_2what_works' || tmpl.id === 'ciim2026_participant_qanda_v2' || tmpl.id === 'ciim2026_invite' || tmpl.id === 'ciim2026_drgh_invite') ? 'wam__template-card--primary' : ''}`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={tmpl.id}
                    checked={selectedTemplateId === tmpl.id}
                    onChange={() => handleSelectTemplate(tmpl.id)}
                  />
                  <div className="wam__template-card-body">
                    <div className="wam__template-card-title-row">
                      <span className="wam__template-name">{tmpl.label || tmpl.name}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {tmpl.id === 'ciim2026_2what_works' && (
                          <span
                            className="wam__tag"
                            style={{
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              fontWeight: 700,
                            }}
                          >
                            ⭐ Featured
                          </span>
                        )}
                        {tmpl.id === 'ciim2026_participant_qanda_v2' && (
                          <span
                            className="wam__tag"
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontWeight: 700,
                            }}
                          >
                            💬 Q&A Utility
                          </span>
                        )}
                        {(tmpl.hasVideoHeader || tmpl.id === 'ciim2026_drgh_invite' || tmpl.name === 'ciim2026_drgh_invite') && (
                          <span className="wam__tag wam__tag--video">🎬 Video Template</span>
                        )}
                        <span
                          className={`wam__tag ${
                            tmpl.category === 'MARKETING' ? 'wam__tag--purple' : 'wam__tag--green'
                          }`}
                        >
                          {tmpl.category} &bull; Approved
                        </span>
                      </div>
                    </div>
                    <p className="wam__template-desc">
                      {tmpl.body ? tmpl.body.slice(0, 110) + '...' : 'WATI Approved Template'}
                    </p>
                    <div className="wam__template-meta">
                      <code className="wam__template-code">{tmpl.name}</code>
                      {(tmpl.hasVideoHeader || tmpl.id === 'ciim2026_drgh_invite' || tmpl.name === 'ciim2026_drgh_invite') ? (
                        <span className="wam__media-badge wam__media-badge--video">🎬 Pre-attached Video Header</span>
                      ) : tmpl.hasHeaderMedia ? (
                        <span className="wam__media-badge">&#128444; Image Header</span>
                      ) : null}
                      <span className="wam__lang-badge">{tmpl.language || 'en_GB'}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Active Template Parameters Configuration */}
            <div className="wam__param-section">
              <h3 className="wam__section-heading">
                &#9881; Parameters for <code>{activeTemplate.name}</code>
              </h3>

              {/* Header Media (Video or Image Uploader) */}
              {(activeTemplate.hasVideoHeader || activeTemplate.id === 'ciim2026_drgh_invite' || activeTemplate.name === 'ciim2026_drgh_invite') ? (
                <div className="wam__video-banner-box">
                  <div className="wam__video-banner-icon">🎬</div>
                  <div className="wam__video-banner-content">
                    <strong>Pre-attached Video Header: dr_ghp_invite_ciim_2026.mp4</strong>
                    <p>
                      This approved Meta/WATI template has Dr. Geetha Haripriya's personal video invitation permanently pre-attached. No upload is required — it will be delivered automatically with every WhatsApp message!
                    </p>
                  </div>
                </div>
              ) : activeTemplate.hasHeaderMedia ? (
                <div className="wam__form-group">
                  <label className="wam__label">
                    Template Header Image / Banner
                    <span className="wam__label-hint">(Select default, upload new, or paste URL)</span>
                  </label>

                  <div className="wam__image-modes">
                    <button
                      type="button"
                      className={`wam__preset-btn ${imageType === 'poster' ? 'is-active' : ''}`}
                      onClick={() => setImageType('poster')}
                    >
                      <img
                        src={DEFAULT_POSTER_URL}
                        alt="Thank you poster"
                        className="wam__preset-thumb"
                      />
                      <span className="wam__preset-text">Default Poster</span>
                    </button>

                    <button
                      type="button"
                      className="wam__preset-btn wam__preset-btn--upload"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <span className="wam__preset-custom-icon">&#128228;</span>
                      <span className="wam__preset-text">
                        {uploadingImage ? 'Uploading...' : '+ Upload New Image'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`wam__preset-btn ${imageType === 'custom' ? 'is-active' : ''}`}
                      onClick={() => setImageType('custom')}
                    >
                      <span className="wam__preset-custom-icon">&#128279;</span>
                      <span className="wam__preset-text">Custom Image URL</span>
                    </button>
                  </div>

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadNewImage(e.target.files[0]);
                    }}
                  />

                  {uploadedImages.length > 0 && (
                    <div className="wam__uploaded-gallery">
                      <span className="wam__gallery-label">Uploaded Image Gallery:</span>
                      <div className="wam__gallery-list">
                        {uploadedImages.map((img, i) => (
                          <div
                            key={i}
                            className={`wam__gallery-item ${imageType === img.url ? 'is-active' : ''}`}
                            onClick={() => setImageType(img.url)}
                            title={img.name}
                          >
                            <img src={img.url} alt={img.name} />
                            <span className="wam__gallery-name">{img.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {imageType === 'custom' && (
                    <input
                      type="url"
                      className="wam__input"
                      placeholder="https://example.com/banner.jpg"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <div className="wam__notice-box">
                  <span className="wam__notice-icon">&#10004;</span>
                  <div>
                    <strong>No Header Image Required</strong>
                    <p className="wam__notice-sub">
                      This template is formatted as a direct text message with interactive action
                      buttons.
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic Text Parameter Fields */}
              <div className="wam__dynamic-fields">
                {(activeTemplate.params || ['Name']).map((paramKey) => (
                  <div className="wam__form-group" key={paramKey}>
                    <label className="wam__label">
                      Parameter: <code>&#123;&#123;{paramKey}&#125;&#125;</code>
                      <span className="wam__label-hint">Default value (overridden by uploaded file)</span>
                    </label>
                    <input
                      type="text"
                      className="wam__input"
                      placeholder={`Default value for ${paramKey}`}
                      value={templateParamValues[paramKey] ?? ''}
                      onChange={(e) =>
                        setTemplateParamValues((prev) => ({
                          ...prev,
                          [paramKey]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Live Template Preview Bubble */}
            <div className="wam__preview-box">
              <div className="wam__preview-header">
                <span className="wam__preview-title">WhatsApp Live Message Preview</span>
              </div>
              <div className="wam__chat-bubble">
                {(activeTemplate.hasVideoHeader || activeTemplate.id === 'ciim2026_drgh_invite' || activeTemplate.name === 'ciim2026_drgh_invite') ? (
                  <div className="wam__chat-media wam__chat-media--video">
                    <div className="wam__chat-video-icon">🎬</div>
                    <div>
                      <div className="wam__chat-video-title">Invitation Video from Dr. Geetha Haripriya</div>
                      <div className="wam__chat-video-meta">MP4 Video &bull; Pre-attached in WATI (CIIM 2026)</div>
                    </div>
                  </div>
                ) : activeTemplate.hasHeaderMedia && resolvedImageUrl ? (
                  <div className="wam__chat-media">
                    <img src={resolvedImageUrl} alt="Header Banner" className="wam__chat-img" />
                  </div>
                ) : null}
                <div className="wam__chat-text">
                  <p className="wam__chat-preview-content">
                    {activeTemplate.body
                      ? activeTemplate.body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, p) => {
                          return (
                            templateParamValues[p] ||
                            (p.toLowerCase().includes('name') ? 'Dr. Karthikeyan' : match)
                          );
                        })
                      : 'Template Body'}
                  </p>

                  {activeTemplate.buttons && activeTemplate.buttons.length > 0 && (
                    <div className="wam__chat-buttons">
                      {activeTemplate.buttons.map((btn, i) => (
                        <div key={i} className="wam__chat-btn-item">
                          {btn}
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="wam__chat-time">
                    12:45 PM &bull; <span className="wam__chat-ticks">&#10003;&#10003;</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Single Test Send Box */}
            <div className="wam__single-test">
              <h3 className="wam__single-test-title">&#128241; Send 1 Test Message</h3>
              <p className="wam__single-test-desc">
                Verify message formatting on your phone before broadcasting.
              </p>
              <div className="wam__single-test-fields">
                <input
                  type="tel"
                  className="wam__input"
                  placeholder="Mobile (10 digits e.g. 9962460782)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={handleTestSend}
                  disabled={testSending || !testPhone}
                >
                  {testSending ? 'Sending...' : 'Test Send'}
                </Button>
              </div>

              {testResult && (
                <div className="wam__alert wam__alert--success">
                  &#10004; Test invitation delivered to {testPhone}! Status:{' '}
                  <strong>{testResult.status || 'SENT'}</strong>
                </div>
              )}
              {testError && <div className="wam__alert wam__alert--error">&#9888; {testError}</div>}
            </div>
          </section>

          {/* Step 2 & 3: File Upload & Audience Selection */}
          <section className="wam__card wam__card--audience">
            <div className="wam__card-header">
              <span className="wam__step-pill">Step 2 & 3</span>
              <div>
                <h2 className="wam__card-title">Audience Data & Row Selection</h2>
                <p className="wam__card-desc">
                  Upload contact list, select subset range (e.g. 1-20, 35-49), and broadcast
                </p>
              </div>
            </div>

            {/* Quick Audience Selection & Reuse Toolbar */}
            <div className="wam__audience-toolbar">
              {savedAudience && (
                <button
                  type="button"
                  className="wam__audience-tool-btn wam__audience-tool-btn--saved"
                  onClick={handleLoadSavedAudience}
                  title="Click to reload the previously uploaded 1400 user data"
                >
                  <span>⚡</span>
                  <span>Reuse Last Upload: <strong>{savedAudience.filename || 'Audience'}</strong> ({savedAudience.rowCount || savedAudience.rows?.length || 0} contacts)</span>
                </button>
              )}

              <button
                type="button"
                className="wam__audience-tool-btn"
                onClick={() => setShowCampaignPicker(true)}
                disabled={!campaignsList || campaignsList.length === 0}
                title="Select a past broadcast to reload all its recipient contacts"
              >
                <span>📋</span>
                <span>Load from Previous Broadcast ({campaignsList?.length || 0})</span>
              </button>

              <button
                type="button"
                className="wam__audience-tool-btn wam__audience-tool-btn--event"
                onClick={openEventRegistrationPicker}
                disabled={loadingRegistrations}
                title="Select registered users from any event page to broadcast WhatsApp marketing messages"
              >
                <span>👥</span>
                <span>Select Registered Users from Event</span>
              </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
              className={`wam__dropzone ${uploadedFile ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) processUploadedFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) processUploadedFile(e.target.files[0]);
                }}
              />
              <div className="wam__dropzone-icon">&#128194;</div>
              <div className="wam__dropzone-content">
                {uploadedFile ? (
                  <>
                    <p className="wam__dropzone-filename">{uploadedFile.name}</p>
                    <p className="wam__dropzone-sub">
                      {totalCount} contacts loaded &bull; Click to replace file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="wam__dropzone-label">
                      Drag and drop your contact file here, or <span className="wam__link">Browse</span>
                    </p>
                    <p className="wam__dropzone-types">Supports Excel (.xlsx, .xls), CSV (.csv), JSON (.json)</p>
                  </>
                )}
              </div>
            </div>

            {/* Dynamic Sample Templates Download Bar */}
            <div className="wam__sample-bar">
              <span className="wam__sample-label">
                Sample Formats for <strong>{activeTemplate.name}</strong>:
              </span>
              <button type="button" className="wam__sample-link" onClick={downloadSampleExcel}>
                &#128196; Excel (.xlsx)
              </button>
              <button type="button" className="wam__sample-link" onClick={downloadSampleCsv}>
                &#128195; CSV (.csv)
              </button>
              <button type="button" className="wam__sample-link" onClick={downloadSampleJson}>
                &#123;&#125; JSON (.json)
              </button>
              <button
                type="button"
                className="wam__sample-link wam__sample-link--load"
                onClick={loadSampleIntoEditor}
              >
                &#9889; Load Sample (12)
              </button>
            </div>

            {/* Column Mapping Controls */}
            {availableHeaders.length > 0 && (
              <div className="wam__col-mapping">
                <div className="wam__mapping-title">
                  &#9881; Column Mapping for <code>{activeTemplate.name}</code>:
                </div>
                <div className="wam__mapping-fields">
                  <div className="wam__mapping-item">
                    <label>Mobile Number Column:</label>
                    <select
                      className="wam__select"
                      value={columnMappings.Phone || ''}
                      onChange={(e) =>
                        setColumnMappings((prev) => ({ ...prev, Phone: e.target.value }))
                      }
                    >
                      {availableHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(activeTemplate.params || ['Name']).map((paramKey) => (
                    <div className="wam__mapping-item" key={paramKey}>
                      <label>Parameter &#123;&#123;{paramKey}&#125;&#125; Column:</label>
                      <select
                        className="wam__select"
                        value={columnMappings[paramKey] || ''}
                        onChange={(e) =>
                          setColumnMappings((prev) => ({ ...prev, [paramKey]: e.target.value }))
                        }
                      >
                        <option value="">-- Use Default / Blank --</option>
                        {availableHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Range Selection & Controls */}
            {parsedContacts.length > 0 && (
              <div className="wam__range-section">
                <div className="wam__range-header">
                  <div>
                    <h3 className="wam__range-title">&#127919; Target Range & Subsets</h3>
                    <p className="wam__range-desc">
                      Enter custom row ranges like <code>1-20, 35-49</code> to target specific users.
                    </p>
                  </div>
                  <div className="wam__selection-stat">
                    Selected: <strong>{selectedCount}</strong> / {totalCount}
                  </div>
                </div>

                {/* Range Input Box */}
                <form className="wam__range-form" onSubmit={handleApplyRange}>
                  <div className="wam__range-input-wrap">
                    <span className="wam__range-prefix">&#9776; Rows:</span>
                    <input
                      type="text"
                      className="wam__input wam__input--range"
                      placeholder="e.g. 1-20, 35-49, 55"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                    />
                    <Button variant="primary" size="sm" type="submit">
                      Apply Range
                    </Button>
                  </div>
                </form>

                {/* Quick Preset Buttons */}
                <div className="wam__quick-buttons">
                  <span className="wam__quick-label">Quick Select:</span>
                  <button type="button" className="wam__quick-btn" onClick={selectAll}>
                    All ({totalCount})
                  </button>
                  <button type="button" className="wam__quick-btn" onClick={() => selectFirstN(10)}>
                    First 10
                  </button>
                  <button type="button" className="wam__quick-btn" onClick={() => selectFirstN(25)}>
                    First 25
                  </button>
                  <button type="button" className="wam__quick-btn" onClick={() => selectFirstN(50)}>
                    First 50
                  </button>
                  <button type="button" className="wam__quick-btn" onClick={invertSelection}>
                    Invert
                  </button>
                  <button
                    type="button"
                    className="wam__quick-btn wam__quick-btn--clear"
                    onClick={clearSelection}
                  >
                    Clear
                  </button>
                </div>

                {/* Search Bar */}
                <div className="wam__search-bar">
                  <input
                    type="text"
                    className="wam__input wam__input--search"
                    placeholder="&#128269; Search list by name, phone or row number..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>

                {/* Interactive Table */}
                <div className="wam__table-wrap">
                  <table className="wam__table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input
                            type="checkbox"
                            checked={selectedCount === totalCount && totalCount > 0}
                            onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                          />
                        </th>
                        <th style={{ width: 65 }}>Row</th>
                        <th>Recipient Name</th>
                        <th>Mobile Number</th>
                        <th>Bound Parameters</th>
                        <th style={{ width: 90 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((contact) => {
                        const isSelected = selectedIndices.has(contact.id);
                        return (
                          <tr
                            key={contact.id}
                            className={`wam__table-row ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleRow(contact.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleRow(contact.id)}
                              />
                            </td>
                            <td>
                              <span className="wam__row-num">#{contact.rowNumber}</span>
                            </td>
                            <td>
                              <div className="wam__delegate-cell">
                                <span className="wam__avatar">{contact.name.charAt(0) || 'D'}</span>
                                <span className="wam__delegate-name">{contact.name}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`wam__phone-cell ${
                                  contact.isValidPhone ? 'is-valid' : 'is-invalid'
                                }`}
                              >
                                {contact.phone || contact.rawPhone || 'No Phone'}
                              </span>
                            </td>
                            <td>
                              <div className="wam__params-pill-list">
                                {Object.entries(contact.params || {}).map(([k, v]) => (
                                  <span key={k} className="wam__param-mini-badge" title={`${k}: ${v}`}>
                                    <strong>{k}:</strong> {String(v).slice(0, 15)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <span
                                className={`wam__status-badge ${
                                  isSelected ? 'wam__status-badge--ready' : 'wam__status-badge--pending'
                                }`}
                              >
                                {isSelected ? 'Selected' : 'Skipped'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Broadcast Action Box */}
                <div className="wam__broadcast-box">
                  <div className="wam__broadcast-info">
                    <h4 className="wam__broadcast-heading">&#128640; Ready to Broadcast</h4>
                    <p className="wam__broadcast-sub">
                      Broadcast template <code>{activeTemplate.name}</code> to{' '}
                      <strong>{selectedCount}</strong> selected recipient(s). All records will be
                      persisted in MongoDB Atlas.
                    </p>
                  </div>

                  <div className="wam__broadcast-actions">
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={broadcasting || selectedCount === 0}
                      onClick={() => setShowConfirmModal(true)}
                    >
                      {broadcasting
                        ? 'Broadcasting Messages...'
                        : `Send to ${selectedCount} Selected Recipient(s)`}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Broadcast Progress State */}
            {broadcasting && (
              <div className="wam__progress-card">
                <h4 className="wam__progress-title">Broadcasting Messages...</h4>
                <p className="wam__progress-sub">
                  Sequential dispatch active to protect delivery rates. Automatically saving to
                  database...
                </p>
                <div className="wam__progress-bar-bg">
                  <div
                    className="wam__progress-bar-fill"
                    style={{ width: `${broadcastProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {broadcastError && (
              <div className="wam__alert wam__alert--error">
                &#9888; Broadcast Error: {broadcastError}
              </div>
            )}
          </section>
        </div>
      )}

      {/* VIEW MODE 2: PERSISTENT LIVE MONITOR & CAMPAIGN HISTORY */}
      {activeViewMode === 'MONITOR' && (
        <div className="wam__monitor-view">
          {/* Top Bar: List of past campaigns */}
          <div className="wam__card wam__card--campaign-selector">
            <div className="wam__history-header">
              <div>
                <h2 className="wam__card-title">&#128203; Saved Broadcast History</h2>
                <p className="wam__card-desc">
                  Select a past dispatch below to inspect its members, filter by delivery status, or download reports.
                </p>
              </div>

              <div className="wam__history-actions">
                <input
                  type="text"
                  className="wam__input wam__input--history-search"
                  placeholder="&#128269; Search history..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                />
                <Button variant="secondary" size="sm" onClick={loadCampaigns}>
                  &#128260; Refresh History
                </Button>
                <Button variant="primary" size="sm" onClick={() => setActiveViewMode('DISPATCH')}>
                  + New Dispatch
                </Button>
              </div>
            </div>

            {/* Campaign Cards List */}
            {campaignsList.length === 0 ? (
              <div className="wam__empty-box">
                <p>No broadcast campaigns found in database yet.</p>
                <Button variant="primary" size="sm" onClick={() => setActiveViewMode('DISPATCH')}>
                  Launch Your First Broadcast
                </Button>
              </div>
            ) : filteredCampaignsList.length === 0 ? (
              <div className="wam__empty-box">
                <p>No broadcasts match your search "{historySearchQuery}".</p>
                <Button variant="secondary" size="sm" onClick={() => setHistorySearchQuery('')}>
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="wam__campaigns-scroll-list">
                {filteredCampaignsList.map((c) => {
                  const isSelected = selectedCampaignId === c._id;
                  const dateStr = new Date(c.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const timeStr = new Date(c.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={c._id}
                      className={`wam__campaign-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => loadCampaignDetails(c._id)}
                    >
                      <div className="wam__campaign-card-top">
                        <span className="wam__campaign-time">
                          &#128347; {dateStr} at {timeStr}
                        </span>
                        <span className="wam__tag wam__tag--purple">
                          {c.templateName}
                        </span>
                      </div>
                      <h4 className="wam__campaign-title">
                        {c.title || `${c.templateName} (${c.total} recipients)`}
                      </h4>
                      <div className="wam__campaign-stats-row">
                        {(() => {
                          const parsedTitleTotal = c.title ? c.title.match(/\((\d+)\s+recipients\)/i)?.[1] : null;
                          const displayTotal = parsedTitleTotal && Number(parsedTitleTotal) > (c.total || 0) ? Number(parsedTitleTotal) : (c.total || 0);
                          return (
                            <span className="wam__c-stat wam__c-stat--total">
                              Total: <strong>{displayTotal}</strong>
                            </span>
                          );
                        })()}
                        <span className="wam__c-stat wam__c-stat--delivered">
                          Delivered: <strong>{c.deliveredCount || 0}</strong>
                        </span>
                        <span className="wam__c-stat wam__c-stat--read">
                          Read: <strong>{c.readCount || 0}</strong>
                        </span>
                        {c.failedCount > 0 && (
                          <span className="wam__c-stat wam__c-stat--failed">
                            Failed: <strong>{c.failedCount}</strong>
                          </span>
                        )}
                      </div>

                      {/* Card Quick Export & Delete */}
                      <div className="wam__campaign-card-footer">
                        <span className="wam__card-export-label">Download:</span>
                        <button
                          type="button"
                          className="wam__card-export-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (activeCampaignData?._id === c._id) {
                              exportCampaignData('xlsx', false, activeCampaignData);
                            } else {
                              try {
                                const res = await whatsappMarketingApi.getCampaignById(c._id);
                                exportCampaignData('xlsx', false, res?.data?.campaign);
                              } catch (err) {
                                alert('Failed to download: ' + err.message);
                              }
                            }
                          }}
                          title="Download complete broadcast in Excel (.xlsx)"
                        >
                          📊 Excel
                        </button>
                        <button
                          type="button"
                          className="wam__card-export-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (activeCampaignData?._id === c._id) {
                              exportCampaignData('csv', false, activeCampaignData);
                            } else {
                              try {
                                const res = await whatsappMarketingApi.getCampaignById(c._id);
                                exportCampaignData('csv', false, res?.data?.campaign);
                              } catch (err) {
                                alert('Failed to download: ' + err.message);
                              }
                            }
                          }}
                          title="Download complete broadcast in CSV (.csv)"
                        >
                          📄 CSV
                        </button>
                        <button
                          type="button"
                          className="wam__card-export-btn wam__card-export-btn--delete"
                          onClick={(e) => handleDeleteCampaign(c._id, e)}
                          title="Permanently delete this test or broadcast record"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Campaign Detail Monitor (The Table of All Members Sent At This Time!) */}
          {activeCampaignData && (
            <div className="wam__card wam__card--campaign-detail">
              <div className="wam__detail-header">
                <div className="wam__detail-title-wrap">
                  <div className="wam__detail-meta-pill">
                    &#128347; Dispatched at{' '}
                    {new Date(activeCampaignData.createdAt).toLocaleDateString('en-GB')}{' '}
                    {new Date(activeCampaignData.createdAt).toLocaleTimeString()}
                  </div>
                  <h3 className="wam__card-title">
                    {activeCampaignData.title} &bull;{' '}
                    <code className="wam__template-code">{activeCampaignData.templateName}</code>
                  </h3>
                  <p className="wam__card-desc">
                    All <strong>{activeCampaignData.total} members</strong> dispatched in this
                    broadcast are listed below. Filter by status or download reports at any time.
                  </p>
                </div>

                <div className="wam__detail-actions">
                  {(activeCampaignData.status === 'RUNNING' ||
                    activeCampaignData.status === 'PAUSED' ||
                    activeCampaignData._id === liveCampaignId) && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setLiveCampaignId(activeCampaignData._id);
                        setLiveMonitorOpen(true);
                      }}
                    >
                      🔴 Open Live Monitor
                    </Button>
                  )}
                  {(campaignStatusCounts.FAILED > 0 || (activeCampaignData.failedCount > 0)) && (
                    <button
                      type="button"
                      className="wam__detail-retry-all-btn"
                      onClick={() => handleRetryAllFailed(activeCampaignData._id)}
                      disabled={retryingAll || actionLoading}
                      title={`Retry all ${campaignStatusCounts.FAILED || activeCampaignData.failedCount} failed messages sequentially one-by-one`}
                    >
                      {retryingAll
                        ? '⏳ Retrying Failed...'
                        : `↻ Retry All Failed (${campaignStatusCounts.FAILED || activeCampaignData.failedCount})`}
                    </button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSyncCampaignDelivery(activeCampaignData._id)}
                    disabled={syncingDeliveries}
                    title="Check handsets for delivery and read status"
                  >
                    {syncingDeliveries ? 'Syncing...' : '🔄 Sync Handset Deliveries'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRefreshCampaignStatuses(activeCampaignData._id, false)}
                    disabled={syncingStatuses}
                  >
                    {syncingStatuses ? 'Refreshing...' : '⚡ Full Status Refresh'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportCampaignData('xlsx', false)}
                    title="Download complete broadcast as Excel spreadsheet"
                  >
                    📊 Download Excel (.xlsx)
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportCampaignData('csv', false)}
                    title="Download complete broadcast as CSV file"
                  >
                    📄 Download CSV (.csv)
                  </Button>
                  <button
                    type="button"
                    className="wam__detail-delete-btn"
                    onClick={() => handleDeleteCampaign(activeCampaignData._id)}
                    title="Permanently delete this entire broadcast log"
                  >
                    🗑 Delete Broadcast
                  </button>
                </div>
              </div>

              {lastSyncTime && (
                <div className="wam__sync-indicator">
                  Last live status sync from WATI: {lastSyncTime}
                </div>
              )}

              {/* Status Filter Bar for this Campaign */}
              <div className="wam__status-filter-bar">
                <div className="wam__status-tabs">
                  <button
                    type="button"
                    className={`wam__status-tab ${campaignStatusFilter === 'ALL' ? 'is-active' : ''}`}
                    onClick={() => setCampaignStatusFilter('ALL')}
                  >
                    All ({campaignStatusCounts.ALL})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--read ${
                      campaignStatusFilter === 'READ' ? 'is-active' : ''
                    }`}
                    onClick={() => setCampaignStatusFilter('READ')}
                  >
                    &#10003;&#10003; Read ({campaignStatusCounts.READ})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--delivered ${
                      campaignStatusFilter === 'DELIVERED' ? 'is-active' : ''
                    }`}
                    onClick={() => setCampaignStatusFilter('DELIVERED')}
                  >
                    &#10003;&#10003; Delivered ({campaignStatusCounts.DELIVERED})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--sent ${
                      campaignStatusFilter === 'SENT' ? 'is-active' : ''
                    }`}
                    onClick={() => setCampaignStatusFilter('SENT')}
                  >
                    &#10003; Sent ({campaignStatusCounts.SENT})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--failed ${
                      campaignStatusFilter === 'FAILED' ? 'is-active' : ''
                    }`}
                    onClick={() => setCampaignStatusFilter('FAILED')}
                  >
                    &#9888; Failed ({campaignStatusCounts.FAILED})
                  </button>
                  {campaignStatusCounts.PENDING > 0 && (
                    <button
                      type="button"
                      className={`wam__status-tab wam__status-tab--pending ${
                        campaignStatusFilter === 'PENDING' ? 'is-active' : ''
                      }`}
                      onClick={() => setCampaignStatusFilter('PENDING')}
                    >
                      &#9202; Pending ({campaignStatusCounts.PENDING})
                    </button>
                  )}
                </div>

                <div className="wam__search-bar wam__search-bar--inline">
                  <input
                    type="text"
                    className="wam__input wam__input--search"
                    placeholder="&#128269; Search members by name or phone..."
                    value={campaignSearchFilter}
                    onChange={(e) => setCampaignSearchFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Active Filter & Filtered Downloads Banner */}
              {(campaignStatusFilter !== 'ALL' || campaignSearchFilter.trim()) && (
                <div className="wam__filter-active-bar">
                  <div className="wam__filter-active-info">
                    <span className="wam__filter-badge">
                      Filter: <strong>{campaignStatusFilter !== 'ALL' ? campaignStatusFilter : 'Search Query'}</strong>
                    </span>
                    <span className="wam__filter-count-text">
                      Showing <strong>{filteredCampaignRecipients.length}</strong> of{' '}
                      {campaignRecipients.length} members
                    </span>
                  </div>

                  <div className="wam__filter-active-downloads">
                    <span className="wam__download-label">Download Filtered List:</span>
                    <button
                      type="button"
                      className="wam__mini-download-btn wam__mini-download-btn--excel"
                      onClick={() => exportCampaignData('xlsx', true)}
                      title={`Download ${filteredCampaignRecipients.length} filtered members as Excel (.xlsx)`}
                    >
                      📊 Excel ({filteredCampaignRecipients.length})
                    </button>
                    <button
                      type="button"
                      className="wam__mini-download-btn wam__mini-download-btn--csv"
                      onClick={() => exportCampaignData('csv', true)}
                      title={`Download ${filteredCampaignRecipients.length} filtered members as CSV (.csv)`}
                    >
                      📄 CSV ({filteredCampaignRecipients.length})
                    </button>
                    {(campaignStatusFilter === 'FAILED' || campaignStatusCounts.FAILED > 0) && (
                      <button
                        type="button"
                        className="wam__mini-download-btn wam__mini-download-btn--retry-failed"
                        onClick={() => handleRetryAllFailed(activeCampaignData._id)}
                        disabled={retryingAll || !campaignStatusCounts.FAILED}
                        title={`Sequentially retry all ${campaignStatusCounts.FAILED} failed messages one-by-one`}
                      >
                        {retryingAll ? '⏳ Retrying...' : `↻ Retry All Failed (${campaignStatusCounts.FAILED})`}
                      </button>
                    )}
                    <button
                      type="button"
                      className="wam__filter-reset-link"
                      onClick={() => {
                        setCampaignStatusFilter('ALL');
                        setCampaignSearchFilter('');
                      }}
                      title="Clear filter and view all members"
                    >
                      ✕ Reset Filter
                    </button>
                  </div>
                </div>
              )}

              {/* Members Table */}
              <div className="wam__table-wrap">
                <table className="wam__table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>Recipient Name</th>
                      <th>Mobile Number</th>
                      <th style={{ width: 140 }}>Delivery Status</th>
                      <th>Sent Time</th>
                      <th>WATI Message ID</th>
                      <th style={{ width: 105, textAlign: 'center' }}>
                        {campaignStatusFilter === 'FAILED' && campaignStatusCounts.FAILED > 0 ? (
                          <button
                            type="button"
                            className="wam__th-retry-all-link"
                            onClick={() => handleRetryAllFailed(activeCampaignData._id)}
                            disabled={retryingAll}
                            title={`Retry all ${campaignStatusCounts.FAILED} failed messages sequentially`}
                          >
                            ↻ Retry All ({campaignStatusCounts.FAILED})
                          </button>
                        ) : (
                          'Action'
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaignRecipients.map((rec, i) => {
                      const isRetrying = retryingId === rec._id;
                      const timeString = rec.sentAt
                        ? new Date(rec.sentAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '-';

                      return (
                        <tr key={rec._id || i}>
                          <td>
                            <span className="wam__row-num">#{rec.rowIndex || i + 1}</span>
                          </td>
                          <td>
                            <div className="wam__delegate-cell">
                              <span className="wam__avatar">{rec.name?.charAt(0) || 'D'}</span>
                              <span className="wam__delegate-name">{rec.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="wam__phone-cell is-valid">
                              {rec.phone || rec.normalizedPhone}
                            </span>
                          </td>
                          <td>
                            <span className={`wam__status-badge wam__status-badge--${(rec.status || 'pending').toLowerCase()}`}>
                              {rec.status === 'READ' && (
                                <>
                                  <span className="wam__tick wam__tick--blue">&#10003;&#10003;</span> Read
                                </>
                              )}
                              {rec.status === 'DELIVERED' && (
                                <>
                                  <span className="wam__tick">&#10003;&#10003;</span> Delivered
                                </>
                              )}
                              {rec.status === 'SENT' && (
                                <>
                                  <span className="wam__tick">&#10003;</span> Sent
                                </>
                              )}
                              {rec.status === 'FAILED' && (
                                <>
                                  <span className="wam__tick wam__tick--error">&#9888;</span> Failed
                                </>
                              )}
                              {(!rec.status || rec.status === 'PENDING') && (
                                <>
                                  <span className="wam__tick">&#9202;</span> Pending
                                </>
                              )}
                            </span>
                            {rec.error && (
                              <span className="wam__status-error" title={rec.error}>
                                {rec.error}
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{timeString}</td>
                          <td style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b' }}>
                            {rec.messageId ? rec.messageId.slice(0, 18) + '...' : '-'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="wam__retry-btn"
                              onClick={(e) => handleRetryRecipient(rec, activeCampaignData._id, e)}
                              disabled={isRetrying}
                              title="Resend WhatsApp message to this recipient"
                            >
                              {isRetrying ? 'Sending...' : '↻ Retry'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="wam__modal-overlay">
          <div className="wam__modal">
            <h3 className="wam__modal-title">&#9888; Confirm WhatsApp Broadcast</h3>
            <p className="wam__modal-text">
              You are about to broadcast WhatsApp messages to <strong>{selectedCount}</strong>{' '}
              selected recipient(s) using the official WATI channel{' '}
              <strong>919940030935 (PRFC - Blast)</strong>.
            </p>
            <div className="wam__modal-summary">
              <div>
                <strong>Template:</strong> {activeTemplate.name} ({activeTemplate.category})
              </div>
              <div>
                <strong>Selected Rows:</strong> {rangeInput || `${selectedCount} contacts`}
              </div>
              <div>
                <strong>Header Media:</strong> {activeTemplate.hasHeaderMedia ? imageType : 'None (Text Only)'}
              </div>
            </div>
            <p className="wam__modal-note">
              This campaign will be permanently saved to your database and can be monitored anytime.
            </p>
            <div className="wam__modal-actions">
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={executeBroadcast}>
                Yes, Send {selectedCount} Messages
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Live Broadcast Mini-Widget (when modal minimized but campaign running) */}
      {!liveMonitorOpen && liveCampaignId && liveProgress && (liveProgress.status === 'RUNNING' || liveProgress.status === 'PAUSED') && (
        <div
          className="wam__floating-live-widget"
          onClick={() => setLiveMonitorOpen(true)}
          title="Click to open full Live Broadcast Monitor"
        >
          <div className="wam__floating-pulse"></div>
          <div className="wam__floating-content">
            <span className="wam__floating-title">
              {liveProgress.status === 'RUNNING' ? '🔴 Live WhatsApp Dispatch' : '⏸ Dispatch Paused'}
            </span>
            <span className="wam__floating-stat">
              {liveProgress.processedCount} / {liveProgress.total} ({liveProgress.percentage}%) &bull; Click to Monitor
            </span>
          </div>
        </div>
      )}

      {/* Live 1-by-1 Broadcast Monitor Modal */}
      {liveMonitorOpen && liveProgress && (
        <div className="wam__modal-overlay wam__modal-overlay--live">
          <div className="wam__modal wam__modal--live">
            {/* Header */}
            <div className="wam__live-modal-header">
              <div className="wam__live-header-info">
                <div className="wam__live-badge-row">
                  {liveProgress.status === 'RUNNING' && (
                    <span className="wam__live-pill wam__live-pill--running">
                      <span className="wam__live-pulse-dot"></span>
                      LIVE 1-BY-1 BROADCASTING
                    </span>
                  )}
                  {liveProgress.status === 'PAUSED' && (
                    <span className="wam__live-pill wam__live-pill--paused">
                      ⏸ BROADCAST PAUSED
                    </span>
                  )}
                  {liveProgress.status === 'STOPPED' && (
                    <span className="wam__live-pill wam__live-pill--stopped">
                      ⏹ BROADCAST STOPPED
                    </span>
                  )}
                  {liveProgress.status === 'COMPLETED' && (
                    <span className="wam__live-pill wam__live-pill--completed">
                      🎉 ALL 1,500 MESSAGES DISPATCHED
                    </span>
                  )}
                  <span className="wam__live-tag">{liveProgress.templateName}</span>
                </div>
                <h3 className="wam__live-modal-title">
                  {liveProgress.title || 'WhatsApp Bulk Broadcast Live Monitor'}
                </h3>
              </div>
              <div className="wam__live-header-actions">
                <button
                  type="button"
                  className="wam__live-close-btn"
                  onClick={() => setLiveMonitorOpen(false)}
                  title="Minimize monitor (broadcast continues sending in background)"
                >
                  ✕ Minimize
                </button>
              </div>
            </div>

            {/* Live Progress Bar Section */}
            <div className="wam__live-progress-section">
              <div className="wam__live-progress-labels">
                <span className="wam__live-progress-count">
                  <strong>{liveProgress.processedCount}</strong> of <strong>{liveProgress.total}</strong> processed ({liveProgress.percentage}%)
                </span>
                <span className="wam__live-speed-meta">
                  {liveProgress.status === 'RUNNING' && (
                    <>
                      ⚡ ~{liveProgress.speed || 0} msgs/sec &bull; ⏱ Est. Remaining:{' '}
                      {Math.floor((liveProgress.etaSeconds || 0) / 60)}m {(liveProgress.etaSeconds || 0) % 60}s
                    </>
                  )}
                  {liveProgress.status === 'COMPLETED' && '✓ 100% Broadcast Completed'}
                  {liveProgress.status === 'PAUSED' && 'Broadcast paused by admin'}
                </span>
              </div>
              <div className="wam__live-bar-track">
                <div
                  className={`wam__live-bar-fill ${liveProgress.status === 'RUNNING' ? 'is-animated' : ''}`}
                  style={{ width: `${Math.max(1, liveProgress.percentage)}%` }}
                >
                  <span className="wam__live-bar-glow"></span>
                </div>
              </div>
            </div>

            {/* Live KPI Metric Cards */}
            <div className="wam__live-kpi-grid">
              <div className="wam__live-kpi-card wam__live-kpi-card--total">
                <span className="wam__live-kpi-label">Total Recipients</span>
                <span className="wam__live-kpi-value">{liveProgress.total}</span>
                <span className="wam__live-kpi-sub">Target list size</span>
              </div>

              <div className="wam__live-kpi-card wam__live-kpi-card--sent">
                <span className="wam__live-kpi-label">Dispatched (Sent)</span>
                <span className="wam__live-kpi-value">
                  <span className="wam__live-check">&#10003;</span> {liveProgress.sentCount}
                </span>
                <span className="wam__live-kpi-sub">WATI server accepted</span>
              </div>

              <div className="wam__live-kpi-card wam__live-kpi-card--delivered">
                <div className="wam__live-kpi-header-row">
                  <span className="wam__live-kpi-label">Delivered</span>
                  <button
                    type="button"
                    className="wam__live-sync-mini-btn"
                    onClick={() => handleSyncCampaignDelivery(liveCampaignId)}
                    disabled={syncingDeliveries}
                    title="Check handsets for delivery"
                  >
                    {syncingDeliveries ? 'Syncing...' : '🔄 Sync'}
                  </button>
                </div>
                <span className="wam__live-kpi-value">
                  <span className="wam__live-ticks">&#10003;&#10003;</span> {liveProgress.deliveredCount || 0}
                </span>
                <span className="wam__live-kpi-sub">Reached user devices</span>
              </div>

              <div className="wam__live-kpi-card wam__live-kpi-card--read">
                <span className="wam__live-kpi-label">Read / Seen</span>
                <span className="wam__live-kpi-value">
                  <span className="wam__live-ticks wam__live-ticks--blue">&#10003;&#10003;</span> {liveProgress.readCount || 0}
                </span>
                <span className="wam__live-kpi-sub">Opened in WhatsApp</span>
              </div>

              <div className="wam__live-kpi-card wam__live-kpi-card--failed">
                <span className="wam__live-kpi-label">Failed / Invalid</span>
                <span className="wam__live-kpi-value">
                  <span className="wam__live-cross">&#9888;</span> {liveProgress.failedCount}
                </span>
                <span className="wam__live-kpi-sub">Rejections or invalid #</span>
              </div>

              <div className="wam__live-kpi-card wam__live-kpi-card--pending">
                <span className="wam__live-kpi-label">Remaining Queue</span>
                <span className="wam__live-kpi-value">{liveProgress.pendingCount}</span>
                <span className="wam__live-kpi-sub">Waiting for send turn</span>
              </div>
            </div>

            {/* Currently Sending Now Card */}
            {liveProgress.status === 'RUNNING' && liveProgress.currentRecipient && (
              <div className="wam__live-current-card">
                <div className="wam__live-current-spinner"></div>
                <div className="wam__live-current-info">
                  <span className="wam__live-current-tag">CURRENTLY DISPATCHING (1-BY-1):</span>
                  <h4 className="wam__live-current-name">
                    {liveProgress.currentRecipient.name} ({liveProgress.currentRecipient.phone})
                  </h4>
                  <span className="wam__live-current-row">Row #{liveProgress.currentRecipient.rowIndex}</span>
                </div>
              </div>
            )}

            {/* Completion Banner */}
            {liveProgress.status === 'COMPLETED' && (
              <div className="wam__live-completed-card">
                <div className="wam__live-completed-icon">🎉</div>
                <div className="wam__live-completed-info">
                  <h4 className="wam__live-completed-title">1,500 Bulk Broadcast Completed Successfully!</h4>
                  <p className="wam__live-completed-desc">
                    All <strong>{liveProgress.total}</strong> messages have been processed. <strong>{liveProgress.sentCount}</strong> delivered to WATI, <strong>{liveProgress.failedCount}</strong> invalid/failed.
                  </p>
                </div>
              </div>
            )}

            {/* Live Terminal / 1-by-1 Feed */}
            <div className="wam__live-feed-card">
              <div className="wam__live-feed-header">
                <span className="wam__live-feed-title">&#128220; Live 1-by-1 Stream Feed (Real-Time Status)</span>
                <span className="wam__live-feed-count">{liveProgress.recentLogs?.length || 0} recent items</span>
              </div>
              <div className="wam__live-feed-scroll">
                {(liveProgress.recentLogs && liveProgress.recentLogs.length > 0) ? (
                  [...liveProgress.recentLogs].reverse().map((log, idx) => {
                    const timeStr = log.time ? new Date(log.time).toLocaleTimeString() : '';
                    return (
                      <div
                        key={idx}
                        className={`wam__live-feed-row ${log.status === 'SENT' ? 'is-sent' : 'is-failed'}`}
                      >
                        <span className="wam__live-feed-time">[{timeStr}]</span>
                        <span className={`wam__live-feed-status ${log.status === 'SENT' ? 'wam__live-feed-status--sent' : 'wam__live-feed-status--failed'}`}>
                          {log.status === 'SENT' ? '✓ SENT' : '⚠ FAILED'}
                        </span>
                        <span className="wam__live-feed-name">
                          {log.name} ({log.phone || log.normalizedPhone})
                        </span>
                        <span className="wam__live-feed-msg">
                          {log.status === 'SENT' ? `ID: ${log.messageId || 'wati_sent'}` : `Error: ${log.error || 'Failed'}`}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="wam__live-feed-empty">
                    <span>Initializing dispatch stream...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Controls Footer */}
            <div className="wam__live-modal-footer">
              <div className="wam__live-footer-left">
                {liveProgress.status === 'RUNNING' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePauseBroadcast}
                    disabled={actionLoading}
                  >
                    ⏸ Pause Broadcast
                  </Button>
                )}
                {liveProgress.status === 'PAUSED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleResumeBroadcast}
                    disabled={actionLoading}
                  >
                    ▶ Resume Broadcast
                  </Button>
                )}
                {(liveProgress.status === 'RUNNING' || liveProgress.status === 'PAUSED') && (
                  <button
                    type="button"
                    className="wam__live-stop-btn"
                    onClick={handleStopBroadcast}
                    disabled={actionLoading}
                  >
                    ⏹ Stop Broadcast
                  </button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSyncCampaignDelivery(liveCampaignId)}
                  disabled={syncingDeliveries}
                >
                  {syncingDeliveries ? 'Syncing...' : '🔄 Check Handset Deliveries (WATI)'}
                </Button>
              </div>

              <div className="wam__live-footer-right">
                <button
                  type="button"
                  className="wam__live-download-btn"
                  onClick={async () => {
                    try {
                      const res = await whatsappMarketingApi.getCampaignById(liveCampaignId);
                      if (res?.data?.campaign) exportCampaignData('xlsx', false, res.data.campaign);
                    } catch (err) {
                      alert('Download failed: ' + err.message);
                    }
                  }}
                >
                  📊 Excel
                </button>
                <button
                  type="button"
                  className="wam__live-download-btn"
                  onClick={async () => {
                    try {
                      const res = await whatsappMarketingApi.getCampaignById(liveCampaignId);
                      if (res?.data?.campaign) exportCampaignData('csv', false, res.data.campaign);
                    } catch (err) {
                      alert('Download failed: ' + err.message);
                    }
                  }}
                >
                  📄 CSV
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setLiveMonitorOpen(false);
                    loadCampaigns();
                    loadCampaignDetails(liveCampaignId);
                    setActiveViewMode('MONITOR');
                  }}
                >
                  View Full Screen Monitor &rarr;
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Pick Past Campaign Audience */}
      {showCampaignPicker && (
        <div className="wam__campaign-picker-overlay" onClick={() => setShowCampaignPicker(false)}>
          <div className="wam__campaign-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wam__campaign-picker-header">
              <h3 className="wam__campaign-picker-title">📋 Select Previous Broadcast to Reuse Audience</h3>
              <button
                type="button"
                className="wam__btn-icon-close"
                onClick={() => setShowCampaignPicker(false)}
              >
                ✕
              </button>
            </div>
            <div className="wam__campaign-picker-body">
              <p style={{ margin: '0 0 10px 0', fontSize: '0.825rem', color: '#64748b' }}>
                Select any previous campaign below to instantly load all its recipient contacts into the current workspace:
              </p>
              {campaignsList.map((c) => (
                <div key={c._id} className="wam__campaign-item">
                  <div>
                    <div className="wam__campaign-item-name">{c.title || c.templateName}</div>
                    <div className="wam__campaign-item-sub">
                      Template: <code>{c.templateName}</code> &bull; Total: <strong>{c.total || 0} contacts</strong> &bull; {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={loadingCampaignAudience}
                    onClick={() => handleLoadAudienceFromCampaign(c._id)}
                  >
                    {loadingCampaignAudience ? 'Loading...' : 'Load Audience'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Select Registered Users from Event */}
      {showEventPickerModal && (
        <div className="wam__campaign-picker-overlay" onClick={() => setShowEventPickerModal(false)}>
          <div
            className="wam__campaign-picker-modal"
            style={{ maxWidth: '880px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wam__campaign-picker-header">
              <h3 className="wam__campaign-picker-title">👥 Select Registered Users from Event for WhatsApp Marketing</h3>
              <button
                type="button"
                className="wam__btn-icon-close"
                onClick={() => setShowEventPickerModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="wam__campaign-picker-body" style={{ maxHeight: '70vh', padding: '16px 20px' }}>
              {/* Event & Filter Toolbar */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Select Event:
                  </label>
                  <select
                    className="wam__input"
                    style={{ padding: '6px 10px', fontSize: '0.875rem' }}
                    value={eventPickerSelectedEvent}
                    onChange={(e) => handleEventPickerChange(e.target.value)}
                  >
                    {eventPickerEvents.map((ev) => (
                      <option key={ev.id || ev._id} value={ev.id || ev._id}>
                        {ev.title || 'Event'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Search Delegate:
                  </label>
                  <input
                    type="text"
                    className="wam__input"
                    style={{ padding: '6px 10px', fontSize: '0.875rem' }}
                    placeholder="Search name, phone, code..."
                    value={eventPickerSearch}
                    onChange={(e) => setEventPickerSearch(e.target.value)}
                  />
                </div>

                <div style={{ flex: '0 0 140px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Status:
                  </label>
                  <select
                    className="wam__input"
                    style={{ padding: '6px 10px', fontSize: '0.875rem' }}
                    value={eventPickerStatus}
                    onChange={(e) => handleEventPickerStatusChange(e.target.value)}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="all">All Statuses</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Selection Counter & Quick Toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 4px',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredPickerRegistrations.length > 0 &&
                        filteredPickerRegistrations.every((c) =>
                          eventPickerSelectedIds.has(c._id || c.RegistrationCode || String(c.Index))
                        )
                      }
                      onChange={(e) => {
                        const next = new Set(eventPickerSelectedIds);
                        if (e.target.checked) {
                          filteredPickerRegistrations.forEach((c) =>
                            next.add(c._id || c.RegistrationCode || String(c.Index))
                          );
                        } else {
                          filteredPickerRegistrations.forEach((c) =>
                            next.delete(c._id || c.RegistrationCode || String(c.Index))
                          );
                        }
                        setEventPickerSelectedIds(next);
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span>Select All Filtered ({filteredPickerRegistrations.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEventPickerSelectedIds(new Set())}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.8rem',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ color: '#475569', fontWeight: 600 }}>
                  Selected: <span style={{ color: '#047857', fontWeight: 700 }}>{eventPickerSelectedIds.size}</span> / {eventPickerList.length} registered delegates
                </div>
              </div>

              {/* Registrations List Table */}
              {eventPickerLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  ⏳ Loading registered delegates for selected event...
                </div>
              ) : filteredPickerRegistrations.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                  No registered users match your search or filter.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '340px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                    <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '40px', padding: '8px 10px', textAlign: 'center' }}></th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569' }}>Doctor Name & Phone</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569' }}>Email</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569' }}>Registration ID</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569' }}>Company / Coupon</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPickerRegistrations.map((c) => {
                        const idKey = c._id || c.RegistrationCode || String(c.Index);
                        const isChecked = eventPickerSelectedIds.has(idKey);
                        return (
                          <tr
                            key={idKey}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isChecked ? '#f0fdf4' : 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const next = new Set(eventPickerSelectedIds);
                              if (next.has(idKey)) next.delete(idKey);
                              else next.add(idKey);
                              setEventPickerSelectedIds(next);
                            }}
                          >
                            <td
                              style={{ textAlign: 'center', padding: '8px 10px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const next = new Set(eventPickerSelectedIds);
                                  if (next.has(idKey)) next.delete(idKey);
                                  else next.add(idKey);
                                  setEventPickerSelectedIds(next);
                                }}
                                style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <strong style={{ color: '#0f172a' }}>{c.Name}</strong>
                              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{c.Phone}</div>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#334155' }}>{c.Email || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                {c.RegistrationCode || c.DelegateId || '—'}
                              </code>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {c.Company ? `${c.Company} ` : ''}
                              {c.Coupon ? `(${c.Coupon})` : '—'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: c.Status === 'confirmed' ? '#dcfce7' : '#fee2e2',
                                  color: c.Status === 'confirmed' ? '#15803d' : '#b91c1c',
                                }}
                              >
                                {c.Status || 'confirmed'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  paddingTop: '14px',
                  borderTop: '1px solid #e2e8f0',
                  marginTop: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <Button variant="ghost" size="sm" onClick={() => setShowEventPickerModal(false)}>
                  Cancel
                </Button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleQuickLoadAllConfirmed}
                    disabled={eventPickerLoading || !eventPickerList.length}
                    title="Load all confirmed registrations without picking individual rows"
                  >
                    Quick Load All Confirmed ({eventPickerList.filter((c) => c.Status === 'confirmed' || !c.Status).length})
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ background: '#16a34a', borderColor: '#15803d', fontWeight: 700 }}
                    onClick={handleConfirmEventAudience}
                    disabled={eventPickerLoading || eventPickerSelectedIds.size === 0}
                  >
                    Load Selected ({eventPickerSelectedIds.size}) into Broadcast &rarr;
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
