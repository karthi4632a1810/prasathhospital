import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import SectionVisibilityBanner from '../../components/SectionVisibilityBanner';
import Switch from '../../components/ui/Switch';

export default function HeroCtaTab({ event, onSaved }) {
  const hero = event.heroSettings || {};
  const finalCta = event.finalCtaSettings || {};

  const [formHero, setFormHero] = useState(() => ({
    showCountdown: hero.showCountdown !== false,
    showStats: hero.showStats !== false,
    showLiveBadge: hero.showLiveBadge !== false,
    liveBadgeText: hero.liveBadgeText || 'Live Tele-Robotic Surgery',
    showShareButton: hero.showShareButton !== false,
    ctaText: hero.ctaText || 'Register Now',
  }));

  const [formCta, setFormCta] = useState(() => ({
    openTitle: finalCta.openTitle || 'Secure your seat',
    closedTitle: finalCta.closedTitle || 'Stay in the loop',
    openText: finalCta.openText || '',
    closedText: finalCta.closedText || '',
    buttonText: finalCta.buttonText || 'Register Now',
  }));

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, {
      heroSettings: formHero,
      finalCtaSettings: {
        show: event.sections?.finalCta !== false,
        ...formCta,
      },
    });
    onSaved(res.data);
  });

  const setH = (key, val) => setFormHero((prev) => ({ ...prev, [key]: val }));
  const setC = (key, val) => setFormCta((prev) => ({ ...prev, [key]: val }));

  return (
    <div>
      <SectionVisibilityBanner
        sectionKey="hero"
        sectionName="Hero Header Banner"
        event={event}
        onSaved={onSaved}
        description="The primary headline banner at the top of the event microsite."
      />

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card__header">
          <h3 className="card__title">Hero Elements & Actions</h3>
        </div>
        <div className="card__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <Switch
              checked={formHero.showCountdown}
              onChange={(val) => setH('showCountdown', val)}
              label="Live Countdown Timer"
              description="Displays Days, Hours, and Minutes countdown to the event start date."
            />

            <Switch
              checked={formHero.showStats}
              onChange={(val) => setH('showStats', val)}
              label="Delegate & Faculty Stat Counters"
              description="Displays numbers of delegates, event days, and faculty."
            />

            <Switch
              checked={formHero.showShareButton}
              onChange={(val) => setH('showShareButton', val)}
              label="Social Share Button"
              description="Displays the WhatsApp / social share button in the hero action row."
            />

            <Switch
              checked={formHero.showLiveBadge}
              onChange={(val) => setH('showLiveBadge', val)}
              label="Featured Live Highlight Badge"
              description="Pulsing beacon badge above the event title."
            />
          </div>

          {formHero.showLiveBadge && (
            <label className="field">
              <span className="field__label">Badge Text</span>
              <input
                className="field__input"
                value={formHero.liveBadgeText}
                onChange={(e) => setH('liveBadgeText', e.target.value)}
                placeholder="Live Tele-Robotic Surgery"
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">Hero CTA Button Text</span>
            <input
              className="field__input"
              value={formHero.ctaText}
              onChange={(e) => setH('ctaText', e.target.value)}
              placeholder="Register Now"
            />
          </label>
        </div>
      </div>

      <SectionVisibilityBanner
        sectionKey="finalCta"
        sectionName="Final Registration Banner (Bottom CTA)"
        event={event}
        onSaved={onSaved}
        description="The conversion banner before the footer prompting visitors to register."
      />

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Final Registration Banner Content</h3>
        </div>
        <div className="card__body">
          <div className="field-row">
            <label className="field">
              <span className="field__label">Title (when registration open)</span>
              <input
                className="field__input"
                value={formCta.openTitle}
                onChange={(e) => setC('openTitle', e.target.value)}
                placeholder="Secure your seat"
              />
            </label>

            <label className="field">
              <span className="field__label">Title (when closed / sold out)</span>
              <input
                className="field__input"
                value={formCta.closedTitle}
                onChange={(e) => setC('closedTitle', e.target.value)}
                placeholder="Stay in the loop"
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Custom Open Description (optional)</span>
            <textarea
              className="field__textarea"
              value={formCta.openText}
              onChange={(e) => setC('openText', e.target.value)}
              placeholder="Leave blank to use default date range & WhatsApp delivery note"
            />
          </label>

          <label className="field">
            <span className="field__label">Registration Button Label</span>
            <input
              className="field__input"
              value={formCta.buttonText}
              onChange={(e) => setC('buttonText', e.target.value)}
              placeholder="Register Now"
            />
          </label>
        </div>
      </div>

      {SaveBar}
    </div>
  );
}
