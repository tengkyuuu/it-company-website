/** Slow-drifting gray gradient clouds rendered behind every page. CSS-only. */
export default function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden>
      <span className="ambient-orb ambient-orb--1" />
      <span className="ambient-orb ambient-orb--2" />
      <span className="ambient-orb ambient-orb--3" />
    </div>
  );
}
