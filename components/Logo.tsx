import type { CSSProperties } from "react";
import { brandGeometry } from "@/lib/brand-geometry";

/** Outlined MykTech() artwork, painted in currentColor for both themes.
 * Set one dimension. Minimum width: horizontal 160px; wordmark 120px;
 * stacked 160px; signature 320px; symbol 40px; micro 16px.
 * Outline is decorative, horizontal/wordmark only, at least 600px wide.
 * Source and full usage rules: public/brand/myktech/index.html. */
export default function Logo({
  variant = "solid",
  layout = "horizontal",
  accent = false,
  label,
  className = "",
}: {
  variant?: "solid" | "outline";
  layout?: keyof typeof brandGeometry;
  /** Gold spark on the solid emblem; use for primary identity placements. */
  accent?: boolean;
  /** accessible name; omit when an ancestor link already provides one */
  label?: string;
  className?: string;
}) {
  const outline = variant === "outline" && (layout === "horizontal" || layout === "wordmark");
  const style = {
    "--wm-ratio": brandGeometry[layout],
    "--wm-solid": `url("/brand/myktech/svg/myktech-${layout}-ink.svg")`,
    "--wm-outline": `url("/brand/myktech/svg/myktech-${layout}-outline.svg")`,
    "--wm-accent": `url("/brand/myktech/svg/myktech-${layout}-accent-mask.svg")`,
  } as CSSProperties;
  const goldSpark = accent && !outline && layout !== "wordmark" && layout !== "micro";
  return (
    <span
      className={`${outline ? "wm-outline" : "wm"}${goldSpark ? " wm-accent" : ""} ${className}`}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
