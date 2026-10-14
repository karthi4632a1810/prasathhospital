import './About.css';

/** Conference highlights + organiser card. The long-form welcome message now
 *  lives in ChairpersonWelcome, so this section only needs the "what's
 *  included" and "who's running it" facts. */
export default function About({ event }) {
  if (!event.highlights?.length && !event.organizer?.name) return null;

  return (
    <section className="section about" id="about">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">At a glance</span>
          <h2 className="section-title">Conference highlights</h2>
        </div>

        <div className="about__grid">
          {event.highlights?.length > 0 && (
            <div className="about__card">
              <h3 className="about__card-title">What&apos;s included</h3>
              <ul className="about__list">
                {event.highlights.map((h) => (
                  <li key={h}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {event.organizer?.name && (
            <div className="about__card about__card--organizer">
              <h3 className="about__card-title">Organised by</h3>
              <p className="about__organizer-name">{event.organizer.name}</p>
              {event.organizer.department && (
                <p className="about__organizer-dept">{event.organizer.department}</p>
              )}
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
      </div>
    </section>
  );
}
