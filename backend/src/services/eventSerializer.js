'use strict';

const env = require('../config/env');

/**
 * Shapes Mongoose documents into the exact payload the public site consumes.
 * Keeping this in one place means internal fields (capacity maths, held
 * inventory, draft notes) never leak to the browser by accident.
 */

function sortByOrder(list = []) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.publicSiteUrl.replace(/\/$/, '')}/${String(pathOrUrl).replace(/^\//, '')}`;
}

function serializeSpeaker(s) {
  return {
    id: String(s._id),
    name: s.name,
    credentials: s.credentials,
    designation: s.designation,
    organization: s.organization,
    photoUrl: s.photoUrl,
    bio: s.bio,
    topic: s.topic,
    isKeynote: s.isKeynote,
  };
}

function serializeCommitteeMember(m) {
  return {
    id: String(m._id),
    name: m.name,
    role: m.role,
    group: m.group,
    photoUrl: m.photoUrl,
  };
}

function serializeAgendaDay(day) {
  return {
    id: String(day._id),
    date: day.date,
    label: day.label,
    items: sortByOrder(day.items).map((item) => ({
      id: String(item._id),
      startTime: item.startTime,
      endTime: item.endTime,
      title: item.title,
      description: item.description,
      speakerNames: item.speakerNames || [],
      track: item.track,
      type: item.type,
    })),
  };
}

function serializeSponsor(s) {
  return {
    id: String(s._id),
    name: s.name,
    logoUrl: s.logoUrl,
    websiteUrl: s.websiteUrl,
    tier: s.tier,
  };
}

function buildSeo(event) {
  const canonical =
    event.seo?.canonicalUrl || `${env.publicSiteUrl.replace(/\/$/, '')}/events/${event.slug}`;

  return {
    metaTitle: event.seo?.metaTitle || `${event.title} | Prashanth Hospitals`,
    metaDescription:
      event.seo?.metaDescription ||
      event.summary ||
      event.tagline ||
      `Join ${event.title} organised by Prashanth Hospitals.`,
    keywords: event.seo?.keywords || [],
    ogImageUrl: absoluteUrl(event.seo?.ogImageUrl || event.theme?.heroImageUrl),
    canonicalUrl: canonical,
    noIndex: Boolean(event.seo?.noIndex),
  };
}

/**
 * schema.org/Event JSON-LD so Google, WhatsApp and social previews render the
 * event richly — part of the "SEO & social sharing" scope item.
 */
function buildJsonLd(event) {
  const venue = event.venue || {};
  const isVirtual = event.mode === 'virtual';

  const location = isVirtual
    ? { '@type': 'VirtualLocation', url: event.virtualLink || env.publicSiteUrl }
    : {
        '@type': 'Place',
        name: venue.name || 'Venue',
        address: {
          '@type': 'PostalAddress',
          streetAddress: [venue.addressLine1, venue.addressLine2].filter(Boolean).join(', '),
          addressLocality: venue.city,
          addressRegion: venue.state,
          postalCode: venue.pincode,
          addressCountry: 'IN',
        },
      };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary || event.tagline,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus:
      event.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: isVirtual
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : event.mode === 'hybrid'
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    location,
    image: [absoluteUrl(event.theme?.heroImageUrl)].filter(Boolean),
    organizer: {
      '@type': 'Organization',
      name: event.organizer?.name || 'Prashanth Hospitals',
      url: event.organizer?.websiteUrl || env.publicSiteUrl,
    },
  };
}

/** Compact shape for listing pages. */
function serializeEventCard(event) {
  return {
    id: String(event._id),
    slug: event.slug,
    title: event.title,
    tagline: event.tagline,
    summary: event.summary,
    category: event.category,
    mode: event.mode,
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    heroImageUrl: event.theme?.heroImageUrl || '',
    city: event.venue?.city || '',
    venueName: event.venue?.name || '',
    registrationState: event.registrationState,
    isFeatured: event.isFeatured,
  };
}

