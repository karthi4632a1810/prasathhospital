import './Badge.css';

export default function Badge({ children, tone = 'neutral', size = 'md', icon, className = '' }) {
  return (
    <span className={`badge badge--${tone} badge--${size} ${className}`.trim()}>
      {icon && (
        <span className="badge__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

/** Maps the API's registrationState to a human label and colour tone. */
export function RegistrationStateBadge({ state, seatsRemaining }) {
  const map = {
    open:
      seatsRemaining !== null && seatsRemaining !== undefined && seatsRemaining <= 25
        ? { tone: 'warning', label: `Only ${seatsRemaining} seats left` }
        : { tone: 'success', label: 'Registration Open' },
    'not-yet-open': { tone: 'info', label: 'Registration Opens Soon' },
    closed: { tone: 'neutral', label: 'Registration Closed' },
    'sold-out': { tone: 'danger', label: 'Sold Out' },
    completed: { tone: 'neutral', label: 'Event Completed' },
    cancelled: { tone: 'danger', label: 'Event Cancelled' },
    unavailable: { tone: 'neutral', label: 'Unavailable' },
  };

  const cfg = map[state] || map.unavailable;
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
