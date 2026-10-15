import { useTilt } from '../lib/useTilt';
import './About.css';

/* Decorative icons cycled across the feature cards. They're generic on
   purpose (signal, discussion, learning, innovation) so they still read
   sensibly if the CMS highlights are reworded or reordered. */
const ICONS = [
  <svg key="signal" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2.2" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" />
  </svg>,
  <svg key="debate" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    <path d="M17 9h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-3" />
  </svg>,
  <svg key="learn" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 9 10-5 10 5-10 5L2 9Z" />
    <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6" />
  </svg>,
  <svg key="innovate" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M10 10h4v4h-4zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </svg>,
];

/** "Live Tele-Robotics: streamed high-definition demo" -> title + body. */
function splitHighlight(text) {
  const idx = text.indexOf(':');
  if (idx === -1) return { title: text, body: '' };
  const body = text.slice(idx + 1).trim();
  return { title: text.slice(0, idx).trim(), body: body.charAt(0).toUpperCase() + body.slice(1) };
}

function FeatureCard({ highlight, index }) {
  const tilt = useTilt({ max: 7, scale: 1.02 });
  const { title, body } = splitHighlight(highlight);

  return (
    <li
      ref={tilt.ref}
      onMouseEnter={tilt.onMouseEnter}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      className="feature-card"
    >
      <span className="feature-card__index">{String(index + 1).padStart(2, '0')}</span>
      <span className="feature-card__icon" aria-hidden="true">
        {ICONS[index % ICONS.length]}
      </span>
      <h3 className="feature-card__title">{title}</h3>
      {body && <p className="feature-card__body">{body}</p>}
    </li>
  );
}

/** Conference highlights as a feature grid, plus the organiser. The
 *  long-form welcome message lives in ChairpersonWelcome. */
export default function About({ event }) {
  if (!event.highlights?.length && !event.organizer?.name) return null;

  return (
    <section className="section about" id="about">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">At a glance</span>
          <h2 className="section-title">Conference highlights</h2>
        </div>

        {event.highlights?.length > 0 && (
          <ul className="about__features">
            {event.highlights.map((h, i) => (
              <FeatureCard highlight={h} index={i} key={h} />
            ))}
          </ul>
        )}

        {event.organizer?.name && (
          <div className="about__organizer">
            <span className="about__organizer-label">Organised by</span>
            <span className="about__organizer-name">{event.organizer.name}</span>
            {event.organizer.websiteUrl && (
              <a
                className="about__organizer-link"
                href={event.organizer.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit website →
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
