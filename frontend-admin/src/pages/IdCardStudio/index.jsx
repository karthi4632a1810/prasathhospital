import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { idCardStudioApi } from '../../lib/idCardStudioApi';
import Button from '../../components/ui/Button';
import IdCardModal from '../Registrations/IdCardModal';
import './IdCardStudio.css';

const PRESET_ROLES = ['FACULTY', 'ORGANISING TEAM', 'DELEGATE'];

export default function IdCardStudio() {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [defaultRole, setDefaultRole] = useState('FACULTY');
  const [isSimulation, setIsSimulation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(null); // 'pdf' | 'zip' | 'print' | rowId
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customizeItem, setCustomizeItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Form states for adding/pasting
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('FACULTY');
  const [pasteText, setPasteText] = useState('');
  const [pasteRole, setPasteRole] = useState('FACULTY');

  const fileInputRef = useRef(null);

  // Load faculty seed on initial mount
  useEffect(() => {
    loadFacultySeed();
  }, []);

  const loadFacultySeed = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await idCardStudioApi.getFacultySeed();
      const list = res.data || [];
      setItems(list);
      setSelectedIds(new Set(list.map((it) => it.id)));
      setSuccess(`Loaded ${list.length} faculty members from "Faculty list for ID.xlsx".`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to load default faculty seed.');
    } finally {
      setLoading(false);
    }
  };

  // Excel / CSV File Import Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('The uploaded spreadsheet contains no data rows.');
        }

        const newAttendees = rawJson
          .map((row, idx) => {
            // Find speaker / name column
            const keys = Object.keys(row);
            const nameKey =
              keys.find((k) => /speaker|doctor|faculty|name|attendee/i.test(k)) || keys[0];
            const rawName = String(row[nameKey] || '').trim();
            if (!rawName) return null;

            // Optional role column detection
            const roleKey = keys.find((k) => /role|category|type|badge/i.test(k));
            let assignedRole = defaultRole;
            if (roleKey && row[roleKey]) {
              const r = String(row[roleKey]).trim().toUpperCase();
              if (r.includes('ORGANIS') || r.includes('ORGANIZ')) assignedRole = 'ORGANISING TEAM';
              else if (r.includes('FACULTY') || r.includes('SPEAKER')) assignedRole = 'FACULTY';
              else if (r.includes('DELEGATE')) assignedRole = 'DELEGATE';
              else assignedRole = r;
            }

            return {
              id: `IMP-${Date.now()}-${idx + 1}`,
              name: rawName,
              role: assignedRole,
              code: `IMP-${String(idx + 1).padStart(3, '0')}`,
            };
          })
          .filter(Boolean);

        if (newAttendees.length === 0) {
          throw new Error('No attendee names could be identified in the file.');
        }

        setItems(newAttendees);
        setSelectedIds(new Set(newAttendees.map((a) => a.id)));
        setSuccess(`Successfully imported ${newAttendees.length} attendees from "${file.name}"!`);
        setTimeout(() => setSuccess(''), 5000);
      } catch (err) {
        setError(`Failed to parse file: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setError('Could not read the selected file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsArrayBuffer(file);
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.role.toLowerCase().includes(search.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(search.toLowerCase()));

      const matchesRole =
        roleFilter === 'ALL' ||
        item.role.toUpperCase() === roleFilter.toUpperCase() ||
        (roleFilter === 'OTHER' && !PRESET_ROLES.includes(item.role.toUpperCase()));

      return matchesSearch && matchesRole;
    });
  }, [items, search, roleFilter]);

  // Selection helpers
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((it) => selectedIds.has(it.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredItems.forEach((it) => next.delete(it.id));
      } else {
        filteredItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItemsList = useMemo(() => {
    return items.filter((it) => selectedIds.has(it.id));
  }, [items, selectedIds]);

  // Individual item modifications
  const updateItem = (id, fields) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...fields } : it)));
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const removeSelected = () => {
    if (!window.confirm(`Remove ${selectedIds.size} selected attendee(s)?`)) return;
    setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
    setSelectedIds(new Set());
  };

  const setRoleForSelected = (targetRole) => {
    setItems((prev) =>
      prev.map((it) => (selectedIds.has(it.id) ? { ...it, role: targetRole } : it))
    );
    setSuccess(`Updated role to "${targetRole}" for ${selectedIds.size} attendee(s).`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Add Single Attendee
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newItem = {
      id: `MAN-${Date.now()}`,
      name: newName.trim(),
      role: newRole,
      code: `MAN-${String(items.length + 1).padStart(3, '0')}`,
    };
    setItems((prev) => [newItem, ...prev]);
    setSelectedIds((prev) => new Set([...prev, newItem.id]));
    setNewName('');
    setShowAddModal(false);
  };

  // Paste Multiline Text
  const handlePasteSubmit = (e) => {
    e.preventDefault();
    if (!pasteText.trim()) return;
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const newRows = lines.map((name, i) => ({
      id: `PST-${Date.now()}-${i + 1}`,
      name,
      role: pasteRole,
      code: `PST-${String(items.length + i + 1).padStart(3, '0')}`,
    }));

    setItems((prev) => [...newRows, ...prev]);
    setSelectedIds((prev) => new Set([...prev, ...newRows.map((r) => r.id)]));
    setPasteText('');
    setShowPasteModal(false);
    setSuccess(`Added ${newRows.length} attendees from pasted text.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Bulk PDF Compilation (1 combined multi-page PDF)
  const handleDownloadBulkPdf = async () => {
    if (selectedItemsList.length === 0) return;
    setBusyAction('pdf');
    setError('');
    try {
      const modeName = isSimulation ? 'SIMULATION' : 'PRINT-OVERLAY';
      const filename = `CIIM2026-ID-CARDS-${modeName}-(${selectedItemsList.length}).pdf`;
      await idCardStudioApi.downloadBulkPdf(selectedItemsList, { template: isSimulation }, filename);
      setSuccess(`Combined PDF downloaded with ${selectedItemsList.length} pages.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to generate bulk PDF.');
    } finally {
      setBusyAction(null);
    }
  };

  // Bulk Print Tab (Opens multi-page PDF in new browser tab for direct Ctrl+P print)
  const handleOpenBulkPrint = async () => {
    if (selectedItemsList.length === 0) return;
    setBusyAction('print');
    setError('');
    try {
      await idCardStudioApi.openBulkPdfTab(selectedItemsList, { template: isSimulation });
    } catch (err) {
      setError(err.message || 'Failed to open print tab.');
    } finally {
      setBusyAction(null);
    }
  };

  // Bulk ZIP Download
  const handleDownloadBulkZip = async () => {
    if (selectedItemsList.length === 0) return;
    setBusyAction('zip');
    setError('');
    try {
      const modeName = isSimulation ? 'SIMULATION' : 'PRINT-OVERLAY';
      const filename = `CIIM2026-ID-CARDS-${modeName}-(${selectedItemsList.length}-FILES).zip`;
      await idCardStudioApi.downloadBulkZip(selectedItemsList, { template: isSimulation }, filename);
      setSuccess(`ZIP archive downloaded containing ${selectedItemsList.length} PDF badge files.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to generate ZIP archive.');
    } finally {
      setBusyAction(null);
    }
  };

  // Single Item Actions
  const handleDownloadSingle = async (item) => {
    setBusyAction(item.id);
    setError('');
    try {
      const safeName = item.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${item.code || 'ID'}-${item.role}-${safeName}.pdf`;
      await idCardStudioApi.downloadSinglePdf(
        { name: item.name, role: item.role, code: item.code, template: isSimulation },
        filename
      );
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenSinglePrint = async (item) => {
    try {
      await idCardStudioApi.openSinglePdfTab({
        name: item.name,
        role: item.role,
        code: item.code,
        template: isSimulation,
      });
    } catch (err) {
      setError(err.message || 'Failed to open print preview.');
    }
  };

  return (
    <div className="idcard-studio-container">
      {/* 1. Top Header Card */}
      <div className="idcard-header-card">
        <div className="idcard-header-top">
          <div className="idcard-title-group">
            <div className="idcard-title-icon">🪪</div>
            <div>
              <h1 className="idcard-title">ID Card Studio &amp; Bulk Badges</h1>
              <p className="idcard-subtitle">
                Import faculty, organizing team, or VIP lists from Excel/CSV and batch-generate print-ready badges.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="idcard-mode-switcher" role="group" aria-label="Print output mode">
            <button
              type="button"
              className={`idcard-mode-btn idcard-mode-btn--clean ${!isSimulation ? 'is-active' : ''}`}
              onClick={() => setIsSimulation(false)}
            >
              <span>🖨️</span> Clean Print Overlay
            </button>
            <button
              type="button"
              className={`idcard-mode-btn idcard-mode-btn--sim ${isSimulation ? 'is-active' : ''}`}
              onClick={() => setIsSimulation(true)}
            >
              <span>🖥️</span> Simulation Preview
            </button>
          </div>
        </div>

        {/* Specifications & Info Banner */}
        <div className="idcard-info-banner">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>Badge Specifications:</span>
            <span className="idcard-spec-tag">📏 10.2 cm × 15.2 cm</span>
            <span className="idcard-spec-tag">🎯 7.5 cm Center Printable Zone</span>
            <span className="idcard-spec-tag">🔒 Top 2.2 cm Logo Blank</span>
            <span className="idcard-spec-tag">🔒 Bottom 5.2 cm Footer Blank</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {isSimulation ? (
              <span style={{ color: '#4f46e5', fontWeight: 600 }}>
                ● Simulation Mode: Renders official CIIM 2026 header &amp; footer graphic for visual alignment.
              </span>
            ) : (
              <span style={{ color: '#be185d', fontWeight: 600 }}>
                ● Clean Print Mode: Perfect for physical card printers feeding pre-printed badge stock.
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="idcard-toolbar">
          <div className="idcard-toolbar__left">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ backgroundColor: '#0284c7', borderColor: '#0369a1' }}
            >
              📁 Import Excel / CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadFacultySeed}
              disabled={loading}
              title="Reload the 38 speakers from 'Faculty list for ID.xlsx'"
            >
              ⚡ Reload Faculty Excel (38)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAddModal(true)}>
              + Add Doctor
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowPasteModal(true)}>
              📋 Paste List
            </Button>
          </div>

          <div className="idcard-toolbar__right">
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm('Clear all attendees from the table?')) {
                    setItems([]);
                    setSelectedIds(new Set());
                  }
                }}
                style={{ color: '#94a3b8' }}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: '#f0fdf4',
            color: '#15803d',
            border: '1px solid #bbf7d0',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          ✓ {success}
        </div>
      )}

      {/* 2. Filter & Selection Bar */}
      <div className="idcard-filter-card">
        <div className="idcard-search-wrap">
          <span className="idcard-search-icon">🔍</span>
          <input
            type="text"
            className="idcard-search-input"
            placeholder="Search by doctor name, role, or ID code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="idcard-role-filters">
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>
            ROLE:
          </span>
          {['ALL', 'FACULTY', 'ORGANISING TEAM', 'DELEGATE'].map((r) => (
            <button
              key={r}
              type="button"
              className={`idcard-role-pill ${roleFilter === r ? 'is-active' : ''}`}
              onClick={() => setRoleFilter(r)}
            >
              {r} {r === 'ALL' ? `(${items.length})` : `(${items.filter((it) => it.role === r).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Sticky Bulk Actions Banner (appears when items are selected) */}
      {selectedIds.size > 0 && (
        <div className="idcard-bulk-banner">
          <div className="idcard-bulk-info">
            <span className="idcard-bulk-count">{selectedIds.size}</span>
            <span>badge(s) selected out of {items.length} total</span>
          </div>

          <div className="idcard-bulk-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadBulkPdf}
              disabled={busyAction === 'pdf'}
              style={{
                backgroundColor: '#be185d',
                borderColor: '#9d174d',
                fontWeight: 700,
              }}
            >
              {busyAction === 'pdf' ? 'Compiling…' : `📄 Download Combined PDF (${selectedIds.size})`}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenBulkPrint}
              disabled={busyAction === 'print'}
              style={{ fontWeight: 600 }}
              title="Open all selected in a multi-page tab for direct Ctrl+P print"
            >
              🖨️ Print Selected
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadBulkZip}
              disabled={busyAction === 'zip'}
              style={{ fontWeight: 600 }}
              title="Download ZIP with individual PDF file per attendee"
            >
              {busyAction === 'zip' ? 'Zipping…' : `🗜️ Download ZIP (${selectedIds.size})`}
            </Button>

            {/* Change Role Dropdown */}
            <select
              className="idcard-role-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  setRoleForSelected(e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ background: '#334155', color: '#ffffff', borderColor: '#475569' }}
            >
              <option value="" disabled>
                🏷️ Set Role for Selected…
              </option>
              <option value="FACULTY">Set FACULTY</option>
              <option value="ORGANISING TEAM">Set ORGANISING TEAM</option>
              <option value="DELEGATE">Set DELEGATE</option>
            </select>

            <button
              type="button"
              className="idcard-action-btn idcard-action-btn--danger"
              onClick={removeSelected}
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', color: '#fca5a5' }}
            >
              🗑️ Delete ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* 4. Badges Table Card */}
      <div className="idcard-table-card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            ⏳ Loading badge attendees…
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <h3 style={{ margin: '0 0 6px', color: '#334155' }}>No attendees match your filter</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Import an Excel sheet or click "Reload Faculty Excel" to populate the badge list.
            </p>
          </div>
        ) : (
          <table className="idcard-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    title="Select/Deselect all filtered"
                  />
                </th>
                <th style={{ width: '50px' }}>#</th>
                <th>Attendee Doctor Name</th>
                <th style={{ width: '190px' }}>Role / Badge Header</th>
                <th style={{ width: '120px' }}>Badge Code</th>
                <th style={{ width: '280px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const isChecked = selectedIds.has(item.id);
                const isLong = item.name.length > 22 || item.name.includes('\n');
                return (
                  <tr key={item.id} className={isChecked ? 'is-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectOne(item.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      {idx + 1}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="idcard-name-input"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, { name: e.target.value })}
                          title="Click to edit name directly"
                        />
                        {isLong && (
                          <span
                            className="idcard-two-line-badge"
                            title="Name will balance into 2 lines on the badge"
                          >
                            2 Lines
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <select
                        className={`idcard-role-select ${
                          item.role === 'FACULTY'
                            ? 'idcard-role-select--faculty'
                            : item.role === 'ORGANISING TEAM'
                            ? 'idcard-role-select--organising'
                            : 'idcard-role-select--delegate'
                        }`}
                        value={item.role}
                        onChange={(e) => updateItem(item.id, { role: e.target.value })}
                      >
                        <option value="FACULTY">FACULTY</option>
                        <option value="ORGANISING TEAM">ORGANISING TEAM</option>
                        <option value="DELEGATE">DELEGATE</option>
                      </select>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>
                      {item.code || `FAC-${String(idx + 1).padStart(2, '0')}`}
                    </td>
                    <td>
                      <div className="idcard-row-actions">
                        <button
                          type="button"
                          className="idcard-action-btn"
                          onClick={() => handleOpenSinglePrint(item)}
                          title="Open PDF in new tab for direct Ctrl+P print"
                        >
                          🖨️ Print
                        </button>
                        <button
                          type="button"
                          className="idcard-action-btn idcard-action-btn--primary"
                          onClick={() => handleDownloadSingle(item)}
                          disabled={busyAction === item.id}
                        >
                          {busyAction === item.id ? '…' : '⬇️ PDF'}
                        </button>
                        <button
                          type="button"
                          className="idcard-action-btn"
                          onClick={() => setCustomizeItem(item)}
                          title="Fine-tune name line breaks, header role, and preview"
                        >
                          ✏️ Customize
                        </button>
                        <button
                          type="button"
                          className="idcard-action-btn idcard-action-btn--danger"
                          onClick={() => removeItem(item.id)}
                          title="Remove attendee"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Customization Modal for Spot-Editing */}
      {customizeItem && (
        <IdCardModal
          registration={{
            id: customizeItem.id,
            registrationCode: customizeItem.code,
            attendee: { name: customizeItem.name },
            badgeRole: customizeItem.role,
            company: { name: 'Faculty & Organising Team' },
            checkedInAt: null,
          }}
          onClose={() => setCustomizeItem(null)}
          onUpdated={(updated) => {
            if (updated?.attendee?.name) {
              updateItem(customizeItem.id, { name: updated.attendee.name });
            }
          }}
        />
      )}

      {/* 6. Add Single Attendee Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', color: '#0f172a' }}>
              + Add Doctor / Attendee
            </h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Doctor Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Hafeez Rahman"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Role / Badge Header
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PRESET_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: newRole === r ? '2px solid #be185d' : '1px solid #cbd5e1',
                        backgroundColor: newRole === r ? '#fdf2f8' : '#ffffff',
                        color: newRole === r ? '#be185d' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" style={{ backgroundColor: '#be185d' }}>
                  Add to List
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Paste Multiline Text Modal */}
      {showPasteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPasteModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#0f172a' }}>
              📋 Paste Attendee Names List
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b' }}>
              Paste a list of doctor names (one per line). Great for copying straight from WhatsApp, emails, or spreadsheets.
            </p>
            <form onSubmit={handlePasteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Default Role for this batch
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PRESET_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setPasteRole(r)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: pasteRole === r ? '2px solid #be185d' : '1px solid #cbd5e1',
                        backgroundColor: pasteRole === r ? '#fdf2f8' : '#ffffff',
                        color: pasteRole === r ? '#be185d' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Doctor Names (1 per line) *
                </label>
                <textarea
                  rows={8}
                  placeholder={`Dr. Ramesh B\nDr. Hafeez Rahman\nDr. Ramani Devi\nDr. Malaraj`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowPasteModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" style={{ backgroundColor: '#be185d' }}>
                  Import Pasted Names
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
