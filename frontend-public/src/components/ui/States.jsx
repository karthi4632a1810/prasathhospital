import Button from './Button';
import './States.css';

/** Skeleton shown while the microsite payload loads. Mirrors the real layout
 *  so the page doesn't visibly jump when content arrives. */
export function LoadingState() {
  return (
    <div className="state-loading" role="status" aria-live="polite">
      <span className="visually-hidden">Loading event details…</span>
      <div className="skeleton-hero">
        <div className="container">
          <div className="skeleton skeleton--pill" style={{ width: 150 }} />
          <div className="skeleton skeleton--title" style={{ width: '70%' }} />
          <div className="skeleton skeleton--title" style={{ width: '45%' }} />
          <div className="skeleton skeleton--text" style={{ width: '55%' }} />
          <div className="skeleton-row">
            <div className="skeleton skeleton--btn" />
            <div className="skeleton skeleton--btn" />
          </div>
        </div>
      </div>
      <div className="container skeleton-body">
        {[0, 1, 2].map((i) => (
          <div className="skeleton skeleton--card" key={i} />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ title, message, onRetry }) {
  return (
    <div className="state-message" role="alert">
      <div className="state-message__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="40"
          height="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.2v.3" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="state-message__title">{title || 'Something went wrong'}</h1>
      <p className="state-message__text">
        {message || 'We could not load this event right now. Please try again in a moment.'}
      </p>
      <div className="state-message__actions">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant="secondary" href="/">
          Back to events
        </Button>
      </div>
    </div>
  );
}

export function NotFoundState({ message }) {
  return (
    <div className="state-message">
      <div className="state-message__icon state-message__icon--muted" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="40"
          height="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M3 7.5h18v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-12Z" />
          <path d="M3 7.5 5.5 3h13L21 7.5M12 11.5v5M9.5 14h5" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="state-message__title">Event not found</h1>
      <p className="state-message__text">
        {message || 'This event may have been moved, unpublished or the link may be incorrect.'}
      </p>
      <div className="state-message__actions">
        <Button variant="primary" href="/">
          Browse all events
        </Button>
      </div>
    </div>
  );
}
