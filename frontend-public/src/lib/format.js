/* Formatting helpers. All dates render in the event's timezone (IST by
   default) so a delegate in another zone still sees the local start time. */

const TZ = 'Asia/Kolkata';

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, opts = {}) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: opts.weekday ?? 'long',
    day: 'numeric',
    month: opts.month ?? 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(d);
}

export function formatShortDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(d);
}

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  }).format(d);
}

/** "Fri, 6 Nov 2026 · 8:30 AM – 5:30 PM" — collapses same-day ranges. */
export function formatDateRange(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s) return '';
  if (!e) return formatDate(s);

  const sameDay =
    new Intl.DateTimeFormat('en-IN', { dateStyle: 'short', timeZone: TZ }).format(s) ===
    new Intl.DateTimeFormat('en-IN', { dateStyle: 'short', timeZone: TZ }).format(e);

  if (sameDay) {
    return `${formatDate(s, { weekday: 'short', month: 'short' })} · ${formatTime(s)} – ${formatTime(e)}`;
  }
  return `${formatShortDate(s)} – ${formatShortDate(e)}`;
}

/** Converts "14:30" to "2:30 PM" for agenda rows. */
export function formatClock(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatCurrency(amount, currency = 'INR') {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

/** Days/hours/minutes remaining until a target date; null once it has passed. */
export function getCountdown(target) {
  const d = toDate(target);
  if (!d) return null;
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export function buildAddress(venue) {
  if (!venue) return '';
  return [
    venue.addressLine1,
    venue.addressLine2,
    venue.city,
    venue.state && venue.pincode ? `${venue.state} ${venue.pincode}` : venue.state || venue.pincode,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Exact rupee amount with paise — "₹2,950.00", "₹0.00". Used where "Free" would hide the maths. */
export function formatAmount(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}
