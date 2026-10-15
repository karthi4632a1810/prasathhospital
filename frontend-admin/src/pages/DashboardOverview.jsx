import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../lib/auth';
import { useEvents, EventSelect } from '../lib/useEvents';
import { reportApi } from '../lib/reportApi';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { CouponStateBadge, UsageBar } from '../components/StatusBadges';

const ALL_LINKS = [
  { to: '/registrations', label: 'Registrations', desc: 'Search, resend tickets, cancel', roles: ['superadmin', 'manager'] },
  { to: '/coupons', label: 'Coupons', desc: 'Create and manage company coupons', roles: ['superadmin', 'manager'] },
  { to: '/reports', label: 'Reports', desc: 'Company & coupon reports, CSV exports', roles: ['superadmin', 'manager'] },
  { to: '/checkin', label: 'Check-in scanner', desc: 'Scan QR codes on event day' },
];

const REFRESH_MS = 30000;

export default function DashboardOverview() {
  const { user } = useAuth();
  const { events, eventId, setEventId, error: eventsError } = useEvents();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');

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
  if (events && events.length === 0) return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;

  const o = overview;
  const companyChart = (o?.byCompany || []).filter((c) => c.confirmed > 0 || c.allocated > 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">{greeting}, {user?.name?.split(' ')[0]}</h2>
          <p className="page-header__subtitle">Live registration and check-in numbers. Refreshes every 30 seconds.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
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
            <StatTile label="Total registrations" value={o.registrations.total} meta={`${o.registrations.cancelled} cancelled`} />
            <StatTile label="Confirmed" value={o.registrations.confirmed} meta="Valid tickets issued" />
            <StatTile
              label="Checked in"
              value={`${o.checkIn.checkedIn}`}
              meta={`${o.checkIn.remaining} still to arrive · ${o.checkIn.rate}%`}
            />
            <StatTile
              label="Coupon places used"
              value={`${o.coupons.used} / ${o.coupons.allocated}`}
              meta={`${o.coupons.remaining} remaining across ${o.coupons.count} coupons`}
            />
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
                    <XAxis dataKey="name" tick={{ fill: 'var(--ink-600)', fontSize: 12 }} axisLine={{ stroke: 'var(--ink-200)' }} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--ink-500)', fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip cursor={{ fill: 'var(--brand-50)' }} contentStyle={{ border: '1px solid var(--ink-200)', borderRadius: 8, fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar isAnimationActive={false} dataKey="confirmed" name="Confirmed" fill="var(--brand-600)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    <Bar isAnimationActive={false} dataKey="checkedIn" name="Checked in" fill="var(--success-500)" radius={[4, 4, 0, 0]} maxBarSize={44} />
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
                        <td className="mono"><strong>{c.code}</strong></td>
                        <td>{c.companyName}</td>
                        <td><UsageBar used={c.used} allocated={c.allocated} /></td>
                        <td className="num">{c.confirmed}</td>
                        <td><CouponStateBadge state={c.state} /></td>
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
        <div className="card__body" style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>{link.desc}</span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--brand-500)' }}>→</span>
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
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--ink-500)', fontWeight: 500 }}> sent</span>
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
    degraded: { label: 'Database unavailable', color: 'var(--warning-700)', bg: 'var(--warning-100)' },
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
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}
