import { useTilt } from '../lib/useTilt';
import './Sponsors.css';

const TIER_ORDER = ['title', 'platinum', 'main', 'gold', 'silver', 'bronze', 'partner'];
const TIER_LABEL = {
  title: 'Title Sponsor',
  platinum: 'Main Sponsor for the Conference',
  main: 'Main Sponsor for the Conference',
  gold: 'Gold Sponsors',
  silver: 'Silver Sponsors',
  bronze: 'Bronze Sponsors',
  partner: 'Supporting Partners',
};

const SPONSOR_LOGO_MAP = {
  'prashanth fertility research centre': '/assets/sponsors/prashanth-fertility.png',
  'nivyan': '/assets/sponsors/nivyan.png',
  'ferring pharmaceuticals': '/assets/sponsors/ferring.png',
  'ferring': '/assets/sponsors/ferring.png',
  'samarth life sciences': '/assets/sponsors/samarth.png',
  'samarth': '/assets/sponsors/samarth.png',
  'intas pharmaceuticals': '/assets/sponsors/intas.png',
  'intas': '/assets/sponsors/intas.png',
  'zydus healthcare': '/assets/sponsors/zydus.png',
  'zydus': '/assets/sponsors/zydus.png',
  'gufic biosciences': '/assets/sponsors/gufic.png',
  'gufic': '/assets/sponsors/gufic.png',
  'mankind pharma': '/assets/sponsors/mankind.png',
  'mankind': '/assets/sponsors/mankind.png',
  'bsv': '/assets/sponsors/bsv.png',
  'bharat serums and vaccines': '/assets/sponsors/bsv.png',
};

const EXTRA_SPONSORS = [
  { id: 'mankind-pharma', name: 'Mankind Pharma', tier: 'platinum', logoUrl: '/assets/sponsors/mankind.png', order: 8 },
  { id: 'bsv', name: 'BSV', tier: 'platinum', logoUrl: '/assets/sponsors/bsv.png', order: 9 },
];

function normalizeName(name = '') {
  return name.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

function SponsorCard({ sponsor, tier }) {
  const tilt = useTilt({ max: 6, scale: 1.02 });
  const norm = normalizeName(sponsor.name);
  const resolvedLogo = SPONSOR_LOGO_MAP[norm] || sponsor.logoUrl;

  const inner = resolvedLogo ? (
    <img src={resolvedLogo} alt={sponsor.name} loading="lazy" />
  ) : (
    <span className="sponsors__name">{sponsor.name}</span>
  );

  return (
    <li
      ref={tilt.ref}
      onMouseEnter={tilt.onMouseEnter}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      className={`sponsors__item sponsors__item--${tier}`}
    >
      {sponsor.websiteUrl ? (
        <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" title={sponsor.name}>
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  );
}

export default function Sponsors({ sponsors }) {
  const mergedList = [...(sponsors || [])];
  for (const extra of EXTRA_SPONSORS) {
    const norm = normalizeName(extra.name);
    if (!mergedList.some((s) => normalizeName(s.name) === norm)) {
      mergedList.push(extra);
    }
  }

  if (!mergedList.length) return null;

  // Group by tier, preserving the canonical tier order.
  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    items: mergedList.filter((s) => s.tier === tier),
  })).filter((g) => g.items.length);

  return (
    <section className="section section--tight sponsors" id="sponsors">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">With thanks to</span>
          <h2 className="section-title">Sponsors &amp; partners</h2>
        </div>

        {grouped.map((group) => (
          <div className={`sponsors__tier sponsors__tier--${group.tier}`} key={group.tier}>
            {group.tier !== 'title' && <h3 className="sponsors__tier-label">{group.label}</h3>}
            <ul className="sponsors__list">
              {group.items.map((s) => (
                <SponsorCard sponsor={s} tier={group.tier} key={s.id} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
