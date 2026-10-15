import Badge from './ui/Badge';

const DELIVERY = {
  sent: { tone: 'success', label: 'Sent' },
  pending: { tone: 'info', label: 'Pending' },
  failed: { tone: 'danger', label: 'Failed' },
  retryable: { tone: 'warning', label: 'Retry' },
  not_configured: { tone: 'neutral', label: 'Not configured' },
};

export const DELIVERY_OPTIONS = [
  ['sent', 'Sent'],
  ['pending', 'Pending'],
  ['failed', 'Failed'],
  ['retryable', 'Retryable'],
  ['not_configured', 'Not configured'],
];

export function DeliveryBadge({ status }) {
  const cfg = DELIVERY[status] || DELIVERY.pending;
  return <Badge tone={cfg.tone} size="sm">{cfg.label}</Badge>;
}

const REG_STATUS = {
  confirmed: { tone: 'success', label: 'Confirmed' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
  pending_payment: { tone: 'neutral', label: 'Legacy · unpaid' },
  refunded: { tone: 'neutral', label: 'Refunded' },
};

export function RegistrationStatusBadge({ status }) {
  const cfg = REG_STATUS[status] || { tone: 'neutral', label: status };
  return <Badge tone={cfg.tone} size="sm">{cfg.label}</Badge>;
}

const COUPON_STATE = {
  active: { tone: 'success', label: 'Active' },
  scheduled: { tone: 'info', label: 'Scheduled' },
  expired: { tone: 'neutral', label: 'Expired' },
  exhausted: { tone: 'warning', label: 'Fully used' },
  inactive: { tone: 'danger', label: 'Inactive' },
};

export const COUPON_STATE_OPTIONS = Object.entries(COUPON_STATE).map(([value, cfg]) => [value, cfg.label]);

export function CouponStateBadge({ state }) {
  const cfg = COUPON_STATE[state] || { tone: 'neutral', label: state };
  return <Badge tone={cfg.tone} size="sm">{cfg.label}</Badge>;
}

/** "used / allocated" with a bar that turns amber at 80% and red when full. */
export function UsageBar({ used, allocated }) {
  const pct = allocated > 0 ? Math.min(Math.round((used / allocated) * 100), 100) : 0;
  const level = pct >= 100 ? 'full' : pct >= 80 ? 'high' : 'normal';
  return (
    <div className="usage" title={`${used} of ${allocated} used`}>
      <div className="usage__text">
        <span>
          <strong>{used}</strong> / {allocated}
        </span>
        <span>{Math.max(allocated - used, 0)} left</span>
      </div>
      <div className="usage__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="usage__fill" data-level={level} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
