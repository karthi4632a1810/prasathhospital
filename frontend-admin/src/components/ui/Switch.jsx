import './Switch.css';

/**
 * Modern, accessible toggle switch for enabling/disabling sections or elements.
 */
export default function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
  id,
}) {
  const switchId = id || (label ? `switch-${String(label).toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <label
      className={`toggle-switch-wrap ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      htmlFor={switchId}
    >
      <div className={`toggle-switch toggle-switch--${size}`}>
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          className="toggle-switch__input"
          checked={Boolean(checked)}
          onChange={(e) => onChange && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="toggle-switch__track">
          <div className="toggle-switch__thumb" />
        </div>
      </div>
      {(label || description) && (
        <div className="toggle-switch__text">
          {label && <span className="toggle-switch__label">{label}</span>}
          {description && <span className="toggle-switch__description">{description}</span>}
        </div>
      )}
    </label>
  );
}
