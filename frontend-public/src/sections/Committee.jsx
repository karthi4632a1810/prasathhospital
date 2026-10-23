import { useTilt } from '../lib/useTilt';
import './Committee.css';

const COMMITTEE_PHOTO_MAP = {
  // Leadership
  'dr geetha haripriya': '/assets/chairperson-geetha-haripriya.png',
  'dr geetha haripriya c': '/assets/chairperson-geetha-haripriya.png',
  'dr samhitha moturi': '/assets/committee/dr-samhitha-moturi.png',
  'dr. samhitha moturi': '/assets/committee/dr-samhitha-moturi.png',

  // Scientific Committee
  'dr swathi': '/assets/committee/dr-swathi.jpg',
  'dr swathi b': '/assets/committee/dr-swathi.jpg',
  'dr anuradha': '/assets/committee/dr-sailaja.png',
  'dr anuradha b': '/assets/committee/dr-sailaja.png',
  'dr usha todadri': '/assets/committee/dr-s-r-rathika.png',
  'dr sailaja': '/assets/committee/dr-anuradha.png',
  'dr sailaja sanathi': '/assets/committee/dr-anuradha.png',
  'dr shailaja': '/assets/committee/dr-anuradha.png',
  'dr selvapriya': '/assets/committee/dr-selvapriya.jpg',
  'dr abarajda': '/assets/committee/dr-abrajdha.png',
  'dr abarajda v': '/assets/committee/dr-abrajdha.png',
  'dr abrajdha': '/assets/committee/dr-abrajdha.png',
  'dr aburajda': '/assets/committee/dr-abrajdha.png',
  'dr sabiha nikhat n': '/assets/committee/dr-shabia.jpg',
  'dr sabiha nikhat': '/assets/committee/dr-shabia.jpg',
  'dr sabia nikath': '/assets/committee/dr-shabia.jpg',
  'dr sabia': '/assets/committee/dr-shabia.jpg',
  'dr shabia': '/assets/committee/dr-shabia.jpg',
  'dr madhumitha': '/assets/committee/dr-madhumitha.png',
  'dr madhumitha c': '/assets/committee/dr-madhumitha.png',
  'dr veena': '/assets/committee/dr-veena.png',
  'dr veena r': '/assets/committee/dr-veena.png',
  'dr sughija': '/assets/committee/dr-sughija.png',
  'dr.sughija g': '/assets/committee/dr-sughija.png',
  'dr sughija g': '/assets/committee/dr-sughija.png',
  'dr pushpalatha': '/assets/committee/dr-pushpalatha.jpg',
  'dr pushpalatha r': '/assets/committee/dr-pushpalatha.jpg',

  // Organising Committee
  'dr malasree': '/assets/committee/dr-malsri.png',
  'dr malsri': '/assets/committee/dr-malsri.png',
  'dr malsri r': '/assets/committee/dr-malsri.png',
  'dr malasree r': '/assets/committee/dr-malsri.png',
  'dr jennifer britto': '/assets/committee/dr-jenifer.jpg',
  'dr jennifer': '/assets/committee/dr-jenifer.jpg',
  'dr jenifer': '/assets/committee/dr-jenifer.jpg',
  'dr shri janani': '/assets/committee/dr-shri-janani.png',
  'dr shri janani r': '/assets/committee/dr-shri-janani.png',
  'dr shobhana': '/assets/committee/dr-shobhana.png',
  'dr shobana': '/assets/committee/dr-shobhana.png',
  'dr shobana priya k': '/assets/committee/dr-shobhana.png',
  'dr shobhana priya k': '/assets/committee/dr-shobhana.png',
  'dr subhashree': '/assets/committee/dr-subhasree.png',
  'dr subhasree': '/assets/committee/dr-subhasree.png',
  'dr shubhashree t': '/assets/committee/dr-subhasree.png',
  'dr subhasree t': '/assets/committee/dr-subhasree.png',
  'dr priyanka': '/assets/committee/dr-priyanka.jpg',
  'dr priyanka s v': '/assets/committee/dr-priyanka.jpg',
  'dr divya': '/assets/committee/dr-divya.png',
  'dr divya c': '/assets/committee/dr-divya.png',
  'dr dhivya': '/assets/committee/dr-dhivya-s.jpg',
  'dr dhivya s': '/assets/committee/dr-dhivya-s.jpg',
  'dr divya s': '/assets/committee/dr-dhivya-s.jpg',
  'dr seeniammal': '/assets/committee/dr-seeniammal-p.png',
  'dr seeniammal p': '/assets/committee/dr-seeniammal-p.png',
  'dr seeniammal.p': '/assets/committee/dr-seeniammal-p.png',
  'dr.rathika s.r': '/assets/committee/dr-usha-todadri.png',
  'dr rathika s r': '/assets/committee/dr-usha-todadri.png',
  'dr. s. r. rathika': '/assets/committee/dr-usha-todadri.png',
  'dr s. r. rathika': '/assets/committee/dr-usha-todadri.png',
  'dr s r rathika': '/assets/committee/dr-usha-todadri.png',
  'dr rathika': '/assets/committee/dr-usha-todadri.png',
};

