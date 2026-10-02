/**
 * The R Ally's Tech wordmark.
 *
 * A ransom-note lockup: every glyph is a different typeface (Abril Fatface ·
 * Bebas Neue · Courier Prime · Playfair Display · Pacifico · Righteous ·
 * Archivo Black · Caveat · Zilla Slab · Lobster). Shipping eleven font families
 * to every visitor would be absurd, so scripts/build-wordmark.mjs converts each
 * glyph to OUTLINES once, at build time, into public/brand/wordmark.svg.
 *
 * It's painted as a CSS mask over `currentColor` rather than an <img>, so it
 * inherits the text colour and therefore follows light/dark and `.band` for
 * free. `variant="outline"` swaps in the stroked-paths asset, which sidesteps
 * drop-shadow (filters apply BEFORE masking, so a shadow would be clipped off).
 *
 * Sizing: the element carries the wordmark's aspect ratio, so set ONE axis —
 * `className="h-7"` or `className="w-full"` — and the other follows. Because
 * it's vector now, there is no maximum size before it goes soft.
 *
 * To restyle the lockup, edit the LOCKUP map in scripts/build-wordmark.mjs and
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
