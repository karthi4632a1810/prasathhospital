import { useCallback, useEffect, useState } from 'react';
import { registrationApi } from '../../lib/registrationApi';
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

const EMPTY_FILTERS = {
  q: '',
  company: '',
  coupon: '',
  status: '',
  emailStatus: '',
  whatsappStatus: '',
  checkedIn: '',
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
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

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
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={exporting || !meta?.total}
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {exportError && <div className="notice notice--error">{exportError}</div>}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
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
            <span className="field__label">Check-in</span>
            <select
              className="field__select"
              value={filters.checkedIn}
              onChange={setFilter('checkedIn')}
            >
              <option value="">Any</option>
              <option value="yes">Checked in</option>
              <option value="no">Not checked in</option>
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
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    className="is-clickable"
                    tabIndex={0}
                    onClick={() => setOpenId(reg.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setOpenId(reg.id);
                    }}
                  >
                    <td>
                      <strong className="mono">{reg.registrationCode}</strong>
                    </td>
                    <td>
                      <strong>{reg.attendee?.name}</strong>
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
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {reg.checkedInAt ? (
                        <Badge tone="success" size="sm">
                          <span title={formatDateTime(reg.checkedInAt)}>Checked in</span>
                        </Badge>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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
        </>
      )}

      {openId && (
        <RegistrationDetail id={openId} onClose={() => setOpenId(null)} onChanged={handleChanged} />
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
