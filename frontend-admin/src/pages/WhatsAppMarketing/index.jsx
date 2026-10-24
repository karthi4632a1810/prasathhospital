import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { whatsappMarketingApi } from '../../lib/whatsappMarketingApi';
import Button from '../../components/ui/Button';
import './WhatsAppMarketing.css';

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

const DEFAULT_TEMPLATES = [
  {
    id: 'ciim2026_registration_thankyou_02',
    name: 'ciim2026_registration_thankyou_02',
    label: 'Thank You Registration Template (Utility)',
    description: 'Header with official conference poster, personalized welcome letter, and optional custom extra note.',
    defaultImageType: 'poster',
    defaultExtra: '...',
    params: ['DrName', 'extra', 'img'],
  },
  {
    id: 'ciim2026_registration_5',
    name: 'ciim2026_registration_5',
    label: 'Registration 5 (QR Header + Ticket Link - Utility)',
    description: 'High-res QR code header with delegate name, dates/venue, and ticket link.',
    defaultImageType: 'qr_gold',
    defaultExtra: 'https://ciim.prashanthfertility.com/tickets/CIIM-TEST-KARTHIKEYAN',
    params: ['Name', 'extra', 'qr', 'QR'],
  },
  {
    id: 'ciim2026_registration_1',
    name: 'ciim2026_registration_1',
    label: 'Registration 1 (QR Code Header - Utility)',
    description: 'Standard confirmed registration template with QR image header.',
    defaultImageType: 'qr_gold',
    defaultExtra: '',
    params: ['Name', 'QR'],
  },
];

