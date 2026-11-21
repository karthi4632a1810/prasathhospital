import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registrationApi } from '../../lib/registrationApi';
import { whatsappMarketingApi } from '../../lib/whatsappMarketingApi';
import { companyApi } from '../../lib/companyApi';
import { couponApi } from '../../lib/couponApi';
import { useEvents, EventSelect } from '../../lib/useEvents';
import { formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import {
  DeliveryBadge,
  RegistrationStatusBadge,
  DELIVERY_OPTIONS,
} from '../../components/StatusBadges';
import RegistrationDetail from './RegistrationDetail';
import IdCardModal from './IdCardModal';
import CertificateModal from './CertificateModal';
import InstantRegistrationModal from './InstantRegistrationModal';
import EditRegistrationModal from './EditRegistrationModal';
import DeleteRegistrationModal from './DeleteRegistrationModal';

const EMPTY_FILTERS = {
  q: '',
  company: '',
  coupon: '',
  status: '',
  emailStatus: '',
  whatsappStatus: '',
  checkedIn: '',
  lunchCheckedIn: '',
  tnmc: '',
  from: '',
  to: '',
};

const PAGE_SIZE = 25;

export default function Registrations() {
  const { events, eventId, setEventId, error: eventsError } = useEvents();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [transferring, setTransferring] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [showInstantRegModal, setShowInstantRegModal] = useState(false);
  const [idCardModalReg, setIdCardModalReg] = useState(null);
  const [certificateModalReg, setCertificateModalReg] = useState(null);
  const [editModalReg, setEditModalReg] = useState(null);
  const [deleteModalReg, setDeleteModalReg] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingAttendance, setExportingAttendance] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setSelectedIds(new Set());
  }, [eventId]);

  useEffect(() => {
    companyApi
      .list()
      .then((res) => setCompanies(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!eventId) return;
    couponApi
      .list({ event: eventId })
      .then((res) => setCoupons(res.data))
      .catch(() => {});
  }, [eventId]);

  const filtersKey = JSON.stringify(filters);
  const query = { event: eventId, ...filters, sort };

  const load = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    registrationApi
      .list({ ...query, page, limit: PAGE_SIZE })
      .then((res) => setResult(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, filtersKey, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  function toggleSort(key) {
    setSort((s) => (s === `-${key}` ? key : `-${key}`));
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      await registrationApi.exportCsv(query);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportAttendance() {
    setExportingAttendance(true);
    setExportError('');
    try {
      await registrationApi.exportScannedAttendanceXlsx(query);
    } catch (err) {
      setExportError(err.message || 'Failed to export scanned attendance.');
    } finally {
      setExportingAttendance(false);
    }
  }

  function handleChanged(updated) {
    setResult((r) =>
      r
        ? {
            ...r,
            data: r.data.map((reg) => (reg.id === updated.id ? { ...reg, ...updated } : reg)),
          }
        : r
    );
  }

  function handleDeleted(deletedId) {
    setResult((r) =>
      r
        ? {
            ...r,
            data: r.data.filter((reg) => reg.id !== deletedId && reg._id !== deletedId),
            meta: r.meta
              ? { ...r.meta, total: Math.max(0, (r.meta.total || 1) - 1) }
              : r.meta,
          }
        : r
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deletedId);
      return next;
    });
  }

  const handleSendSelectedToWhatsApp = () => {
    const selectedList = registrations.filter((r) => selectedIds.has(r.id));
    if (!selectedList.length) return;

    const contacts = selectedList.map((r, idx) => ({
      Name: r.attendee?.name || 'Delegate',
      Phone: r.attendee?.phone || '',
      Email: r.attendee?.email || '',
      RegistrationCode: r.registrationCode || '',
      DelegateId: r.registrationCode || '',
      Company: r.company?.name || '',
      Coupon: r.coupon?.code || r.couponCode || '',
      Status: r.status || '',
      Index: idx + 1,
    }));

    const currentEvent = events?.find((e) => e.id === eventId || e._id === eventId);
    const title = `Event Registrations: ${currentEvent?.title || 'Selected'} (${contacts.length} delegates)`;

    sessionStorage.setItem(
      'ciim_transfer_audience',
      JSON.stringify({
        title,
        contacts,
        templateId: 'ciim2026_2what_works',
      })
    );

    navigate('/whatsapp-marketing');
  };

  const handleSendAllFilteredToWhatsApp = async () => {
    try {
      setTransferring(true);
      const res = await whatsappMarketingApi.getRegistrationsAudience({
        event: eventId,
        status: filters.status || undefined,
      });
      const contacts = res?.data?.contacts || [];
      if (!contacts.length) {
        alert('No registrations found for the selected event/filters.');
        return;
      }
      const currentEvent = events?.find((e) => e.id === eventId || e._id === eventId);
      const title = `All Event Registrations: ${currentEvent?.title || 'CIIM 2026'} (${contacts.length} delegates)`;
      sessionStorage.setItem(
        'ciim_transfer_audience',
        JSON.stringify({
          title,
          contacts,
          templateId: 'ciim2026_2what_works',
        })
      );
      navigate('/whatsapp-marketing');
    } catch (err) {
      alert('Failed to load registrations: ' + (err.message || 'Error'));
    } finally {
      setTransferring(false);
    }
  };

  if (eventsError) return <ErrorState message={eventsError} />;
  if (events === null) return <LoadingState label="Loading events…" />;
  if (events.length === 0)
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;

  const registrations = result?.data || [];
  const meta = result?.meta;
  const filtersActive = Object.values(filters).some(Boolean);
  const couponOptions = filters.company
    ? coupons.filter((c) => c.company?.id === filters.company)
    : coupons;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Registrations</h2>
          <p className="page-header__subtitle">
            {meta
              ? `${meta.total} ${filtersActive ? 'matching' : 'total'}`
              : 'Search, filter and manage attendee registrations.'}
          </p>
        </div>
        <div
          style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <EventSelect
            events={events}
            eventId={eventId}
            onChange={(id) => {
              setEventId(id);
              setPage(1);
            }}
          />
          <Button
            variant="primary"
            size="sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#059669',
              borderColor: '#047857',
              color: '#ffffff',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
            }}
            onClick={() => setShowInstantRegModal(true)}
            title="Instant on-spot registration for TMNC or Non-TMNC attendees with badge generation"
          >
            <span>➕</span>
            <span>Instant Registration</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={exporting || !meta?.total}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#0284c7',
              borderColor: '#7dd3fc',
              fontWeight: 600,
            }}
            onClick={handleExportAttendance}
            disabled={exportingAttendance}
            title="Export scanned attendee attendance in official TNMC bulk upload Excel format (.xlsx)"
          >
            <span>📋</span>
            <span>{exportingAttendance ? 'Exporting…' : 'Export Scanned Attendance (.xlsx)'}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#15803d',
              borderColor: '#86efac',
              fontWeight: 600,
            }}
            onClick={handleSendAllFilteredToWhatsApp}
            disabled={transferring || !meta?.total}
            title="Transfer all matching registrations for this event directly into WhatsApp Marketing"
          >
            <span>💬</span>
            <span>{transferring ? 'Loading...' : `WhatsApp Marketing (${meta?.total || 0})`}</span>
          </Button>
        </div>
      </div>

      {exportError && <div className="notice notice--error">{exportError}</div>}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 16px 0',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Quick Filter:</span>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, checkedIn: '', lunchCheckedIn: '', status: '' }));
              setPage(1);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: !filters.checkedIn && !filters.lunchCheckedIn ? '2px solid #6366f1' : '1px solid #cbd5e1',
              backgroundColor: !filters.checkedIn && !filters.lunchCheckedIn ? '#eef2ff' : '#ffffff',
              color: !filters.checkedIn && !filters.lunchCheckedIn ? '#4338ca' : '#475569',
            }}
          >
            All Registrations
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, checkedIn: 'yes', lunchCheckedIn: '' }));
              setPage(1);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: filters.checkedIn === 'yes' ? '2px solid #16a34a' : '1px solid #cbd5e1',
              backgroundColor: filters.checkedIn === 'yes' ? '#f0fdf4' : '#ffffff',
              color: filters.checkedIn === 'yes' ? '#15803d' : '#475569',
            }}
          >
            🚪 Checked-in Users Only
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, checkedIn: 'no', lunchCheckedIn: '' }));
              setPage(1);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filters.checkedIn === 'no' ? '2px solid #d97706' : '1px solid #cbd5e1',
              backgroundColor: filters.checkedIn === 'no' ? '#fffbeb' : '#ffffff',
              color: filters.checkedIn === 'no' ? '#b45309' : '#475569',
            }}
          >
            ⏳ Pending Check-in
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, lunchCheckedIn: 'yes' }));
              setPage(1);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filters.lunchCheckedIn === 'yes' ? '2px solid #9333ea' : '1px solid #cbd5e1',
              backgroundColor: filters.lunchCheckedIn === 'yes' ? '#faf5ff' : '#ffffff',
              color: filters.lunchCheckedIn === 'yes' ? '#7e22ce' : '#475569',
            }}
          >
            🍽️ Lunch Scanned
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, tnmc: f.tnmc === 'yes' ? '' : 'yes' }));
              setPage(1);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: filters.tnmc === 'yes' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: filters.tnmc === 'yes' ? '#eff6ff' : '#ffffff',
              color: filters.tnmc === 'yes' ? '#1d4ed8' : '#475569',
            }}
          >
            🩺 TNMC Only
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, tnmc: f.tnmc === 'no' ? '' : 'no' }));
              setPage(1);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: filters.tnmc === 'no' ? '2px solid #d97706' : '1px solid #fde68a',
              backgroundColor: filters.tnmc === 'no' ? '#fef3c7' : '#fffbeb',
              color: filters.tnmc === 'no' ? '#b45309' : '#92400e',
            }}
          >
            ⚡ Non-TNMC (No TNMC)
          </button>
        </div>
        <div className="toolbar">
          <label className="field field--grow">
            <span className="field__label">Search</span>
            <input
              className="field__input"
              placeholder="Name, email, mobile, registration ID, coupon…"
              value={filters.q}
              onChange={setFilter('q')}
            />
          </label>
          <label className="field">
            <span className="field__label">Company</span>
            <select
              className="field__select"
              value={filters.company}
              onChange={(e) => {
                setFilters((f) => ({ ...f, company: e.target.value, coupon: '' }));
                setPage(1);
              }}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Coupon</span>
            <select className="field__select" value={filters.coupon} onChange={setFilter('coupon')}>
              <option value="">All coupons</option>
              {couponOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select className="field__select" value={filters.status} onChange={setFilter('status')}>
              <option value="">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <select
              className="field__select"
              value={filters.emailStatus}
              onChange={setFilter('emailStatus')}
            >
              <option value="">Any</option>
              {DELIVERY_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">WhatsApp</span>
            <select
              className="field__select"
              value={filters.whatsappStatus}
              onChange={setFilter('whatsappStatus')}
            >
              <option value="">Any</option>
              {DELIVERY_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Entry Check-in</span>
            <select
              className="field__select"
              value={filters.checkedIn}
              onChange={setFilter('checkedIn')}
            >
              <option value="">Any</option>
              <option value="yes">🚪 Entry: Scanned</option>
              <option value="no">🚪 Entry: Pending</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Lunch Pass</span>
            <select
              className="field__select"
              value={filters.lunchCheckedIn}
              onChange={setFilter('lunchCheckedIn')}
            >
              <option value="">Any</option>
              <option value="yes">🍽️ Lunch: Scanned</option>
              <option value="no">🍽️ Lunch: Pending</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">TNMC Council</span>
            <select
              className="field__select"
              value={filters.tnmc}
              onChange={setFilter('tnmc')}
            >
              <option value="">All (TNMC &amp; Non-TNMC)</option>
              <option value="yes">🩺 With TNMC Number</option>
              <option value="no">⚡ Non-TNMC (No TNMC Number)</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">From</span>
            <input
              className="field__input"
              type="date"
              value={filters.from}
              onChange={setFilter('from')}
            />
          </label>
          <label className="field">
            <span className="field__label">To</span>
            <input
              className="field__input"
              type="date"
              value={filters.to}
              onChange={setFilter('to')}
            />
          </label>
          {filtersActive && (
            <div className="toolbar__actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : result === null ? (
        <LoadingState label="Loading registrations…" />
      ) : registrations.length === 0 ? (
        <EmptyState
          title={filtersActive ? 'No registrations match' : 'No registrations yet'}
          message={
            filtersActive
              ? 'Try different filters.'
              : 'Registrations appear here as delegates sign up with a coupon.'
          }
        />
      ) : (
        <>
          <div
            className="data-table-wrap"
            style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={registrations.length > 0 && registrations.every((r) => selectedIds.has(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set([...selectedIds, ...registrations.map((r) => r.id)]));
                        } else {
                          const next = new Set(selectedIds);
                          registrations.forEach((r) => next.delete(r.id));
                          setSelectedIds(next);
                        }
                      }}
                      aria-label="Select all registrations on this page"
                      title="Select / deselect all delegates on this page"
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <SortTh
                    label="Registration ID"
                    field="registrationCode"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortTh
                    label="Name · mobile · email"
                    field="name"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortTh
                    label="Company · coupon"
                    field="couponCode"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortTh label="Date" field="createdAt" sort={sort} onSort={toggleSort} />
                  <SortTh label="Status" field="status" sort={sort} onSort={toggleSort} />
                  <th>QR</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <SortTh label="Check-in" field="checkedInAt" sort={sort} onSort={toggleSort} />
                  <th style={{ textAlign: 'center', width: '190px' }}>ID Card &amp; Certificate</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => {
                  const tnmcRaw = String(reg.attendee?.medicalCouncilRegNo || '').trim();
                  const isNoTnmc =
                    !tnmcRaw ||
                    ['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', 'NOTAPPLICABLE', '-'].includes(
                      tnmcRaw.toUpperCase()
                    );
                  const hasTnmc = !isNoTnmc;

                  return (
                    <tr
                      key={reg.id}
                      className="is-clickable"
                      tabIndex={0}
                      onClick={() => setOpenId(reg.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setOpenId(reg.id);
                      }}
                      style={{
                        backgroundColor: !hasTnmc ? '#fffdf7' : undefined,
                        boxShadow: !hasTnmc ? 'inset 3.5px 0 0 #f59e0b' : undefined,
                      }}
                    >
                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '40px', textAlign: 'center' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(reg.id)}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(reg.id)) next.delete(reg.id);
                              else next.add(reg.id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${reg.attendee?.name || 'delegate'}`}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong className="mono">{reg.registrationCode}</strong>
                          {reg.badgeNo && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#eef2ff',
                                color: '#4338ca',
                                border: '1px solid #c7d2fe',
                              }}
                              title={`Registration order badge #${reg.badgeNo}`}
                            >
                              #{reg.badgeNo}
                            </span>
                          )}
                          {reg.isTest && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '9999px',
                                background: 'rgba(124, 58, 237, 0.1)',
                                color: '#7c3aed',
                                border: '1px solid rgba(124, 58, 237, 0.25)',
                              }}
                              title="Test registration made with a test mode coupon"
                            >
                              🧪 TEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong>{reg.attendee?.name}</strong>
                        </div>
                        <div
                          style={{
                            margin: '3px 0 4px',
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          {hasTnmc ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '1px 7px',
                                borderRadius: '4px',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                              }}
                              title={`Medical Council Registration Number: ${tnmcRaw}`}
                            >
                              <span>🩺</span>
                              <span>TNMC: {tnmcRaw}</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                padding: '1px 7px',
                                borderRadius: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1.5px solid #fde68a',
                              }}
                              title="Attendee has NO Medical Council / TNMC registration number (e.g. Embryologist or Non-Clinical Delegate)"
                            >
                              <span>⚡</span>
                              <span>Non-TNMC</span>
                            </span>
                          )}
                          {reg.attendee?.designation && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#475569',
                                backgroundColor: '#f1f5f9',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              {reg.attendee.designation}
                            </span>
                          )}
                        </div>
                        <span className="sub">{reg.attendee?.phone}</span>
                        <span className="sub" style={{ overflowWrap: 'anywhere' }}>
                          {reg.attendee?.email}
                        </span>
                      </td>
                    <td>
                      {reg.company?.name || <span className="muted">No company</span>}
                      <span className="sub mono">{reg.couponCode || reg.coupon?.code || '—'}</span>
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(reg.createdAt)}</td>
                    <td>
                      <RegistrationStatusBadge status={reg.status} />
                    </td>
                    <td>
                      <Badge tone={reg.qrStatus === 'active' ? 'success' : 'neutral'} size="sm">
                        {reg.qrStatus === 'active'
                          ? 'Active'
                          : reg.qrStatus === 'void'
                            ? 'Void'
                            : 'None'}
                      </Badge>
                    </td>
                    <td>
                      <DeliveryBadge status={reg.delivery?.email?.status} />
                    </td>
                    <td>
                      <DeliveryBadge status={reg.delivery?.whatsapp?.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {reg.checkedInAt || reg.checkins?.some((c) => c.locationCode === 'ENTRY') ? (
                          <Badge tone="success" size="sm">
                            <span title={`Entry: ${reg.checkedInAt ? formatDateTime(reg.checkedInAt) : 'Checked in'}`}>
                              🚪 Entry
                            </span>
                          </Badge>
                        ) : null}
                        {reg.checkins?.some((c) => c.locationCode === 'LUNCH') ? (
                          <Badge tone="purple" size="sm">
                            <span title="Lunch pass scanned">🍽️ Lunch</span>
                          </Badge>
                        ) : null}
                        {reg.checkins?.filter((c) => !['ENTRY', 'LUNCH'].includes(c.locationCode)).map((c) => (
                          <Badge key={c.locationCode} tone="neutral" size="sm">
                            <span>{c.locationName || c.locationCode}</span>
                          </Badge>
                        ))}
                        {!reg.checkedInAt && (!reg.checkins || reg.checkins.length === 0) && (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setEditModalReg(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            transition: 'all 120ms',
                          }}
                          title="Edit attendee details and ID card number"
                        >
                          <span>✏️</span>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdCardModalReg(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: '#fdf2f8',
                            color: '#be185d',
                            border: '1px solid #fbcfe8',
                            transition: 'all 120ms',
                          }}
                          title="Print or download attendee ID badge"
                        >
                          <span>🪪</span>
                          <span>ID</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCertificateModalReg(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            transition: 'all 120ms',
                          }}
                          title="Download Certificate as PNG, JPG, or PDF"
                        >
                          <span>📜</span>
                          <span>Cert</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModalReg(reg)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            transition: 'all 120ms',
                          }}
                          title="Permanently delete registration"
                        >
                          <span>🗑️</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="pagination">
              <span>
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </span>
              <div className="pagination__controls">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={meta.page <= 1 || loading}
                >
                  ← Previous
                </Button>
                <span>
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={meta.page >= meta.totalPages || loading}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div
              style={{
                position: 'sticky',
                bottom: '24px',
                zIndex: 40,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                padding: '14px 24px',
                borderRadius: '12px',
                boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                marginTop: '20px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '1.2rem', color: '#4ade80' }}>✓</span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'delegate' : 'delegates'} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#e2e8f0',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear Selection
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Button
                  variant="primary"
                  size="sm"
                  style={{
                    background: '#22c55e',
                    borderColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 700,
                    padding: '8px 18px',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onClick={handleSendSelectedToWhatsApp}
                >
                  <span>💬</span>
                  <span>Send WhatsApp Marketing ({selectedIds.size})</span>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {openId && (
        <RegistrationDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={handleChanged}
          onDeleted={handleDeleted}
        />
      )}

      {editModalReg && (
        <EditRegistrationModal
          registration={editModalReg}
          onClose={() => setEditModalReg(null)}
          onUpdated={(updated) => {
            handleChanged(updated);
            setEditModalReg(null);
          }}
        />
      )}

      {deleteModalReg && (
        <DeleteRegistrationModal
          registration={deleteModalReg}
          onClose={() => setDeleteModalReg(null)}
          onDeleted={(deletedId) => {
            handleDeleted(deletedId);
            setDeleteModalReg(null);
          }}
        />
      )}

      {showInstantRegModal && (
        <InstantRegistrationModal
          eventId={eventId}
          onClose={() => setShowInstantRegModal(false)}
          onCreated={() => {
            load();
          }}
          onOpenIdCard={(newReg) => {
            setIdCardModalReg(newReg);
          }}
        />
      )}

      {idCardModalReg && (
        <IdCardModal
          registration={idCardModalReg}
          onClose={() => setIdCardModalReg(null)}
          onUpdated={handleChanged}
        />
      )}

      {certificateModalReg && (
        <CertificateModal
          registration={certificateModalReg}
          onClose={() => setCertificateModalReg(null)}
          onUpdated={handleChanged}
        />
      )}
    </div>
  );
}

function SortTh({ label, field, sort, onSort }) {
  const active = sort === field || sort === `-${field}`;
  const desc = sort === `-${field}`;
  return (
    <th aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="sort-btn" data-active={active} onClick={() => onSort(field)}>
        {label}
        <span aria-hidden="true">{active ? (desc ? '↓' : '↑') : '↕'}</span>
      </button>
    </th>
  );
}
