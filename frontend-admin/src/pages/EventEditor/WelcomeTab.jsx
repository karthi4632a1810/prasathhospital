import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import SectionVisibilityBanner from '../../components/SectionVisibilityBanner';
import ImageUploadField from '../../components/ImageUploadField';

export default function WelcomeTab({ event, onSaved }) {
  const currentWelcome = event.chairpersonWelcome || {};

  const [form, setForm] = useState(() => ({
    show: currentWelcome.show !== false,
    eyebrow: currentWelcome.eyebrow || 'A message from our chairperson',
    name: currentWelcome.name || 'Dr. Geetha Haripriya',
    title: currentWelcome.title || 'Chairperson, Prashanth Fertility and Research Centre Pvt. Ltd.',
    photoUrl: currentWelcome.photoUrl || '/assets/chairperson-geetha-haripriya.png',
    message: currentWelcome.message || event.description || '',
  }));

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, {
      chairpersonWelcome: {
        show: form.show,
        eyebrow: form.eyebrow,
        name: form.name,
        title: form.title,
        photoUrl: form.photoUrl,
        message: form.message,
      },
    });
    onSaved(res.data);
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <SectionVisibilityBanner
        sectionKey="chairpersonWelcome"
        sectionName="Chairperson / Welcome Message"
        event={event}
        onSaved={onSaved}
        description="A full-width personal welcome address from the event chairperson or leadership."
      />

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Chairperson & Welcome Message</h3>
        </div>
        <div className="card__body">
          <label className="field">
            <span className="field__label">Section Eyebrow</span>
            <input
              className="field__input"
              value={form.eyebrow}
              onChange={set('eyebrow')}
              placeholder="A message from our chairperson"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Full Name & Title</span>
              <input
                className="field__input"
                value={form.name}
                onChange={set('name')}
                placeholder="Dr. Geetha Haripriya"
              />
            </label>

            <label className="field">
              <span className="field__label">Designation / Organization</span>
              <input
                className="field__input"
                value={form.title}
                onChange={set('title')}
                placeholder="Chairperson, Prashanth Fertility and Research Centre Pvt. Ltd."
              />
            </label>
          </div>

          <ImageUploadField
            label="Portrait Photo"
            value={form.photoUrl}
            onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
          />

          <label className="field">
            <span className="field__label">
              Welcome Message
            </span>
            <span className="field__hint">
              Separate paragraphs with blank lines.
            </span>
            <textarea
              className="field__textarea"
              style={{ minHeight: 200 }}
              value={form.message}
              onChange={set('message')}
              placeholder="Greetings from the organizing committee..."
            />
          </label>

          {/* Quick Preview Card */}
          <div
            style={{
              marginTop: 'var(--space-6)',
              padding: 'var(--space-5)',
              background: 'var(--ink-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--ink-200)',
            }}
          >
            <span
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                color: 'var(--brand-700)',
                display: 'block',
                marginBottom: 'var(--space-2)',
              }}
            >
              Live Preview Preview
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {form.photoUrl && (
                <img
                  src={form.photoUrl}
                  alt={form.name}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 'var(--radius-full)',
                    objectFit: 'cover',
                    border: '2px solid var(--brand-500)',
                  }}
                />
              )}
              <div style={{ flex: '1 1 240px' }}>
                <strong style={{ fontSize: 'var(--text-base)', color: 'var(--ink-900)' }}>
                  {form.name || 'Name not set'}
                </strong>
                <p style={{ margin: '2px 0 var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
                  {form.title || 'Designation not set'}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink-700)', fontStyle: 'italic' }}>
                  {form.message
                    ? `"${form.message.slice(0, 180)}..."`
                    : 'No welcome message set yet.'}
                </p>
              </div>
            </div>
          </div>

          {SaveBar}
        </div>
      </div>
    </div>
  );
}
