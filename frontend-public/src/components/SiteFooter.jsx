import './SiteFooter.css';

export default function SiteFooter({ event }) {
  const year = new Date().getFullYear();
  const contact = event?.contact || {};

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark">
            <img src="/assets/pf-logo-icon.png" alt="Prashanth Fertility" width="30" height="30" />
          </span>
          <span className="site-footer__mark site-footer__mark--tapisar">
            <img src="/assets/tapisar-logo.png" alt="TAPISAR" width="30" height="30" />
          </span>
          <div>
            <p className="site-footer__name">Prashanth Fertility &amp; Research Centre</p>
            <p className="site-footer__tagline">In association with TAPISAR (Tamil Nadu &amp; Pondicherry Chapter of ISAR)</p>
          </div>
        </div>

        <p className="site-footer__promise">
          Healthier Women &nbsp;|&nbsp; Stronger Families &nbsp;|&nbsp; Brighter Tomorrows
        </p>

        <div className="site-footer__contact">
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          <a href={`tel:${(contact.phone || '+91 96000 47646').replace(/\s/g, '')}`}>
            {contact.phone || '+91 96000 47646'}
          </a>
        </div>
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