// Sample demo contacts for 1-click template download & immediate testing
const SAMPLE_CONTACTS = [
  { Name: 'Dr. Karthikeyan', Phone: '9962460782', Extra: 'Special Guest' },
  { Name: 'Dr. Priya Sharma', Phone: '9840123456', Extra: 'Senior Delegate' },
  { Name: 'Dr. Rajesh Kumar', Phone: '9841234567', Extra: 'Speaker' },
  { Name: 'Dr. Ananya Reddy', Phone: '9884567890', Extra: 'Delegate' },
  { Name: 'Dr. Suresh Babu', Phone: '9940123987', Extra: 'Workshop Pass' },
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
 * Returns a Set of 0-based row indices.
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
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Template & Media Selection
  const [selectedTemplateId, setSelectedTemplateId] = useState('ciim2026_registration_thankyou_02');
  const [imageType, setImageType] = useState('poster');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [globalExtra, setGlobalExtra] = useState('...');

  // Audience Data
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawDataRows, setRawDataRows] = useState([]);
  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [nameCol, setNameCol] = useState('');
  const [phoneCol, setPhoneCol] = useState('');
  const [extraCol, setExtraCol] = useState('');

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
  const [broadcastCurrent, setBroadcastCurrent] = useState(0);
  const [broadcastTotal, setBroadcastTotal] = useState(0);
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
        }
      })
      .catch((err) => {
        console.warn('Could not load marketing config:', err);
      })
      .finally(() => {
        setLoadingConfig(false);
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

      // Normalize phone digits
      const digitsOnly = rawPhone.replace(/[^\d]/g, '');
      const isValidPhone = digitsOnly.length >= 10;
      const normalizedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

      return {
        id: index,
        rowNumber: index + 1,
        name: rawName || `Recipient #${index + 1}`,
        rawPhone: rawPhone,
        phone: normalizedPhone,
        isValidPhone,
        extra: rawExtra || globalExtra,
        originalData: row,
      };
    });
  }, [rawDataRows, nameCol, phoneCol, extraCol, globalExtra]);

  // Filtered contacts for table view
  const filteredContacts = useMemo(() => {
    if (!searchFilter.trim()) return parsedContacts;
    const q = searchFilter.toLowerCase();
    return parsedContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || String(c.rowNumber) === q
    );
  }, [parsedContacts, searchFilter]);

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
        // Excel (.xlsx, .xls) or CSV
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

    // Auto-detect columns
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

    // Default select all rows
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
    XLSX.writeFile(wb, 'whatsapp_marketing_sample_contacts.xlsx');
  };

  const downloadSampleCsv = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_CONTACTS);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_marketing_sample_contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJson = () => {
    const jsonStr = JSON.stringify(SAMPLE_CONTACTS, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_marketing_sample_contacts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load sample contacts directly into editor for instant preview
  const loadSampleIntoEditor = () => {
    setupRowsAndHeaders(SAMPLE_CONTACTS);
    setUploadedFile({ name: 'sample_ciim_delegates.xlsx (Preloaded)' });
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
        imageType,
        customImageUrl,
      });
      setTestResult(res?.data || { success: true });
    } catch (err) {
      setTestError(err.message || 'Failed to deliver test message.');
    } finally {
      setTestSending(false);
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
    setBroadcastTotal(selectedContacts.length);
    setBroadcastCurrent(0);
    setBroadcastProgress(5);

    try {
      // Chunk or execute batch request
      const payload = {
        templateName: selectedTemplateId,
        imageType,
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
    } catch (err) {
      setBroadcastError(err.message || 'Error occurred while broadcasting WhatsApp messages.');
    } finally {
      setBroadcasting(false);
    }
  };

  // Export Results as CSV
  const exportResultsCsv = () => {
    if (!broadcastResults?.results?.length) return;
    const ws = XLSX.utils.json_to_sheet(broadcastResults.results);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_broadcast_report_${new Date().toISOString().slice(0, 10)}.csv`;
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
          </div>
          <h1 className="wam__title">WhatsApp Marketing & Broadcast</h1>
          <p className="wam__subtitle">
            Upload contact lists (.xlsx, .csv, .json), select custom audience ranges (e.g. 1-20, 35-49),
            pick an approved WATI template, and broadcast personalized messages.
          </p>
        </div>

        <div className="wam__header-actions">
          <Button variant="secondary" onClick={loadSampleIntoEditor}>
            Load Demo Contacts (12)
          </Button>
        </div>
      </header>

      {/* Main Grid: Left Config, Right Audience & Execution */}
      <div className="wam__grid">
        {/* Step 1: Choose Template & Media */}
        <section className="wam__card wam__card--template">
          <div className="wam__card-header">
            <span className="wam__step-pill">Step 1</span>
            <div>
              <h2 className="wam__card-title">Choose WATI Template</h2>
              <p className="wam__card-desc">Select official approved utility template & header media</p>
            </div>
          </div>

          <div className="wam__template-selector">
            {templates.map((tmpl) => (
              <label
                key={tmpl.id}
                className={`wam__template-card ${
                  selectedTemplateId === tmpl.id ? 'is-selected' : ''
                }`}
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
                    <span className="wam__tag wam__tag--green">Utility</span>
                  </div>
                  <p className="wam__template-desc">{tmpl.description}</p>
                  <code className="wam__template-code">{tmpl.name}</code>
                </div>
              </label>
            ))}
          </div>

          {/* Header Image Preset */}
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

          {/* Extra / Link Parameter */}
          <div className="wam__form-group">
            <label className="wam__label">
              Extra Parameter Value
              <span className="wam__label-hint">
                (Used if contact row does not specify a custom extra)
              </span>
            </label>
            <input
              type="text"
              className="wam__input"
              value={globalExtra}
              onChange={(e) => setGlobalExtra(e.target.value)}
              placeholder="e.g. https://ciim.prashanthfertility.com or ..."
            />
          </div>

          {/* Live Template Preview Bubble */}
          <div className="wam__preview-box">
            <div className="wam__preview-header">
              <span className="wam__preview-title">WhatsApp Live Message Preview</span>
            </div>
            <div className="wam__chat-bubble">
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
              <div className="wam__chat-text">
                <p>
                  <strong>Dear Dr. {testName.replace(/^Dr\.\s*/i, '')},</strong>
                </p>
                {selectedTemplateId === 'ciim2026_registration_thankyou_02' ? (
                  <>
                    <p>
                      Thank you for confirming your presence at the{' '}
                      <strong>2nd Chennai International Infertility Meet (CIIM 2026)</strong>.
                    </p>
                    <p>
                      <strong>Date:</strong> 06 - 08 February 2026
                      <br />
                      <strong>Venue:</strong> ITC Grand Chola, Guindy, Chennai
                    </p>
                    {globalExtra && globalExtra !== '...' && <p>{globalExtra}</p>}
                    <p>We look forward to welcoming you.</p>
                  </>
                ) : (
                  <>
                    <p>
                      Your registration for <strong>CIIM 2026</strong> is confirmed.
                    </p>
                    <p>
                      <strong>Venue:</strong> ITC Grand Chola, Chennai
                      <br />
                      <strong>Dates:</strong> 06 - 08 February 2026
                    </p>
                    {globalExtra && (
                      <p className="wam__chat-link">
                        &#127915; {globalExtra}
                      </p>
                    )}
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
                &#10004; Test message delivered to {testPhone}! Message ID: {testResult.messageId}
              </div>
            )}
            {testError && (
              <div className="wam__alert wam__alert--error">
                &#9888; {testError}
              </div>
            )}
          </div>
        </section>

        {/* Step 2 & 3: File Upload, Range Selection & Audience Table */}
        <section className="wam__card wam__card--audience">
          <div className="wam__card-header">
            <span className="wam__step-pill">Step 2 & 3</span>
            <div>
              <h2 className="wam__card-title">Upload Audience & Select Range</h2>
              <p className="wam__card-desc">
                Upload contacts file, specify exact rows or range (e.g. 1-20, 35-49)
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
            <span className="wam__sample-label">Download Sample Formats:</span>
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

          {/* Column Mapping Controls (Visible when headers are present) */}
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
                    <option value="">-- None (Use Global Extra) --</option>
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

          {/* Range Selection & Quick Action Controls */}
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
                <button type="button" className="wam__quick-btn wam__quick-btn--clear" onClick={clearSelection}>
                  Clear
                </button>
              </div>

              {/* Search Table */}
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
                      <th style={{ width: 70 }}>Row</th>
                      <th>Recipient Name</th>
                      <th>Mobile Number</th>
                      <th>Extra Parameter</th>
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
                            <span className="wam__extra-cell">
                              {contact.extra || globalExtra || '-'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`wam__row-status ${
                                isSelected ? 'wam__row-status--ready' : 'wam__row-status--skipped'
                              }`}
                            >
                              {isSelected ? 'Ready' : 'Skipped'}
                            </span>
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
                  <h4 className="wam__broadcast-heading">&#128640; Ready to Launch Campaign</h4>
                  <p className="wam__broadcast-sub">
                    You have selected <strong>{selectedCount}</strong> recipient(s). Each will receive
                    the <code>{activeTemplate.name}</code> template customized with their name and phone.
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
                  <span className="wam__stat-label">Total Selected</span>
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

              {/* Delivery Log Table */}
              <div className="wam__log-table-wrap">
                <table className="wam__table wam__table--log">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcastResults.results?.map((res, i) => (
                      <tr key={i}>
                        <td>#{res.rowIndex}</td>
                        <td>{res.name}</td>
                        <td>{res.phone || res.normalizedPhone}</td>
                        <td>
                          {res.sent ? (
                            <span className="wam__log-badge wam__log-badge--success">
                              &#10004; Sent
                            </span>
                          ) : (
                            <span className="wam__log-badge wam__log-badge--fail">
                              &#10008; Failed
                            </span>
                          )}
                        </td>
                        <td className="wam__log-detail">
                          {res.sent ? `ID: ${res.messageId}` : res.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <strong>Template:</strong> {activeTemplate.name}
              </div>
              <div>
                <strong>Selected Rows:</strong> {rangeInput || `${selectedCount} contacts`}
              </div>
              <div>
                <strong>Header Media:</strong> {imageType}
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
