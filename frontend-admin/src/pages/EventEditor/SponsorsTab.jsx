import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import RepeatingListEditor from '../../components/RepeatingListEditor';
import ImageUploadField from '../../components/ImageUploadField';

const TIERS = ['title', 'platinum', 'gold', 'silver', 'bronze', 'partner'];

export default function SponsorsTab({ event, onSaved }) {
  const [sponsors, setSponsors] = useState(event.sponsors || []);

  const { SaveBar } = useSaveBar(async () => {
    const saved = await eventApi.replaceArray(event.id, 'sponsors', sponsors);
    onSaved({ ...event, sponsors: saved.data });
  });

  return (
    <div>
      <RepeatingListEditor
        items={sponsors}
        onChange={setSponsors}
        itemLabel="Sponsor"
        newItem={() => ({
          name: '',
          logoUrl: '',
          websiteUrl: '',
          tier: 'partner',
          order: sponsors.length,
        })}
        renderItem={(item, update) => (
          <>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Name</span>
                <input
                  className="field__input"
                  value={item.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Tier</span>
                <select
                  className="field__select"
                  value={item.tier}
                  onChange={(e) => update({ tier: e.target.value })}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field__label">Website URL</span>
              <input
                className="field__input"
                value={item.websiteUrl}
                onChange={(e) => update({ websiteUrl: e.target.value })}
              />
            </label>
            <ImageUploadField
              label="Logo"
              value={item.logoUrl}
              onChange={(url) => update({ logoUrl: url })}
            />
          </>
        )}
      />
      {SaveBar}
    </div>
  );
}
