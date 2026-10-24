import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { whatsappMarketingApi } from '../../lib/whatsappMarketingApi';
import Button from '../../components/ui/Button';
import './WhatsAppMarketing.css';

const DEFAULT_TEMPLATES = [
  {
    id: 'ciim2026_invite',
    name: 'ciim2026_invite',
    label: 'CIIM 2026 Personal Invitation (Marketing Approved)',
    category: 'Marketing',
    status: 'Approved',
    language: 'English (UK)',
    description: 'Personal invitation from Dr. Geetha Haripriya & Dr. Samhitha Moturi (Dates: 21 & 22 Nov 2026, The Leela Palace, Chennai) with Register & Call buttons.',
    defaultImageType: 'none',
    hasHeaderMedia: false,
    defaultExtra: '',
    params: ['Name'],
    buttons: [
      { type: 'url', text: 'Register Here', url: 'https://ciim.prashanthfertility.com/' },
      { type: 'call', text: 'Call Now', phone: '+919600047646' },
    ],
  },
  {
    id: 'ciim2026_registration_thankyou_02',
    name: 'ciim2026_registration_thankyou_02',
    label: 'Thank You Registration Template (Utility)',
    category: 'Utility',
    status: 'Approved',
    language: 'English (UK)',
    description: 'Header with conference poster banner, welcome letter, and optional custom extra note.',
    defaultImageType: 'poster',
    hasHeaderMedia: true,
    defaultExtra: '...',
    params: ['DrName', 'extra', 'img'],
  },
  {
    id: 'ciim2026_registration_5',
    name: 'ciim2026_registration_5',
    label: 'Registration 5 (QR Header + Ticket Link - Utility)',
    category: 'Utility',
    status: 'Approved',
    language: 'English (UK)',
    description: 'High-res QR code header with delegate name, dates/venue, and ticket link.',
    defaultImageType: 'qr_gold',
    hasHeaderMedia: true,
    defaultExtra: 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
    params: ['Name', 'extra', 'qr', 'QR'],
  },
];

const DEFAULT_IMAGE_PRESETS = [
  {
    id: 'poster',
    label: 'Official Thank You Poster Banner',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg',
    type: 'poster',
  },
  {
    id: 'qr_gold',
    label: 'Option 1: Royal Gold Standalone QR Code',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/option1_royal_gold_verified.png',
    type: 'qr',
  },
  {
    id: 'qr_gradient',
    label: 'Theme Gradient QR Code',
    url: 'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/sample_royal_qr.png',
    type: 'qr',
  },
];

const SAMPLE_CONTACTS = [
  { Name: 'Dr. Karthikeyan', Phone: '9962460782', Extra: 'Special Guest' },
  { Name: 'Dr. Priya Sharma', Phone: '9840123456', Extra: 'Senior Delegate' },
  { Name: 'Dr. Rajesh Kumar', Phone: '9841234567', Extra: 'Speaker' },
  { Name: 'Dr. Ananya Reddy', Phone: '9884567890', Extra: 'Delegate' },
  { Name: 'Dr. Suresh Babu', Phone: '9940123987', Extra: 'Faculty' },
  { Name: 'Dr. Meera Nambiar', Phone: '9840987654', Extra: 'VIP Delegate' },
  { Name: 'Dr. Vikram Seth', Phone: '9789123456', Extra: 'Delegate' },
  { Name: 'Dr. Kavitha Raman', Phone: '9841987654', Extra: 'Faculty' },
  { Name: 'Dr. Arunachalam S', Phone: '9884123789', Extra: 'Delegate' },
  { Name: 'Dr. Divya Iyer', Phone: '9940567123', Extra: 'Delegate' },
  { Name: 'Dr. Balaji Mohan', Phone: '9840345678', Extra: 'Delegate' },
  { Name: 'Dr. Geetha Venkatesh', Phone: '9789345678', Extra: 'Faculty' },
];

