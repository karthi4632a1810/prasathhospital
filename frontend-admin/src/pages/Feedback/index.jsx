import { useCallback, useEffect, useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { feedbackApi } from '../../lib/feedbackApi';
import { formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';

export default function Feedback() {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    eventApi
      .list()
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setEventId((id) => id || res.data[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const load = useCallback(() => {
    if (!eventId) return;
    setResult(null);
    feedbackApi
      .list(eventId)
      .then((res) => setResult(res))
      .catch((err) => setError(err.message));
  }, [eventId]);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (events === null) return <LoadingState label="Loading events…" />;
  if (events.length === 0)
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;

  const entries = result?.data || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Feedback</h2>
          <p className="page-header__subtitle">
            What attendees said, straight from their ticket link.
          </p>
        </div>
        {events.length > 1 && (
          <select
            className="field__select"
            value={eventId || ''}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {result === null ? (
        <LoadingState label="Loading feedback…" />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-tile">
              <p className="stat-tile__label">Average rating</p>
              <p className="stat-tile__value">
                {result.meta.average !== null ? `${result.meta.average} ★` : '—'}
              </p>
            </div>
            <div className="stat-tile">
              <p className="stat-tile__label">Responses</p>
              <p className="stat-tile__value">{result.meta.count}</p>
            </div>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              title="No feedback yet"
              message="Responses appear here as attendees submit them from their ticket page."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {entries.map((f) => (
                <div className="card" key={f._id}>
                  <div
                    className="card__body"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--space-4)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: 'var(--warning-500)',
                          fontSize: 'var(--text-lg)',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        {'★'.repeat(f.rating)}
                        {'☆'.repeat(5 - f.rating)}
                      </div>
                      {f.comments && (
                        <p style={{ margin: 0, color: 'var(--ink-800)' }}>{f.comments}</p>
                      )}
                      <p
                        style={{
                          margin: '8px 0 0',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--ink-500)',
                        }}
                      >
                        {f.registration?.attendee?.name} · {f.registration?.registrationCode}
                      </p>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--ink-400)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDateTime(f.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
