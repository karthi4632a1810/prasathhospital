import Button from '../components/ui/Button';
import './ExhibitStalls.css';

const STALL_TIERS = [
  {
    tier: 'platinum',
    name: 'Platinum Stall',
    price: '₹10,00,000',
    registrations: '60 free registrations',
    benefits: [
      'Prime high-visibility location',
      'Top-tier branding across collateral',
      'Stage recognition',
    ],
  },
  {
    tier: 'gold',
    name: 'Gold Stall',
    price: '₹5,00,000',
    registrations: '30 free registrations',
    benefits: ['Strategic booth placement', 'Display-screen branding', 'Program mentions'],
  },
  {
    tier: 'silver',
    name: 'Silver Stall',
    price: '₹2,50,000',
    registrations: '15 free registrations',
    benefits: ['Standard exhibition stall', 'Official sponsor directory listing'],
  },
];

export default function ExhibitStalls({ exhibit = {}, contactEmail }) {
  if (exhibit.show === false) return null;

  const eyebrow = exhibit.eyebrow || 'Exhibit & sponsor';
  const title = exhibit.title || 'Put your brand in front of key decision makers';
  const subtitle =
    exhibit.subtitle ||
    'Position your organization before leading clinical decision makers and opinion leaders in reproductive medicine from India and internationally.';
  const ctaText = exhibit.ctaText || 'Reserve your stall';
  const email = contactEmail || exhibit.contactEmail || 'infociim@pfrcivf.com';

  const rawTiers =
    exhibit.tiers && exhibit.tiers.length > 0 ? exhibit.tiers : STALL_TIERS;
  const tiers = rawTiers.filter((t) => t.isActive !== false);

  if (!tiers.length) return null;

  const mailHref = `mailto:${email}?subject=${encodeURIComponent(
    `Stall Reservation — ${title}`
  )}`;

  return (
    <section className="section section--tight exhibit-stalls" id="exhibit">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">{eyebrow}</span>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>

        <div className="exhibit-stalls__grid">
          {tiers.map((s, idx) => (
            <div className={`exhibit-stall exhibit-stall--${s.tier || 'partner'}`} key={s._id || s.id || s.tier || idx}>
              <h3 className="exhibit-stall__name">{s.name}</h3>
              {s.price && <div className="exhibit-stall__price">{s.price}</div>}
              {s.registrations && <p className="exhibit-stall__regs">{s.registrations}</p>}
              {s.benefits && s.benefits.length > 0 && (
                <ul className="exhibit-stall__benefits">
                  {s.benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="exhibit-stalls__cta">
          <Button variant="accent" size="lg" href={mailHref}>
            {ctaText}
          </Button>
        </div>
      </div>
    </section>
  );
}
