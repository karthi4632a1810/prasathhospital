/** Decorative DNA-helix line art for the hero's empty right-hand side on
 *  wide screens — a nod to embryology/reproductive medicine without being
 *  literal clip-art. Pure line work, low opacity, so it reads as ambience
 *  behind the content rather than competing with it. Hidden on narrow
 *  viewports via CSS, where there's no spare space for it anyway.
 *
 *  Three layered, restrained animations (all stopped by the site-wide
 *  prefers-reduced-motion rule in tokens.css): a light pulse travels along
 *  each strand via CSS offset-path, the gold "highlight" nodes breathe,
 *  and the whole piece sways very slowly as if suspended. */
export default function HeroMotif() {
  const peaks = [60, 180, 300, 420, 540, 660];
  // Strand A/B share axis-crossing points and mirror each other at every
  // peak — true double-helix geometry, not just two independent wiggles.
  const strandA =
    'M100,0 Q200,60 100,120 Q0,180 100,240 Q200,300 100,360 Q0,420 100,480 Q200,540 100,600 Q0,660 100,720';
  const strandB =
    'M100,0 Q0,60 100,120 Q200,180 100,240 Q0,300 100,360 Q200,420 100,480 Q0,540 100,600 Q200,660 100,720';

  return (
    <svg
      className="hero__motif"
      viewBox="0 0 200 720"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={strandA} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <path d={strandB} stroke="rgba(255,255,255,0.22)" strokeWidth="2" />

      {peaks.map((y, i) => {
        const [ax, bx] = i % 2 === 0 ? [150, 50] : [50, 150];
        const isGold = i === 1 || i === 4;
        return (
          <g key={y}>
            <line x1={ax} y1={y} x2={bx} y2={y} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
            <circle
              cx={ax}
              cy={y}
              r={isGold ? 5 : 3.5}
              fill={isGold ? 'var(--gold-500)' : 'rgba(255,255,255,0.55)'}
              className={isGold ? 'hero__motif-node--gold' : undefined}
              style={isGold ? { animationDelay: `${i * 0.6}s` } : undefined}
            />
            <circle cx={bx} cy={y} r="3.5" fill="rgba(255,255,255,0.35)" />
          </g>
        );
      })}

      {/* Traveling light pulses — a glowing dot runs the length of each
          strand on a loop, like a signal moving through the helix. */}
      <circle
        r="4.5"
        className="hero__motif-pulse hero__motif-pulse--a"
        fill="var(--white)"
        style={{ offsetPath: `path('${strandA}')` }}
      />
      <circle
        r="3.5"
        className="hero__motif-pulse hero__motif-pulse--b"
        fill="var(--gold-500)"
        style={{ offsetPath: `path('${strandB}')` }}
      />
    </svg>
  );
}
