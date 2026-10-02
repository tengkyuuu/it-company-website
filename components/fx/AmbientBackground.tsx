/**
 * Site-wide ambient graphic: soft gray gradient clouds + a depth veil + a faint
 * paper grain, fixed behind every page.
 *
 * Deliberately STATIC and filter-free, so the whole layer is rasterized once
 * and then only composited. It used to drift `filter: blur(80px)` orbs and run
 * a cursor spotlight whose rAF loop wrote CSS variables every frame, forever —
 * a full-viewport blurred repaint behind the page, which cost frames everywhere.
 * The clouds now get their softness from eased gradient stops instead of blur.
 * No effects, no listeners — markup + CSS (`.ambient-*` in globals.css) only.
 */
export default function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden>
      <span className="ambient-orb ambient-orb--1" />
      <span className="ambient-orb ambient-orb--2" />
      <span className="ambient-orb ambient-orb--3" />
      <span className="ambient-veil" />
      {/* the grain lives here, behind content, instead of in a fixed layer over it */}
      <span className="ambient-grain grain" />
    </div>
  );
}
