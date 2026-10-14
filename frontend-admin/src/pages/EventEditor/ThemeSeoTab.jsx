import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import ImageUploadField from '../../components/ImageUploadField';

export default function ThemeSeoTab({ event, onSaved }) {
  const [theme, setTheme] = useState({
    primaryColor: '#96291F',
    accentColor: '#96291F',
    heroImageUrl: '',
    logoUrl: '',
    ...event.theme,
  });
  const [seo, setSeo] = useState({
    metaTitle: '',
    metaDescription: '',
    keywords: [],
    ogImageUrl: '',
    canonicalUrl: '',
    noIndex: false,
    ...event.seo,
  });

  const { SaveBar } = useSaveBar(async () => {
    const res = await eventApi.update(event.id, { theme, seo });
    onSaved(res.data);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card">
        <div className="card__header"><h3 className="card__title">Theme</h3></div>
        <div className="card__body">
          <div className="field-row">
            <label className="field">
              <span className="field__label">Primary color</span>
              <input
                type="color"
                className="field__input"
                style={{ height: 44, padding: 4 }}
                value={theme.primaryColor}
                onChange={(e) => setTheme((t) => ({ ...t, primaryColor: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field__label">Accent color</span>
              <input
                type="color"
                className="field__input"
                style={{ height: 44, padding: 4 }}
                value={theme.accentColor}
                onChange={(e) => setTheme((t) => ({ ...t, accentColor: e.target.value }))}
              />
            </label>
          </div>

          <ImageUploadField
            label="Hero background image"
            value={theme.heroImageUrl}
            onChange={(url) => setTheme((t) => ({ ...t, heroImageUrl: url }))}
            hint="Shown behind the hero headline on the microsite."
          />
          <ImageUploadField
            label="Logo"
            value={theme.logoUrl}
            onChange={(url) => setTheme((t) => ({ ...t, logoUrl: url }))}
          />
        </div>
      </div>

      <div className="card">
        <div className="card__header"><h3 className="card__title">SEO</h3></div>
        <div className="card__body">
          <label className="field">
            <span className="field__label">Meta title</span>
            <input
              className="field__input"
              maxLength={70}
              value={seo.metaTitle}
              onChange={(e) => setSeo((s) => ({ ...s, metaTitle: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Meta description</span>
            <textarea
              className="field__textarea"
              maxLength={200}
              value={seo.metaDescription}
              onChange={(e) => setSeo((s) => ({ ...s, metaDescription: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Keywords (comma separated)</span>
            <input
              className="field__input"
              value={(seo.keywords || []).join(', ')}
              onChange={(e) =>
                setSeo((s) => ({ ...s, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) }))
              }
            />
          </label>
          <ImageUploadField
            label="Social share image (OG image)"
            value={seo.ogImageUrl}
            onChange={(url) => setSeo((s) => ({ ...s, ogImageUrl: url }))}
            hint="Shown when the event link is shared on WhatsApp/social media."
          />
          <label className="field">
            <span className="field__label">Canonical URL (leave blank for default)</span>
            <input
              className="field__input"
              value={seo.canonicalUrl}
              onChange={(e) => setSeo((s) => ({ ...s, canonicalUrl: e.target.value }))}
            />
          </label>
          <label className="field__label">
            <input
              type="checkbox"
              checked={seo.noIndex}
              onChange={(e) => setSeo((s) => ({ ...s, noIndex: e.target.checked }))}
              style={{ marginRight: 'var(--space-2)' }}
            />
            Hide from search engines (noindex)
          </label>
        </div>
      </div>

      {SaveBar}
    </div>
  );
}
