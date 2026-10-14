import { useCallback, useRef } from 'react';

/**
 * Mouse-tracking 3D tilt — the card rotates toward the cursor using real
 * perspective/rotateX/rotateY (not a 2D fake), with a quick follow while the
 * pointer moves and a slower spring back to flat on leave. Mutates the DOM
 * directly in the event handlers rather than via React state, since a
 * mousemove-driven re-render would be janky at this frequency.
 *
 * Skips the effect entirely under prefers-reduced-motion — this is
 * interaction-triggered rather than autoplaying, but the tilt itself is
 * still motion some users will want off.
 */
export function useTilt({ max = 10, scale = 1.025 } = {}) {
  const ref = useRef(null);
  const reduced = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const onMouseEnter = useCallback(() => {
    const el = ref.current;
    if (!el || reduced.current) return;
    el.style.transition = 'transform 120ms ease-out';
  }, []);

  const onMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el || reduced.current) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * max * 2;
      const rotateX = (0.5 - py) * max * 2;
      el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;
    },
    [max, scale]
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el || reduced.current) return;
    el.style.transition = 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  }, []);

  return { ref, onMouseEnter, onMouseMove, onMouseLeave };
}
