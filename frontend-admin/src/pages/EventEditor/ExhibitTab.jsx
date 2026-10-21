import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import SectionVisibilityBanner from '../../components/SectionVisibilityBanner';
import RepeatingListEditor from '../../components/RepeatingListEditor';

const DEFAULT_STALL_TIERS = [
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
    isActive: true,
  },
  {
    tier: 'gold',
    name: 'Gold Stall',
    price: '₹5,00,000',
    registrations: '30 free registrations',
    benefits: ['Strategic booth placement', 'Display-screen branding', 'Program mentions'],
    isActive: true,
  },
  {
    tier: 'silver',
    name: 'Silver Stall',
    price: '₹2,50,000',
    registrations: '15 free registrations',
    benefits: ['Standard exhibition stall', 'Official sponsor directory listing'],
    isActive: true,
  },
];

const TIER_OPTIONS = [
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'partner', label: 'Partner' },
];

export default function ExhibitTab({ event, onSaved }) {
  const current = event.exhibitStalls || {};

  const [header, setHeader] = useState(() => ({
    eyebrow: current.eyebrow || 'Exhibit & sponsor',
    title: current.title || 'Put your brand in front of key decision makers',
    subtitle:
      current.subtitle ||
      'Position your organization before leading clinical decision makers and opinion leaders in reproductive medicine from India and internationally.',
    ctaText: current.ctaText || 'Reserve your stall',
    contactEmail: current.contactEmail || event.contact?.email || '',
  }));

  const [tiers, setTiers] = useState(() => {
    if (current.tiers && current.tiers.length > 0) {
      return current.tiers.map((t) => ({
        ...t,
        benefits: Array.isArray(t.benefits) ? t.benefits : [],
      }));
    }
    return DEFAULT_STALL_TIERS;
  });

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, {
      exhibitStalls: {
        show: current.show !== false,
        eyebrow: header.eyebrow,
        title: header.title,
        subtitle: header.subtitle,
        ctaText: header.ctaText,
        contactEmail: header.contactEmail,
        tiers,
      },
    });
    onSaved(res.data);
  });

  const setH = (key) => (e) => setHeader((h) => ({ ...h, [key]: e.target.value }));

  return (
    <div>
      <SectionVisibilityBanner
        sectionKey="exhibitStalls"
        sectionName="Exhibit & Stalls Booking"
        event={event}
        onSaved={onSaved}
        description="Exhibition stalls and packages for commercial partners, medical device sponsors, and vendors."
      />

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card__header">
          <h3 className="card__title">Section Headers & Inquiries</h3>
        </div>
        <div className="card__body">
          <div className="field-row">
            <label className="field">
              <span className="field__label">Section Eyebrow</span>
              <input
                className="field__input"
                value={header.eyebrow}
                onChange={setH('eyebrow')}
                placeholder="Exhibit & sponsor"
              />
            </label>
            <label className="field">
              <span className="field__label">Main Title</span>
              <input
                className="field__input"
                value={header.title}
                onChange={setH('title')}
                placeholder="Put your brand in front of key decision makers"
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Subtitle / Description</span>
            <textarea
              className="field__textarea"
              value={header.subtitle}
              onChange={setH('subtitle')}
              placeholder="Position your organization before leading clinical decision makers..."
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Reservation Contact Email</span>
              <input
                type="email"
                className="field__input"
                value={header.contactEmail}
                onChange={setH('contactEmail')}
                placeholder="infociim@pfrcivf.com"
              />
              <span className="field__hint">
                Inquiry CTA button opens mailto: with this address.
              </span>
            </label>

            <label className="field">
              <span className="field__label">CTA Button Label</span>
              <input
                className="field__input"
                value={header.ctaText}
                onChange={setH('ctaText')}
                placeholder="Reserve your stall"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Stall Packages & Tiers</h3>
        </div>
        <div className="card__body">
          <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            Configure individual stall packages. You can hide or delete any stall tier with the controls below.
          </p>

          <RepeatingListEditor
            items={tiers}
            onChange={setTiers}
            itemLabel="Stall Tier"
            newItem={() => ({
              tier: 'silver',
              name: 'New Stall Package',
              price: '₹2,00,000',
              registrations: '10 free registrations',
              benefits: ['Standard booth', 'Program mention'],
              isActive: true,
              order: tiers.length,
            })}
            renderItem={(item, update) => (
              <>
                <div className="field-row">
                  <label className="field">
                    <span className="field__label">Package Name</span>
                    <input
                      className="field__input"
                      value={item.name}
                      onChange={(e) => update({ name: e.target.value })}
                      placeholder="Gold Stall"
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Tier Category</span>
                    <select
                      className="field__select"
                      value={item.tier || 'partner'}
                      onChange={(e) => update({ tier: e.target.value })}
                    >
                      {TIER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="field-row">
                  <label className="field">
                    <span className="field__label">Price / Sponsorship Cost</span>
                    <input
                      className="field__input"
                      value={item.price}
                      onChange={(e) => update({ price: e.target.value })}
                      placeholder="₹5,00,000"
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Delegate Registrations Included</span>
                    <input
                      className="field__input"
                      value={item.registrations}
                      onChange={(e) => update({ registrations: e.target.value })}
                      placeholder="30 free registrations"
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Benefits (one per line)</span>
                  <textarea
                    className="field__textarea"
                    value={(item.benefits || []).join('\n')}
                    onChange={(e) =>
                      update({
                        benefits: e.target.value
                          .split('\n')
                          .map((b) => b.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Prime high-visibility location&#10;Stage recognition&#10;Logo in program directory"
                  />
                </label>
              </>
            )}
          />
        </div>
      </div>

      {SaveBar}
    </div>
  );
}
