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
          ×
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
            For Free PG Registration, Contact:
          </span>
          <span className="pg-modal-contact-phone">+91 96000 47646</span>
        </div>

        {/* Action buttons */}
        <div className="pg-modal-actions">
          <a
            href="tel:+919600047646"
            className="pg-modal-btn pg-modal-btn--primary"
          >
            📞 Call +91 96000 47646
          </a>

          <a
            href="https://wa.me/919600047646?text=Hello%2C%20I%20am%20a%20PG%20student%20and%20would%20like%20to%20claim%20the%20First%2050%20PG%20Free%20Registration%20offer%20for%20CIIM%202026."
            target="_blank"
            rel="noopener noreferrer"
            className="pg-modal-btn pg-modal-btn--secondary"
          >
            💬 WhatsApp for Free Pass
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
