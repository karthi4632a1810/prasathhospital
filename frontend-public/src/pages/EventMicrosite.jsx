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

  /* Which sections actually have content — drives the header nav so we never
     link to an empty anchor. */
  const availableSections = useMemo(() => {
    if (!event) return [];
    const list = [];
    if (event.description || event.summary) list.push('about');
    if (event.speakers?.length) list.push('speakers');
    if (event.committee?.length) list.push('committee');
    if (event.agenda?.some((d) => d.items?.length)) list.push('agenda');
    if (ticketTypes.length) list.push('tickets');
    if (event.mode === 'virtual' || event.venue?.name) list.push('venue');
    if (event.faqs?.length) list.push('faq');
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
    return (
      <ErrorState
        message={state.error?.message}
        onRetry={() => load()}
      />
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <AnnouncementBar announcements={event.announcements} />

      <SiteHeader
        event={event}
        onRegister={scrollToTickets}
        canRegister={canRegister}
        availableSections={availableSections}
      />

      <main id="main">
        <Hero
          event={event}
          onRegister={scrollToTickets}
          canRegister={canRegister}
          onShare={() => setShareOpen(true)}
        />
        <ChairpersonWelcome
          name="Dr. Geetha Haripriya"
          title="Chairperson, Prashanth Fertility and Research Centre Pvt. Ltd."
          photoUrl="/assets/chairperson-geetha-haripriya.png"
          message={event.description}
        />
        <About event={event} />
        <Speakers speakers={event.speakers} />
        <Committee committee={event.committee} />
        <Agenda agenda={event.agenda} />
        <Tickets
          ticketTypes={ticketTypes}
          onSelect={goToRegistration}
          canRegister={canRegister}
        />
        <Venue event={event} />
        <Sponsors sponsors={event.sponsors} />
        <ExhibitStalls contactEmail={event.contact?.email} />
        <Faq faqs={event.faqs} contact={event.contact} />
        <FinalCta event={event} onRegister={scrollToTickets} canRegister={canRegister} />
      </main>

      <SiteFooter event={event} />

      <StickyCta
        event={event}
        ticketTypes={ticketTypes}
        onRegister={scrollToTickets}
        canRegister={canRegister}
      />

      <ShareSheet event={event} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}
