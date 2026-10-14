import './About.css';

function initials(name) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Renders the long-form description, splitting plain-text paragraphs on
 *  blank lines. Content is authored in the CMS (Module 2). `signature`
 *  attributes the welcome message to whoever wrote it (e.g. the chairperson),
 *  when the event page passes one in. */
export default function About({ event, signature }) {
  const paragraphs = (event.description || event.summary || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!paragraphs.length && !event.highlights?.length) return null;

  return (
    <section className="section about" id="about">
      <div className="container about__grid">
        <div className="about__content">
          <div className="section-head">
            <span className="section-eyebrow">About the event</span>
            <h2 className="section-title">
              {event.summary ? 'Why attend' : 'About this event'}
            </h2>
          </div>

          {paragraphs.map((p, i) => (
            <p className="about__paragraph" key={i}>
              {p}
            </p>
          ))}

          {signature?.name && (
            <div className="about__signature">
              <span className="about__signature-rule" aria-hidden="true" />
              <span className="about__signature-avatar" aria-hidden="true">
                {initials(signature.name)}
              </span>
              <span className="about__signature-text">
                <strong>{signature.name}</strong>
                {signature.title && <span>{signature.title}</span>}
              </span>
            </div>
          )}
        </div>

        <aside className="about__aside">
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
        </aside>
      </div>
    </section>
  );
}