function normalizeName(name = '') {
  return name.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

/** Initials avatar used until a photo is uploaded in the CMS. `tone` tints
 *  it per committee group — a restrained way to tell the two groups apart
 *  at a glance without introducing a new accent color. */
function Avatar({ name, photoUrl, tone }) {
  const norm = normalizeName(name);
  const resolvedPhoto = COMMITTEE_PHOTO_MAP[norm] || photoUrl;

  const initials = name
    .replace(/^Dr\.?\s*/i, '')
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
            Organising Chairperson
          </span>
          <span className="committee-member__role-line committee-member__role-line--hospitals">
            Director & Chairman Prashanth Group of Hospitals
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
      <div className={`committee__grid committee__grid--${tone}`}>
        {members.map((m) => (
          <MemberCard member={m} tone={tone} key={m.id || m.name} />
        ))}
      </div>
    </div>
  );
}

const CANONICAL_LEADERSHIP = [
  {
    id: 'lead-1',
    name: 'Dr Geetha Haripriya C',
    group: 'leadership',
    role: 'Organising Chairperson\nDirector & Chairman Prashanth Group of Hospitals',
    photoUrl: '/assets/chairperson-geetha-haripriya.png',
    order: 1,
  },
  {
    id: 'lead-2',
    name: 'Dr Samhitha Moturi',
    group: 'leadership',
    role: 'Organising Secretary\nDirector Prashanth Group of Hospitals',
    photoUrl: '/assets/committee/dr-samhitha-moturi.png',
    order: 2,
  },
];

const CANONICAL_SCIENTIFIC = [
  { order: 1, name: 'Dr Swathi B', group: 'scientific', photoUrl: '/assets/committee/dr-swathi.jpg' },
  { order: 2, name: 'Dr Anuradha B', group: 'scientific', photoUrl: '/assets/committee/dr-sailaja.png' },
  { order: 3, name: 'Dr Usha Todadri', group: 'scientific', photoUrl: '/assets/committee/dr-s-r-rathika.png' },
  { order: 4, name: 'Dr Sailaja Sanathi', group: 'scientific', photoUrl: '/assets/committee/dr-anuradha.png' },
  { order: 5, name: 'Dr Selvapriya', group: 'scientific', photoUrl: '/assets/committee/dr-selvapriya.jpg' },
  { order: 6, name: 'Dr Abarajda V', group: 'scientific', photoUrl: '/assets/committee/dr-abrajdha.png' },
  { order: 7, name: 'Dr Sabiha Nikhat N', group: 'scientific', photoUrl: '/assets/committee/dr-shabia.jpg' },
  { order: 8, name: 'Dr Madhumitha C', group: 'scientific', photoUrl: '/assets/committee/dr-madhumitha.png' },
  { order: 9, name: 'Dr Veena R', group: 'scientific', photoUrl: '/assets/committee/dr-veena.png' },
  { order: 10, name: 'Dr.Sughija G', group: 'scientific', photoUrl: '/assets/committee/dr-sughija.png' },
  { order: 11, name: 'Dr Pushpalatha R', group: 'scientific', photoUrl: '/assets/committee/dr-pushpalatha.jpg' },
];

const CANONICAL_ORGANISING = [
  { order: 1, name: 'Dr Malsri R', group: 'organising', photoUrl: '/assets/committee/dr-malsri.png' },
  { order: 2, name: 'Dr Jennifer Britto', group: 'organising', photoUrl: '/assets/committee/dr-jenifer.jpg' },
  { order: 3, name: 'Dr Shri janani R', group: 'organising', photoUrl: '/assets/committee/dr-shri-janani.png' },
  { order: 4, name: 'Dr Shobana Priya K', group: 'organising', photoUrl: '/assets/committee/dr-shobhana.png' },
  { order: 5, name: 'Dr Shubhashree T', group: 'organising', photoUrl: '/assets/committee/dr-subhasree.png' },
  { order: 6, name: 'Dr Priyanka S V', group: 'organising', photoUrl: '/assets/committee/dr-priyanka.jpg' },
  { order: 7, name: 'Dr Divya C', group: 'organising', photoUrl: '/assets/committee/dr-divya.png' },
  { order: 8, name: 'Dr Dhivya S', group: 'organising', photoUrl: '/assets/committee/dr-dhivya-s.jpg' },
  { order: 9, name: 'Dr Seeniammal P', group: 'organising', photoUrl: '/assets/committee/dr-seeniammal-p.png' },
  { order: 10, name: 'Dr.Rathika S.R', group: 'organising', photoUrl: '/assets/committee/dr-usha-todadri.png' },
  { order: 11, name: 'Dr.Krupasankari Rajesh', group: 'organising', photoUrl: '' },
];

export default function Committee({ committee }) {
  // If committee is supplied from the CMS/API, we use the canonical rosters
  // to ensure exact naming, photo links, and 1-to-11 order matching the official sheet.
  const leadership = CANONICAL_LEADERSHIP;
  const scientific = CANONICAL_SCIENTIFIC;
  const organising = CANONICAL_ORGANISING;

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
