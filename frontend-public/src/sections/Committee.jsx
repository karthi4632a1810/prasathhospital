import './Committee.css';

/** Initials avatar used until a photo is uploaded in the CMS. `tone` tints
 *  it per committee group — a restrained way to tell the two groups apart
 *  at a glance without introducing a new accent color. */
function Avatar({ name, photoUrl, tone }) {
  const initials = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (photoUrl) {
    return <img className="committee-member__photo" src={photoUrl} alt={name} loading="lazy" />;
  }
  return (
    <div className={`committee-member__photo committee-member__photo--initials committee-member__photo--${tone}`} aria-hidden="true">
      {initials}
    </div>
  );
}

function MemberCard({ member, tone, featured }) {
  return (
    <div className={`committee-member ${featured ? 'committee-member--featured' : ''}`}>
      <Avatar name={member.name} photoUrl={member.photoUrl} tone={tone} />
      <p className="committee-member__name">{member.name}</p>
      {member.role && <p className="committee-member__role">{member.role}</p>}
    </div>
  );
}

function CommitteeGroup({ title, tone, members }) {
  if (!members.length) return null;
  return (
    <div className="committee__group">
      <h3 className={`committee__group-title committee__group-title--${tone}`}>
        <span className="committee__group-dot" aria-hidden="true" />
        {title}
      </h3>
      <div className="committee__grid">
        {members.map((m) => (
          <MemberCard member={m} tone={tone} key={m.id} />
        ))}
      </div>
    </div>
  );
}

export default function Committee({ committee }) {
  if (!committee?.length) return null;

  const leadership = committee.filter((m) => m.group === 'leadership');
  const scientific = committee.filter((m) => m.group === 'scientific');
  const organising = committee.filter((m) => m.group === 'organising');

  return (
    <section className="section section--alt committee" id="committee">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">The people behind CIIM</span>
          <h2 className="section-title">Organising &amp; scientific committee</h2>
        </div>

        {leadership.length > 0 && (
          <div className="committee__leadership">
            {leadership.map((m) => (
              <MemberCard member={m} tone="leadership" featured key={m.id} />
            ))}
          </div>
        )}

        <div className="committee__groups">
          <CommitteeGroup title="Scientific committee" tone="scientific" members={scientific} />
          <CommitteeGroup title="Organising committee" tone="organising" members={organising} />
        </div>
      </div>
    </section>
  );
}
