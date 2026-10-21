import { useState } from 'react';
import Badge from '../components/ui/Badge';
import { useTilt } from '../lib/useTilt';
import './Speakers.css';

/** Large photo panel; falls back to a giant initials monogram on an accent
 *  gradient when no photo has been uploaded in the CMS yet. */
function Avatar({ name, photoUrl }) {
  const initials = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="speaker__avatar-wrap">
      {photoUrl ? (
        <img className="speaker__photo" src={photoUrl} alt={name} loading="lazy" />
      ) : (
        <div className="speaker__photo speaker__photo--initials" aria-hidden="true">
          {initials}
        </div>
      )}
    </div>
  );
}

function SpeakerCard({ speaker }) {
  const [expanded, setExpanded] = useState(false);
  const hasBio = Boolean(speaker.bio);
  const tilt = useTilt({ max: 8, scale: 1.015 });

  return (
    <article
      ref={tilt.ref}
      onMouseEnter={tilt.onMouseEnter}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      className={`speaker ${speaker.isKeynote ? 'speaker--keynote' : ''}`}
    >
      <div className="speaker__panel">
        <Avatar name={speaker.name} photoUrl={speaker.photoUrl} />
        {speaker.isKeynote && (
          <Badge tone="accent" size="sm" className="speaker__flag">
            Keynote
          </Badge>
        )}
      </div>

      <div className="speaker__body">
        <h3 className="speaker__name">{speaker.name}</h3>
        {speaker.credentials && <p className="speaker__credentials">{speaker.credentials}</p>}

        {(speaker.designation || speaker.organization) && (
          <p className="speaker__role">
            {speaker.designation}
            {speaker.designation && speaker.organization && <br />}
            {speaker.organization && <span className="speaker__org">{speaker.organization}</span>}
          </p>
        )}

        {speaker.topic && (
          <p className="speaker__topic">
            <span className="speaker__topic-label">Speaking on</span>
            {speaker.topic}
          </p>
        )}

        {hasBio && (
          <>
            <p className={`speaker__bio ${expanded ? 'is-expanded' : ''}`}>{speaker.bio}</p>
            <button
              className="speaker__toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function Speakers({ speakers }) {
  if (!speakers?.length) return null;

  return (
    <section className="section section--alt speakers" id="speakers">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">Faculty</span>
          <h2 className="section-title">Expected speakers</h2>
          <p className="section-subtitle">
            Invited faculty joining CIIM 2026 — session topics to be announced.
          </p>
        </div>

        <div className="speakers__grid">
          {speakers.map((s) => (
            <SpeakerCard speaker={s} key={s.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
