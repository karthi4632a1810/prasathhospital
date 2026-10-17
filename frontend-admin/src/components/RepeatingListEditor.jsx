import Button from './ui/Button';
import Switch from './ui/Switch';
import Badge from './ui/Badge';

/**
 * Shared add/remove/reorder shell for the CMS's flat embedded-array tabs
 * (speakers, sponsors, faqs, announcements). Each tab supplies its own field
 * layout via `renderItem` — this component only owns list mechanics.
 */
export default function RepeatingListEditor({
  items,
  onChange,
  newItem,
  itemLabel,
  renderItem,
  showActiveToggle = true,
}) {
  function updateAt(index, patch) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeAt(index) {
    if (window.confirm(`Are you sure you want to delete this ${itemLabel.toLowerCase()}?`)) {
      onChange(items.filter((_, i) => i !== index));
    }
  }

  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    const item = newItem();
    if (item.isActive === undefined) item.isActive = true;
    onChange([...items, item]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {items.length === 0 && (
        <p style={{ color: 'var(--ink-500)' }}>No {itemLabel.toLowerCase()}s yet.</p>
      )}

      {items.map((item, index) => {
        const isActive = item.isActive !== false;

        return (
          <div
            key={item._id || item.id || index}
            className="card"
            style={{
              padding: 'var(--space-5)',
              background: isActive ? 'var(--white)' : 'var(--ink-50)',
              borderColor: isActive ? 'var(--ink-200)' : 'var(--warning-300)',
              borderStyle: isActive ? 'solid' : 'dashed',
              transition: 'background-color 200ms ease, border-color 200ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--ink-100)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <strong style={{ color: 'var(--ink-700)', fontSize: 'var(--text-sm)' }}>
                  {itemLabel} {index + 1}
                  {item.name ? ` — ${item.name}` : item.title ? ` — ${item.title}` : ''}
                </strong>
                <Badge tone={isActive ? 'success' : 'neutral'} size="sm">
                  {isActive ? 'Visible' : 'Hidden'}
                </Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {showActiveToggle && (
                  <Switch
                    size="sm"
                    checked={isActive}
                    onChange={(val) => updateAt(index, { isActive: val })}
                    label={isActive ? 'Show on site' : 'Hidden'}
                  />
                )}
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ color: 'var(--danger-600)' }}
                    onClick={() => removeAt(index)}
                    aria-label={`Remove ${itemLabel.toLowerCase()}`}
                    title="Delete item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {renderItem(item, (patch) => updateAt(index, patch))}
          </div>
        );
      })}

      <Button variant="secondary" size="sm" onClick={add} type="button">
        + Add {itemLabel.toLowerCase()}
      </Button>
    </div>
  );
}
