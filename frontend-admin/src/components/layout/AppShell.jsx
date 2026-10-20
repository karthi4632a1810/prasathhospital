import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import './AppShell.css';

// Roles that run day-to-day operations. Check-in staff only get the
// dashboard numbers and the scanner (enforced again on every API route).
export const OPS_ROLES = ['superadmin', 'manager'];

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: IconGrid, end: true }],
  },
  {
    label: 'Content',
    items: [
      { to: '/event', label: 'Event CMS', icon: IconEdit, roles: OPS_ROLES },
      { to: '/ticket-types', label: 'Passes', icon: IconTicket, roles: OPS_ROLES },
    ],
  },
  {
    label: 'Registrations',
    items: [
      { to: '/registrations', label: 'Registrations', icon: IconUsers, roles: OPS_ROLES },
      { to: '/companies', label: 'Companies', icon: IconBuilding, roles: OPS_ROLES },
      { to: '/coupons', label: 'Coupons', icon: IconTag, roles: OPS_ROLES },
    ],
  },
  {
    label: 'Event day',
    items: [
      { to: '/checkin', label: 'Check-in', icon: IconScan },
      { to: '/feedback', label: 'Feedback', icon: IconStar, roles: OPS_ROLES },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', label: 'Reports', icon: IconChart, roles: OPS_ROLES }],
  },
  {
    label: 'System',
    items: [
      { to: '/users', label: 'Users & roles', icon: IconShield, roles: ['superadmin'] },
      { to: '/audit-log', label: 'Audit log', icon: IconClock, roles: ['superadmin'] },
      { to: '/help', label: 'Help', icon: IconHelp },
    ],
  },
];

function pageTitle(pathname) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.end ? pathname === item.to : pathname.startsWith(item.to)) return item.label;
    }
  }
  return 'Admin';
}

export default function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="shell">
      <button
        type="button"
        className="shell__scrim"
        aria-hidden={!navOpen}
        data-open={navOpen}
        onClick={() => setNavOpen(false)}
      />

      <aside className="shell__sidebar" data-open={navOpen}>
        <div className="shell__brand">
          <span className="shell__brand-mark">
            <img src="/assets/pf-new-logo.png" alt="Prashanth Fertility" width="26" height="26" />
          </span>
          <span className="shell__brand-text">
            Prashanth Fertility
            <small>Events Admin</small>
          </span>
        </div>

        <nav className="shell__nav">
          {NAV_GROUPS.filter((group) =>
            group.items.some((item) => !item.roles || item.roles.includes(user?.role))
          ).map((group) => (
            <div className="shell__nav-group" key={group.label}>
              <p className="shell__nav-label">{group.label}</p>
              {group.items
                .filter((item) => !item.roles || item.roles.includes(user?.role))
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `shell__nav-link${isActive ? ' is-active' : ''}`}
                    onClick={() => setNavOpen(false)}
                  >
                    <item.icon />
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="shell__main">
        <header className="shell__topbar">
          <button
            type="button"
            className="shell__nav-toggle"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <IconMenu />
          </button>
          <h1 className="shell__page-title">{pageTitle(location.pathname)}</h1>

          <div className="shell__user">
            <div className="shell__user-info">
              <span className="shell__user-name">{user?.name}</span>
              <span className="shell__user-role">{user?.role?.replace('_', ' ')}</span>
            </div>
            <div className="shell__user-avatar" aria-hidden="true">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <button type="button" className="shell__signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="shell__content">{children}</main>
      </div>
    </div>
  );
}

/* ---------- Inline icon set (no icon-library dependency) ---------- */

function IconGrid() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 20h9" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconTicket() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M9 6v12" strokeDasharray="2 3" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m20.5 12.5-8 8a1.5 1.5 0 0 1-2.1 0L3.5 13.6a1.5 1.5 0 0 1 0-2.1l8-8H18a2.5 2.5 0 0 1 2.5 2.5Z" />
      <circle cx="15.5" cy="8.5" r="1.25" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 4.8a3.2 3.2 0 0 1 0 6.2M18.5 20a5 5 0 0 0-4-5.4" strokeLinecap="round" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 20.5V5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 15 5v15.5M15 9.5h3.5A1.5 1.5 0 0 1 20 11v9.5M2.5 20.5h19" />
      <path d="M7.5 7.5h4M7.5 11h4M7.5 14.5h4" strokeLinecap="round" />
    </svg>
  );
}
function IconScan() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
        strokeLinecap="round"
      />
      <path d="M4 12h16" strokeLinecap="round" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 3.5 14.7 9l6 .9-4.4 4.2 1 6-5.3-2.8L6.7 20l1-6L3.3 9.9l6-.9Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChart() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" />
    </svg>
  );
}
function IconHelp() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.5 2.2c-.9.5-1.2 1-1.2 1.9" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" strokeLinecap="round" />
    </svg>
  );
}
