import './HeroHelix3D.css';

/**
 * A real 3D DNA helix, not a flat approximation — each "rung" (base-pair
 * connector) is an independently rotated plane in 3D space (rotateY around
 * a shared vertical axis), so the two strands spiral out of actual
 * perspective/rotateX/rotateY geometry rather than a drawn curve. The whole
 * assembly spins continuously on Y inside a slower wobble on X, for a
 * tumbling, suspended-in-space feel rather than a flat mechanical spin.
 *
 * Bars are dense (small twist per step) so the strands read as smooth
 * continuous curves rather than a few sparse crossing chords; "bead" nodes
 * only render on a subset of bars so the result looks like two beaded
 * strands, not a bar at every single step. Gold nodes (the rare "highlight"
 * color) pulse in sequence top-to-bottom, reading as a signal traveling
 * down the strand as the helix turns.
 */
const BAR_COUNT = 64;
const TOTAL_HEIGHT = 600; // px, the helix's own design-space height
const RADIUS = 66; // px, cylinder radius
const TWIST_PER_BAR = 10; // deg — 64 * 10 = 640deg, ~1.8 turns, same shape as a sparser version but smooth
const NODE_EVERY = 4; // only every 4th bar gets visible "bead" nodes
const GOLD_EVERY = 3; // every 3rd beaded node is gold — ~5-6 total, stays rare

const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
  const y = (i / (BAR_COUNT - 1)) * TOTAL_HEIGHT - TOTAL_HEIGHT / 2;
  const angle = i * TWIST_PER_BAR;
  const hasNodes = i % NODE_EVERY === 0;
  const nodeIndex = i / NODE_EVERY;
  const isGold = hasNodes && nodeIndex % GOLD_EVERY === 0;
  return { key: i, y, angle, hasNodes, isGold, delay: (i / BAR_COUNT) * 4.8 };
});

export default function HeroHelix3D() {
  return (
    <div className="helix3d" aria-hidden="true">
      <div className="helix3d__wobble">
        <div className="helix3d__spin">
          {bars.map((r) => (
            <div
              key={r.key}
              className="helix3d__rung"
              style={{ transform: `translateY(${r.y}px) rotateY(${r.angle}deg)` }}
            >
              <span className="helix3d__bar" style={{ width: RADIUS * 2 }} />
              {r.hasNodes && (
                <>
                  <span
                    className={`helix3d__node ${r.isGold ? 'helix3d__node--gold' : 'helix3d__node--a'}`}
                    style={{ left: -RADIUS, animationDelay: `${r.delay}s` }}
                  />
                  <span className="helix3d__node helix3d__node--b" style={{ left: RADIUS }} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
