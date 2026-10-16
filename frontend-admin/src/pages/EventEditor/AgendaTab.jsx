import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import RepeatingListEditor from '../../components/RepeatingListEditor';

const TYPES = [
  'session',
  'keynote',
  'panel',
  'workshop',
  'break',
  'registration',
  'networking',
  'other',
];

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function AgendaTab({ event, onSaved }) {
  const [days, setDays] = useState(
    (event.agenda || []).map((d) => ({ ...d, date: toDateInput(d.date) }))
  );

  const { SaveBar } = useSaveBar(async () => {
    const payload = days.map((d) => ({ ...d, date: d.date ? new Date(d.date) : new Date() }));
    const saved = await eventApi.replaceArray(event.id, 'agenda', payload);
    onSaved({ ...event, agenda: saved.data });
  });

  return (
    <div>
      <RepeatingListEditor
        items={days}
        onChange={setDays}
        itemLabel="Day"
        newItem={() => ({ date: toDateInput(new Date()), label: '', items: [] })}
        renderItem={(day, updateDay) => (
          <>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Date</span>
                <input
                  type="date"
                  className="field__input"
                  value={day.date}
                  onChange={(e) => updateDay({ date: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Label</span>
                <input
                  className="field__input"
                  placeholder="Day 1 — Clinical Track"
                  value={day.label}
                  onChange={(e) => updateDay({ label: e.target.value })}
                />
              </label>
            </div>

            <p
              className="field__label"
              style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-3)' }}
            >
              Sessions
            </p>
            <RepeatingListEditor
              items={day.items || []}
              onChange={(items) => updateDay({ items })}
              itemLabel="Session"
              newItem={() => ({
                startTime: '',
                endTime: '',
                title: '',
                description: '',
                speakerNames: [],
                track: '',
                type: 'session',
                order: (day.items || []).length,
              })}
              renderItem={(item, updateItem) => (
                <>
                  <div className="field-row">
                    <label className="field">
                      <span className="field__label">Start</span>
                      <input
                        className="field__input"
                        placeholder="09:30"
                        value={item.startTime}
                        onChange={(e) => updateItem({ startTime: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">End</span>
                      <input
                        className="field__input"
                        placeholder="10:15"
                        value={item.endTime}
                        onChange={(e) => updateItem({ endTime: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Type</span>
                      <select
                        className="field__select"
                        value={item.type}
                        onChange={(e) => updateItem({ type: e.target.value })}
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span className="field__label">Title</span>
                    <input
                      className="field__input"
                      value={item.title}
                      onChange={(e) => updateItem({ title: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Description</span>
                    <textarea
                      className="field__textarea"
                      value={item.description}
                      onChange={(e) => updateItem({ description: e.target.value })}
                    />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      <span className="field__label">Speakers (comma separated)</span>
                      <input
                        className="field__input"
                        value={(item.speakerNames || []).join(', ')}
                        onChange={(e) =>
                          updateItem({
                            speakerNames: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Track / room</span>
                      <input
                        className="field__input"
                        value={item.track}
                        onChange={(e) => updateItem({ track: e.target.value })}
                      />
                    </label>
                  </div>
                </>
              )}
            />
          </>
        )}
      />
      {SaveBar}
    </div>
  );
}