/**
 * Parses range expressions like "1-20, 35-49, 55"
 */
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

  // Template Selection (Defaults directly to the approved Marketing template)
  const [selectedTemplateId, setSelectedTemplateId] = useState('ciim2026_invite');
  const [imageType, setImageType] = useState('none');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [globalExtra, setGlobalExtra] = useState('');

  // Audience Data
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawDataRows, setRawDataRows] = useState([]);
  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [nameCol, setNameCol] = useState('');
  const [phoneCol, setPhoneCol] = useState('');
  const [extraCol, setExtraCol] = useState('');

  // Contact Delivery Status Map: { [contactId]: { status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED', error?: string, messageId?: string, lastUpdated?: string } }
  const [contactStatuses, setContactStatuses] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'READ' | 'DELIVERED' | 'SENT' | 'FAILED' | 'PENDING'
  const [retryingId, setRetryingId] = useState(null);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Selection & Range
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Single Test Send
  const [testPhone, setTestPhone] = useState('9962460782');
  const [testName, setTestName] = useState('Dr. Karthikeyan');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  // Batch Broadcast Execution
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastResults, setBroadcastResults] = useState(null);
  const [broadcastError, setBroadcastError] = useState('');

  const fileInputRef = useRef(null);

  // Load config on mount
  useEffect(() => {
    whatsappMarketingApi
      .getConfig()
      .then((res) => {
        if (res?.data) {
          setConfig(res.data);
          if (res.data.primaryTemplate) {
            setSelectedTemplateId(res.data.primaryTemplate);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load marketing config:', err);
      });
  }, []);

  const templates = config?.templates || DEFAULT_TEMPLATES;
  const imagePresets = config?.imagePresets || DEFAULT_IMAGE_PRESETS;
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Update default extra and image when template changes
  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      if (tmpl.defaultImageType) setImageType(tmpl.defaultImageType);
      else setImageType('none');
      if (tmpl.defaultExtra !== undefined) setGlobalExtra(tmpl.defaultExtra);
    }
  };

  // Process and normalize uploaded rows
  const parsedContacts = useMemo(() => {
    if (!rawDataRows.length) return [];

    return rawDataRows.map((row, index) => {
      const rawName = nameCol ? String(row[nameCol] || '').trim() : '';
      const rawPhone = phoneCol ? String(row[phoneCol] || '').trim() : '';
      const rawExtra = extraCol ? String(row[extraCol] || '').trim() : '';

      const digitsOnly = rawPhone.replace(/[^\d]/g, '');
      const isValidPhone = digitsOnly.length >= 10;
      const normalizedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

      const currentStatusInfo = contactStatuses[index] || {
        status: isValidPhone ? 'PENDING' : 'FAILED',
        error: isValidPhone ? null : 'Invalid phone number (must be at least 10 digits)',
      };

      return {
        id: index,
        rowNumber: index + 1,
        name: rawName || `Recipient #${index + 1}`,
        rawPhone: rawPhone,
        phone: normalizedPhone,
        isValidPhone,
        extra: rawExtra || globalExtra,
        status: currentStatusInfo.status,
        error: currentStatusInfo.error,
        messageId: currentStatusInfo.messageId,
        lastUpdated: currentStatusInfo.lastUpdated,
        originalData: row,
      };
    });
  }, [rawDataRows, nameCol, phoneCol, extraCol, globalExtra, contactStatuses]);

  // Status Counts
  const statusCounts = useMemo(() => {
    const counts = { ALL: parsedContacts.length, READ: 0, DELIVERED: 0, SENT: 0, FAILED: 0, PENDING: 0 };
    parsedContacts.forEach((c) => {
      const s = c.status || 'PENDING';
      if (counts[s] !== undefined) counts[s]++;
      else counts.PENDING++;
    });
    return counts;
  }, [parsedContacts]);

  // Filtered contacts for table view (filtered by search and status tab)
  const filteredContacts = useMemo(() => {
    return parsedContacts.filter((c) => {
      // Status filter
      if (statusFilter !== 'ALL' && c.status !== statusFilter) {
        return false;
      }
      // Search filter
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

  // Handle Range Input Change
  const handleApplyRange = (e) => {
    if (e) e.preventDefault();
    if (!parsedContacts.length) return;
    const newSelected = parseRangeString(rangeInput, parsedContacts.length);
    setSelectedIndices(newSelected);
  };

  // Quick Selection Helpers
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

  // Handle File Parsing (Excel, CSV, JSON)
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
          else {
            throw new Error('JSON file must contain an array of contact objects.');
          }
        }
        setupRowsAndHeaders(jsonContent);
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (!rows.length) {
          throw new Error('The uploaded spreadsheet is empty or has no data rows.');
        }
        setupRowsAndHeaders(rows);
      }
    } catch (err) {
      alert(`Error reading file: ${err.message}`);
      setUploadedFile(null);
    }
  };

  const setupRowsAndHeaders = (rows) => {
    if (!rows || !rows.length) return;
    setRawDataRows(rows);

    const headers = Object.keys(rows[0]);
    setAvailableHeaders(headers);

    const detectedName = headers.find((h) =>
      /^(name|full_?name|doctor_?name|delegate|dr_?name|dr\s*name|client)/i.test(h)
    );
    const detectedPhone = headers.find((h) =>
      /^(phone|mobile|whatsapp|contact|phone_?no|cell|mobile_?no|tel)/i.test(h)
    );
    const detectedExtra = headers.find((h) =>
      /^(extra|ticket|link|ticket_?url|notes|remarks|role)/i.test(h)
    );

    setNameCol(detectedName || headers[0] || '');
    setPhoneCol(detectedPhone || (headers.length > 1 ? headers[1] : headers[0]) || '');
    setExtraCol(detectedExtra || '');

    // Reset statuses and select all rows
    setContactStatuses({});
    const all = new Set(rows.map((_, i) => i));
    setSelectedIndices(all);
    setRangeInput(`1-${rows.length}`);
    setBroadcastResults(null);
  };

  // Download Sample Templates
  const downloadSampleExcel = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_CONTACTS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WhatsApp_Contacts');
    XLSX.writeFile(wb, 'ciim2026_marketing_sample_contacts.xlsx');
  };

  const downloadSampleCsv = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_CONTACTS);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ciim2026_marketing_sample_contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJson = () => {
    const jsonStr = JSON.stringify(SAMPLE_CONTACTS, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ciim2026_marketing_sample_contacts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSampleIntoEditor = () => {
    setupRowsAndHeaders(SAMPLE_CONTACTS);
    setUploadedFile({ name: 'ciim_invite_sample_delegates.xlsx' });
  };

  // Single Test Send
  const handleTestSend = async () => {
    setTestError('');
    setTestResult(null);
    setTestSending(true);

    try {
      const res = await whatsappMarketingApi.sendTestSingle({
        phone: testPhone,
        templateName: selectedTemplateId,
        name: testName,
        extra: globalExtra,
        imageType: activeTemplate.hasHeaderMedia ? imageType : 'none',
        customImageUrl,
      });
      setTestResult(res?.data || { success: true });
    } catch (err) {
      setTestError(err.message || 'Failed to deliver test message.');
    } finally {
      setTestSending(false);
    }
  };

  // Retry Single Contact Send
  const handleRetrySingle = async (contact, e) => {
    if (e) e.stopPropagation();
    setRetryingId(contact.id);

    try {
      const res = await whatsappMarketingApi.resendSingle({
        phone: contact.phone || contact.rawPhone,
        name: contact.name,
        templateName: selectedTemplateId,
        extra: contact.extra,
        imageType: activeTemplate.hasHeaderMedia ? imageType : 'none',
        customImageUrl,
      });

      if (res?.data?.sent) {
        setContactStatuses((prev) => ({
          ...prev,
          [contact.id]: {
            status: 'SENT',
            messageId: res.data.messageId,
            error: null,
            lastUpdated: new Date().toLocaleTimeString(),
          },
        }));
      } else {
        setContactStatuses((prev) => ({
          ...prev,
          [contact.id]: {
            status: 'FAILED',
            error: res?.data?.error || 'Failed to deliver',
            lastUpdated: new Date().toLocaleTimeString(),
          },
        }));
      }
    } catch (err) {
      setContactStatuses((prev) => ({
        ...prev,
        [contact.id]: {
          status: 'FAILED',
          error: err.message || 'Network error',
          lastUpdated: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setRetryingId(null);
    }
  };

  // Retry All Failed Contacts
  const handleRetryAllFailed = async () => {
    const failedContacts = parsedContacts.filter((c) => c.status === 'FAILED');
    if (!failedContacts.length) {
      alert('There are no failed contacts to retry.');
      return;
    }

    // Select only failed contacts
    const failedSet = new Set(failedContacts.map((c) => c.id));
    setSelectedIndices(failedSet);
    setShowConfirmModal(true);
  };

  // Query WATI for real-time delivery and read statuses
  const handleRefreshLiveStatuses = async () => {
    const sentContacts = parsedContacts.filter((c) => c.status && c.status !== 'PENDING');
    if (!sentContacts.length) {
      alert('No messages have been sent yet. Broadcast messages first to check delivery and read status.');
      return;
    }

    setSyncingStatuses(true);
    try {
      const phones = sentContacts.map((c) => c.phone).filter(Boolean);
      const res = await whatsappMarketingApi.checkStatuses({ phones });
      const serverStatuses = res?.data?.statuses || {};

      setContactStatuses((prev) => {
        const updated = { ...prev };
        parsedContacts.forEach((contact) => {
          const s = serverStatuses[contact.phone];
          if (s && s.status) {
            updated[contact.id] = {
              ...(updated[contact.id] || {}),
              status: s.status,
              messageId: s.messageId || updated[contact.id]?.messageId,
              error: s.failedDetail || null,
              lastUpdated: new Date().toLocaleTimeString(),
            };
          }
        });
        return updated;
      });
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Failed checking WATI statuses:', err);
      alert('Could not refresh statuses: ' + (err.message || 'WATI API error'));
    } finally {
      setSyncingStatuses(false);
    }
  };

  // Batch Broadcast Execution
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
    setBroadcastProgress(10);

    try {
      const payload = {
        templateName: selectedTemplateId,
        imageType: activeTemplate.hasHeaderMedia ? imageType : 'none',
        customImageUrl,
        globalExtra,
        recipients: selectedContacts.map((c) => ({
          rowIndex: c.rowNumber,
          name: c.name,
          phone: c.phone,
          extra: c.extra,
        })),
        throttleMs: 120,
      };

      const res = await whatsappMarketingApi.sendBatch(payload);
      setBroadcastProgress(100);
      setBroadcastResults(res?.data);

      // Update contactStatuses map with the dispatch results
      if (res?.data?.results) {
        setContactStatuses((prev) => {
          const updated = { ...prev };
          res.data.results.forEach((r) => {
            const contact = parsedContacts.find((c) => c.rowNumber === r.rowIndex);
            if (contact) {
              updated[contact.id] = {
                status: r.status || (r.sent ? 'SENT' : 'FAILED'),
                messageId: r.messageId,
                error: r.error,
                lastUpdated: new Date().toLocaleTimeString(),
              };
            }
          });
          return updated;
        });
      }
    } catch (err) {
      setBroadcastError(err.message || 'Error occurred while broadcasting WhatsApp messages.');
    } finally {
      setBroadcasting(false);
    }
  };

  // Export Results as CSV
  const exportResultsCsv = () => {
    if (!parsedContacts.length) return;
    const exportData = parsedContacts.map((c) => ({
      Row: c.rowNumber,
      Name: c.name,
      Phone: c.phone,
      Status: c.status,
      MessageId: c.messageId || '',
      Error: c.error || '',
      LastUpdated: c.lastUpdated || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_marketing_delivery_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = selectedIndices.size;
  const totalCount = parsedContacts.length;

  return (
    <div className="wam">
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
            <span className="wam__chip wam__chip--marketing">
              ✨ Marketing Approved: ciim2026_invite
            </span>
          </div>
          <h1 className="wam__title">WhatsApp Marketing & Campaign Dispatch</h1>
          <p className="wam__subtitle">
            Send client-approved marketing invitations, track live statuses (
            <strong>Sent</strong>, <strong>Delivered</strong>, <strong>Read</strong>,{' '}
            <strong>Failed</strong>), filter audience by delivery state, and retry instantly.
          </p>
        </div>

        <div className="wam__header-actions">
          <Button variant="secondary" onClick={loadSampleIntoEditor}>
            Load Demo Contacts (12)
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="wam__grid">
        {/* Step 1: Choose Template & Media */}
        <section className="wam__card wam__card--template">
          <div className="wam__card-header">
            <span className="wam__step-pill">Step 1</span>
            <div>
              <h2 className="wam__card-title">Approved Template: ciim2026_invite</h2>
              <p className="wam__card-desc">
                Official approved marketing invitation with interactive action buttons
              </p>
            </div>
          </div>

          <div className="wam__template-selector">
            {templates.map((tmpl) => (
              <label
                key={tmpl.id}
                className={`wam__template-card ${
                  selectedTemplateId === tmpl.id ? 'is-selected' : ''
                } ${tmpl.id === 'ciim2026_invite' ? 'wam__template-card--primary' : ''}`}
              >
                <input
                  type="radio"
                  name="template"
                  value={tmpl.id}
                  checked={selectedTemplateId === tmpl.id}
                  onChange={() => handleTemplateChange(tmpl.id)}
                />
                <div className="wam__template-card-body">
                  <div className="wam__template-card-title-row">
                    <span className="wam__template-name">{tmpl.label || tmpl.name}</span>
                    <span
                      className={`wam__tag ${
                        tmpl.category === 'Marketing' ? 'wam__tag--purple' : 'wam__tag--green'
                      }`}
                    >
                      {tmpl.category || 'Utility'} &bull; {tmpl.status || 'Approved'}
                    </span>
                  </div>
                  <p className="wam__template-desc">{tmpl.description}</p>
                  <div className="wam__template-meta">
                    <code className="wam__template-code">{tmpl.name}</code>
                    <span className="wam__lang-badge">{tmpl.language || 'English (UK)'}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Header Media / Image Preset (Only if template requires header media) */}
          {activeTemplate.hasHeaderMedia ? (
            <div className="wam__form-group">
              <label className="wam__label">Header Media / Banner</label>
              <div className="wam__image-presets">
                {imagePresets.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className={`wam__preset-btn ${imageType === preset.id ? 'is-active' : ''}`}
                    onClick={() => setImageType(preset.id)}
                  >
                    <img src={preset.url} alt={preset.label} className="wam__preset-thumb" />
                    <span className="wam__preset-text">{preset.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`wam__preset-btn ${imageType === 'custom' ? 'is-active' : ''}`}
                  onClick={() => setImageType('custom')}
                >
                  <span className="wam__preset-custom-icon">&#128279;</span>
                  <span className="wam__preset-text">Custom URL</span>
                </button>
              </div>

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
                <strong>Header Media: None required</strong>
                <p className="wam__notice-sub">
                  This approved marketing template delivers a clean, high-conversion text invitation
                  with interactive Call & Register action buttons.
                </p>
              </div>
            </div>
          )}

          {/* Live Template Preview Bubble */}
          <div className="wam__preview-box">
            <div className="wam__preview-header">
              <span className="wam__preview-title">WhatsApp Live Message Preview</span>
            </div>
            <div className="wam__chat-bubble">
              {activeTemplate.hasHeaderMedia && (
                <div className="wam__chat-media">
                  <img
                    src={
                      imageType === 'custom' && customImageUrl
                        ? customImageUrl
                        : (imagePresets.find((p) => p.id === imageType) || imagePresets[0]).url
                    }
                    alt="Template Banner"
                    className="wam__chat-img"
                  />
                </div>
              )}
              <div className="wam__chat-text">
                {selectedTemplateId === 'ciim2026_invite' ? (
                  <>
                    <p className="wam__chat-inviter">
                      A Personal Invitation from Dr. Geetha Haripriya & Dr. Samhitha Moturi
                    </p>
                    <p>
                      <strong>Dear Dr. {testName.replace(/^Dr\.\s*/i, '')},</strong>
                    </p>
                    <p>
                      I am delighted to invite you to{' '}
                      <strong>CIIM 2026 – Controversies in Infertility Management!</strong> ✨
                    </p>
                    <p>
                      📅 <strong>21st & 22nd November 2026</strong>
                      <br />
                      📍 <strong>The Leela Palace, Chennai</strong>
                    </p>
                    <p>
                      Join us for an inspiring exchange of knowledge and advancements in infertility
                      care.
                    </p>
                    <p>🤝 Your presence would mean a lot!</p>
                    <p className="wam__chat-link">
                      🔗 Register here: https://ciim.prashanthfertility.com/
                    </p>
                    <p>🎟️ Coupon Code Enquiries & Assistance</p>
                    <p>📞 Call or WhatsApp: +91 96000 47646</p>
                    <p className="wam__chat-closing">
                      Warm regards,
                      <br />
                      Organising committee, CIIM 2026
                    </p>
                    <div className="wam__chat-buttons">
                      <div className="wam__chat-btn-item">&#128279; Register Here</div>
                      <div className="wam__chat-btn-item">&#128222; Call Now</div>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>Dear Dr. {testName.replace(/^Dr\.\s*/i, '')},</strong>
                    </p>
                    <p>
                      Thank you for confirming your presence at the{' '}
                      <strong>2nd Chennai International Infertility Meet (CIIM 2026)</strong>.
                    </p>
                    <p>
                      <strong>Date:</strong> 06 - 08 February 2026
                      <br />
                      <strong>Venue:</strong> ITC Grand Chola, Guindy, Chennai
                    </p>
                  </>
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
                type="text"
                className="wam__input"
                placeholder="Doctor Name (e.g. Dr. Karthikeyan)"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
              <input
                type="tel"
                className="wam__input"
                placeholder="Mobile (10 digits)"
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
            {testError && (
              <div className="wam__alert wam__alert--error">&#9888; {testError}</div>
            )}
          </div>
        </section>

        {/* Step 2 & 3: File Upload, Audience Table, Status Filter & Retries */}
        <section className="wam__card wam__card--audience">
          <div className="wam__card-header">
            <span className="wam__step-pill">Step 2 & 3</span>
            <div>
              <h2 className="wam__card-title">Audience & Delivery Tracking</h2>
              <p className="wam__card-desc">
                Upload contact files, select range (e.g. 1-20, 35-49), monitor delivery states &
                retry
              </p>
            </div>
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

          {/* Sample Templates Download Bar */}
          <div className="wam__sample-bar">
            <span className="wam__sample-label">Download Sample Files:</span>
            <button type="button" className="wam__sample-link" onClick={downloadSampleExcel}>
              &#128196; Excel (.xlsx)
            </button>
            <button type="button" className="wam__sample-link" onClick={downloadSampleCsv}>
              &#128195; CSV (.csv)
            </button>
            <button type="button" className="wam__sample-link" onClick={downloadSampleJson}>
              &#123;&#125; JSON (.json)
            </button>
          </div>

          {/* Column Mapping Controls */}
          {availableHeaders.length > 0 && (
            <div className="wam__col-mapping">
              <div className="wam__mapping-title">&#9881; Column Mapping:</div>
              <div className="wam__mapping-fields">
                <div className="wam__mapping-item">
                  <label>Name Column:</label>
                  <select
                    className="wam__select"
                    value={nameCol}
                    onChange={(e) => setNameCol(e.target.value)}
                  >
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wam__mapping-item">
                  <label>Phone Column:</label>
                  <select
                    className="wam__select"
                    value={phoneCol}
                    onChange={(e) => setPhoneCol(e.target.value)}
                  >
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wam__mapping-item">
                  <label>Extra / Link (Opt):</label>
                  <select
                    className="wam__select"
                    value={extraCol}
                    onChange={(e) => setExtraCol(e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {availableHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Range Selection & Status Tracking Section */}
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

              {/* Status Filter Bar & Refresh Button */}
              <div className="wam__status-filter-bar">
                <div className="wam__status-tabs">
                  <button
                    type="button"
                    className={`wam__status-tab ${statusFilter === 'ALL' ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter('ALL')}
                  >
                    All ({statusCounts.ALL})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--read ${
                      statusFilter === 'READ' ? 'is-active' : ''
                    }`}
                    onClick={() => setStatusFilter('READ')}
                  >
                    &#10003;&#10003; Read ({statusCounts.READ})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--delivered ${
                      statusFilter === 'DELIVERED' ? 'is-active' : ''
                    }`}
                    onClick={() => setStatusFilter('DELIVERED')}
                  >
                    &#10003;&#10003; Delivered ({statusCounts.DELIVERED})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--sent ${
                      statusFilter === 'SENT' ? 'is-active' : ''
                    }`}
                    onClick={() => setStatusFilter('SENT')}
                  >
                    &#10003; Sent ({statusCounts.SENT})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--failed ${
                      statusFilter === 'FAILED' ? 'is-active' : ''
                    }`}
                    onClick={() => setStatusFilter('FAILED')}
                  >
                    &#9888; Failed ({statusCounts.FAILED})
                  </button>
                  <button
                    type="button"
                    className={`wam__status-tab wam__status-tab--pending ${
                      statusFilter === 'PENDING' ? 'is-active' : ''
                    }`}
                    onClick={() => setStatusFilter('PENDING')}
                  >
                    Pending ({statusCounts.PENDING})
                  </button>
                </div>

                <div className="wam__status-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshLiveStatuses}
                    disabled={syncingStatuses}
                  >
                    {syncingStatuses ? 'Syncing...' : '🔄 Refresh Live Status (WATI)'}
                  </Button>
                  {statusCounts.FAILED > 0 && (
                    <button
                      type="button"
                      className="wam__quick-btn wam__quick-btn--retry-all"
                      onClick={handleRetryAllFailed}
                    >
                      ↻ Retry All Failed ({statusCounts.FAILED})
                    </button>
                  )}
                </div>
              </div>

              {lastSyncTime && (
                <div className="wam__sync-indicator">
                  Last live status sync from WATI: {lastSyncTime}
                </div>
              )}

              {/* Search Bar */}
              <div className="wam__search-bar">
                <input
                  type="text"
                  className="wam__input wam__input--search"
                  placeholder="&#128269; Search table by name, phone or row number..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>

              {/* Interactive Audience Table */}
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
                      <th style={{ width: 130 }}>Delivery Status</th>
                      <th style={{ width: 95 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => {
                      const isSelected = selectedIndices.has(contact.id);
                      const isRetrying = retryingId === contact.id;
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
                              <div>
                                <span className="wam__delegate-name">{contact.name}</span>
                                {contact.extra && (
                                  <span className="wam__delegate-extra">{contact.extra}</span>
                                )}
                              </div>
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
                            <span className={`wam__status-badge wam__status-badge--${contact.status.toLowerCase()}`}>
                              {contact.status === 'READ' && (
                                <>
                                  <span className="wam__tick wam__tick--blue">&#10003;&#10003;</span> Read
                                </>
                              )}
                              {contact.status === 'DELIVERED' && (
                                <>
                                  <span className="wam__tick">&#10003;&#10003;</span> Delivered
                                </>
                              )}
                              {contact.status === 'SENT' && (
                                <>
                                  <span className="wam__tick">&#10003;</span> Sent
                                </>
                              )}
                              {contact.status === 'FAILED' && (
                                <>
                                  <span className="wam__tick wam__tick--error">&#9888;</span> Failed
                                </>
                              )}
                              {contact.status === 'PENDING' && (
                                <>
                                  <span className="wam__tick">&#9202;</span> Pending
                                </>
                              )}
                            </span>
                            {contact.error && (
                              <span className="wam__status-error" title={contact.error}>
                                {contact.error}
                              </span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="wam__retry-btn"
                              onClick={(e) => handleRetrySingle(contact, e)}
                              disabled={isRetrying || !contact.isValidPhone}
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

              {/* Broadcast Action Card */}
              <div className="wam__broadcast-box">
                <div className="wam__broadcast-info">
                  <h4 className="wam__broadcast-heading">&#128640; Launch WhatsApp Campaign</h4>
                  <p className="wam__broadcast-sub">
                    Broadcast template <code>{activeTemplate.name}</code> to{' '}
                    <strong>{selectedCount}</strong> selected recipient(s) using channel{' '}
                    <strong>919940030935 (PRFC - Blast)</strong>.
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
                Throttled dispatch active to protect delivery rates. Please do not close this window.
              </p>
              <div className="wam__progress-bar-bg">
                <div
                  className="wam__progress-bar-fill"
                  style={{ width: `${broadcastProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Broadcast Results Summary */}
          {broadcastResults && (
            <div className="wam__results-card">
              <div className="wam__results-header">
                <div>
                  <h3 className="wam__results-title">&#10004; Broadcast Execution Complete</h3>
                  <p className="wam__results-sub">
                    Campaign finished for template <code>{broadcastResults.templateName}</code>
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={exportResultsCsv}>
                  &#128229; Download CSV Report
                </Button>
              </div>

              <div className="wam__results-stats">
                <div className="wam__stat-box">
                  <span className="wam__stat-label">Total Targeted</span>
                  <span className="wam__stat-val">{broadcastResults.total}</span>
                </div>
                <div className="wam__stat-box wam__stat-box--green">
                  <span className="wam__stat-label">Delivered Successfully</span>
                  <span className="wam__stat-val">{broadcastResults.sentCount}</span>
                </div>
                <div className="wam__stat-box wam__stat-box--red">
                  <span className="wam__stat-label">Failed / Invalid</span>
                  <span className="wam__stat-val">{broadcastResults.failedCount}</span>
                </div>
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
                <strong>Channel:</strong> 919940030935 (PRFC - Blast)
              </div>
            </div>
            <p className="wam__modal-note">
              Messages will be sent sequentially with personalized recipient names. Are you sure you
              wish to proceed?
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
    </div>
  );
}