/** Full microsite payload. */
function serializeEventForPublic(event) {
  return {
    id: String(event._id),
    slug: event.slug,
    title: event.title,
    tagline: event.tagline,
    summary: event.summary,
    description: event.description,

    category: event.category,
    mode: event.mode,
    status: event.status,

    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,

    registrationState: event.registrationState,
    capacity: event.capacity || 0,
    seatsRemaining: event.seatsRemaining,
    isSoldOut: event.isSoldOut,

    organizer: event.organizer,
    venue: event.mode === 'virtual' ? null : event.venue,
    virtualLink: event.mode === 'in-person' ? '' : event.virtualLink,

    highlights: event.highlights || [],
    speakers: sortByOrder((event.speakers || []).filter((s) => s.isActive !== false)).map(serializeSpeaker),
    committee: sortByOrder((event.committee || []).filter((m) => m.isActive !== false)).map(serializeCommitteeMember),
    agenda: [...(event.agenda || [])]
      .filter((d) => d.isActive !== false)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((day) => {
        const plain = day.toObject ? day.toObject() : day;
        return serializeAgendaDay({
          ...plain,
          items: (plain.items || []).filter((item) => item.isActive !== false),
        });
      }),
    sponsors: sortByOrder((event.sponsors || []).filter((s) => s.isActive !== false)).map(serializeSponsor),
    faqs: sortByOrder((event.faqs || []).filter((f) => f.isActive !== false)).map((f) => ({
      id: String(f._id),
      question: f.question,
      answer: f.answer,
    })),
    announcements: event.activeAnnouncements.map((a) => ({
      id: String(a._id),
      message: a.message,
      level: a.level,
      publishedAt: a.publishedAt,
    })),

    sections: {
      announcements: event.sections?.announcements !== false,
      hero: event.sections?.hero !== false,
      chairpersonWelcome: event.sections?.chairpersonWelcome !== false,
      about: event.sections?.about !== false,
      speakers: event.sections?.speakers !== false,
      committee: event.sections?.committee !== false,
      agenda: event.sections?.agenda !== false,
      tickets: event.sections?.tickets !== false,
      venue: event.sections?.venue !== false,
      sponsors: event.sections?.sponsors !== false,
      exhibitStalls: event.sections?.exhibitStalls !== false,
      faqs: event.sections?.faqs !== false,
      finalCta: event.sections?.finalCta !== false,
      stickyCta: event.sections?.stickyCta !== false,
    },
    heroSettings: event.heroSettings || {},
    chairpersonWelcome: {
      show: event.chairpersonWelcome?.show !== false,
      eyebrow: event.chairpersonWelcome?.eyebrow || 'A message from our chairperson',
      name: event.chairpersonWelcome?.name || 'Dr. Geetha Haripriya',
      title:
        event.chairpersonWelcome?.title ||
        'Chairperson, Prashanth Fertility and Research Centre Pvt. Ltd.',
      photoUrl:
        event.chairpersonWelcome?.photoUrl || '/assets/chairperson-geetha-haripriya.png',
      message: event.chairpersonWelcome?.message || event.description || '',
    },
    exhibitStalls: event.exhibitStalls || {},
    finalCtaSettings: event.finalCtaSettings || {},

    contact: event.contact,
    theme: event.theme,
    seo: buildSeo(event),
    jsonLd: buildJsonLd(event),
  };
}

function serializeTicketTypeForPublic(ticket) {
  return {
    id: String(ticket._id),
    name: ticket.name,
    code: ticket.code,
    description: ticket.description,
    kind: ticket.kind,
    price: ticket.price,
    currency: ticket.currency,
    taxPercent: ticket.taxPercent,
    priceWithTax: ticket.priceWithTax,
    isFree: ticket.isFree,
    admitsCount: ticket.admitsCount,
    benefits: ticket.benefits || [],
    minPerOrder: ticket.minPerOrder,
    maxPerOrder: ticket.maxPerOrder,
    salesStartAt: ticket.salesStartAt,
    salesEndAt: ticket.salesEndAt,
    saleState: ticket.saleState,
    isSoldOut: ticket.isSoldOut,
    // Exact remaining counts stay private; only scarcity is surfaced.
    isLowStock:
      ticket.quantityAvailable !== null && ticket.quantityAvailable > 0 && ticket.quantityAvailable <= 10,
    allowedParticipantTypes: ticket.allowedParticipantTypes || [],
  };
}

module.exports = {
  serializeEventCard,
  serializeEventForPublic,
  serializeTicketTypeForPublic,
};
