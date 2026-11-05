"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

/**
 * The MykTech keyswitch — two layered renders (public/brand/keycap.avif +
 * keyswitch.avif, both alpha AVIF). The cap floats above the housing; hover
 * flares an under-cap glow and a press (:active) drives the cap home. All CSS —
 * no listeners, no JS animation. The cap is recoloured per placement
 * (gold / onyx / ivory — the housing stays neutral); the glow is always gold.
 * Decorative (aria-hidden). Press/glow CSS lives in globals.css (.keyswitch).
 */

/**
 * The source cap is red resin. v2 palette: three resins (DESIGN.md §5), made with
 * CSS filters on the cap image (verified visually — onyx keeps its facets):
 *  - gold  → the accent resin (hero + at most one more key per page)
 *  - onyx  → near-black resin, the default on white sections
 *  - ivory → frosted white resin, the default on black bands
 */
const TINTS = {
  gold: "grayscale(1) sepia(1) hue-rotate(2deg) saturate(2.2) brightness(1.15)",
  onyx: "grayscale(1) brightness(0.5) contrast(1.15)",
  ivory: "grayscale(1) brightness(1.7) contrast(0.8)",
} as const;

export type KeyTint = keyof typeof TINTS;

export default function KeySwitch({
  size = 56,
  tint = "onyx",
  legend,
  capSrc,
  pressed = false,
  className = "",
}: {
  size?: number | string;
  tint?: KeyTint;
  /** an icon printed on the cap's front face (e.g. a service `Icon`) */
  legend?: ReactNode;
  /** A finished cap-only render; the original switch layer stays in place. */
  capSrc?: string;
  /** hold the key down with the gold glow lit — same look as :active */
  pressed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`keyswitch ks-${tint} ${pressed ? "is-pressed" : ""} ${className}`}
      style={{ width: size, height: typeof size === "number" ? Math.round(size * 1.18) : undefined, aspectRatio: "1 / 1.18" }}
      aria-hidden="true"
    >
      {/* housing */}
      <Image
        src="/brand/keyswitch.avif"
        alt=""
        width={512}
        height={337}
        sizes={typeof size === "number" ? `${size}px` : "(max-width: 767px) 96px, 420px"}
        className="ks-base"
      />
      {/* cap + its glow, tinted together so the glow matches the resin */}
      <span
        className="ks-capwrap"
        style={{ "--ks-tint": capSrc ? "brightness(1)" : TINTS[tint] } as CSSProperties}
      >
        <span className="ks-glow" />
        <Image
          src={capSrc ?? "/brand/keycap.avif"}
          alt=""
          width={512}
          height={414}
          sizes={typeof size === "number" ? `${size}px` : "(max-width: 767px) 96px, 420px"}
          className="ks-capimg"
        />
        {legend ? <span className="ks-legend">{legend}</span> : null}
      </span>
    </span>
  );
}
