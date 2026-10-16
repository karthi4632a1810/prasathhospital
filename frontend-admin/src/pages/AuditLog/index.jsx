import { useCallback, useEffect, useState } from 'react';
import { auditLogApi } from '../../lib/auditLogApi';
import { formatDateTime } from '../../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/States';
import Badge from '../../components/ui/Badge';

const VERB_TONE = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  cancel: 'warning',
  checkin: 'success',
  resendTicket: 'info',
};

function toneFor(action) {
  const verb = action.split('.').pop();
  return VERB_TONE[verb] || 'neutral';
}

export default function AuditLog() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    auditLogApi
      .list({ limit: 100 })
      .then((res) => setResult(res))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (result === null) return <LoadingState label="Loading audit log…" />;

  const entries = result.data || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Audit Log</h2>
          <p className="page-header__subtitle">
            {result.meta
              ? `${result.meta.total} events`
              : 'Who did what, across the whole admin dashboard.'}
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No activity yet"
          message="Admin actions (creating events, editing passes, cancelling registrations, etc.) will appear here."
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</td>
                  <td>{e.actorName}</td>
                  <td>
                    <Badge tone={toneFor(e.action)} size="sm">
                      {e.action}
                    </Badge>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
                    {e.entityType}
                    {e.entityId ? ` #${String(e.entityId).slice(-6)}` : ''}
                  </td>
                  <td
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', maxWidth: 320 }}
                  >
                    {e.meta ? JSON.stringify(e.meta) : '—'}
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
