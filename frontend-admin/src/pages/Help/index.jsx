import { useAuth } from '../../lib/auth';

const TASKS = [
  {
    title: 'Set up a sponsoring company',
    body: 'Companies → "Add company". Then Coupons → "New coupon", pick the company, set the code and how many delegates it covers.',
    to: '/companies',
    roles: ['superadmin', 'manager'],
  },
  {
    title: 'Stop a coupon from being used',
    body: 'Coupons → "Deactivate". It stops working immediately; registrations already made with it are kept. Deactivating a company stops all of its coupons.',
    to: '/coupons',
    roles: ['superadmin', 'manager'],
  },
  {
    title: 'Find a specific attendee',
    body: 'Registrations → search matches name, email, mobile, registration ID or coupon code. Filter by company, coupon, status or delivery status.',
    to: '/registrations',
    roles: ['superadmin', 'manager'],
  },
  {
    title: "Resend someone's ticket",
    body: 'Registrations → open the row → Delivery → "Resend email" or "Retry WhatsApp". Every attempt and its error is listed under Delivery attempts.',
    to: '/registrations',
    roles: ['superadmin', 'manager'],
  },
  {
    title: 'Cancel a registration',
    body: 'Registrations → open the row → "Cancel this registration…" with a reason. The QR stops working and the coupon place goes back to the company.',
    to: '/registrations',
    roles: ['superadmin', 'manager'],
  },
  {
    title: 'Check someone in without scanning',
    body: 'Check-in → paste their QR token or ticket link into the manual-entry box.',
    to: '/checkin',
  },
  {
    title: 'Add or reset an admin user',
    body: 'Users & roles → create a new account, or use the 🔑 icon to reset a password. checkin_staff accounts only see the Dashboard and Check-in.',
    to: '/users',
    roles: ['superadmin'],
  },
  {
    title: 'See who changed what',
    body: 'Audit Log lists every admin action — coupon changes, cancellations, delivery retries, exports — with who and when.',
    to: '/audit-log',
    roles: ['superadmin'],
  },
];

const TROUBLESHOOTING = [
  {
    q: 'Email or WhatsApp shows "Not configured"',
    a: 'The server has no SMTP settings (email) or WhatsApp API credentials yet. Registrations still succeed and the attendee sees their QR on screen. Once credentials are added, use "Send email" / "Retry WhatsApp" on each registration.',
  },
  {
    q: 'WhatsApp shows "Failed"',
    a: 'Open the registration and read the error under Delivery attempts. A wrong number or an unapproved message template needs fixing first; "Retry" status means a temporary error — try again shortly.',
  },
  {
    q: 'A delegate says their coupon is "not valid"',
    a: 'Check Coupons: the code may be inactive, expired, not started yet, fully used, or its company deactivated. Codes are not case-sensitive.',
  },
  {
    q: '"This email address is already registered"',
    a: 'Each email can hold one active registration per event. Find the existing one in Registrations and resend the ticket, or cancel it first if it was a mistake.',
  },
];

export default function Help() {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Help</h2>
          <p className="page-header__subtitle">
            Quick answers for common tasks. For anything not covered here, see{' '}
            <code>docs/SUPPORT.md</code> in the repository, or contact a developer.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card__header"><h3 className="card__title">Common tasks</h3></div>
        <div className="card__body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {TASKS.filter((t) => !t.roles || t.roles.includes(user?.role)).map((task) => (
            <a
              key={task.title}
              href={task.to}
              style={{
                display: 'block',
                padding: 'var(--space-4)',
                border: '1px solid var(--ink-200)',
                borderRadius: 'var(--radius-md)',
                color: 'inherit',
              }}
            >
              <strong style={{ display: 'block', color: 'var(--ink-900)', marginBottom: 4 }}>{task.title}</strong>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>{task.body}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__header"><h3 className="card__title">Troubleshooting</h3></div>
        <div className="card__body" style={{ display: 'grid', gap: 'var(--space-5)' }}>
          {TROUBLESHOOTING.map((item) => (
            <div key={item.q}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--ink-900)' }}>{item.q}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink-600)' }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
