import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '../lib/auth';
import { useEvents, EventSelect } from '../lib/useEvents';
import { reportApi } from '../lib/reportApi';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { CouponStateBadge, UsageBar } from '../components/StatusBadges';

const ICON_MAP = {
  door: '🚪',
  utensils: '🍽️',
  gift: '🎁',
  coffee: '☕',
  mic: '🎤',
  star: '⭐',
};

const ALL_LINKS = [
  {
    to: '/registrations',
    label: 'Registrations',
    desc: 'Search, resend tickets, cancel',
    roles: ['superadmin', 'manager'],
  },
  {
    to: '/coupons',
    label: 'Coupons',
    desc: 'Create and manage company coupons',
    roles: ['superadmin', 'manager'],
  },
  {
    to: '/reports',
    label: 'Reports',
    desc: 'Company & coupon reports, CSV exports',
    roles: ['superadmin', 'manager'],
  },
  { to: '/checkin', label: 'Check-in scanner', desc: 'Scan QR codes on event day' },
  { to: '/checkin-locations', label: 'Check-in Locations', desc: 'Configure & manage active checkpoints' },
];

const REFRESH_MS = 30000;

export default function DashboardOverview() {
  const { user } = useAuth();
  const { events, eventId, setEventId, error: eventsError } = useEvents();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/v1/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body) => setApiStatus(body?.data?.database === 'connected' ? 'ok' : 'degraded'))
      .catch(() => setApiStatus('down'));
  }, []);

  const load = useCallback(() => {
    if (!eventId) return;
    reportApi
      .overview(eventId)
      .then((res) => {
        setOverview(res.data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [eventId]);

  useEffect(() => {
    setOverview(null);
    load();
    const t = setInterval(load, REFRESH_MS); // live numbers on event day
    return () => clearInterval(t);
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const links = ALL_LINKS.filter((l) => !l.roles || l.roles.includes(user?.role));

  if (eventsError) return <ErrorState message={eventsError} />;
  if (events && events.length === 0)
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;

  const o = overview;
  const companyChart = (o?.byCompany || []).filter((c) => c.confirmed > 0 || c.allocated > 0);
  const allLocs = o?.locations || o?.checkIn?.locations || [];
  const activeLocs = o?.activeLocations || o?.checkIn?.activeLocations || allLocs.filter((l) => l.isActive);
  const inactiveLocs = allLocs.filter((l) => !l.isActive);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">
            {greeting}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="page-header__subtitle">
            Live registration and check-in numbers. Refreshes every 30 seconds.
          </p>
        </div>
        <div
          style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <EventSelect events={events} eventId={eventId} onChange={setEventId} />
          <StatusPill status={apiStatus} />
        </div>
      </div>

      {error && <div className="notice notice--error">{error}</div>}

      {!o ? (
        <LoadingState label="Loading overview…" />
      ) : (
        <>
          <div className="stat-grid">
            <StatTile
              label="Total registrations"
              value={o.registrations.total}
              meta={`${o.registrations.cancelled} cancelled`}
            />
            <StatTile
              label="Confirmed"
              value={o.registrations.confirmed}
              meta="Valid tickets issued"
            />
            <StatTile
              label="Checked in"
              value={`${o.checkIn.checkedIn}`}
              meta={`${o.checkIn.remaining} still to arrive · ${o.checkIn.rate}%`}
            />
            <StatTile
              label="Coupon places used"
              value={`${o.coupons.used} / ${o.coupons.allocated}`}
              meta={`${o.coupons.remaining} remaining across ${o.coupons.count} active coupons${o.coupons.inactiveCount ? ` (${o.coupons.inactiveCount} inactive)` : ''}`}
            />
          </div>

          {/* Active Check-in Locations & Live Scan Count */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div
              className="card__header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <h3 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📍</span>
                  <span>Active Check-in Locations ({activeLocs.length})</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--ink-500)' }}>
                  Live verified attendee check-in counts for today&apos;s active checkpoints.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {inactiveLocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInactive((prev) => !prev)}
                    className="btn btn--sm btn--secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    {showInactive
                      ? `Hide Past Locations (${inactiveLocs.length})`
                      : `Show Past Locations (${inactiveLocs.length})`}
                  </button>
                )}
                <a
                  href="/checkin"
                  className="btn btn--sm btn--primary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                  }}
                >
                  <span>📷</span>
                  <span>Open Scanner Desk</span>
                </a>
                <a
                  href="/checkin-locations"
                  className="btn btn--sm btn--secondary"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', textDecoration: 'none' }}
                >
                  ⚙️ Manage Locations
                </a>
              </div>
            </div>

            <div className="card__body">
              {activeLocs.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--ink-500)' }}>
                  <p style={{ fontSize: '1.5rem', margin: '0 0 6px' }}>📍</p>
                  <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No checkpoints are currently marked active.</p>
                  <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
                    Go to{' '}
                    <a href="/checkin-locations" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
                      Check-in Locations
                    </a>{' '}
                    to activate or create checkpoints for today.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--space-4)',
                  }}
                >
                  {activeLocs.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      totalConfirmed={o.registrations.confirmed}
                    />
                  ))}
                </div>
              )}

              {/* Collapsible Past/Inactive Locations */}
              {showInactive && inactiveLocs.length > 0 && (
                <div
                  style={{
                    marginTop: 'var(--space-5)',
                    paddingTop: 'var(--space-5)',
                    borderTop: '1px dashed var(--ink-200)',
                  }}
                >
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--ink-400)',
                      }}
                    >
                      Past / Inactive Event Checkpoints
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 'var(--space-4)',
                    }}
                  >
                    {inactiveLocs.map((loc) => (
                      <LocationCard
                        key={loc.id}
                        location={loc}
                        totalConfirmed={o.registrations.confirmed}
                        isInactive
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="stat-grid">
            <DeliveryTile label="Email delivery" counts={o.delivery.email} />
            <DeliveryTile label="WhatsApp delivery" counts={o.delivery.whatsapp} />
          </div>

          {companyChart.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card__header">
                <h3 className="card__title">Registrations by company</h3>
              </div>
              <div className="card__body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={companyChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--ink-600)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--ink-200)' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--ink-500)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--brand-50)' }}
                      contentStyle={{
                        border: '1px solid var(--ink-200)',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      isAnimationActive={false}
                      dataKey="confirmed"
                      name="Confirmed"
                      fill="var(--brand-600)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="checkedIn"
                      name="Checked in"
                      fill="var(--success-500)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {o.byCoupon.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card__header">
                <h3 className="card__title">Coupon allocation vs usage</h3>
              </div>
              <div className="data-table-wrap" style={{ border: 0, borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Coupon</th>
                      <th>Company</th>
                      <th>Usage</th>
                      <th className="num">Confirmed</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.byCoupon.map((c) => (
                      <tr key={c.id}>
                        <td className="mono">
                          <strong>{c.code}</strong>
                        </td>
                        <td>{c.companyName}</td>
                        <td>
                          <UsageBar used={c.used} allocated={c.allocated} />
                        </td>
                        <td className="num">{c.confirmed}</td>
                        <td>
                          <CouponStateBadge state={c.state} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Quick links</h3>
        </div>
        <div
          className="card__body"
          style={{
            display: 'grid',
            gap: 'var(--space-3)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {links.map((link) => (
            <a
              key={link.to}
              href={link.to}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-4)',
                border: '1px solid var(--ink-200)',
                borderRadius: 'var(--radius-md)',
                color: 'inherit',
              }}
            >
              <span>
                <strong style={{ display: 'block', color: 'var(--ink-900)' }}>{link.label}</strong>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>
                  {link.desc}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--brand-500)' }}>
                →
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, meta }) {
  return (
    <div className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">{value}</p>
      <p className="stat-tile__meta">{meta}</p>
    </div>
  );
}

function DeliveryTile({ label, counts }) {
  const failed = (counts.failed || 0) + (counts.retryable || 0);
  return (
    <div className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">
        {counts.sent}
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--ink-500)', fontWeight: 500 }}>
          {' '}
          sent
        </span>
      </p>
      <p className="stat-tile__meta">
        <span style={{ color: failed ? 'var(--danger-700)' : undefined }}>{failed} failed</span>
        {' · '}
        {counts.pending} pending
        {counts.not_configured > 0 && ` · ${counts.not_configured} not configured`}
      </p>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    checking: { label: 'Checking API…', color: 'var(--ink-500)', bg: 'var(--ink-100)' },
    ok: { label: 'All systems normal', color: 'var(--success-700)', bg: 'var(--success-100)' },
    degraded: {
      label: 'Database unavailable',
      color: 'var(--warning-700)',
      bg: 'var(--warning-100)',
    },
    down: { label: 'API unreachable', color: 'var(--danger-700)', bg: 'var(--danger-100)' },
  };
  const cfg = map[status] || map.checking;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        borderRadius: 'var(--radius-full)',
        background: cfg.bg,
        color: cfg.color,
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'currentColor',
          display: 'inline-block',
        }}
      />
      {cfg.label}
    </span>
  );
}

function LocationCard({ location, totalConfirmed, isInactive }) {
  const iconEmoji = ICON_MAP[location.icon] || '📍';
  const pct =
    totalConfirmed > 0
      ? Math.min(Math.round((location.checkedInCount / totalConfirmed) * 100), 100)
      : 0;
  const remaining = Math.max(totalConfirmed - location.checkedInCount, 0);
  const color = location.color || '#2563eb';

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        border: isInactive ? '1px solid var(--ink-200)' : `1.5px solid ${color}35`,
        backgroundColor: isInactive ? 'var(--ink-50)' : 'var(--white)',
        boxShadow: isInactive ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        transition: 'all 0.15s ease',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                backgroundColor: isInactive ? 'var(--ink-200)' : `${color}18`,
                color: isInactive ? 'var(--ink-600)' : color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
              }}
            >
              {iconEmoji}
            </div>
            <div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  color: isInactive ? 'var(--ink-600)' : 'var(--ink-900)',
                  lineHeight: 1.25,
                }}
              >
                {location.name}
              </h4>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  color: 'var(--ink-500)',
                  backgroundColor: 'var(--ink-100)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  marginTop: '3px',
                }}
              >
                {location.code}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {location.isDefault && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '12px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                }}
              >
                ⭐ DEFAULT
              </span>
            )}
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '12px',
                backgroundColor: isInactive ? 'var(--ink-200)' : '#ecfdf5',
                color: isInactive ? 'var(--ink-600)' : '#065f46',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: isInactive ? 'var(--ink-500)' : '#10b981',
                }}
              />
              {isInactive ? 'INACTIVE' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Counter Display */}
        <div style={{ margin: '14px 0 10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontSize: '2.4rem',
                fontWeight: 800,
                color: isInactive ? 'var(--ink-700)' : color,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {location.checkedInCount}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--ink-500)', fontWeight: 500 }}>
              / {totalConfirmed} checked in
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'var(--ink-100)',
              overflow: 'hidden',
              margin: '10px 0 6px',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: isInactive ? 'var(--ink-400)' : color,
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: 'var(--ink-500)',
            }}
          >
            <span>
              <strong>{pct}%</strong> checked-in
            </span>
            <span>{remaining} remaining</span>
          </div>
        </div>
      </div>

      {!isInactive && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--ink-100)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <a
            href={`/checkin?location=${location.id}`}
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
            }}
          >
            <span>Scan at this desk</span>
            <span>→</span>
          </a>
        </div>
      )}
    </div>
  );
}
