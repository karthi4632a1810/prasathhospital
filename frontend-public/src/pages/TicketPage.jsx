import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { LoadingState, ErrorState, NotFoundState } from '../components/ui/States';

import { api } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import './TicketPage.css';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export default function TicketPage() {
  const { qrToken } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState({ status: 'loading', data: null, error: null });
    api
      .getTicket(qrToken)
      .then((res) => setState({ status: 'ready', data: res.data, error: null }))
      .catch((err) =>
        setState({ status: err.status === 404 ? 'not-found' : 'error', data: null, error: err })
      );
  }, [qrToken]);

  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'not-found') {
    return <NotFoundState message="This ticket link is invalid or has expired." />;
  }
  if (state.status === 'error') {
    return (
      <ErrorState
        message={state.error?.message}
        onRetry={() => setState({ status: 'loading', data: null, error: null })}
      />
    );
  }

  const ticket = state.data;
  const qrImageUrl = `${BASE_URL}/api/v1/tickets/${qrToken}/qr.png`;
  const pdfUrl = `${BASE_URL}/api/v1/tickets/${qrToken}/pdf`;
  const certificateUrl = `${BASE_URL}/api/v1/tickets/${qrToken}/certificate.pdf`;
  const eventCompleted = ticket.event?.status === 'completed';
  const isCancelled = ticket.status !== 'confirmed';
  const eventSlug = ticket.event?.slug || 'fertility-gynaecology-summit-2026';

  const handleCopyCode = () => {
    if (!ticket?.registrationCode) return;
    navigator.clipboard?.writeText(ticket.registrationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      <SiteHeader event={ticket.event} canRegister={false} availableSections={[]} />
      <main id="main" className="ticket-page">
        <div className="container ticket-page__wrapper">
          {/* Top Live Badge & Navigation */}
          <div className="ticket-top-bar">
            <Link to={`/events/${eventSlug}`} className="ticket-back-link">
              ← Back to {ticket.event.title}
            </Link>
            <div className="ticket-live-pill">
              <span className="ticket-live-dot" />
              <span>Digital Delegate Pass • Live Access Card</span>
            </div>
          </div>

          {/* The Hero VIP Boarding Pass Card */}
          <div className="vip-pass-card">
            {/* Card Brand Header */}
            <div className="vip-pass-card__top">
              <div className="vip-pass-card__brand">
                <span className="vip-pass-card__brand-title">PRASHANTH FERTILITY &amp; RESEARCH CENTRE</span>
                <span className="vip-pass-card__brand-subtitle">IN ASSOCIATION WITH TAPISAR • CIIM 2026</span>
              </div>
              <span className="vip-pass-card__vip-chip">
                ★ OFFICIAL DIGITAL PASS
              </span>
            </div>

            {/* Event Info Bar */}
            <div className="vip-pass-card__event-bar">
              <div className="vip-pass-card__event-main">
                <span className="vip-pass-card__event-kicker">Conference Pass</span>
                <h1 className="vip-pass-card__event-title">{ticket.event.title}</h1>
              </div>
              <div className="vip-pass-card__event-meta">
                <div className="vip-pass-card__meta-pill">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>
                    {formatDate(ticket.event.startDate)} · {formatTime(ticket.event.startDate)}
                  </span>
                </div>
                {ticket.event.venue?.name && (
                  <div className="vip-pass-card__meta-pill">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{ticket.event.venue.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Perforation Cutouts Divider */}
            <div className="vip-pass-card__perforation">
              <span className="vip-pass-card__notch vip-pass-card__notch--left" />
              <span className="vip-pass-card__dashed-line" />
              <span className="vip-pass-card__notch vip-pass-card__notch--right" />
            </div>

            {/* Card Main Body */}
            <div className="vip-pass-card__body">
              {/* Left Column: Delegate Details */}
              <div className="vip-pass-card__delegate">
                <div className="vip-pass-card__category-badge">{ticket.ticketType?.name || 'Delegate Pass'}</div>

                <h2 className="vip-pass-card__attendee-name">{ticket.attendee.name}</h2>

                {ticket.attendee.medicalCouncilRegNo && (
                  <div className="vip-pass-card__reg-chip">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M19 10.5V6a2 2 0 0 0-2-2h-3V2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2H5a2 2 0 0 0-2 2v4.5A5.5 5.5 0 0 0 8.5 16h.7A5.5 5.5 0 0 0 14 19.92V22a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.08A5.5 5.5 0 0 0 22 14.5a5.5 5.5 0 0 0-3-4zM10 4V2h2v2h-2zm-1.5 10A3.5 3.5 0 0 1 5 10.5V6h3.5v8z" />
                    </svg>
                    <span>
                      Medical Council Reg: <strong>{ticket.attendee.medicalCouncilRegNo}</strong>
                    </span>
                    <span className="vip-pass-card__cme-tag">6 CME Points</span>
                  </div>
                )}

                <div className="vip-pass-card__details-grid">
                  <div className="vip-pass-card__detail-cell">
                    <span className="vip-pass-card__detail-label">Registration ID</span>
                    <div className="vip-pass-card__id-row">
                      <span className="vip-pass-card__detail-val vip-pass-card__detail-val--mono">
                        {ticket.registrationCode}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className={`vip-pass-card__copy-btn ${copied ? 'is-copied' : ''}`}
                        title="Copy Registration ID"
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {ticket.company?.name && (
                    <div className="vip-pass-card__detail-cell">
                      <span className="vip-pass-card__detail-label">Sponsoring Organization</span>
                      <span className="vip-pass-card__detail-val">{ticket.company.name}</span>
                    </div>
                  )}

                  {ticket.couponCode && (
                    <div className="vip-pass-card__detail-cell">
                      <span className="vip-pass-card__detail-label">Coupon / Pass Code</span>
                      <span className="vip-pass-card__detail-val vip-pass-card__detail-val--coupon">
                        {ticket.couponCode}
                      </span>
                    </div>
                  )}

                  {ticket.attendee.email && (
                    <div className="vip-pass-card__detail-cell">
                      <span className="vip-pass-card__detail-label">Registered Email</span>
                      <span className="vip-pass-card__detail-val vip-pass-card__detail-val--sm">
                        {ticket.attendee.email}
                      </span>
                    </div>
                  )}
                </div>

                <div className="vip-pass-card__status-badges">
                  {isCancelled ? (
                    <span className="vip-status-pill vip-status-pill--void">✕ Void / Cancelled</span>
                  ) : (
                    <span className="vip-status-pill vip-status-pill--confirmed">● Confirmed</span>
                  )}
                  {!isCancelled &&
                    (ticket.checkedInAt ? (
                      <span className="vip-status-pill vip-status-pill--checkedin">✓ Checked In</span>
                    ) : (
                      <span className="vip-status-pill vip-status-pill--waiting">⏳ Awaiting Check-In</span>
                    ))}
                </div>
              </div>

              {/* Right Column: QR Viewfinder Box */}
              <div className="vip-pass-card__qr-col">
                <div className={`vip-pass-card__qr-container ${isCancelled ? 'is-void' : ''}`}>
                  <span className="qr-corner qr-corner--tl" />
                  <span className="qr-corner qr-corner--tr" />
                  <span className="qr-corner qr-corner--bl" />
                  <span className="qr-corner qr-corner--br" />
                  <img
                    src={qrImageUrl}
                    alt="Ticket QR code"
                    width={160}
                    height={160}
                    className="vip-pass-card__qr-img"
                  />
                </div>
                <p className="vip-pass-card__qr-note">
                  {isCancelled ? 'Ticket has been cancelled' : 'Present this at registration desk'}
                </p>
                <span className="vip-pass-card__qr-code-text">{ticket.registrationCode}</span>
              </div>
            </div>

            {/* Card Actions Footer */}
            <div className="vip-pass-card__footer">
              <div className="vip-pass-card__actions">
                {!isCancelled && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vip-btn vip-btn--primary"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Download PDF Ticket</span>
                  </a>
                )}

                {eventCompleted && !isCancelled && (
                  <a
                    href={certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vip-btn vip-btn--gold"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="8" r="7" />
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                    </svg>
                    <span>Download CME Certificate</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="vip-btn vip-btn--ghost"
                  title="Print Digital Ticket"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span>Print Pass</span>
                </button>

                <Link to={`/feedback/${qrToken}`} className="vip-btn vip-btn--ghost">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>Give Feedback</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Venue & Check-In Guide Card */}
          <div className="ticket-venue-card">
            <div className="ticket-venue-card__header">
              <span className="ticket-venue-card__pin" aria-hidden="true">
                📍
              </span>
              <div>
                <h3 className="ticket-venue-card__title">The Leela Palace, Chennai</h3>
                <p className="ticket-venue-card__address">
                  Adyar Seaface, MRC Nagar, Raja Annamalai Puram, Chennai, Tamil Nadu 600028
                </p>
              </div>
            </div>

            <div className="ticket-venue-card__tips">
              <div className="ticket-venue-card__tip">
                <span className="ticket-venue-card__badge-num">1</span>
                <span>Keep this digital pass open on your phone or carry the downloaded PDF ticket.</span>
              </div>
              <div className="ticket-venue-card__tip">
                <span className="ticket-venue-card__badge-num">2</span>
                <span>
                  Proceed to <strong>Counter A</strong> for fast-track QR scanning and physical badge printing.
                </span>
              </div>
              <div className="ticket-venue-card__tip">
                <span className="ticket-venue-card__badge-num">3</span>
                <span>Registration desk opens at <strong>07:30 AM</strong> on Friday, 21 November 2026.</span>
              </div>
            </div>
          </div>

          {/* Need Help / Support Footer */}
          <div className="ticket-support-bar">
            <span>Need assistance with your pass?</span>
            <a href="tel:+919600047646" className="ticket-support-link">
              📞 +91 96000 47646
            </a>
            <span className="ticket-support-sep">•</span>
            <a href="mailto:infociim@pfrcivf.com" className="ticket-support-link">
              ✉ infociim@pfrcivf.com
            </a>
          </div>
        </div>
      </main>
      <SiteFooter event={ticket.event} />
    </>
  );
}
