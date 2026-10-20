import { useCallback, useEffect, useRef, useState } from 'react';
import { couponApi } from '../../lib/couponApi';
import { companyApi } from '../../lib/companyApi';
import { useEvents, EventSelect } from '../../lib/useEvents';
import { toDateTimeLocal, fromDateTimeLocal, formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import { CouponStateBadge, COUPON_STATE_OPTIONS, UsageBar } from '../../components/StatusBadges';

export default function Coupons() {
  const { events, eventId, setEventId, error: eventsError } = useEvents();
  const [coupons, setCoupons] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ company: '', state: '', q: '' });
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | coupon
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    companyApi
      .list()
      .then((res) => setCompanies(res.data))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!eventId) return;
    setError(null);
    couponApi
      .list({ event: eventId, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) })
      .then((res) => setCoupons(res.data))
      .catch((err) => setError(err.message));
  }, [eventId, filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function notify(tone, message) {
    setFlash({ tone, message });
    setTimeout(() => setFlash(null), 4500);
  }

  async function toggleActive(coupon) {
    const next = !coupon.isActive;
    if (
      !next &&
      !window.confirm(
        `Deactivate ${coupon.code}? It will stop working immediately. Existing registrations are kept.`
      )
    )
      return;
    try {
      await couponApi.update(coupon.id, { isActive: next });
      notify('success', `${coupon.code} ${next ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err) {
      notify('error', err.message);
    }
  }

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  if (eventsError) return <ErrorState message={eventsError} />;
  if (events === null) return <LoadingState label="Loading events…" />;
  if (events.length === 0)
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;
  if (error && coupons === null) return <ErrorState message={error} onRetry={load} />;

  const activeCompanies = (companies || []).filter((c) => c.isActive);
  const activeCoupons = (coupons || []).filter((c) => c.isActive);
  const inactiveCoupons = (coupons || []).filter((c) => !c.isActive);
  const totals = activeCoupons.reduce(
    (acc, c) => ({
      allocated: acc.allocated + c.maxAllowedRegistrations,
      used: acc.used + c.usageCount,
    }),
    { allocated: 0, used: 0 }
  );
  const allUsed = (coupons || []).reduce((sum, c) => sum + c.usageCount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Coupons</h2>
          <p className="page-header__subtitle">
            Each coupon admits a fixed number of delegates at ₹0.
            {coupons &&
              coupons.length > 0 &&
              ` ${allUsed} of ${totals.allocated} places used across ${activeCoupons.length} active coupons${inactiveCoupons.length > 0 ? ` (${inactiveCoupons.length} inactive)` : ''}.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <EventSelect events={events} eventId={eventId} onChange={setEventId} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSeriesOpen(true)}
            disabled={activeCompanies.length === 0}
            title="Generate sequential coupon codes (e.g. PFRCCIIM001B2B to PFRCCIIM300B2B)"
          >
            + Generate Series
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setEditing('new')}
            disabled={activeCompanies.length === 0}
          >
            + New coupon
          </Button>
        </div>
      </div>

      {activeCompanies.length === 0 && companies !== null && (
        <div className="notice notice--info">
          Add an active company first — every coupon belongs to a company.{' '}
          <a href="/companies">Go to Companies →</a>
        </div>
      )}
      {flash && (
        <div className={`notice notice--${flash.tone}`} role="status">
          {flash.message}
        </div>
      )}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="toolbar">
          <label className="field field--grow">
            <span className="field__label">Search code</span>
            <input
              className="field__input"
              placeholder="e.g. YAMAHA"
              value={filters.q}
              onChange={setFilter('q')}
            />
          </label>
          <label className="field">
            <span className="field__label">Company</span>
            <select
              className="field__select"
              value={filters.company}
              onChange={setFilter('company')}
            >
              <option value="">All companies</option>
              {(companies || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">State</span>
            <select className="field__select" value={filters.state} onChange={setFilter('state')}>
              <option value="">All states</option>
              {COUPON_STATE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {coupons === null ? (
        <LoadingState label="Loading coupons…" />
      ) : coupons.length === 0 ? (
        <EmptyState
          title="No coupons"
          message="Create a coupon for a company to open registration to its delegates."
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Company</th>
                <th>Usage</th>
                <th>Valid</th>
                <th>State</th>
                <th>Created</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong className="mono">{c.code}</strong>
                    {c.description && <span className="sub">{c.description}</span>}
                  </td>
                  <td>{c.company?.name || '—'}</td>
                  <td>
                    <UsageBar used={c.usageCount} allocated={c.maxAllowedRegistrations} />
                  </td>
                  <td
                    className="muted"
                    style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}
                  >
                    {c.startDate ? formatDateTime(c.startDate) : 'Now'}
                    <br />→ {c.expiryDate ? formatDateTime(c.expiryDate) : 'No expiry'}
                  </td>
                  <td>
                    <CouponStateBadge state={c.state} />
                  </td>
                  <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                    {formatDateTime(c.createdAt)}
                    {c.createdBy?.name && <span className="sub">by {c.createdBy.name}</span>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CouponForm
          coupon={editing === 'new' ? null : editing}
          eventId={eventId}
          companies={editing === 'new' ? activeCompanies : companies || []}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            notify('success', message);
            load();
          }}
        />
      )}

      {seriesOpen && (
        <SeriesCouponDrawer
          eventId={eventId}
          companies={activeCompanies}
          onClose={() => setSeriesOpen(false)}
          onSaved={(message) => {
            setSeriesOpen(false);
            notify('success', message);
            load();
          }}
        />
      )}
    </div>
  );
}

function CouponForm({ coupon, eventId, companies, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    code: coupon?.code || '',
    company: coupon?.company?.id || companies[0]?.id || '',
    description: coupon?.description || '',
    maxAllowedRegistrations: coupon?.maxAllowedRegistrations ?? 50,
    startDate: toDateTimeLocal(coupon?.startDate),
    expiryDate: toDateTimeLocal(coupon?.expiryDate),
    isActive: coupon ? coupon.isActive : true,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const customCode = useRef(false); // true once the admin types their own code
  const used = coupon?.usageCount || 0;
  const locked = used > 0; // code + company frozen once redeemed

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const generate = useCallback(async (companyId) => {
    if (!companyId) return;
    setGenerating(true);
    try {
      const res = await couponApi.generateCode(companyId);
      customCode.current = false;
      setForm((f) => ({ ...f, code: res.data.code }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  // New coupons start with a generated code, and get a fresh one when the
  // company changes — unless the admin has typed their own.
  useEffect(() => {
    if (!coupon && !customCode.current) generate(form.company);
  }, [coupon, form.company, generate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      description: form.description,
      maxAllowedRegistrations: Number(form.maxAllowedRegistrations),
      startDate: fromDateTimeLocal(form.startDate),
      expiryDate: fromDateTimeLocal(form.expiryDate),
      isActive: form.isActive,
    };
    if (!locked) {
      body.code = form.code.trim().toUpperCase();
      body.company = form.company;
    }
    try {
      if (coupon) {
        await couponApi.update(coupon.id, body);
        onSaved(`${coupon.code} saved.`);
      } else {
        const res = await couponApi.create({ ...body, event: eventId });
        onSaved(`${res.data.code} created for ${res.data.company?.name}.`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${coupon.code}? Only possible while it has never been used.`))
      return;
    setSaving(true);
    try {
      await couponApi.remove(coupon.id);
      onSaved(`${coupon.code} deleted.`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Drawer
      open
      title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      subtitle={
        coupon
          ? `${used} of ${coupon.maxAllowedRegistrations} used`
          : 'Codes are case-insensitive and must be unique.'
      }
      onClose={onClose}
      footer={
        <>
          {coupon && used === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              style={{ marginRight: 'auto' }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="coupon-form" disabled={saving}>
            {saving ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={handleSubmit}>
        {error && (
          <div className="notice notice--error" role="alert">
            {error}
          </div>
        )}
        {locked && (
          <div className="notice notice--info">
            This coupon has been used, so its code and company are locked. You can still change the
            limit, dates and status.
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span className="field__label">Coupon code *</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                className="field__input mono"
                style={{ flex: 1, minWidth: 0 }}
                required
                minLength={4}
                maxLength={32}
                pattern="[A-Za-z0-9_\-]{4,32}"
                title="4–32 letters, numbers, - or _"
                value={form.code}
                disabled={locked}
                placeholder={generating ? 'Generating…' : ''}
                onChange={(e) => {
                  customCode.current = true;
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }));
                }}
              />
              {!locked && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => generate(form.company)}
                  disabled={generating || !form.company}
                >
                  {generating ? '…' : 'Generate'}
                </Button>
              )}
            </div>
            <span className="field__hint">
              {coupon
                ? '4–32 letters, numbers, “-” or “_”.'
                : 'Auto-generated and unique for the company. You can edit it or press Generate for another.'}
            </span>
          </label>
          <label className="field">
            <span className="field__label">Company *</span>
            <select
              className="field__select"
              required
              value={form.company}
              disabled={locked}
              onChange={set('company')}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field__label">Description</span>
          <input
            className="field__input"
            maxLength={500}
            value={form.description}
            onChange={set('description')}
            placeholder="e.g. Yamaha dealer network delegates"
          />
        </label>
        <label className="field">
          <span className="field__label">Max registrations *</span>
          <input
            className="field__input"
            type="number"
            min={Math.max(used, 1)}
            max={100000}
            required
            value={form.maxAllowedRegistrations}
            onChange={set('maxAllowedRegistrations')}
          />
          {used > 0 && (
            <span className="field__hint">Can’t be set below the {used} already used.</span>
          )}
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Start date</span>
            <input
              className="field__input"
              type="datetime-local"
              value={form.startDate}
              onChange={set('startDate')}
            />
            <span className="field__hint">Blank = usable immediately.</span>
          </label>
          <label className="field">
            <span className="field__label">Expiry date</span>
            <input
              className="field__input"
              type="datetime-local"
              value={form.expiryDate}
              onChange={set('expiryDate')}
            />
            <span className="field__hint">Blank = no expiry.</span>
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>
      </form>
    </Drawer>
  );
}

function SeriesCouponDrawer({ eventId, companies, onClose, onSaved }) {
  // 3-slot pattern state:
  // slot 1, 2, or 3 can be the series counter
  const [seriesSlot, setSeriesSlot] = useState(2); // default 2 (middle field, matching the user's PFRCCIIM001B2B example)
  const [field1, setField1] = useState('PFRCCIIM');
  const [field2, setField2] = useState('');
  const [field3, setField3] = useState('B2B');
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(300);
  const [digits, setDigits] = useState(3);

  // General coupon properties
  const [company, setCompany] = useState(companies[0]?.id || '');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Submission & feedback states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdSummary, setCreatedSummary] = useState(null);
  const [copied, setCopied] = useState(false);

  // Compute live preview
  const sNum = parseInt(startNum, 10);
  const eNum = parseInt(endNum, 10);
  const dLen = Math.max(parseInt(digits, 10) || 3, 1);
  const isValidRange = !Number.isNaN(sNum) && !Number.isNaN(eNum) && sNum >= 0 && eNum >= sNum;
  const count = isValidRange ? eNum - sNum + 1 : 0;

  function formatCode(n) {
    const padded = String(n).padStart(dLen, '0');
    const p1 = (seriesSlot === 1 ? padded : field1).trim().toUpperCase();
    const p2 = (seriesSlot === 2 ? padded : field2).trim().toUpperCase();
    const p3 = (seriesSlot === 3 ? padded : field3).trim().toUpperCase();
    return `${p1}${p2}${p3}`;
  }

  const firstCode = isValidRange ? formatCode(sNum) : '—';
  const lastCode = isValidRange ? formatCode(eNum) : '—';
  const CODE_RE = /^[A-Z0-9_-]{4,32}$/;
  const isFirstValid = CODE_RE.test(firstCode);
  const isLastValid = CODE_RE.test(lastCode);
  const isValidBatch = isFirstValid && isLastValid && count > 0 && count <= 2000;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!company) {
      setError('Please select a company.');
      return;
    }
    if (!isValidBatch) {
      setError('Please check the series range and ensure codes are 4–32 letters/numbers.');
      return;
    }

    setSubmitting(true);
    setError('');

    const body = {
      event: eventId,
      company,
      field1,
      field2,
      field3,
      seriesField: seriesSlot,
      startNum: sNum,
      endNum: eNum,
      digits: dLen,
      maxAllowedRegistrations: 1, // Single use per coupon as requested
      description: description.trim() || `Series ${firstCode} to ${lastCode}`,
      startDate: fromDateTimeLocal(startDate),
      expiryDate: fromDateTimeLocal(expiryDate),
      isActive,
    };

    try {
      const res = await couponApi.createSeries(body);
      setCreatedSummary(res.data);
    } catch (err) {
      setError(err.message || 'Failed to generate coupon series.');
    } finally {
      setSubmitting(false);
    }
  }

  // If created, render the summary & download screen
  if (createdSummary) {
    const allCodes = createdSummary.codes || [];
    const codesText = allCodes.join('\n');
    const companyObj = companies.find((c) => c.id === company);

    function handleCopy() {
      navigator.clipboard.writeText(codesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }

    function handleDownloadTxt() {
      const blob = new Blob([codesText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coupons-${createdSummary.firstCode}-to-${createdSummary.lastCode}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function handleDownloadCsv() {
      const header = 'Code,Company,Max Uses\n';
      const rows = allCodes.map((c) => `"${c}","${companyObj?.name || ''}",1`).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coupons-${createdSummary.firstCode}-to-${createdSummary.lastCode}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return (
      <Drawer
        open
        width={640}
        title="Series Created"
        subtitle={`${createdSummary.count} single-use coupons generated`}
        onClose={() =>
          onSaved(
            `Successfully generated ${createdSummary.count} coupons (${createdSummary.firstCode} to ${createdSummary.lastCode}).`
          )
        }
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              onSaved(
                `Successfully generated ${createdSummary.count} coupons (${createdSummary.firstCode} to ${createdSummary.lastCode}).`
              )
            }
          >
            Done & View in Table →
          </Button>
        }
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--success-100)',
              color: 'var(--success-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px auto',
            }}
          >
            ✓
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--ink-900)' }}>
            {createdSummary.count} Coupons Generated Successfully!
          </h3>
          <p style={{ color: 'var(--ink-600)', margin: '0 0 20px 0', fontSize: 'var(--text-sm)' }}>
            Allocated to <strong>{companyObj?.name || 'Company'}</strong>. Each code can be used{' '}
            <strong>1 time</strong>.
          </p>

          <div
            style={{
              background: 'var(--ink-50)',
              border: '1px solid var(--ink-200)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
              <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-700)' }}>
                {createdSummary.firstCode}
              </span>
              <span style={{ color: 'var(--ink-400)', fontWeight: 700 }}>→</span>
              <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-700)' }}>
                {createdSummary.lastCode}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '20px',
            }}
          >
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? '✓ Copied All Codes!' : `📋 Copy All ${createdSummary.count} Codes`}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadTxt}>
              ⬇ Download .TXT
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadCsv}>
              ⬇ Download .CSV
            </Button>
          </div>

          <div
            style={{
              background: 'var(--white)',
              border: '1px solid var(--ink-200)',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '200px',
              overflowY: 'auto',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--ink-500)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Sample of generated codes (showing up to 50):
            </span>
            <pre
              className="mono"
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                lineHeight: '1.6',
                color: 'var(--ink-800)',
              }}
            >
              {allCodes.slice(0, 50).join('\n')}
              {allCodes.length > 50 ? `\n... and ${allCodes.length - 50} more` : ''}
            </pre>
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      open
      width={640}
      title="Generate Coupon Series"
      subtitle="Build a custom series with prefix, counter, and suffix (e.g. PFRCCIIM001B2B to PFRCCIIM300B2B)"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="coupon-series-form"
            disabled={submitting || !isValidBatch || !company}
          >
            {submitting ? 'Generating…' : `Generate ${count > 0 ? count : ''} Single-Use Coupons`}
          </Button>
        </>
      }
    >
      <form id="coupon-series-form" onSubmit={handleSubmit}>
        {error && (
          <div className="notice notice--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              color: 'var(--ink-800)',
            }}
          >
            3-Field Pattern Builder
          </label>
          <p style={{ margin: '0 0 12px 0', fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
            Choose which field is the <strong>Series Counter</strong>. The other two fields act as
            static text (e.g. prefix and suffix).
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-3)',
            }}
          >
            {/* Slot 1 */}
            <div
              style={{
                border: seriesSlot === 1 ? '2px solid var(--brand-600)' : '1px solid var(--ink-200)',
                background: seriesSlot === 1 ? 'var(--brand-50, #f0f4ff)' : 'var(--white)',
                borderRadius: '8px',
                padding: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <strong
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: seriesSlot === 1 ? 'var(--brand-800)' : 'var(--ink-700)',
                  }}
                >
                  1. Prefix
                </strong>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    color: 'var(--ink-600)',
                  }}
                >
                  <input
                    type="radio"
                    name="seriesSlot"
                    checked={seriesSlot === 1}
                    onChange={() => setSeriesSlot(1)}
                  />
                  <span>Series</span>
                </label>
              </div>

              {seriesSlot === 1 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-700)', fontWeight: 600 }}>
                  [Dynamic Series]
                </div>
              ) : (
                <input
                  className="field__input mono"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                  value={field1}
                  placeholder="e.g. PFRCCIIM"
                  onChange={(e) => setField1(e.target.value.toUpperCase())}
                />
              )}
            </div>

            {/* Slot 2 */}
            <div
              style={{
                border: seriesSlot === 2 ? '2px solid var(--brand-600)' : '1px solid var(--ink-200)',
                background: seriesSlot === 2 ? 'var(--brand-50, #f0f4ff)' : 'var(--white)',
                borderRadius: '8px',
                padding: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <strong
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: seriesSlot === 2 ? 'var(--brand-800)' : 'var(--ink-700)',
                  }}
                >
                  2. Series (Middle)
                </strong>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    color: 'var(--ink-600)',
                  }}
                >
                  <input
                    type="radio"
                    name="seriesSlot"
                    checked={seriesSlot === 2}
                    onChange={() => setSeriesSlot(2)}
                  />
                  <span>Series</span>
                </label>
              </div>

              {seriesSlot === 2 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-700)', fontWeight: 600 }}>
                  [Dynamic Series]
                </div>
              ) : (
                <input
                  className="field__input mono"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                  value={field2}
                  placeholder="Text / Blank"
                  onChange={(e) => setField2(e.target.value.toUpperCase())}
                />
              )}
            </div>

            {/* Slot 3 */}
            <div
              style={{
                border: seriesSlot === 3 ? '2px solid var(--brand-600)' : '1px solid var(--ink-200)',
                background: seriesSlot === 3 ? 'var(--brand-50, #f0f4ff)' : 'var(--white)',
                borderRadius: '8px',
                padding: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <strong
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: seriesSlot === 3 ? 'var(--brand-800)' : 'var(--ink-700)',
                  }}
                >
                  3. Suffix
                </strong>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    color: 'var(--ink-600)',
                  }}
                >
                  <input
                    type="radio"
                    name="seriesSlot"
                    checked={seriesSlot === 3}
                    onChange={() => setSeriesSlot(3)}
                  />
                  <span>Series</span>
                </label>
              </div>

              {seriesSlot === 3 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-700)', fontWeight: 600 }}>
                  [Dynamic Series]
                </div>
              ) : (
                <input
                  className="field__input mono"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                  value={field3}
                  placeholder="e.g. B2B"
                  onChange={(e) => setField3(e.target.value.toUpperCase())}
                />
              )}
            </div>
          </div>
        </div>

        {/* Series Range Controls */}
        <div
          style={{
            background: 'var(--ink-50)',
            border: '1px solid var(--ink-200)',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              color: 'var(--brand-800)',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            Series Range Settings (Field {seriesSlot})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="field__label">Start Number *</span>
              <input
                className="field__input mono"
                type="number"
                min="0"
                max="999999"
                required
                value={startNum}
                onChange={(e) => setStartNum(e.target.value)}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field__label">End Number *</span>
              <input
                className="field__input mono"
                type="number"
                min={startNum || 0}
                max="999999"
                required
                value={endNum}
                onChange={(e) => setEndNum(e.target.value)}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field__label">Padding Digits *</span>
              <input
                className="field__input mono"
                type="number"
                min="1"
                max="8"
                required
                value={digits}
                onChange={(e) => setDigits(e.target.value)}
              />
              <span className="field__hint" style={{ marginTop: '2px' }}>
                e.g. 3 = {String(sNum).padStart(dLen, '0')} to {String(eNum).padStart(dLen, '0')}
              </span>
            </label>
          </div>
        </div>

        {/* Live Preview Box */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
            border: '1px solid #c7d2fe',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                color: 'var(--brand-800)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Live Series Preview
            </span>
            <span
              style={{
                background: isValidBatch ? 'var(--brand-600)' : 'var(--danger-500)',
                color: '#fff',
                fontSize: 'var(--text-xs)',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontWeight: 600,
              }}
            >
              {count} {count === 1 ? 'Coupon' : 'Coupons'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '10px',
            }}
          >
            <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink-900)' }}>
              {firstCode}
            </span>
            <span style={{ color: 'var(--ink-400)', fontWeight: 600 }}>→</span>
            <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink-900)' }}>
              {lastCode}
            </span>
          </div>

          {isValidRange && count > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                className="mono"
                style={{
                  background: '#fff',
                  border: '1px solid #c7d2fe',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {formatCode(sNum)}
              </span>
              {sNum + 1 <= eNum && (
                <span
                  className="mono"
                  style={{
                    background: '#fff',
                    border: '1px solid #c7d2fe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {formatCode(sNum + 1)}
                </span>
              )}
              {sNum + 2 <= eNum && (
                <span
                  className="mono"
                  style={{
                    background: '#fff',
                    border: '1px solid #c7d2fe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {formatCode(sNum + 2)}
                </span>
              )}
              {count > 4 && (
                <span style={{ color: 'var(--ink-500)', padding: '0 4px', fontSize: 'var(--text-xs)' }}>
                  ...
                </span>
              )}
              {count > 3 && (
                <span
                  className="mono"
                  style={{
                    background: '#fff',
                    border: '1px solid #c7d2fe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {formatCode(eNum)}
                </span>
              )}
            </div>
          )}

          {!isFirstValid && firstCode !== '—' && (
            <div style={{ marginTop: '8px', color: 'var(--danger-700)', fontSize: 'var(--text-xs)' }}>
              ⚠ Code length must be 4–32 letters/numbers. Current: {firstCode.length} chars.
            </div>
          )}
        </div>

        {/* Company & Usage Rules */}
        <div className="field-row">
          <label className="field">
            <span className="field__label">Company *</span>
            <select
              className="field__select"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Usage Per Code</span>
            <input
              className="field__input"
              disabled
              value="1 (Single-use delegate pass)"
              style={{ background: 'var(--ink-50)' }}
            />
            <span className="field__hint">Each generated code works exactly 1 time.</span>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Description</span>
          <input
            className="field__input"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`e.g. Series ${firstCode} to ${lastCode}`}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Start date</span>
            <input
              className="field__input"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="field__hint">Blank = usable immediately.</span>
          </label>
          <label className="field">
            <span className="field__label">Expiry date</span>
            <input
              className="field__input"
              type="datetime-local"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <span className="field__hint">Blank = no expiry.</span>
          </label>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active immediately upon creation
        </label>
      </form>
    </Drawer>
  );
}
