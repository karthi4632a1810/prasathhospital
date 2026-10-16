import Button from '../components/ui/Button';
import { formatDateRange } from '../lib/format';
import './FinalCta.css';

export default function FinalCta({ event, onRegister, canRegister }) {
  return (
    <section className="final-cta">
      <div className="final-cta__glow" aria-hidden="true" />
      <div className="container final-cta__inner">
        <h2 className="final-cta__title">
          {canRegister ? 'Secure your seat' : 'Stay in the loop'}
        </h2>

        <p className="final-cta__text">
          {canRegister
            ? `${formatDateRange(event.startDate, event.endDate)}. Your digital ticket and QR code arrive on WhatsApp the moment you register.`
            : 'Registration for this event is no longer open. Contact our helpdesk to hear about upcoming programmes.'}
        </p>

        {canRegister ? (
          <div className="final-cta__actions">
            <Button variant="accent" size="lg" onClick={onRegister}>
              Register Now
            </Button>
            {event.seatsRemaining !== null && event.seatsRemaining <= 50 && (
              <span className="final-cta__scarcity">
                Only {event.seatsRemaining} {event.seatsRemaining === 1 ? 'seat' : 'seats'}{' '}
                remaining
              </span>
            )}
          </div>
        ) : (
          event.contact?.email && (
            <div className="final-cta__actions">
              <Button variant="outline-light" size="lg" href={`mailto:${event.contact.email}`}>
                Contact the team
              </Button>
            </div>
          )
        )}
      </div>
    </section>
  );
}
