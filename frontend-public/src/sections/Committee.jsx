import './Committee.css';

/** Initials avatar used until a photo is uploaded in the CMS. */
function Avatar({ name, photoUrl }) {
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
    <div className="committee-member__photo committee-member__photo--initials" aria-hidden="true">
      {initials}
    </div>
  );
}

function MemberCard({ member, featured }) {
  return (
    <div className={`committee-member ${featured ? 'committee-member--featured' : ''}`}>
      <Avatar name={member.name} photoUrl={member.photoUrl} />
      <div>
        <p className="committee-member__name">{member.name}</p>
        {member.role && <p className="committee-member__role">{member.role}</p>}
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
              <MemberCard member={m} featured key={m.id} />
            ))}
          </div>
        )}

        <div className="committee__groups">
          {scientific.length > 0 && (
            <div className="committee__group">
              <h3 className="committee__group-title">Scientific committee</h3>
              <div className="committee__list">
                {scientific.map((m) => (
                  <MemberCard member={m} key={m.id} />
                ))}
              </div>
            </div>
          )}

          {organising.length > 0 && (
            <div className="committee__group">
              <h3 className="committee__group-title">Organising committee</h3>
              <div className="committee__list">
                {organising.map((m) => (
                  <MemberCard member={m} key={m.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
