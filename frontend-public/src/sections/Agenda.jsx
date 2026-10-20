import { useState } from 'react';
import { formatDate, formatClock } from '../lib/format';
import './Agenda.css';

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

  if (!days.length) return null;

  const current = days[activeDay] || days[0];
  const isMultiDay = days.length > 1;

  return (
    <section className="section agenda" id="agenda">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">Programme</span>
          <h2 className="section-title">Agenda</h2>
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
