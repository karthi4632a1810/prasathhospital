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

function SponsorCard({ sponsor, tier }) {
  const tilt = useTilt({ max: 6, scale: 1.02 });
  const inner = sponsor.logoUrl ? (
    <img src={sponsor.logoUrl} alt={sponsor.name} loading="lazy" />
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
  if (!sponsors?.length) return null;

  // Group by tier, preserving the canonical tier order.
  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    items: sponsors.filter((s) => s.tier === tier),
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
