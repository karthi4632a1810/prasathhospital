import { useEffect, useState } from 'react';
import { checkinApi } from './checkinApi';

const STORAGE_KEY = 'prashanth_admin_event';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Event list + the currently selected event, shared by every page that is
 * scoped to one event. Uses the role-agnostic /admin/checkin/events list so
 * it works for check-in staff too, and remembers the choice per browser.
 */
export function useEvents() {
  const [events, setEvents] = useState(null);
  const [eventId, setEventIdState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkinApi
      .events()
      .then((res) => {
        setEvents(res.data);
        const stored = readStored();
        const initial = res.data.find((e) => e.id === stored) || res.data[0];
        if (initial) setEventIdState(initial.id);
      })
      .catch((err) => setError(err.message));
  }, []);

  function setEventId(id) {
    setEventIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage blocked — selection just won't persist */
    }
  }

  return { events, eventId, setEventId, error };
}

export function EventSelect({ events, eventId, onChange }) {
  if (!events || events.length < 2) return null;
  return (
    <select
      className="field__select"
      value={eventId || ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Event"
    >
      {events.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.title}
        </option>
      ))}
    </select>
  );
}
