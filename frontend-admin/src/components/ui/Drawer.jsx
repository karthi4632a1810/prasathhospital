import { useEffect, useRef } from 'react';
import './Drawer.css';

/**
 * Right-hand slide-over panel for detail views and forms. Closes on Escape
 * and on a backdrop click; focus moves into the panel when it opens.
 */
export default function Drawer({ open, title, subtitle, onClose, children, footer, width = 560 }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement;
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer" role="presentation">
      <button type="button" className="drawer__backdrop" aria-label="Close" onClick={onClose} />
      <section
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        style={{ '--drawer-width': `${width}px` }}
      >
        <header className="drawer__header">
          <div>
            <h3 className="drawer__title">{title}</h3>
            {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__footer">{footer}</footer>}
      </section>
    </div>
  );
}
