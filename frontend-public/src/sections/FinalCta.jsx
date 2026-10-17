import Button from '../components/ui/Button';
import { formatDateRange } from '../lib/format';
import './FinalCta.css';

export default function FinalCta({ event, settings = {}, onRegister, canRegister }) {
  if (settings.show === false) return null;

  const openTitle = settings.openTitle || 'Secure your seat';
  const closedTitle = settings.closedTitle || 'Stay in the loop';
  const buttonText = settings.buttonText || 'Register Now';

  const defaultOpenText = `${formatDateRange(event.startDate, event.endDate)}. Your digital ticket and QR code arrive on WhatsApp the moment you register.`;
  const defaultClosedText =
    'Registration for this event is no longer open. Contact our helpdesk to hear about upcoming programmes.';

  const text = canRegister
    ? settings.openText || defaultOpenText
    : settings.closedText || defaultClosedText;

  return (
    <section className="final-cta" id="final-cta">
      <div className="final-cta__glow" aria-hidden="true" />
      <div className="container final-cta__inner">
        <h2 className="final-cta__title">{canRegister ? openTitle : closedTitle}</h2>

        <p className="final-cta__text">{text}</p>

        {canRegister ? (
          <div className="final-cta__actions">
            <Button variant="accent" size="lg" onClick={onRegister}>
              {buttonText}
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
