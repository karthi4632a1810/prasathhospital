import { useCallback, useEffect, useState } from 'react';
import { companyApi } from '../../lib/companyApi';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Drawer from '../../components/ui/Drawer';
import { UsageBar } from '../../components/StatusBadges';

const EMPTY = { name: '', contactName: '', contactEmail: '', contactPhone: '', notes: '', isActive: true };

export default function Companies() {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | company
  const [flash, setFlash] = useState('');

  const load = useCallback(() => {
    setError(null);
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (active) params.active = active;
    companyApi
      .list(params)
      .then((res) => setCompanies(res.data))
      .catch((err) => setError(err.message));
  }, [q, active]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function handleSaved(company, message) {
    setEditing(null);
    setFlash(message);
    load();
    setTimeout(() => setFlash(''), 4000);
    return company;
  }

  if (error && companies === null) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Companies</h2>
          <p className="page-header__subtitle">Sponsoring companies whose coupons cover their delegates’ registrations.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
          + Add company
        </Button>
      </div>

      {flash && <div className="notice notice--success" role="status">{flash}</div>}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="toolbar">
          <label className="field field--grow">
            <span className="field__label">Search</span>
            <input className="field__input" placeholder="Company name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select className="field__select" value={active} onChange={(e) => setActive(e.target.value)}>
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>
      </div>

      {companies === null ? (
        <LoadingState label="Loading companies…" />
      ) : companies.length === 0 ? (
        <EmptyState
          title={q || active ? 'No companies match' : 'No companies yet'}
          message={q || active ? 'Try a different search.' : 'Add the first sponsoring company, then create coupons for it.'}
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th className="num">Coupons</th>
                <th>Coupon usage</th>
                <th className="num">Confirmed</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.notes && <span className="sub">{c.notes.length > 60 ? `${c.notes.slice(0, 60)}…` : c.notes}</span>}
                  </td>
                  <td>
                    {c.contactName || <span className="muted">—</span>}
                    {(c.contactEmail || c.contactPhone) && (
                      <span className="sub">{[c.contactEmail, c.contactPhone].filter(Boolean).join(' · ')}</span>
                    )}
                  </td>
                  <td className="num">{c.couponCount}</td>
                  <td>{c.allocated > 0 ? <UsageBar used={c.used} allocated={c.allocated} /> : <span className="muted">No coupons</span>}</td>
                  <td className="num">{c.registrations}</td>
                  <td>
                    <Badge tone={c.isActive ? 'success' : 'neutral'} size="sm">{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CompanyForm
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function CompanyForm({ company, onClose, onSaved }) {
  const [form, setForm] = useState(company ? { ...EMPTY, ...company } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      name: form.name,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      notes: form.notes,
      isActive: form.isActive,
    };
    try {
      const res = company ? await companyApi.update(company.id, body) : await companyApi.create(body);
      onSaved(res.data, company ? `${res.data.name} updated.` : `${res.data.name} added.`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${company.name}? This only works if it has no coupons or registrations.`)) return;
    setSaving(true);
    setError('');
    try {
      await companyApi.remove(company.id);
      onSaved(null, `${company.name} deleted.`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Drawer
      open
      title={company ? `Edit ${company.name}` : 'Add company'}
      subtitle={company ? `${company.couponCount} coupons · ${company.registrations} confirmed registrations` : undefined}
      onClose={onClose}
      footer={
        <>
          {company && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving} style={{ marginRight: 'auto' }}>
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="company-form" disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : company ? 'Save changes' : 'Add company'}
          </Button>
        </>
      }
    >
      <form id="company-form" onSubmit={handleSubmit}>
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        <label className="field">
          <span className="field__label">Company name *</span>
          <input className="field__input" required maxLength={120} value={form.name} onChange={set('name')} autoFocus />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field__label">Contact person</span>
            <input className="field__input" maxLength={120} value={form.contactName} onChange={set('contactName')} />
          </label>
          <label className="field">
            <span className="field__label">Contact phone</span>
            <input className="field__input" maxLength={20} value={form.contactPhone} onChange={set('contactPhone')} />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Contact email</span>
          <input className="field__input" type="email" maxLength={160} value={form.contactEmail} onChange={set('contactEmail')} />
        </label>
        <label className="field">
          <span className="field__label">Notes</span>
          <textarea className="field__textarea" maxLength={1000} value={form.notes} onChange={set('notes')} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Active
        </label>
        <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
          Deactivating a company stops all of its coupons from being redeemed. Existing registrations are kept.
        </p>
      </form>
    </Drawer>
  );
}
