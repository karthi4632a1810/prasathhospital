import { useTilt } from '../lib/useTilt';
import './Committee.css';

const COMMITTEE_PHOTO_MAP = {
  'dr geetha haripriya': '/assets/chairperson-geetha-haripriya.png',
  'dr samhitha moturi': '/assets/committee/dr-samhitha-moturi.png',
  'dr swathi': '/assets/committee/dr-swathi.jpg',
  'dr abrajdha': '/assets/committee/dr-abrajdha.png',
  'dr anuradha': '/assets/committee/dr-sailaja.png',
  'dr veena': '/assets/committee/dr-veena.png',
  'dr usha todadri': '/assets/committee/dr-s-r-rathika.png',
  'dr shabia': '/assets/committee/dr-shabia.jpg',
  'dr sailaja': '/assets/committee/dr-anuradha.png',
  'dr sughija': '/assets/committee/dr-sughija.png',
  'dr selvapriya': '/assets/committee/dr-selvapriya.jpg',
  'dr pushpalatha': '/assets/committee/dr-pushpalatha.jpg',
  'dr jenifer': '/assets/committee/dr-jenifer.jpg',
  'dr shri janani': '/assets/committee/dr-shri-janani.png',
  'dr. s. r. rathika': '/assets/committee/dr-usha-todadri.png',
  'dr s. r. rathika': '/assets/committee/dr-usha-todadri.png',
  'dr s r rathika': '/assets/committee/dr-usha-todadri.png',
  'dr shobhana': '/assets/committee/dr-shobhana.png',
  'dr subhasree': '/assets/committee/dr-subhasree.png',
  'dr divya': '/assets/committee/dr-divya.png',
  'dr malsri': '/assets/committee/dr-malsri.png',
  'dr. samhitha moturi': '/assets/committee/dr-samhitha-moturi.png',
};

function normalizeName(name = '') {
  return name.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

/** Initials avatar used until a photo is uploaded in the CMS. `tone` tints
 *  it per committee group — a restrained way to tell the two groups apart
 *  at a glance without introducing a new accent color. */
function Avatar({ name, photoUrl, tone }) {
  const norm = normalizeName(name);
  const resolvedPhoto = norm === 'dr priyanka' ? null : (photoUrl || COMMITTEE_PHOTO_MAP[norm]);

  const initials = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (resolvedPhoto) {
    return <img className="committee-member__photo" src={resolvedPhoto} alt={name} loading="lazy" />;
  }
  return (
    <div
      className={`committee-member__photo committee-member__photo--initials committee-member__photo--${tone}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function MemberCard({ member, tone, featured }) {
  // Tilt is reserved for the featured leadership cards — a hook still has to
  // run unconditionally, but the ref/handlers only attach when featured.
  const tilt = useTilt({ max: 7, scale: 1.02 });
  const tiltProps = featured
    ? {
        ref: tilt.ref,
        onMouseEnter: tilt.onMouseEnter,
        onMouseMove: tilt.onMouseMove,
        onMouseLeave: tilt.onMouseLeave,
      }
    : {};

  const isGeetha = /geetha/i.test(member.name);
  const isSamhitha = /samhitha/i.test(member.name);
  const roleLines = member.role ? member.role.split('\n').map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div
      className={`committee-member ${featured ? 'committee-member--featured' : ''}`}
      {...tiltProps}
    >
      <Avatar name={member.name} photoUrl={member.photoUrl} tone={tone} />
      <p className="committee-member__name">{member.name}</p>
      {member.designation && <p className="committee-member__designation">{member.designation}</p>}
      {isGeetha ? (
        <div className="committee-member__role-lines">
          <span className="committee-member__role-line">
            Organising Chairman
          </span>
          <span className="committee-member__role-line committee-member__role-line--hospitals">
            Chairman Prashanth Group of Hospitals
          </span>
        </div>
      ) : isSamhitha ? (
        <div className="committee-member__role-lines">
          <span className="committee-member__role-line">
            Organising Secretary
          </span>
          <span className="committee-member__role-line committee-member__role-line--hospitals">
            Director Prashanth Group of Hospitals
          </span>
        </div>
      ) : roleLines.length > 1 ? (
        <div className="committee-member__role-lines">
          {roleLines.map((line, idx) => (
            <span key={idx} className="committee-member__role-line">
              {line}
            </span>
          ))}
        </div>
      ) : (
        member.role && <p className="committee-member__role">{member.role}</p>
      )}
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
