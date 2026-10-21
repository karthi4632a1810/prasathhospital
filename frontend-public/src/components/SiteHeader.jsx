import { useEffect, useState } from 'react';
import Button from './ui/Button';
import './SiteHeader.css';

const NAV_ITEMS = [
  { id: 'about', label: 'About' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'committee', label: 'Committee' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'tickets', label: 'Passes' },
  { id: 'venue', label: 'Venue' },
  { id: 'faq', label: 'FAQ' },
];

export default function SiteHeader({ _event, onRegister, canRegister, availableSections }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  const navItems = NAV_ITEMS.filter((item) => availableSections.includes(item.id));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: highlights the nav item for the section currently in view.
  useEffect(() => {
    if (!navItems.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0.1, 0.5] }
    );

    navItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navItems.length]);

  // Lock body scroll while the mobile drawer is open, and hide the sticky
  // mobile CTA bar (a sibling component below in the page) so it doesn't
  // show a second "Register Now" underneath the open drawer.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    document.body.classList.toggle('nav-drawer-open', menuOpen);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('nav-drawer-open');
    };
  }, [menuOpen]);

  const handleNavClick = (e, id) => {
    e.preventDefault();
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container site-header__inner">
          <a className="site-header__brand" href="#top" onClick={(e) => handleNavClick(e, 'top')}>
            <img
              className="site-header__pf-logo"
              src="/assets/prashanth-fertility-logo.png"
              alt="Prashanth Fertility"
            />
            <span className="site-header__partner-tag">
              <span className="site-header__partner-sub">in association with</span>
              <span className="site-header__partner-val">
                <img
                  src="/assets/tapisar-logo.png"
                  alt="TAPISAR"
                  className="site-header__tapisar-logo"
                  width="20"
                  height="20"
                />
                <strong>TAPISAR</strong>
              </span>
            </span>
          </a>

          <nav className="site-header__nav" aria-label="Section navigation">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`site-header__link ${activeSection === item.id ? 'is-active' : ''}`}
                onClick={(e) => handleNavClick(e, item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="site-header__actions">
            {canRegister && (
              <Button variant="accent" size="sm" onClick={onRegister} className="site-header__cta">
                Register Now
              </Button>
            )}
            <button
              className="site-header__burger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={menuOpen ? 'is-open' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Siblings of <header>, not children — <header> is position:sticky, which
        (in current browser behavior) becomes the containing block for any
        position:fixed descendant, collapsing a fixed scrim to zero height
        instead of covering the viewport. Rendering these outside it keeps
        them fixed to the real viewport. */}
      {menuOpen && (
        <>
          <div className="site-header__scrim" onClick={() => setMenuOpen(false)} />
          <nav className="site-header__drawer" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={(e) => handleNavClick(e, item.id)}>
                {item.label}
              </a>
            ))}
            {canRegister && (
              <Button
                variant="accent"
                fullWidth
                onClick={() => {
                  setMenuOpen(false);
                  onRegister();
                }}
              >
                Register Now
              </Button>
            )}
          </nav>
        </>
      )}
    </>
  );
}
