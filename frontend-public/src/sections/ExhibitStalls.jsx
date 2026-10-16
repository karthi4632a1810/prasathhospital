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

export default function ExhibitStalls({ contactEmail }) {
  const mailHref = `mailto:${contactEmail || 'secretariat@ciim2026.com'}?subject=${encodeURIComponent(
    'Stall Reservation — CIIM 2026'
  )}`;

  return (
    <section className="section section--tight exhibit-stalls" id="exhibit">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">Exhibit &amp; sponsor</span>
          <h2 className="section-title">Put your brand in front of key decision makers</h2>
          <p className="section-sub">
            Position your organization before leading clinical decision makers and opinion leaders
            in reproductive medicine from India and internationally.
          </p>
        </div>

        <div className="exhibit-stalls__grid">
          {STALL_TIERS.map((s) => (
            <div className={`exhibit-stall exhibit-stall--${s.tier}`} key={s.tier}>
              <h3 className="exhibit-stall__name">{s.name}</h3>
              <div className="exhibit-stall__price">{s.price}</div>
              <p className="exhibit-stall__regs">{s.registrations}</p>
              <ul className="exhibit-stall__benefits">
                {s.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="exhibit-stalls__cta">
          <Button variant="accent" size="lg" href={mailHref}>
            Reserve your stall
          </Button>
        </div>
      </div>
    </section>
  );
}
