import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { whatsappMarketingApi } from '../../lib/whatsappMarketingApi';
import Button from '../../components/ui/Button';
import './WhatsAppMarketing.css';

// Default Thank You Poster Banner (QR code options removed as requested)
const DEFAULT_POSTER_URL =
  'https://raw.githubusercontent.com/karthi4632a1810/prasathhospital/main/backend/src/assets/thankyou-img.jpg';

const LOCAL_STORAGE_IMAGES_KEY = 'ciim_wam_uploaded_images';

// Helper to generate sample delegate names & phones
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
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Template Search & Category Filter (All / Marketing / Utility)
  const [templateCategoryTab, setTemplateCategoryTab] = useState('ALL'); // 'ALL' | 'MARKETING' | 'UTILITY'
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('ciim2026_invite');

  // Dynamic Template Parameter Values (Key-value map for the chosen template)
  const [templateParamValues, setTemplateParamValues] = useState({});

  // Image Selection: 'poster' | 'custom' | URL string of uploaded image
  const [imageType, setImageType] = useState('poster');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Audience Data
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawDataRows, setRawDataRows] = useState([]);
  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [columnMappings, setColumnMappings] = useState({}); // { [paramKey]: headerName }

  // Contact Delivery Status Map
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
  const imageInputRef = useRef(null);

  // Load saved uploaded images from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_IMAGES_KEY);
      if (saved) {
        setUploadedImages(JSON.parse(saved));
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  // Save uploaded images to localStorage
  const saveUploadedImage = (newImg) => {
    setUploadedImages((prev) => {
      const updated = [newImg, ...prev.filter((img) => img.url !== newImg.url)].slice(0, 15);
      try {
        localStorage.setItem(LOCAL_STORAGE_IMAGES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      return updated;
    });
  };

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
      })
      .finally(() => {
        setLoadingConfig(false);
      });
  }, []);

  const allTemplates = config?.templates || [];
  const activeTemplate =
    allTemplates.find((t) => t.id === selectedTemplateId) ||
    allTemplates[0] || {
      id: 'ciim2026_invite',
      name: 'ciim2026_invite',
      label: 'CIIM 2026 Personal Invitation',
      category: 'MARKETING',
      params: ['Name'],
      hasHeaderMedia: false,
    };

  // Filter templates by category and search query
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      if (templateCategoryTab !== 'ALL' && t.category !== templateCategoryTab) {
        return false;
      }
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

  // Handle template selection
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    const tmpl = allTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;

    // Reset or initialize default parameter values
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

    // Auto update column mappings if a file was already loaded
    if (availableHeaders.length > 0) {
      updateColumnMappingsForTemplate(tmpl, availableHeaders);
    }
  };

  // Helper to update column mappings based on template parameters
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

  // Upload an image file for templates
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

  // Determine final image URL
  const resolvedImageUrl = useMemo(() => {
    if (imageType === 'none') return '';
    if (imageType === 'poster') return DEFAULT_POSTER_URL;
    if (imageType === 'custom') return customImageUrl.trim();
    if (imageType.startsWith('http://') || imageType.startsWith('https://')) return imageType;
    return DEFAULT_POSTER_URL;
  }, [imageType, customImageUrl]);

  // Process and normalize uploaded rows with dynamic template parameter extraction
  const parsedContacts = useMemo(() => {
    if (!rawDataRows.length) return [];

    const phoneCol = columnMappings.Phone || 'Phone';
    const declaredParams = activeTemplate.params || ['Name'];

    return rawDataRows.map((row, index) => {
      const rawPhone = String(row[phoneCol] || row.Phone || row.phone || row.mobile || '').trim();
      const digitsOnly = rawPhone.replace(/[^\d]/g, '');
      const isValidPhone = digitsOnly.length >= 10;
      const normalizedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

      // Extract each parameter required by the template from the row
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

      // Name fallback
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

  // Filtered contacts for table view
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

  // Range Input Change
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

  // Handle File Upload (Excel, CSV, JSON)
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

  const setupRowsAndHeaders = (rows) => {
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
  };

  // Generate dynamic sample data matching EXACT parameters of the currently chosen template
  const generateTemplateSampleData = () => {
    const declaredParams = activeTemplate.params || ['Name'];

    return SAMPLE_DELEGATES.map((del, idx) => {
      const sampleRow = {
        Phone: del.phone,
      };

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

  // Dynamic Sample File Downloads
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

  // Single Test Send
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

  // Retry Single Contact Send
  const handleRetrySingle = async (contact, e) => {
    if (e) e.stopPropagation();
    setRetryingId(contact.id);

    try {
      const res = await whatsappMarketingApi.resendSingle({
        phone: contact.phone || contact.rawPhone,
        name: contact.name,
        templateName: selectedTemplateId,
        customParamsValues: contact.params || templateParamValues,
        imageType: activeTemplate.hasHeaderMedia ? imageType : 'none',
        customImageUrl: resolvedImageUrl,
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
        customImageUrl: resolvedImageUrl,
        globalParams: templateParamValues,
        recipients: selectedContacts.map((c) => ({
          rowIndex: c.rowNumber,
          name: c.name,
          phone: c.phone,
          params: c.params,
          originalData: c.originalData,
        })),
        throttleMs: 120,
      };

      const res = await whatsappMarketingApi.sendBatch(payload);
      setBroadcastProgress(100);
      setBroadcastResults(res?.data);

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
            <span className="wam__chip wam__chip--total-templates">
              {allTemplates.length} Approved Templates Loaded
            </span>
          </div>
          <h1 className="wam__title">WhatsApp Marketing & Multi-Template Dispatch</h1>
          <p className="wam__subtitle">
            Choose from all WATI <strong>Marketing</strong> & <strong>Utility</strong> templates,
            upload custom banners, customize dynamic parameters, filter by delivery status, and
            broadcast personalized messages.
          </p>
        </div>

        <div className="wam__header-actions">
          <Button variant="secondary" onClick={loadSampleIntoEditor}>
            Load Sample for {activeTemplate.name}
          </Button>
        </div>
      </header>

      {/* Main Grid */}
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
                } ${tmpl.id === 'ciim2026_invite' ? 'wam__template-card--primary' : ''}`}
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
                    <span
                      className={`wam__tag ${
                        tmpl.category === 'MARKETING' ? 'wam__tag--purple' : 'wam__tag--green'
                      }`}
                    >
                      {tmpl.category} &bull; Approved
                    </span>
                  </div>
                  <p className="wam__template-desc">
                    {tmpl.body ? tmpl.body.slice(0, 110) + '...' : 'WATI Approved Template'}
                  </p>
                  <div className="wam__template-meta">
                    <code className="wam__template-code">{tmpl.name}</code>
                    {tmpl.hasHeaderMedia && (
                      <span className="wam__media-badge">&#128444; Image Header</span>
                    )}
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

            {/* Header Media / Image Uploader (Visible only if template requires an image) */}
            {activeTemplate.hasHeaderMedia ? (
              <div className="wam__form-group">
                <label className="wam__label">
                  Template Header Image / Banner
                  <span className="wam__label-hint">(Select default, upload new, or paste URL)</span>
                </label>

                {/* Image Mode Buttons */}
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
                    <span className="wam__preset-text">Default Thank You Poster</span>
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

                {/* Uploaded Images Gallery for Future Use */}
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

            {/* Dynamic Text Parameter Fields for Selected Template */}
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
              {activeTemplate.hasHeaderMedia && resolvedImageUrl && (
                <div className="wam__chat-media">
                  <img src={resolvedImageUrl} alt="Header Banner" className="wam__chat-img" />
                </div>
              )}
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

        {/* Step 2 & 3: File Upload, Audience Table, Status Filter & Retries */}
        <section className="wam__card wam__card--audience">
          <div className="wam__card-header">
            <span className="wam__step-pill">Step 2 & 3</span>
            <div>
              <h2 className="wam__card-title">Audience Data & Status Tracking</h2>
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

          {/* Dynamic Sample Templates Download Bar (Adapts to Active Template Parameters) */}
          <div className="wam__sample-bar">
            <span className="wam__sample-label">
              Download Sample Formats for <strong>{activeTemplate.name}</strong>:
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
                      <th>Custom Parameters</th>
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
                                  <strong>{k}:</strong> {String(v).slice(0, 20)}
                                </span>
                              ))}
                            </div>
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
                <strong>Header Media:</strong> {activeTemplate.hasHeaderMedia ? imageType : 'None (Text Only)'}
              </div>
            </div>
            <p className="wam__modal-note">
              Messages will be sent sequentially with personalized recipient parameters. Are you
              sure you wish to proceed?
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
