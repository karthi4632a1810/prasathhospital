import { useEffect, useState, useRef } from 'react';
import Button from '../components/ui/Button';
import Badge, { RegistrationStateBadge } from '../components/ui/Badge';
import { formatDateRange, formatDate, getCountdown } from '../lib/format';
import HeroHelix3D from './HeroHelix3D';
import './Hero.css';

function AnimatedStatCounter({ value }) {
  const match = String(value).match(/^(\D*)(\d+)(\D*)$/);
  if (!match) return <span>{value}</span>;

  const prefix = match[1] || '';
  const target = parseInt(match[2], 10);
  const suffix = match[3] || '';

  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let startTimestamp = null;
    const duration = 1600;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(easeProgress * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [hasStarted, target]);

  return (
    <span ref={ref}>
      {prefix}
      {hasStarted ? count : 0}
      {suffix}
    </span>
  );
}

const MODE_LABEL = {
  'in-person': 'In person',
  virtual: 'Online',
  hybrid: 'Hybrid',
};

const CATEGORY_LABEL = {
  cme: 'CME Programme',
  conference: 'Conference',
  workshop: 'Workshop',
  'awareness-camp': 'Awareness Camp',
  'public-seminar': 'Public Seminar',
  other: 'Event',
};

function Countdown({ target }) {
  const [remaining, setRemaining] = useState(() => getCountdown(target));

  useEffect(() => {
    setRemaining(getCountdown(target));
    const timer = setInterval(() => setRemaining(getCountdown(target)), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!remaining) return null;

  const units = [
    { value: remaining.days, label: remaining.days === 1 ? 'Day' : 'Days' },
    { value: remaining.hours, label: remaining.hours === 1 ? 'Hour' : 'Hours' },
    { value: remaining.minutes, label: 'Min' },
    { value: remaining.seconds, label: 'Sec' },
  ];

  return (
    <div className="hero__countdown" role="timer" aria-label="Time remaining until the event">
      {units.map((u) => (
        <div className="hero__countdown-unit" key={u.label}>
          <span className="hero__countdown-value">{String(u.value).padStart(2, '0')}</span>
          <span className="hero__countdown-label">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Hero({ event, onRegister, canRegister, onShare }) {
  const { venue, theme } = event;
  const heroSettings = event.heroSettings || {};
  const showCountdown = heroSettings.showCountdown !== false;
  const showStats = heroSettings.showStats !== false;
  const showLiveBadge = heroSettings.showLiveBadge !== false;
  const liveBadgeText = heroSettings.liveBadgeText || 'Live Tele-Robotic Surgery';
  const showShareButton = heroSettings.showShareButton !== false;
  const ctaText = heroSettings.ctaText || 'Register Now';

  const heroStyle = theme?.heroImageUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(16,21,43,0.92), rgba(61,16,13,0.82)), url(${theme.heroImageUrl})`,
      }
    : undefined;

  const locationLine =
    event.mode === 'virtual'
      ? 'Online — joining link shared on registration'
      : [venue?.name, venue?.city].filter(Boolean).join(', ') || 'Venue to be announced';

  // Headline numbers, all derived from real event data — nothing invented.
  const days =
    event.startDate && event.endDate
      ? Math.round(
          (new Date(event.endDate).setHours(0, 0, 0, 0) -
            new Date(event.startDate).setHours(0, 0, 0, 0)) /
            86400000
        ) + 1
      : 0;
  const facultyCount = (event.speakers?.length || 0) + (event.committee?.length || 0);
  const stats = [
    event.capacity > 0 && { value: `${event.capacity}+`, label: 'Delegates' },
    days > 0 && { value: String(days), label: days === 1 ? 'Day' : 'Days' },
    facultyCount > 0 && { value: String(facultyCount), label: 'Faculty & committee' },
  ].filter(Boolean);

  // A trailing year in the title ("CIIM 2026") gets its own gradient.
  const titleMatch = /^(.*?)\s*(\d{4})$/.exec(event.title || '');

  return (
    <section className="hero" id="top" style={heroStyle}>
      <div className="hero__glow" aria-hidden="true" />
      <HeroHelix3D />

      <div className="container hero__inner">
        {/* Organizer association lead pill (Prashanth logo in sticky header above) */}
        <div className="hero__organizer-lead">
          <span className="hero__org-bridge">In association with</span>

          <div className="hero__org-brand">
            <img
              src="/assets/tapisar-logo.png"
              alt="TAPISAR Logo"
              className="hero__org-logo hero__org-logo--tapisar"
            />
            <div className="hero__tapisar-info">
              <span className="hero__org-name hero__org-name--tapisar">TAPISAR</span>
              <span className="hero__org-sub">Tamil Nadu &amp; Pondicherry Chapter of ISAR</span>
            </div>
          </div>
        </div>

        {/* 2. Historic breakthrough pill */}
        <div className="hero__era-pill">
          <span className="hero__era-tag">HISTORIC FIRST</span>
          <span className="hero__era-text">Infertility Care Enters a New Surgical Era</span>
        </div>

        {/* 3. MANDATED HERO ORDER: [CIIM Logo] CIIM 2026 (Centered Below) */}
        <div className="hero__ciim-block">
          <div className="hero__ciim-head">
            <img
              src="/assets/ciim-2026-logo.png"
              alt="CIIM 2026 Logo"
              className="hero__ciim-logo"
            />
            <h1 className="hero__title">
              CIIM <span className="hero__title-year">2026</span>
            </h1>
          </div>
          <p className="hero__fullname">CONTROVERSIES IN INFERTILITY MANAGEMENT</p>
          <p className="hero__theme-quote">
            Theme: &ldquo;Breaking Boundaries, Elevating Surgical Precision &amp; ART Outcomes&rdquo;
          </p>
        </div>

        {event.tagline && event.tagline !== 'Breaking Boundaries, Elevating Surgical Precision & ART Outcomes' && (
          <p className="hero__tagline">{event.tagline}</p>
        )}

        <dl className="hero__facts">
          <div className="hero__fact">
            <dt>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
              </svg>
              <span className="visually-hidden">Date and time</span>
            </dt>
            <dd>
              <span className="hero__fact-label">DATES</span>
              <strong>{formatDateRange(event.startDate, event.endDate)}</strong>
            </dd>
          </div>

          <div className="hero__fact">
            <dt>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span className="visually-hidden">Location</span>
            </dt>
            <dd>
              <span className="hero__fact-label">VENUE</span>
              <strong>{locationLine}</strong>
            </dd>
          </div>

          <div className="hero__fact">
            <dt>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="visually-hidden">Conference Highlights</span>
            </dt>
            <dd>
              <span className="hero__fact-label">CONFERENCE HIGHLIGHTS</span>
              <strong>Live Tele-Robotic Surgery</strong>
            </dd>
          </div>
        </dl>

        {showCountdown && <Countdown target={event.startDate} />}

        <div className="hero__actions">
          {canRegister ? (
            <Button variant="accent" size="lg" onClick={onRegister}>
              {ctaText}
            </Button>
          ) : (
            <Button variant="outline-light" size="lg" disabled>
              {event.registrationState === 'sold-out' ? 'Sold Out' : 'Registration Closed'}
            </Button>
          )}

          {showShareButton && (
            <Button
              variant="outline-light"
              size="lg"
              onClick={onShare}
              iconLeft={
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" />
                </svg>
              }
            >
              Share
            </Button>
          )}
        </div>

        {showStats && stats.length > 0 && (
          <dl className="hero__stats">
            {stats.map((s) => (
              <div className="hero__stat" key={s.label}>
                <dt className="hero__stat-label">{s.label}</dt>
                <dd className="hero__stat-value">
                  <AnimatedStatCounter value={s.value} />
                </dd>
              </div>
            ))}
          </dl>
        )}

        {event.registrationClosesAt && event.registrationState === 'open' && (
          <p className="hero__deadline">
            Registration closes on{' '}
            {formatDate(event.registrationClosesAt, { weekday: 'short', month: 'short' })}
          </p>
        )}
      </div>
    </section>
  );
}
