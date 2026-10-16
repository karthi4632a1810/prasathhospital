import { useState } from 'react';
import './Faq.css';

function FaqItem({ faq, isOpen, onToggle }) {
  const panelId = `faq-panel-${faq.id}`;
  const buttonId = `faq-button-${faq.id}`;

  return (
    <li className={`faq-item ${isOpen ? 'is-open' : ''}`}>
      <h3 className="faq-item__heading">
        <button
          id={buttonId}
          className="faq-item__trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{faq.question}</span>
          <span className="faq-item__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M6 9.5 12 15l6-5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="faq-item__panel"
        hidden={!isOpen}
      >
        <p>{faq.answer}</p>
      </div>
    </li>
  );
}

export default function Faq({ faqs, contact }) {
  // First question opens by default — it is usually "who should attend".
  const [openId, setOpenId] = useState(faqs?.[0]?.id ?? null);

  if (!faqs?.length) return null;

  return (
    <section className="section faq" id="faq">
      <div className="container faq__inner">
        <div className="section-head section-head--center">
          <span className="section-eyebrow">Good to know</span>
          <h2 className="section-title">Frequently asked questions</h2>
        </div>

        <ul className="faq__list">
          {faqs.map((faq) => (
            <FaqItem
              key={faq.id}
              faq={faq}
              isOpen={openId === faq.id}
              onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
            />
          ))}
        </ul>

        {(contact?.email || contact?.phone || contact?.whatsapp) && (
          <div className="faq__contact">
            <h3 className="faq__contact-title">Still have a question?</h3>
            <p className="faq__contact-text">
              Our delegate helpdesk is happy to help with registration, invoices or access needs.
            </p>
            <div className="faq__contact-links">
              {contact.whatsapp && (
                <a
                  className="faq__contact-link faq__contact-link--whatsapp"
                  href={`https://wa.me/${contact.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.5 14c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.3-.9-2.8-1.2-4.5-4-4.6-4.2-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.2.1.4.1.5-.1l.8-.9c.2-.2.3-.2.6-.1l2 1c.3.1.4.2.5.3.1.2.1.6-.1 1.2Z" />
                  </svg>
                  WhatsApp us
                </a>
              )}
              {contact.email && (
                <a className="faq__contact-link" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a className="faq__contact-link" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                  {contact.phone}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
