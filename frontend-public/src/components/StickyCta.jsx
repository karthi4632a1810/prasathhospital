import { useEffect, useState } from 'react';
import Button from './ui/Button';
import { formatCurrency } from '../lib/format';
import './StickyCta.css';

/**
 * Mobile-only bottom bar. Appears once the hero scrolls away so the Register
 * action is always one tap from anywhere on the page — most traffic arrives
 * from a WhatsApp link on a phone.
 */
export default function StickyCta({ _event, ticketTypes, onRegister, canRegister }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!canRegister) return null;

  const buyable = (ticketTypes || []).filter((t) => t.saleState === 'on-sale' && !t.isFree);
  const lowest = buyable.length ? Math.min(...buyable.map((t) => t.price)) : null;

  return (
    <div className={`sticky-cta ${visible ? 'is-visible' : ''}`}>
      <div className="sticky-cta__info">
        <span className="sticky-cta__label">
          {lowest !== null ? 'Passes from' : 'Registration'}
        </span>
        <span className="sticky-cta__value">
          {lowest !== null ? formatCurrency(lowest) : 'Free'}
        </span>
      </div>
      <Button variant="accent" onClick={onRegister} className="sticky-cta__btn">
        Register Now
      </Button>
    </div>
  );
}
