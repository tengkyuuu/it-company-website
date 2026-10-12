/**
 * The R Ally's Tech logo.
 *
 * The house lockup: an oversized serif R (Cinzel) with a hairline flick in its
 * crook, a four-point spark, ALLY'S in tracked serif caps, and TECH (Geist)
 * between two hairline rules beneath. The spark, the flick and the rules are
 * drawn shapes, not glyphs, so scripts/build-wordmark.mjs composes the whole
 * thing as OUTLINES once, at build time, into public/brand/wordmark.svg.
 *
 * It's painted as a CSS mask over `currentColor` rather than an <img>, so it
 * inherits the text colour and therefore follows light/dark and `.band` for
 * free. `variant="outline"` swaps in the ring asset, which sidesteps
 * drop-shadow (filters apply BEFORE masking, so a shadow would be clipped off).
 *
 * Sizing: the element carries the lockup's aspect ratio (~3:1), so set ONE
 * axis — `className="h-10"` or `className="w-full"` — and the other follows.
 * The R is the full height, so the name's caps are under half of it: below
 * ~36px tall the TECH line stops being legible. It's vector, so there is no
 * maximum size.
 *
 * To restyle the lockup, edit the constants in scripts/build-wordmark.mjs and
 * re-run it; then update `aspect-ratio` in globals.css to the printed ratio.
 */
export default function Logo({
  variant = "solid",
  label,
  className = "",
}: {
  variant?: "solid" | "outline";
  /** accessible name; omit when an ancestor link already provides one */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`${variant === "outline" ? "wm-outline" : "wm"} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
