import { useEffect, useCallback, useId } from 'react';
import './PgOfferModal.css';

/**
 * PgOfferModal
 * Auto-opens on page load and announces the "First 50 PGs Free Registration"
 * offer for CIIM 2026. Triggered from EventMicrosite.
 *
 * Props:
 *   open    {boolean}   — controlled open state
 *   onClose {function}  — called when user dismisses
 */
export default function PgOfferModal({ open, onClose }) {
  const titleId = useId();

  /* Lock body scroll while open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Escape key closes modal */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  /* Backdrop click closes modal */
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="pg-modal-backdrop"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="pg-modal-card">
        {/* Close × button */}
        <button
          className="pg-modal-close"
          aria-label="Close promotional offer"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Top badge */}
        <div className="pg-modal-badge" aria-hidden="true">
          🎓 EARLY BIRD / FREE BIRD OFFER • PGs ONLY
        </div>

        {/* Headline */}
        <h2 className="pg-modal-headline" id={titleId}>
          Free Registration for the First 50 PG Students!
        </h2>

        {/* Description */}
        <p className="pg-modal-desc">
          Special complimentary conference passes exclusively for the first 50
          Postgraduate (PG) Students &amp; Residents registering for CIIM 2026.
        </p>

        {/* Contact callout */}
        <div className="pg-modal-contact">
          <span className="pg-modal-contact-label">
            For Free PG Registration, Contact
          </span>
          <a
            href="tel:+919600047646"
            className="pg-modal-contact-phone"
            title="Click to call"
          >
            +91 96000 47646
          </a>
        </div>

        {/* Action buttons */}
        <div className="pg-modal-actions">
          <a
            href="tel:+919600047646"
            className="pg-modal-btn pg-modal-btn--primary"
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="currentColor"
              className="pg-modal-btn-icon"
              aria-hidden="true"
            >
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
            <span>Call +91 96000 47646</span>
          </a>

          <a
            href="https://wa.me/919600047646?text=Hello%2C%20I%20am%20a%20PG%20student%20and%20would%20like%20to%20claim%20the%20First%2050%20PG%20Free%20Registration%20offer%20for%20CIIM%202026."
            target="_blank"
            rel="noopener noreferrer"
            className="pg-modal-btn pg-modal-btn--secondary"
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="currentColor"
              className="pg-modal-btn-icon"
              aria-hidden="true"
            >
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.78 14.04c-.24.68-1.4 1.25-1.92 1.33-.5.08-1.14.12-3.32-.78-2.6-1.07-4.24-3.73-4.37-3.9-.13-.18-1.04-1.38-1.04-2.64 0-1.25.66-1.87.89-2.12.24-.26.52-.32.69-.32.18 0 .35 0 .5.01.16.01.38-.06.59.45.22.52.74 1.8.8 1.93.07.13.11.29.02.47-.08.18-.13.29-.26.44-.13.16-.27.35-.39.47-.13.13-.26.27-.11.53.15.26.67 1.1 1.44 1.78.99.88 1.83 1.15 2.09 1.28.26.13.41.11.56-.06.16-.18.66-.77.84-1.03.18-.26.35-.22.59-.13.24.09 1.54.73 1.8.86.26.13.44.19.5.3.07.11.07.65-.17 1.33z" />
            </svg>
            <span>WhatsApp for Free Pass</span>
          </a>
        </div>

        {/* Dismiss link */}
        <button className="pg-modal-dismiss" onClick={onClose}>
          Continue to Website
        </button>
      </div>
    </div>
  );
}
