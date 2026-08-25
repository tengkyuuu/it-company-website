/**
 * The mykTech() wordmark.
 *
 * The lockup mixes eight typefaces (Canva Sans · Brittany · Roboto · Horizon ·
 * Ahsing · Brick Sans · Sanchez · Alatsi), so it can't be set in a web font — it
 * lives as a raster silhouette in public/brand/. Rather than an <img>, it's
 * painted as a CSS mask over `currentColor`, which means it inherits the text
 * colour and therefore follows light/dark and `.band` automatically.
 *
 * `variant="outline"` uses the pre-computed ring asset (the silhouette dilated
 * minus itself), so an outlined treatment needs no filter tricks.
 *
 * Sizing: the element carries the wordmark's aspect ratio, so set ONE axis —
 * `className="h-7"` or `className="w-full"` — and the other follows.
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
