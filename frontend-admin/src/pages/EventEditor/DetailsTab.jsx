import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { toDateTimeLocal, fromDateTimeLocal } from '../../lib/format';
import { useSaveBar } from '../../components/SaveBar';

const CATEGORIES = ['cme', 'conference', 'workshop', 'awareness-camp', 'public-seminar', 'other'];
const MODES = ['in-person', 'virtual', 'hybrid'];
const STATUSES = ['draft', 'published', 'registration-closed', 'completed', 'cancelled'];

export default function DetailsTab({ event, onSaved }) {
  const [form, setForm] = useState(() => ({
    title: event.title || '',
    tagline: event.tagline || '',
    summary: event.summary || '',
    description: event.description || '',
    category: event.category || 'conference',
    mode: event.mode || 'in-person',
    status: event.status || 'draft',
    startDate: toDateTimeLocal(event.startDate),
    endDate: toDateTimeLocal(event.endDate),
    registrationOpensAt: toDateTimeLocal(event.registrationOpensAt),
    registrationClosesAt: toDateTimeLocal(event.registrationClosesAt),
    capacity: event.capacity ?? 0,
    isFeatured: Boolean(event.isFeatured),
    highlights: (event.highlights || []).join('\n'),
  }));

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, {
      title: form.title,
      tagline: form.tagline,
      summary: form.summary,
      description: form.description,
      category: form.category,
      mode: form.mode,
      status: form.status,
      startDate: fromDateTimeLocal(form.startDate),
      endDate: fromDateTimeLocal(form.endDate),
      registrationOpensAt: fromDateTimeLocal(form.registrationOpensAt),
      registrationClosesAt: fromDateTimeLocal(form.registrationClosesAt),
      capacity: Number(form.capacity) || 0,
      isFeatured: form.isFeatured,
      highlights: form.highlights
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onSaved(res.data);
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="card">
      <div className="card__body">
        <label className="field">
          <span className="field__label">Title</span>
          <input className="field__input" value={form.title} onChange={set('title')} />
        </label>

        <label className="field">
          <span className="field__label">Tagline</span>
          <input
            className="field__input"
            value={form.tagline}
            onChange={set('tagline')}
            maxLength={220}
          />
        </label>

        <label className="field">
          <span className="field__label">Summary</span>
          <textarea
            className="field__textarea"
            value={form.summary}
            onChange={set('summary')}
            maxLength={600}
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="field__textarea"
            style={{ minHeight: 160 }}
            value={form.description}
            onChange={set('description')}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Category</span>
            <select className="field__select" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Mode</span>
            <select className="field__select" value={form.mode} onChange={set('mode')}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Status</span>
            <select className="field__select" value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Start date &amp; time</span>
            <input
              type="datetime-local"
              className="field__input"
              value={form.startDate}
              onChange={set('startDate')}
            />
          </label>
          <label className="field">
            <span className="field__label">End date &amp; time</span>
            <input
              type="datetime-local"
              className="field__input"
              value={form.endDate}
              onChange={set('endDate')}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Registration opens</span>
            <input
              type="datetime-local"
              className="field__input"
              value={form.registrationOpensAt}
              onChange={set('registrationOpensAt')}
            />
          </label>
          <label className="field">
            <span className="field__label">Registration closes</span>
            <input
              type="datetime-local"
              className="field__input"
              value={form.registrationClosesAt}
              onChange={set('registrationClosesAt')}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Capacity</span>
            <input
              type="number"
              min="0"
              className="field__input"
              value={form.capacity}
              onChange={set('capacity')}
            />
            <span className="field__hint">0 = unlimited</span>
          </label>

          <label className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="field__label">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                style={{ marginRight: 'var(--space-2)' }}
              />
              Featured event
            </span>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Highlights (one per line)</span>
          <textarea
            className="field__textarea"
            value={form.highlights}
            onChange={set('highlights')}
          />
        </label>

        {SaveBar}
      </div>
    </div>
  );
}
