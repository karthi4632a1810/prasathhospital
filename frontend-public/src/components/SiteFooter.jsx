import './SiteFooter.css';

export default function SiteFooter({ event }) {
  const year = new Date().getFullYear();
  const contact = event?.contact || {};

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark">
            <img src="/assets/pf-logo-icon.png" alt="Prashanth Fertility" width="28" height="28" />
          </span>
          <div>
            <p className="site-footer__name">Prashanth Fertility</p>
            <p className="site-footer__tagline">Care · Compassion · Life</p>
          </div>
        </div>

        <p className="site-footer__promise">
          Healthier Women &nbsp;|&nbsp; Stronger Families &nbsp;|&nbsp; Brighter Tomorrows
        </p>

        {(contact.email || contact.phone) && (
          <div className="site-footer__contact">
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
            )}
          </div>
        )}
      </div>

      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <p>© {year} Prashanth Hospitals. All rights reserved.</p>
          <p className="site-footer__signature">More Than Care — A Healthier Future</p>
        </div>
      </div>
    </footer>
  );
}
