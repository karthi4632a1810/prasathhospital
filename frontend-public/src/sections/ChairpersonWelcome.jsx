import './ChairpersonWelcome.css';

/** A full-width welcome banner — a large portrait on one side, the
 *  chairperson's message on the other. `message` is plain text, split into
 *  paragraphs on blank lines like the rest of the event's long-form copy. */
export default function ChairpersonWelcome({ name, title, photoUrl, message }) {
  const paragraphs = (message || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!name || !paragraphs.length) return null;

  return (
    <section className="section section--tight chairperson-welcome">
      <div className="container chairperson-welcome__grid">
        <div className="chairperson-welcome__photo-wrap">
          {photoUrl && <img className="chairperson-welcome__photo" src={photoUrl} alt={name} />}
        </div>

        <div className="chairperson-welcome__content">
          <span className="section-eyebrow">A message from our chairperson</span>
          {paragraphs.map((p, i) => (
            <p className="chairperson-welcome__paragraph" key={i}>
              {p}
            </p>
          ))}
          <div className="chairperson-welcome__byline">
            <strong>{name}</strong>
            {title && <span>{title}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
