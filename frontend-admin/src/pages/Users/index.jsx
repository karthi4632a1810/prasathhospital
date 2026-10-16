import { useEffect, useState } from 'react';
import { userApi } from '../../lib/userApi';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState } from '../../components/ui/States';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const ROLES = ['superadmin', 'manager', 'checkin_staff'];
const ROLE_LABELS = {
  superadmin: 'Super admin',
  manager: 'Manager',
  checkin_staff: 'Check-in staff',
};

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setError(null);
    userApi
      .list()
      .then((res) => setUsers(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function handleUpdated(updated) {
    setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
  }

  function handleDeleted(id) {
    setUsers((list) => list.filter((u) => u.id !== id));
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (users === null) return <LoadingState label="Loading users…" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Users &amp; Roles</h2>
          <p className="page-header__subtitle">
            Who can access the admin dashboard, and what they can do.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '+ New user'}
        </Button>
      </div>

      {showCreate && (
        <CreateUserForm
          onCreated={(u) => {
            setUsers((list) => [u, ...list]);
            setShowCreate(false);
          }}
        />
      )}

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === me?.id}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ user, isSelf, onUpdated, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleRoleChange(e) {
    setBusy(true);
    try {
      const res = await userApi.update(user.id, { role: e.target.value });
      onUpdated(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    setBusy(true);
    setError('');
    try {
      const res = await userApi.update(user.id, { isActive: !user.isActive });
      onUpdated(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    const newPassword = window.prompt(`New password for ${user.email} (min 8 characters):`);
    if (!newPassword) return;
    setBusy(true);
    setError('');
    try {
      await userApi.update(user.id, { newPassword });
      window.alert('Password updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove ${user.name} (${user.email})? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await userApi.remove(user.id);
      onDeleted(user.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        {user.name} {isSelf && <span style={{ color: 'var(--ink-400)' }}>(you)</span>}
      </td>
      <td>{user.email}</td>
      <td>
        <select
          className="field__select"
          value={user.role}
          onChange={handleRoleChange}
          disabled={busy}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <Badge tone={user.isActive ? 'success' : 'neutral'} size="sm">
          {user.isActive ? 'Active' : 'Disabled'}
        </Badge>
      </td>
      <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</td>
      <td>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={handleResetPassword}
            disabled={busy}
            title="Reset password"
          >
            🔑
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={handleToggleActive}
            disabled={busy || isSelf}
            title={user.isActive ? 'Disable' : 'Enable'}
          >
            {user.isActive ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={handleDelete}
            disabled={busy || isSelf}
            title="Delete"
          >
            ✕
          </button>
        </div>
        {error && (
          <p className="field__error" style={{ textAlign: 'right' }}>
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

function CreateUserForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await userApi.create(form);
      onCreated(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div className="card__body">
        <form onSubmit={handleSubmit} className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              className="field__input"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input
              type="password"
              className="field__input"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Role</span>
            <select
              className="field__select"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </form>
        {error && <p className="field__error">{error}</p>}
      </div>
    </div>
  );
}
