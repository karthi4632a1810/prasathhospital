import { useCallback, useEffect, useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { ticketTypeApi } from '../../lib/ticketTypeApi';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import TicketTypeCard from './TicketTypeCard';

export default function TicketTypes() {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [tickets, setTickets] = useState(null);
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

  const loadTickets = useCallback(() => {
    if (!eventId) return;
    setTickets(null);
    ticketTypeApi
      .list(eventId)
      .then((res) => setTickets(res.data))
      .catch((err) => setError(err.message));
  }, [eventId]);

  useEffect(loadTickets, [loadTickets]);

  async function handleCreate() {
    const res = await ticketTypeApi.create({
      event: eventId,
      name: 'New pass',
      code: `PASS${(tickets?.length || 0) + 1}`,
      order: tickets?.length || 0,
    });
    setTickets((list) => [...(list || []), res.data]);
  }

  function handleSaved(updated) {
    setTickets((list) =>
      list.map((t) => ((t._id || t.id) === (updated._id || updated.id) ? updated : t))
    );
  }

  function handleDeleted(id) {
    setTickets((list) => list.filter((t) => (t._id || t.id) !== id));
  }

  if (error) return <ErrorState message={error} onRetry={loadTickets} />;
  if (events === null) return <LoadingState label="Loading events…" />;
  if (events.length === 0) {
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Ticket Types</h2>
          <p className="page-header__subtitle">
            Pricing, inventory and sales windows for each pass.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
          <Button variant="primary" size="sm" onClick={handleCreate}>
            + New pass
          </Button>
        </div>
      </div>

      {tickets === null ? (
        <LoadingState label="Loading ticket types…" />
      ) : tickets.length === 0 ? (
        <EmptyState title="No passes yet" message="Add the first pass type for this event." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {tickets.map((t) => (
            <TicketTypeCard
              key={t._id || t.id}
              ticket={t}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
