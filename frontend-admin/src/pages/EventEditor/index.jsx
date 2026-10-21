import { useCallback, useEffect, useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import SectionsTab from './SectionsTab';
import DetailsTab from './DetailsTab';
import HeroCtaTab from './HeroCtaTab';
import WelcomeTab from './WelcomeTab';
import VenueTab from './VenueTab';
import ThemeSeoTab from './ThemeSeoTab';
import SpeakersTab from './SpeakersTab';
import CommitteeTab from './CommitteeTab';
import AgendaTab from './AgendaTab';
import SponsorsTab from './SponsorsTab';
import ExhibitTab from './ExhibitTab';
import FaqTab from './FaqTab';
import AnnouncementsTab from './AnnouncementsTab';
import './EventEditor.css';

const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '');

const TABS = [
  { key: 'sections', label: 'Screen Controls', Component: SectionsTab },
  { key: 'details', label: 'Details', Component: DetailsTab },
  { key: 'hero-cta', label: 'Hero & CTA', Component: HeroCtaTab },
  { key: 'welcome', label: 'Welcome Message', Component: WelcomeTab },
  { key: 'venue', label: 'Venue & Contact', Component: VenueTab },
  { key: 'theme', label: 'Theme & SEO', Component: ThemeSeoTab },
  { key: 'speakers', label: 'Speakers', Component: SpeakersTab },
  { key: 'committee', label: 'Committee', Component: CommitteeTab },
  { key: 'sponsors', label: 'Sponsors', Component: SponsorsTab },
  { key: 'exhibit', label: 'Exhibit & Stalls', Component: ExhibitTab },
  { key: 'faqs', label: 'FAQ', Component: FaqTab },
  { key: 'announcements', label: 'Announcements', Component: AnnouncementsTab },
];

export default function EventEditor() {
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sections');

  const loadList = useCallback(() => {
    setError(null);
    eventApi
      .list()
      .then((res) => {
        setEvents(res.data);
        if (res.data.length > 0) setEventId((id) => id || res.data[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(loadList, [loadList]);

  useEffect(() => {
    if (!eventId) return;
    setEvent(null);
    eventApi
      .get(eventId)
      .then((res) => setEvent(res.data))
      .catch((err) => setError(err.message));
  }, [eventId]);

  async function handleCreate() {
    const res = await eventApi.create({
      title: 'New event',
      startDate: new Date(),
      endDate: new Date(),
    });
    loadList();
    setEventId(res.data.id);
  }

  if (error) return <ErrorState message={error} onRetry={loadList} />;
  if (events === null) return <LoadingState label="Loading events…" />;

  if (events.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        message="Create your first event to start editing the microsite."
        action={
          <Button variant="primary" onClick={handleCreate}>
            + New event
          </Button>
        }
      />
    );
  }

  const ActiveTab = TABS.find((t) => t.key === activeTab).Component;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Event CMS</h2>
          <p className="page-header__subtitle">
            Everything on the public microsite comes from here.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
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
          <Button variant="secondary" size="sm" onClick={handleCreate}>
            + New event
          </Button>
          {event && PUBLIC_SITE_URL && (
            <a
              className="btn btn--primary btn--sm"
              href={`${PUBLIC_SITE_URL}/events/${event.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Preview live ↗
            </a>
          )}
        </div>
      </div>

      <div className="event-editor__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`event-editor__tab${activeTab === tab.key ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="event-editor__panel">
        {!event ? (
          <LoadingState label="Loading event…" />
        ) : (
          <ActiveTab event={event} onSaved={setEvent} onNavigateTab={setActiveTab} />
        )}
      </div>
    </div>
  );
}
