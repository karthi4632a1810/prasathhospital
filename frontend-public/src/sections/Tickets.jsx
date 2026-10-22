import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatShortDate } from '../lib/format';
import { useTilt } from '../lib/useTilt';
import './Tickets.css';

const KIND_META = {
  vip: { tone: 'accent', label: 'Premium' },
  couple: { tone: 'brand', label: 'Best value' },
  free: { tone: 'success', label: 'Free' },
  complimentary: { tone: 'success', label: 'Invitation' },
  paid: { tone: null, label: null },
};

function saleNotice(ticket) {
  switch (ticket.saleState) {
    case 'sold-out':
      return { text: 'Sold out', tone: 'danger' };
    case 'closed':
      return { text: 'Sales closed', tone: 'neutral' };
    case 'not-yet-open':
      return {
        text: ticket.salesStartAt
          ? `Opens ${formatShortDate(ticket.salesStartAt)}`
          : 'Opening soon',
        tone: 'info',
      };
    case 'inactive':
      return { text: 'Unavailable', tone: 'neutral' };
    default:
      return ticket.isLowStock ? { text: 'Only a few left', tone: 'warning' } : null;
  }
}

function TicketCard({ ticket, onSelect, canRegister }) {
  const meta = KIND_META[ticket.kind] || KIND_META.paid;
  const notice = saleNotice(ticket);
  const isAvailable = ticket.saleState === 'on-sale' && canRegister;
  const featured = ticket.kind === 'vip';
  const tilt = useTilt({ max: 9, scale: 1.02 });

  return (
    <article
      ref={tilt.ref}
      onMouseEnter={tilt.onMouseEnter}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      className={`ticket ${featured ? 'ticket--featured' : ''} ${!isAvailable ? 'is-unavailable' : ''}`}
    >
      {meta.label && (
        <span className={`ticket__ribbon ticket__ribbon--${meta.tone}`}>{meta.label}</span>
      )}

      <header className="ticket__head">
        <h3 className="ticket__name">{ticket.name}</h3>
        {ticket.description && <p className="ticket__desc">{ticket.description}</p>}
      </header>

      <div className="ticket__price">
        {ticket.isFree ? (
          <span className="ticket__amount">Free</span>
        ) : (
          <span className="ticket__amount">{formatCurrency(ticket.price, ticket.currency)}</span>
        )}
        {ticket.admitsCount > 1 && (
          <span className="ticket__admits">Admits {ticket.admitsCount} delegates</span>
        )}
      </div>

      {ticket.benefits?.length > 0 && (
        <ul className="ticket__benefits">
          {ticket.benefits.map((b) => (
            <li key={b}>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="ticket__foot">
        {notice && (
          <Badge tone={notice.tone} size="sm" className="ticket__notice">
            {notice.text}
          </Badge>
        )}

        {ticket.allowedParticipantTypes?.length > 0 && (
          <p className="ticket__restriction">
            For {ticket.allowedParticipantTypes.join(' / ')} only — ID required at check-in.
          </p>
        )}

        <Button
          variant={featured ? 'accent' : 'primary'}
          fullWidth
          disabled={!isAvailable}
          onClick={() => onSelect(ticket)}
        >
          {isAvailable ? 'Select this pass' : notice?.text || 'Unavailable'}
        </Button>
      </footer>
    </article>
  );
}

export default function Tickets({ ticketTypes, onSelect, canRegister }) {
  if (!ticketTypes?.length) return null;

  const visiblePasses = ticketTypes.filter(
    (t) => t.code === 'REG' || t.code === 'PGS' || /regular|pg student|resident/i.test(t.name)
  );

  if (!visiblePasses.length) return null;

  return (
    <section className="section section--brand-soft tickets" id="tickets">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">Registration</span>
          <h2 className="section-title">Choose your pass</h2>
          <p className="section-subtitle">
            Every pass includes a digital ticket with a unique QR code, delivered instantly on
            WhatsApp and email.
          </p>
        </div>

        <div className={`tickets__grid tickets__grid--${Math.min(visiblePasses.length, 4)}`}>
          {visiblePasses.map((t) => (
            <TicketCard ticket={t} key={t.id} onSelect={onSelect} canRegister={canRegister} />
          ))}
        </div>

        <p className="tickets__note">
          Registration is by sponsor coupon — enter your company's coupon code when you register and
          your pass is free.
        </p>
      </div>
    </section>
  );
}
