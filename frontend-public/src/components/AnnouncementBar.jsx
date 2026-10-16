import { useState } from 'react';
import './AnnouncementBar.css';

/** Shows CMS-managed announcements (Module 2) above the header. Dismissal is
 *  per-render — announcements are short-lived and re-appear on a fresh visit. */
export default function AnnouncementBar({ announcements }) {
  const [dismissed, setDismissed] = useState([]);
  const visible = (announcements || []).filter((a) => !dismissed.includes(a.id));

  if (!visible.length) return null;

  const current = visible[0];

  return (
    <div className={`announcement announcement--${current.level}`} role="status">
      <div className="container announcement__inner">
        <span className="announcement__icon" aria-hidden="true">
          {current.level === 'warning' ? (
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5M12 15.8v.2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M4 9.5h3.5L13 5.5v13L7.5 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"
                strokeLinejoin="round"
              />
              <path d="M17 9.5a4 4 0 0 1 0 5" strokeLinecap="round" />
            </svg>
          )}
        </span>

        <p className="announcement__text">{current.message}</p>

        <button
          className="announcement__close"
          aria-label="Dismiss announcement"
          onClick={() => setDismissed((d) => [...d, current.id])}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
