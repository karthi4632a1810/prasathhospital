import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import AnnouncementBar from '../components/AnnouncementBar';
import StickyCta from '../components/StickyCta';
import ShareSheet from '../components/ShareSheet';
import { LoadingState, ErrorState, NotFoundState } from '../components/ui/States';

import Hero from '../sections/Hero';
import ChairpersonWelcome from '../sections/ChairpersonWelcome';
import About from '../sections/About';
import Speakers from '../sections/Speakers';
import Committee from '../sections/Committee';
import Agenda from '../sections/Agenda';
import Tickets from '../sections/Tickets';
import Venue from '../sections/Venue';
import Sponsors from '../sections/Sponsors';
import ExhibitStalls from '../sections/ExhibitStalls';
import Faq from '../sections/Faq';
import FinalCta from '../sections/FinalCta';

import { api } from '../lib/api';
import { useSeo } from '../lib/useSeo';
import { captureCampaign, withCampaignParams } from '../lib/campaign';
import { useRevealOnScroll } from '../lib/useRevealOnScroll';

const DEFAULT_SLUG = import.meta.env.VITE_DEFAULT_EVENT_SLUG || 'fertility-gynaecology-summit-2026';

export default function EventMicrosite() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug || DEFAULT_SLUG;

  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [shareOpen, setShareOpen] = useState(false);

  // Record which campaign brought this visitor in, before anything else.
  useEffect(() => {
    captureCampaign();
  }, []);

  const load = useCallback(
    (signal) => {
      setState({ status: 'loading', data: null, error: null });

      api
        .getEvent(slug, { signal })
        .then((res) => setState({ status: 'ready', data: res.data, error: null }))
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setState({
            status: err.status === 404 ? 'not-found' : 'error',
            data: null,
            error: err,
          });
        });
    },
    [slug]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const event = state.data?.event;
  const ticketTypes = state.data?.ticketTypes || [];

  useSeo(event?.seo, event?.jsonLd);
  useRevealOnScroll(state.status === 'ready');

  const canRegister = event?.registrationState === 'open';

  const sections = event?.sections || {};

  /* Which sections actually have content and are enabled — drives the header nav
     so we never link to a hidden or empty anchor. */
  const availableSections = useMemo(() => {
    if (!event) return [];
    const sec = event.sections || {};
    const list = [];
    if (sec.about !== false && (event.description || event.summary || event.highlights?.length)) {
      list.push('about');
    }
    if (sec.speakers !== false && event.speakers?.length) list.push('speakers');
    if (sec.committee !== false && event.committee?.length) list.push('committee');
    if (sec.agenda !== false && event.agenda?.some((d) => d.items?.length)) list.push('agenda');
    if (sec.tickets !== false && ticketTypes.length) list.push('tickets');
    if (sec.venue !== false && (event.mode === 'virtual' || event.venue?.name)) list.push('venue');
    if (sec.sponsors !== false && event.sponsors?.length) list.push('sponsors');
    if (sec.exhibitStalls !== false) list.push('exhibit');
    if (sec.faqs !== false && event.faqs?.length) list.push('faq');
    return list;
  }, [event, ticketTypes.length]);

  /* Registration hand-off. Module 3 mounts /events/:slug/register; the campaign
     source rides along so the registration record can be attributed. */
  const goToRegistration = useCallback(
    (ticket) => {
      const base = `/events/${slug}/register`;
      const path = ticket ? `${base}?ticket=${encodeURIComponent(ticket.code)}` : base;
      navigate(withCampaignParams(path));
    },
    [navigate, slug]
  );

  const scrollToTickets = useCallback(() => {
    const el = document.getElementById('tickets');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      goToRegistration(null);
    }
  }, [goToRegistration]);

  if (state.status === 'loading') return <LoadingState />;

  if (state.status === 'not-found') {
    return <NotFoundState message={state.error?.message} />;
  }

  if (state.status === 'error') {
    return <ErrorState message={state.error?.message} onRetry={() => load()} />;
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {sections.announcements !== false && (
        <AnnouncementBar announcements={event.announcements} />
      )}

      <SiteHeader
        event={event}
        onRegister={scrollToTickets}
        canRegister={canRegister}
        availableSections={availableSections}
      />

      <main id="main">
        {sections.hero !== false && (
          <Hero
            event={event}
            onRegister={scrollToTickets}
            canRegister={canRegister}
            onShare={() => setShareOpen(true)}
          />
        )}
        {sections.chairpersonWelcome !== false && (
          <ChairpersonWelcome
            welcome={event.chairpersonWelcome}
            eventDescription={event.description}
          />
        )}
        {sections.about !== false && <About event={event} />}
        {sections.speakers !== false && event.speakers?.length > 0 && (
          <Speakers speakers={event.speakers} />
        )}
        {sections.committee !== false && event.committee?.length > 0 && (
          <Committee committee={event.committee} />
        )}
        {sections.agenda !== false && event.agenda?.length > 0 && (
          <Agenda agenda={event.agenda} />
        )}
        {sections.tickets !== false && ticketTypes.length > 0 && (
          <Tickets ticketTypes={ticketTypes} onSelect={goToRegistration} canRegister={canRegister} />
        )}
        {sections.venue !== false && <Venue event={event} />}
        {sections.sponsors !== false && event.sponsors?.length > 0 && (
          <Sponsors sponsors={event.sponsors} />
        )}
        {sections.exhibitStalls !== false && (
          <ExhibitStalls
            exhibit={event.exhibitStalls}
            contactEmail={event.exhibitStalls?.contactEmail || event.contact?.email}
          />
        )}
        {sections.faqs !== false && event.faqs?.length > 0 && (
          <Faq faqs={event.faqs} contact={event.contact} />
        )}
        {sections.finalCta !== false && (
          <FinalCta
            event={event}
            settings={event.finalCtaSettings}
            onRegister={scrollToTickets}
            canRegister={canRegister}
          />
        )}
      </main>

      <SiteFooter event={event} />

      <ShareSheet event={event} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}
