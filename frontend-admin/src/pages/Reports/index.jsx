import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { useEvents, EventSelect } from '../../lib/useEvents';
import { reportApi } from '../../lib/reportApi';
import { formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import { CouponStateBadge, UsageBar } from '../../components/StatusBadges';

function ExportButton({ type, label, exporting, onExport }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => onExport(type)}
      disabled={Boolean(exporting)}
    >
      {exporting === type ? 'Exporting…' : label}
    </Button>
  );
}

export default function Reports() {
  const { events, eventId, setEventId, error: eventsError } = useEvents();
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  const params = { event: eventId, from: range.from, to: range.to };

  const load = useCallback(() => {
    if (!eventId) return;
    setError(null);
    reportApi
      .breakdown({ event: eventId, from: range.from, to: range.to })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, [eventId, range.from, range.to]);

  useEffect(load, [load]);

  async function handleExport(type) {
    setExporting(type);
    setExportError('');
    try {
      if (type === 'registrations') await reportApi.exportRegistrations(params);
      if (type === 'companies') await reportApi.exportCompanies(params);
      if (type === 'coupons') await reportApi.exportCoupons(params);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting('');
    }
  }

  if (eventsError) return <ErrorState message={eventsError} />;
  if (events === null) return <LoadingState label="Loading events…" />;
  if (events.length === 0)
    return <EmptyState title="No events yet" message="Create an event in the Event CMS first." />;

  const totals = data
    ? data.companies.reduce(
        (acc, c) => ({
          confirmed: acc.confirmed + c.confirmed,
          cancelled: acc.cancelled + c.cancelled,
          checkedIn: acc.checkedIn + c.checkedIn,
          emailSent: acc.emailSent + c.emailSent,
          emailFailed: acc.emailFailed + c.emailFailed,
          whatsappSent: acc.whatsappSent + c.whatsappSent,
          whatsappFailed: acc.whatsappFailed + c.whatsappFailed,
        }),
        {
          confirmed: 0,
          cancelled: 0,
          checkedIn: 0,
          emailSent: 0,
          emailFailed: 0,
          whatsappSent: 0,
          whatsappFailed: 0,
        }
      )
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Reports</h2>
          <p className="page-header__subtitle">
            Company-wise and coupon-wise registrations, delivery and check-in.
          </p>
        </div>
        <EventSelect events={events} eventId={eventId} onChange={setEventId} />
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="toolbar">
          <label className="field">
            <span className="field__label">From</span>
            <input
              className="field__input"
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">To</span>
            <input
              className="field__input"
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          {(range.from || range.to) && (
            <Button variant="ghost" size="sm" onClick={() => setRange({ from: '', to: '' })}>
              Clear dates
            </Button>
          )}
          <div className="toolbar__actions" style={{ flexWrap: 'wrap' }}>
            <ExportButton
              type="registrations"
              label="Registrations CSV"
              exporting={exporting}
              onExport={handleExport}
            />
            <ExportButton
              type="companies"
              label="Companies CSV"
              exporting={exporting}
              onExport={handleExport}
            />
            <ExportButton
              type="coupons"
              label="Coupons CSV"
              exporting={exporting}
              onExport={handleExport}
            />
          </div>
        </div>
      </div>

      {exportError && <div className="notice notice--error">{exportError}</div>}
      {(range.from || range.to) && (
        <div className="notice notice--info">
          Registration counts are limited to {range.from || 'the start'} – {range.to || 'today'}.
          Coupon allocation, usage and remaining are whole-coupon figures.
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState label="Loading report…" />
      ) : (
        <>
          <div className="stat-grid">
            <StatTile label="Confirmed" value={totals.confirmed} />
            <StatTile label="Cancelled" value={totals.cancelled} />
            <StatTile
              label="Checked in"
              value={totals.checkedIn}
              meta={`${Math.max(totals.confirmed - totals.checkedIn, 0)} remaining`}
            />
            <StatTile
              label="Email"
              value={totals.emailSent}
              meta={`sent · ${totals.emailFailed} failed`}
            />
            <StatTile
              label="WhatsApp"
              value={totals.whatsappSent}
              meta={`sent · ${totals.whatsappFailed} failed`}
            />
          </div>

          {data.daily.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card__header">
                <h3 className="card__title">Registrations by date</h3>
              </div>
              <div className="card__body">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.daily} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--ink-500)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--ink-200)' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--ink-500)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        border: '1px solid var(--ink-200)',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="confirmed"
                      name="Confirmed"
                      stroke="var(--brand-600)"
                      fill="var(--brand-100)"
                      strokeWidth={2}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="cancelled"
                      name="Cancelled"
                      stroke="var(--danger-500)"
                      fill="var(--danger-100)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <ReportTable
            title="By company"
            rows={data.companies}
            empty="No companies with coupons or registrations for this event yet."
            first={{ label: 'Company', render: (r) => <strong>{r.name}</strong> }}
          />
          <ReportTable
            title="By coupon"
            rows={data.coupons}
            empty="No coupons for this event yet."
            first={{
              label: 'Coupon',
              render: (r) => (
                <>
                  <strong className="mono">{r.code}</strong>
                  <span className="sub">{r.companyName}</span>
                </>
              ),
            }}
            extra={{ label: 'State', render: (r) => <CouponStateBadge state={r.state} /> }}
          />
        </>
      )}
    </div>
  );
}

function ReportTable({ title, rows, empty, first, extra }) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
      <div className="card__header">
        <h3 className="card__title">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="card__body muted">{empty}</div>
      ) : (
        <div className="data-table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{first.label}</th>
                {extra && <th>{extra.label}</th>}
                <th>Allocated / used</th>
                <th className="num">Confirmed</th>
                <th className="num">Cancelled</th>
                <th className="num">Checked in</th>
                <th className="num">Email ✓ / ✕</th>
                <th className="num">WhatsApp ✓ / ✕</th>
                <th>Registrations</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || 'legacy'}>
                  <td>{first.render(r)}</td>
                  {extra && <td>{extra.render(r)}</td>}
                  <td>
                    {r.allocated > 0 ? (
                      <UsageBar used={r.used} allocated={r.allocated} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">{r.confirmed}</td>
                  <td className="num">{r.cancelled}</td>
                  <td className="num">{r.checkedIn}</td>
                  <td className="num">
                    {r.emailSent} / {r.emailFailed}
                  </td>
                  <td className="num">
                    {r.whatsappSent} / {r.whatsappFailed}
                  </td>
                  <td
                    className="muted"
                    style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}
                  >
                    {r.firstRegistrationAt ? (
                      <>
                        {formatDateTime(r.firstRegistrationAt)}
                        <br />→ {formatDateTime(r.lastRegistrationAt)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, meta }) {
  return (
    <div className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">{value}</p>
      {meta && <p className="stat-tile__meta">{meta}</p>}
    </div>
  );
}
