import { useEffect, useState } from 'react';
import './ShareSheet.css';

/**
 * Sharing is a growth channel for these campaigns, so shared links carry a
 * `src` tag and the WhatsApp option comes first — it is how most delegates
 * pass events to colleagues.
 */
export default function ShareSheet({ event, open, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const url = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const shareUrl = `${url}?utm_source=share`;
  const text = `${event.title} — ${event.tagline || 'Organised by Prashanth Hospitals'}`;

  const targets = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${shareUrl}`)}`,
      className: 'share-option--whatsapp',
    },
    {
      key: 'email',
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(`${text}\n\n${shareUrl}`)}`,
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="share-scrim" onClick={onClose} role="presentation">
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Share this event"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-sheet__head">
          <h2 className="share-sheet__title">Share this event</h2>
          <button className="share-sheet__close" onClick={onClose} aria-label="Close">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="share-sheet__options">
          {targets.map((t) => (
            <a
              key={t.key}
              className={`share-option ${t.className || ''}`}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.label}
            </a>
          ))}
        </div>

        <div className="share-sheet__link">
          <input
            type="text"
            value={shareUrl}
            readOnly
            aria-label="Event link"
            onFocus={(e) => e.target.select()}
          />
          <button onClick={copyLink} className={copied ? 'is-copied' : ''}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
