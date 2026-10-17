import { useState } from 'react';
import Switch from './ui/Switch';
import Badge from './ui/Badge';
import { eventApi } from '../lib/eventApi';

export default function SectionVisibilityBanner({
  sectionKey,
  sectionName,
  event,
  onSaved,
  description,
}) {
  const currentSections = event.sections || {};
  const isVisible = currentSections[sectionKey] !== false;
  const [loading, setLoading] = useState(false);

  async function handleToggle(checked) {
    setLoading(true);
    try {
      const updatedSections = {
        ...currentSections,
        [sectionKey]: checked,
      };
      const res = await eventApi.update(event.id, { sections: updatedSections });
      onSaved(res.data);
    } catch (err) {
      console.error('Failed to update section visibility', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-5)',
        background: isVisible ? 'var(--white)' : 'var(--ink-100)',
        border: `1px solid ${isVisible ? 'var(--ink-200)' : 'var(--warning-300)'}`,
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Switch
          checked={isVisible}
          disabled={loading}
          onChange={handleToggle}
          size="sm"
        />
        <div>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--ink-900)' }}>
            Show {sectionName} on public microsite
          </span>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
            {description || (isVisible
              ? 'This section is currently visible to attendees.'
              : 'This section is hidden from the public microsite and navigation menu.')}
          </p>
        </div>
      </div>
      <div>
        <Badge tone={isVisible ? 'success' : 'neutral'} size="sm">
          {isVisible ? 'Section Visible' : 'Section Hidden'}
        </Badge>
      </div>
    </div>
  );
}
