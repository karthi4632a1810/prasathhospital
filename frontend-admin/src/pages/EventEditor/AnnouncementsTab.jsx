import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import RepeatingListEditor from '../../components/RepeatingListEditor';
import { toDateTimeLocal, fromDateTimeLocal } from '../../lib/format';

const LEVELS = ['info', 'success', 'warning'];

export default function AnnouncementsTab({ event, onSaved }) {
  const [announcements, setAnnouncements] = useState(
    (event.announcements || []).map((a) => ({
      ...a,
      expiresAt: a.expiresAt ? toDateTimeLocal(a.expiresAt) : '',
    }))
  );

  const { SaveBar } = useSaveBar(async () => {
    const payload = announcements.map((a) => ({ ...a, expiresAt: fromDateTimeLocal(a.expiresAt) }));
    const saved = await eventApi.replaceArray(event.id, 'announcements', payload);
    onSaved({ ...event, announcements: saved.data });
  });

  return (
    <div>
      <p style={{ color: 'var(--ink-500)', marginBottom: 'var(--space-4)' }}>
        Shown as a dismissible bar at the top of the microsite. Only active, unexpired announcements
        are visible to visitors.
      </p>
      <RepeatingListEditor
        items={announcements}
        onChange={setAnnouncements}
        itemLabel="Announcement"
        newItem={() => ({ message: '', level: 'info', isActive: true, expiresAt: '' })}
        renderItem={(item, update) => (
          <>
            <label className="field">
              <span className="field__label">Message</span>
              <input
                className="field__input"
                value={item.message}
                onChange={(e) => update({ message: e.target.value })}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Level</span>
                <select
                  className="field__select"
                  value={item.level}
                  onChange={(e) => update({ level: e.target.value })}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Expires at (optional)</span>
                <input
                  type="datetime-local"
                  className="field__input"
                  value={item.expiresAt}
                  onChange={(e) => update({ expiresAt: e.target.value })}
                />
              </label>
            </div>
            <label className="field__label">
              <input
                type="checkbox"
                checked={item.isActive}
                onChange={(e) => update({ isActive: e.target.checked })}
                style={{ marginRight: 'var(--space-2)' }}
              />
              Active
            </label>
          </>
        )}
      />
      {SaveBar}
    </div>
  );
}
