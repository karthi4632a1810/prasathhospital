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
  const [editing, setEditing] = useState(null); // null | 'new' | coupon
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    companyApi.list().then((res) => setCompanies(res.data)).catch(() => {});
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
    if (!next && !window.confirm(`Deactivate ${coupon.code}? It will stop working immediately. Existing registrations are kept.`)) return;
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
  if (events.length === 0) return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;
  if (error && coupons === null) return <ErrorState message={error} onRetry={load} />;

  const activeCompanies = (companies || []).filter((c) => c.isActive);
  const totals = (coupons || []).reduce(
    (acc, c) => ({ allocated: acc.allocated + c.maxAllowedRegistrations, used: acc.used + c.usageCount }),
    { allocated: 0, used: 0 }
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Coupons</h2>
          <p className="page-header__subtitle">
            Each coupon admits a fixed number of delegates at ₹0.
            {coupons && coupons.length > 0 && ` ${totals.used} of ${totals.allocated} places used across ${coupons.length} coupons.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <EventSelect events={events} eventId={eventId} onChange={setEventId} />
          <Button variant="primary" size="sm" onClick={() => setEditing('new')} disabled={activeCompanies.length === 0}>
            + New coupon
          </Button>
        </div>
      </div>

      {activeCompanies.length === 0 && companies !== null && (
        <div className="notice notice--info">
          Add an active company first — every coupon belongs to a company. <a href="/companies">Go to Companies →</a>
        </div>
      )}
      {flash && <div className={`notice notice--${flash.tone}`} role="status">{flash.message}</div>}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="toolbar">
          <label className="field field--grow">
            <span className="field__label">Search code</span>
            <input className="field__input" placeholder="e.g. YAMAHA" value={filters.q} onChange={setFilter('q')} />
          </label>
          <label className="field">
            <span className="field__label">Company</span>
            <select className="field__select" value={filters.company} onChange={setFilter('company')}>
              <option value="">All companies</option>
              {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">State</span>
            <select className="field__select" value={filters.state} onChange={setFilter('state')}>
              <option value="">All states</option>
              {COUPON_STATE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {coupons === null ? (
        <LoadingState label="Loading coupons…" />
      ) : coupons.length === 0 ? (
        <EmptyState title="No coupons" message="Create a coupon for a company to open registration to its delegates." />
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
                  <td><UsageBar used={c.usageCount} allocated={c.maxAllowedRegistrations} /></td>
                  <td className="muted" style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                    {c.startDate ? formatDateTime(c.startDate) : 'Now'}
                    <br />→ {c.expiryDate ? formatDateTime(c.expiryDate) : 'No expiry'}
                  </td>
                  <td><CouponStateBadge state={c.state} /></td>
                  <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                    {formatDateTime(c.createdAt)}
                    {c.createdBy?.name && <span className="sub">by {c.createdBy.name}</span>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</Button>
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
    if (!window.confirm(`Delete ${coupon.code}? Only possible while it has never been used.`)) return;
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
      subtitle={coupon ? `${used} of ${coupon.maxAllowedRegistrations} used` : 'Codes are case-insensitive and must be unique.'}
      onClose={onClose}
      footer={
        <>
          {coupon && used === 0 && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving} style={{ marginRight: 'auto' }}>
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" form="coupon-form" disabled={saving}>
            {saving ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={handleSubmit}>
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        {locked && (
          <div className="notice notice--info">
            This coupon has been used, so its code and company are locked. You can still change the limit, dates and status.
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
                <Button variant="secondary" size="sm" onClick={() => generate(form.company)} disabled={generating || !form.company}>
                  {generating ? '…' : 'Generate'}
                </Button>
              )}
            </div>
            <span className="field__hint">
              {coupon ? '4–32 letters, numbers, “-” or “_”.' : 'Auto-generated and unique for the company. You can edit it or press Generate for another.'}
            </span>
          </label>
          <label className="field">
            <span className="field__label">Company *</span>
            <select className="field__select" required value={form.company} disabled={locked} onChange={set('company')}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field__label">Description</span>
          <input className="field__input" maxLength={500} value={form.description} onChange={set('description')} placeholder="e.g. Yamaha dealer network delegates" />
        </label>
        <label className="field">
          <span className="field__label">Max registrations *</span>
          <input className="field__input" type="number" min={Math.max(used, 1)} max={100000} required value={form.maxAllowedRegistrations} onChange={set('maxAllowedRegistrations')} />
          {used > 0 && <span className="field__hint">Can’t be set below the {used} already used.</span>}
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Start date</span>
            <input className="field__input" type="datetime-local" value={form.startDate} onChange={set('startDate')} />
            <span className="field__hint">Blank = usable immediately.</span>
          </label>
          <label className="field">
            <span className="field__label">Expiry date</span>
            <input className="field__input" type="datetime-local" value={form.expiryDate} onChange={set('expiryDate')} />
            <span className="field__hint">Blank = no expiry.</span>
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Active
        </label>
      </form>
    </Drawer>
  );
}
