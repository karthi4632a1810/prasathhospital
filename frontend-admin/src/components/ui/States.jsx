import Button from './Button';
import './States.css';

/** Small inline spinner used inside buttons/tables while a request is in flight. */
export function Spinner({ size = 18 }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Full-panel loading state for a page/table that hasn't returned data yet. */
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <Spinner size={28} />
      <p className="state-panel__text">{label}</p>
    </div>
  );
}

export function ErrorState({ title, message, onRetry }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <div className="state-panel__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.2v.3" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="state-panel__title">{title || 'Something went wrong'}</h2>
      <p className="state-panel__text">
        {message || 'We could not load this. Please try again in a moment.'}
      </p>
      {onRetry && (
        <Button variant="primary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="state-panel state-panel--empty">
      <h2 className="state-panel__title">{title || 'Nothing here yet'}</h2>
      {message && <p className="state-panel__text">{message}</p>}
      {action}
    </div>
  );
}

export function NotFoundState({ message }) {
  return (
    <div className="state-panel">
      <h2 className="state-panel__title">Not found</h2>
      <p className="state-panel__text">{message || 'This page does not exist.'}</p>
      <Button variant="primary" size="sm" href="/">
        Back to dashboard
      </Button>
    </div>
  );
}
