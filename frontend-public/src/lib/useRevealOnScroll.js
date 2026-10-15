import { useEffect } from 'react';

/* Blocks that rise into view as the visitor scrolls. Siblings matched by
   the same selector inside one parent get a small stagger, so a grid of
   cards cascades in rather than appearing all at once. */
const SELECTORS = [
  '.section-head',
  '.chairperson-welcome__grid',
  '.feature-card',
  '.about__organizer',
  '.speaker',
  '.committee-member',
  '.committee__group-title',
  '.agenda__tabs',
  '.agenda-item',
  '.ticket',
  '.venue__card',
  '.venue__map-frame',
  '.sponsors__tier-label',
  '.sponsors__item',
  '.exhibit-stall',
  '.faq-item',
  '.faq__contact',
  '.final-cta__inner',
];

const STAGGER_MS = 80;
const MAX_STAGGER_MS = 480;

/**
 * Adds the `.reveal` class (opacity 0) at runtime and `.is-visible` when an
 * element enters the viewport. Classes are applied here, never in markup, so
 * nothing is hidden if JS fails — and nothing at all happens under
 * prefers-reduced-motion. Pass `ready` once the page content has rendered.
 */
export function useRevealOnScroll(ready) {
  useEffect(() => {
    if (!ready || typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const elements = document.querySelectorAll(SELECTORS.join(','));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    elements.forEach((el) => {
      const siblings = el.parentElement
        ? Array.from(el.parentElement.children).filter((c) => c.matches(SELECTORS.join(',')))
        : [el];
      const delay = Math.min(siblings.indexOf(el) * STAGGER_MS, MAX_STAGGER_MS);
      el.style.setProperty('--reveal-delay', `${delay}ms`);
      el.classList.add('reveal');
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
      elements.forEach((el) => el.classList.remove('reveal', 'is-visible'));
    };
  }, [ready]);
}
