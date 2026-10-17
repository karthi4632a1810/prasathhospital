import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import Switch from '../../components/ui/Switch';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const SECTIONS_CONFIG = [
  {
    key: 'hero',
    name: 'Hero Header Banner',
    category: 'Header',
    description: 'The top hero section with event title, dates, countdown timer, stats, and registration button.',
    tabKey: 'hero-cta',
  },
  {
    key: 'announcements',
    name: 'Announcement Bar',
    category: 'Header',
    description: 'Top alert ribbon for breaking news, deadlines, or important announcements.',
    tabKey: 'announcements',
  },
  {
    key: 'chairpersonWelcome',
    name: 'Chairperson / Welcome Message',
    category: 'Welcome',
    description: 'Full-width welcome address with portrait photo, chairperson title, and personal message.',
    tabKey: 'welcome',
  },
  {
    key: 'about',
    name: 'About & Highlights',
    category: 'Content',
    description: 'Conference highlights grid and organizer info.',
    tabKey: 'details',
  },
  {
    key: 'speakers',
    name: 'Speakers & Faculty',
    category: 'Content',
    description: 'Keynote speakers and faculty profiles, topics, and credentials.',
    tabKey: 'speakers',
  },
  {
    key: 'committee',
    name: 'Committee',
    category: 'Content',
    description: 'Leadership, Scientific, and Organizing committee members.',
    tabKey: 'committee',
  },
  {
    key: 'agenda',
    name: 'Agenda & Schedule',
    category: 'Schedule',
    description: 'Detailed program schedule broken down by days, tracks, and sessions.',
    tabKey: 'agenda',
  },
  {
    key: 'tickets',
    name: 'Registration Passes (Tickets)',
    category: 'Registration',
    description: 'Registration pass cards, pricing, quota, and attendee booking selection.',
    tabKey: null,
  },
  {
    key: 'venue',
    name: 'Venue & Directions',
    category: 'Location',
    description: 'Physical venue location, Google Maps embed, landmark, and virtual meeting links.',
    tabKey: 'venue',
  },
  {
    key: 'sponsors',
    name: 'Sponsors & Partners',
    category: 'Commercial',
    description: 'Tiered sponsor logos (Title, Platinum, Gold, Silver, Partners).',
    tabKey: 'sponsors',
  },
  {
    key: 'exhibitStalls',
    name: 'Exhibit & Stalls Booking',
    category: 'Commercial',
    description: 'Exhibitor booth packages, stall pricing, benefits, and inquiry CTA.',
    tabKey: 'exhibit',
  },
  {
    key: 'faqs',
    name: 'Frequently Asked Questions (FAQ)',
    category: 'Support',
    description: 'Interactive FAQ accordion answering delegate queries.',
    tabKey: 'faqs',
  },
  {
    key: 'finalCta',
    name: 'Final Registration Banner',
    category: 'Registration',
    description: 'Bottom call-to-action banner driving last-chance registrations.',
    tabKey: 'hero-cta',
  },
  {
    key: 'stickyCta',
    name: 'Floating Sticky Registration Bar',
    category: 'Registration',
    description: 'Bottom floating bar that remains visible as the user scrolls.',
    tabKey: null,
  },
];

export default function SectionsTab({ event, onSaved, onNavigateTab }) {
  const [sections, setSections] = useState(() => {
    const s = event.sections || {};
    const initial = {};
    SECTIONS_CONFIG.forEach((cfg) => {
      initial[cfg.key] = s[cfg.key] !== false;
    });
    return initial;
  });

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, { sections });
    onSaved(res.data);
  });

  function toggleSection(key, value) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  function handleEnableAll() {
    const all = {};
    SECTIONS_CONFIG.forEach((cfg) => {
      all[cfg.key] = true;
    });
    setSections(all);
  }

  function handleHideOptional() {
    const modified = {};
    SECTIONS_CONFIG.forEach((cfg) => {
      // Keep hero, about, tickets enabled; hide optional marketing sections
      const isCore = ['hero', 'about', 'tickets', 'venue'].includes(cfg.key);
      modified[cfg.key] = isCore;
    });
    setSections(modified);
  }

  const activeCount = Object.values(sections).filter(Boolean).length;
  const totalCount = SECTIONS_CONFIG.length;

  return (
    <div>
      <div
        className="card"
        style={{
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
          background: 'var(--brand-50)',
          borderColor: 'var(--brand-200)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--text-lg)', color: 'var(--brand-900)' }}>
              Microsite Screen Controls
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink-600)' }}>
              Enable or hide any section with one click. Hidden sections are completely removed from the event page and navigation menu.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" onClick={handleEnableAll}>
              Show all ({totalCount})
            </Button>
            <Button variant="ghost" size="sm" onClick={handleHideOptional}>
              Core sections only
            </Button>
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Badge tone={activeCount === totalCount ? 'success' : 'info'} size="md">
            {activeCount} of {totalCount} sections active
          </Badge>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
            Changes take effect immediately on save.
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {SECTIONS_CONFIG.map((cfg) => {
          const isVisible = sections[cfg.key] !== false;

          return (
            <div
              key={cfg.key}
              className="card"
              style={{
                padding: 'var(--space-4) var(--space-5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
                background: isVisible ? 'var(--white)' : 'var(--ink-50)',
                borderColor: isVisible ? 'var(--ink-200)' : 'var(--warning-300)',
                borderStyle: isVisible ? 'solid' : 'dashed',
                transition: 'background-color 200ms ease, border-color 200ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: '1 1 300px' }}>
                <Switch
                  checked={isVisible}
                  onChange={(checked) => toggleSection(cfg.key, checked)}
                  size="md"
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
                    <strong style={{ fontSize: 'var(--text-base)', color: isVisible ? 'var(--ink-900)' : 'var(--ink-600)' }}>
                      {cfg.name}
                    </strong>
                    <Badge tone={isVisible ? 'success' : 'neutral'} size="sm">
                      {isVisible ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
                    {cfg.description}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {cfg.tabKey && onNavigateTab && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigateTab(cfg.tabKey)}
                  >
                    Edit content →
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {SaveBar}
    </div>
  );
}
