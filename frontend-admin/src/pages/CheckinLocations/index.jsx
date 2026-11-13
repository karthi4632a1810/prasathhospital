import { useCallback, useEffect, useState } from 'react';
import { checkinApi } from '../../lib/checkinApi';
import { useEvents, EventSelect } from '../../lib/useEvents';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import './CheckinLocations.css';

const ICON_OPTIONS = [
  { id: 'door', emoji: '🚪', label: 'Entrance' },
  { id: 'utensils', emoji: '🍽️', label: 'Lunch / Dining' },
  { id: 'gift', emoji: '🎁', label: 'Delegate Kit' },
  { id: 'coffee', emoji: '☕', label: 'High Tea' },
  { id: 'mic', emoji: '🎤', label: 'Workshop / Hall' },
  { id: 'star', emoji: '⭐', label: 'VIP Lounge' },
];

export default function CheckinLocations() {
  const { events, eventId, setEventId, error: eventsError } = useEvents();
  const [locations, setLocations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | location object
  const [flash, setFlash] = useState(null);

  const notify = (tone, message) => {
    setFlash({ tone, message });
    setTimeout(() => setFlash(null), 4500);
  };

  const load = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    checkinApi
      .locations(eventId)
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (loc) => {
    try {
      const next = !loc.isActive;
      await checkinApi.updateLocation(loc.id, { isActive: next });
      notify('success', `"${loc.name}" ${next ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const deleteLocation = async (loc) => {
    if (!window.confirm(`Delete checkpoint "${loc.name}"? Only possible if no check-ins have been scanned here.`)) {
      return;
    }
    try {
      const res = await checkinApi.deleteLocation(loc.id);
      notify('success', res.message || `Deleted "${loc.name}".`);
      load();
    } catch (err) {
      notify('error', err.message);
    }
  };

  if (eventsError) return <ErrorState message={eventsError} />;
  if (events === null) return <LoadingState label="Loading events…" />;
  if (events.length === 0)
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;

  const activeLocations = (locations || []).filter((l) => l.isActive);
  const totalScans = (locations || []).reduce((acc, l) => acc + (l.checkedInCount || 0), 0);
  const defaultLoc = (locations || []).find((l) => l.isDefault) || null;

  return (
    <div className="locations-container">
      <div className="locations-header">
        <div>
          <h2 className="locations-header__title">
            <span>📍</span> Check-in Locations
          </h2>
          <p className="locations-header__subtitle">
            Configure checkpoint locations for the event (e.g. <strong>Main Entry Desk</strong> and{' '}
            <strong>Lunch Counter</strong>). Attendees can scan the <strong>same QR code</strong> at
            different checkpoints with duplicate prevention per location.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <EventSelect events={events} eventId={eventId} onChange={setEventId} />
          <Button variant="primary" size="sm" onClick={() => setEditing('new')} disabled={!eventId}>
            + Add Check-in Location
          </Button>
        </div>
      </div>

      {flash && (
        <div className={`notice notice--${flash.tone}`} style={{ marginBottom: 'var(--space-4)' }} role="status">
          {flash.message}
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="locations-stats-grid">
        <div className="location-stat-card">
          <div className="location-stat-card__label">Active Checkpoints</div>
          <div className="location-stat-card__value">
            {activeLocations.length}{' '}
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)', fontWeight: 400 }}>
              / {locations ? locations.length : 0} total
            </span>
          </div>
        </div>
        <div className="location-stat-card">
          <div className="location-stat-card__label">Total Scans Recorded</div>
          <div className="location-stat-card__value" style={{ color: 'var(--brand-700)' }}>
            {totalScans}
          </div>
        </div>
        <div className="location-stat-card">
          <div className="location-stat-card__label">Default Checkpoint</div>
          <div className="location-stat-card__value" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🚪</span>
            <span>{defaultLoc?.name || 'Main Entry Desk'}</span>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {loading && locations === null && <LoadingState label="Loading checkpoint locations…" />}

      {locations && locations.length === 0 && (
        <EmptyState
          title="No locations configured"
          message="Click Add Check-in Location to create your first checkpoint."
          action={
            <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
              + Add Location
            </Button>
          }
        />
      )}

      {locations && locations.length > 0 && (
        <div className="locations-table-card">
          <table className="locations-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}></th>
                <th>Location / Checkpoint</th>
                <th>Code</th>
                <th>Description</th>
                <th>Scanned Count</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const iconOpt = ICON_OPTIONS.find((i) => i.id === loc.icon) || { emoji: '📍' };
                return (
                  <tr key={loc.id}>
                    <td>
                      <div
                        className="location-badge-icon"
                        style={{
                          backgroundColor: `${loc.color || '#2563eb'}18`,
                          color: loc.color || '#2563eb',
                        }}
                      >
                        {iconOpt.emoji}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{loc.name}</div>
                      {loc.isDefault && (
                        <span className="location-pill location-pill--default" style={{ marginTop: '4px' }}>
                          ⭐ Default Entry
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="location-code-badge">{loc.code}</span>
                    </td>
                    <td style={{ color: 'var(--ink-600)', fontSize: 'var(--text-xs)', maxWidth: '300px' }}>
                      {loc.description || '—'}
                    </td>
                    <td>
                      <strong style={{ fontSize: '1rem', color: 'var(--ink-900)' }}>
                        {loc.checkedInCount || 0}
                      </strong>{' '}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>attendees</span>
                    </td>
                    <td>
                      {loc.isActive ? (
                        <span className="location-pill location-pill--active">Active</span>
                      ) : (
                        <span className="location-pill location-pill--inactive">Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(loc)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(loc)}>
                        {loc.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: '#dc2626' }}
                        disabled={loc.checkedInCount > 0}
                        title={
                          loc.checkedInCount > 0
                            ? 'Cannot delete checkpoint with recorded scans. Deactivate it instead.'
                            : 'Delete this checkpoint'
                        }
                        onClick={() => deleteLocation(loc)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Drawer */}
      {editing && (
        <LocationDrawer
          location={editing === 'new' ? null : editing}
          eventId={eventId}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notify('success', msg);
            load();
          }}
        />
      )}
    </div>
  );
}

function LocationDrawer({ location, eventId, onClose, onSaved }) {
  const [name, setName] = useState(location?.name || '');
  const [code, setCode] = useState(location?.code || '');
  const [description, setDescription] = useState(location?.description || '');
  const [icon, setIcon] = useState(location?.icon || 'door');
  const [color, setColor] = useState(location?.color || '#2563eb');
  const [isDefault, setIsDefault] = useState(location ? Boolean(location.isDefault) : false);
  const [isActive, setIsActive] = useState(location ? Boolean(location.isActive) : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const autoCode = (val) => {
    setName(val);
    if (!location) {
      setCode(
        val
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .slice(0, 16)
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a checkpoint name.');
      return;
    }
    setSaving(true);
    setError('');

    const body = {
      event: eventId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      icon,
      color,
      isDefault,
      isActive,
    };

    try {
      if (location) {
        await checkinApi.updateLocation(location.id, body);
        onSaved(`Checkpoint "${name}" updated successfully.`);
      } else {
        await checkinApi.createLocation(body);
        onSaved(`Checkpoint "${name}" created successfully.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      title={location ? `Edit ${location.name}` : 'New Check-in Location'}
      subtitle="Defines a checkpoint where attendee QR passes can be scanned."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="location-form" disabled={saving}>
            {saving ? 'Saving…' : location ? 'Save changes' : 'Create location'}
          </Button>
        </>
      }
    >
      <form id="location-form" onSubmit={handleSubmit}>
        {error && (
          <div className="notice notice--error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <label className="field">
          <span className="field__label">Location Name *</span>
          <input
            className="field__input"
            required
            value={name}
            onChange={(e) => autoCode(e.target.value)}
            placeholder="e.g. Lunch Counter / Buffet Hall"
          />
        </label>

        <label className="field">
          <span className="field__label">Identifier Code *</span>
          <input
            className="field__input mono"
            required
            maxLength={24}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. LUNCH"
          />
          <span className="field__hint">Unique short code used in QR tracking and reports (e.g. ENTRY, LUNCH).</span>
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="field__input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dining hall entrance for verifying buffet lunch vouchers"
          />
        </label>

        <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
          <span className="field__label">Checkpoint Icon</span>
          <div className="icon-selector-grid">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`icon-opt-btn${icon === opt.id ? ' is-selected' : ''}`}
                onClick={() => setIcon(opt.id)}
              >
                <span>{opt.emoji}</span>
                <span className="icon-opt-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Theme Color</span>
            <input
              type="color"
              style={{ width: '100%', height: '38px', padding: '2px', borderRadius: '6px', cursor: 'pointer' }}
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>

        <label className="checkbox" style={{ marginTop: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <span>
            <strong>Default Entry Checkpoint</strong>
            <span className="field__hint" style={{ margin: 0 }}>
              (Pre-selected by default on the Check-in Desk scanner screen)
            </span>
          </span>
        </label>

        <label className="checkbox" style={{ marginTop: 'var(--space-2)' }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Active (Visible on Scanner Desk)</span>
        </label>
      </form>
    </Drawer>
  );
}

