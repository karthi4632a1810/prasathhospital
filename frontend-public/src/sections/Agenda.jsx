import { useState } from 'react';
import { formatDate, formatClock } from '../lib/format';
import './Agenda.css';

const SHOW_FULL_SCHEDULE = false;

const TYPE_META = {
  keynote: { label: 'Keynote', tone: 'accent' },
  panel: { label: 'Panel', tone: 'brand' },
  workshop: { label: 'Workshop', tone: 'teal' },
  break: { label: 'Break', tone: 'muted' },
  registration: { label: 'Registration', tone: 'muted' },
  networking: { label: 'Networking', tone: 'muted' },
  session: { label: '', tone: 'default' },
  other: { label: '', tone: 'default' },
};

function AgendaItem({ item }) {
  const meta = TYPE_META[item.type] || TYPE_META.session;
  const isPassive = ['break', 'registration', 'networking'].includes(item.type);

  return (
    <li className={`agenda-item agenda-item--${meta.tone} ${isPassive ? 'is-passive' : ''}`}>
      <div className="agenda-item__time">
        <span className="agenda-item__start">{formatClock(item.startTime)}</span>
        {item.endTime && <span className="agenda-item__end">{formatClock(item.endTime)}</span>}
      </div>

      <div className="agenda-item__marker" aria-hidden="true">
        <span className="agenda-item__dot" />
      </div>

      <div className="agenda-item__content">
        <div className="agenda-item__heading">
          <h4 className="agenda-item__title">{item.title}</h4>
          {meta.label && (
            <span className={`agenda-tag agenda-tag--${meta.tone}`}>{meta.label}</span>
          )}
        </div>

        {item.description && <p className="agenda-item__desc">{item.description}</p>}

        <div className="agenda-item__meta">
          {item.speakerNames?.length > 0 && (
            <span className="agenda-item__speakers">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
              </svg>
              {item.speakerNames.join(', ')}
            </span>
          )}
          {item.track && (
            <span className="agenda-item__track">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden="true"
              >
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.2" />
              </svg>
              {item.track}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Agenda({ agenda }) {
  const days = (agenda || []).filter((d) => d.items?.length);
  const [activeDay, setActiveDay] = useState(0);

  // If full schedule is enabled in the future, render the interactive timeline
  if (SHOW_FULL_SCHEDULE && days.length > 0) {
    const current = days[activeDay] || days[0];
    const isMultiDay = days.length > 1;

    return (
      <section className="section agenda" id="agenda">
        <div className="container">
          <div className="section-head section-head--center">
            <span className="section-eyebrow">Programme</span>
            <h2 className="section-title">Agenda (Day 1 &amp; 2)</h2>
            <p className="section-subtitle">
              {isMultiDay
                ? `${days.length} days of sessions, workshops and discussion.`
                : 'A full day of sessions, workshops and discussion.'}
            </p>
          </div>

          {isMultiDay && (
            <div className="agenda__tabs" role="tablist" aria-label="Agenda days">
              {days.map((day, i) => (
                <button
                  key={day.id || `day-${i}`}
                  role="tab"
                  aria-selected={i === activeDay}
                  className={`agenda__tab ${i === activeDay ? 'is-active' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  <span className="agenda__tab-day">Day {i + 1}</span>
                  <span className="agenda__tab-date">
                    {formatDate(day.date, { weekday: 'short', month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="agenda__panel">
            {!isMultiDay ? (
              <p className="agenda__single-date">
                {formatDate(current.date)}
                {current.label && <span className="agenda__label"> · {current.label}</span>}
              </p>
            ) : current.label ? (
              <p className="agenda__day-theme">
                <span className="agenda__theme-badge">Day {activeDay + 1} Focus</span>
                <span className="agenda__theme-text">
                  {current.label.replace(/^Day\s+\d+\s*[—–-]\s*/i, '')}
                </span>
              </p>
            ) : null}

            <ol className="agenda__list">
              {current.items.map((item, idx) => (
                <AgendaItem item={item} key={item.id || item._id || `${item.startTime}-${idx}`} />
              ))}
            </ol>
          </div>

          <p className="agenda__note">
            The programme is subject to minor changes. Registered delegates are notified of any
            updates on WhatsApp.
          </p>
        </div>
      </section>
    );
  }

  // Client Mandated State: Hide full session schedule; display "Announcing Shortly" teaser instead
  return (
    <section className="section section--alt agenda" id="agenda">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">Scientific Programme</span>
          <h2 className="section-title">Agenda (Day 1 &amp; 2)</h2>
          <p className="section-subtitle">
            Two power-packed days of controversies, clinical debates, keynotes, and surgical masterclasses in reproductive medicine.
          </p>
        </div>

        <div className="agenda-teaser">
          <div className="agenda-teaser__top-bar">
            <span className="agenda-teaser__badge">
              <span className="agenda-teaser__pulse" aria-hidden="true" />
              Announcing Shortly
            </span>
            <span className="agenda-teaser__status-text">
              Scientific advisory review in progress
            </span>
          </div>

          <div className="agenda-teaser__hero">
            <div className="agenda-teaser__icon-ring" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <circle cx="8" cy="15" r="1" fill="currentColor" />
                <circle cx="12" cy="15" r="1" fill="currentColor" />
                <circle cx="16" cy="15" r="1" fill="currentColor" />
              </svg>
            </div>
            <h3 className="agenda-teaser__title">
              Full Session Schedule &amp; Debate Lineups Coming Soon
            </h3>
            <p className="agenda-teaser__desc">
              The minute-by-minute scientific agenda is undergoing final review by the Scientific Committee.
              The comprehensive conference brochure will feature clinical debates, surgical videos, and interactive panel sessions across both days.
            </p>
          </div>

          <div className="agenda-teaser__days">
            <div className="agenda-teaser__day-card">
              <div className="agenda-teaser__day-header">
                <span className="agenda-teaser__day-pill">Day 1</span>
                <span className="agenda-teaser__day-date">Saturday · 21 Nov 2026</span>
              </div>
              <h4 className="agenda-teaser__day-heading">
                Clinical Innovations &amp; Controversies
              </h4>
              <p className="agenda-teaser__day-summary">
                Keynote lectures by national &amp; international faculty, controversial debates on ovarian stimulation protocols, recurrent implantation failure, and live-recorded surgical case masterclasses.
              </p>
              <ul className="agenda-teaser__day-highlights">
                <li>Ovarian Stimulation &amp; Poor Responders</li>
                <li>Endometrial Receptivity Controversies</li>
                <li>Keynote Addresses &amp; Panel Debates</li>
              </ul>
              <div className="agenda-teaser__day-footer">
                <span>Morning &amp; Afternoon Sessions</span>
                <span>The Leela Palace, Chennai</span>
              </div>
            </div>

            <div className="agenda-teaser__day-card">
              <div className="agenda-teaser__day-header">
                <span className="agenda-teaser__day-pill">Day 2</span>
                <span className="agenda-teaser__day-date">Sunday · 22 Nov 2026</span>
              </div>
              <h4 className="agenda-teaser__day-heading">
                Advanced Embryology &amp; Clinical Panels
              </h4>
              <p className="agenda-teaser__day-summary">
                Male factor infertility andrology masterclass, AI &amp; morphokinetics in the embryology lab, genetics and PGT debates, ethics of third-party reproduction, and delegate case discussions.
              </p>
              <ul className="agenda-teaser__day-highlights">
                <li>Male Infertility &amp; DNA Fragmentation</li>
                <li>Embryology Quality Control &amp; AI in ART</li>
                <li>Genetics, PGT &amp; Case Discussions</li>
              </ul>
              <div className="agenda-teaser__day-footer">
                <span>Full Day Academic Sessions</span>
                <span>The Leela Palace, Chennai</span>
              </div>
            </div>
          </div>

          <div className="agenda-teaser__topics">
            <span className="agenda-teaser__topics-label">Major Clinical Focus Themes</span>
            <div className="agenda-teaser__tags">
              <span className="agenda-teaser__tag">Ovarian Stimulation</span>
              <span className="agenda-teaser__tag">Endometrial Receptivity</span>
              <span className="agenda-teaser__tag">Male Infertility &amp; Andrology</span>
              <span className="agenda-teaser__tag">Embryo Selection &amp; AI</span>
              <span className="agenda-teaser__tag">Genetics &amp; PGT-A</span>
              <span className="agenda-teaser__tag">Difficult Case Debates</span>
            </div>
          </div>

          <div className="agenda-teaser__bottom">
            <div className="agenda-teaser__notice">
              <div className="agenda-teaser__notice-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
                </svg>
              </div>
              <p className="agenda-teaser__notice-text">
                Registered delegates will automatically receive the official minute-by-minute schedule and PDF brochure directly on WhatsApp and email prior to the conference.
              </p>
            </div>
            <a href="#tickets" className="agenda-teaser__cta">
              Register for Passes
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
