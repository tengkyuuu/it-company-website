"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

/**
 * The mykTech() keyswitch — two layered renders (public/brand/keycap.avif +
 * keyswitch.avif, both alpha AVIF). The cap floats above the housing; hover
 * presses it home and flares an under-cap glow. The cap is recolored per
 * placement with a hue-rotate tint (the housing stays neutral), so the same
 * switch shows up in a different color everywhere it appears.
 * Decorative (aria-hidden). Press/glow CSS lives in globals.css (.keyswitch).
 */

/** The source cap is red resin (hue ≈ 12°); tints rotate from there. */
const TINTS = {
  red: "none",
  gold: "hue-rotate(34deg) saturate(0.95) brightness(1.05)",
  plum: "hue-rotate(298deg) saturate(0.7) brightness(0.98)",
  rose: "hue-rotate(330deg) saturate(0.78)",
  sky: "hue-rotate(196deg) saturate(0.72) brightness(1.03)",
  mint: "hue-rotate(140deg) saturate(0.68) brightness(1.03)",
} as const;

export type KeyTint = keyof typeof TINTS;

export default function KeySwitch({
  size = 56,
  tint = "gold",
  className = "",
}: {
  size?: number;
  tint?: KeyTint;
  className?: string;
}) {
  return (
    <span
      className={`keyswitch ${className}`}
      style={{ width: size, height: Math.round(size * 1.18) }}
      aria-hidden="true"
      data-cursor
    >
      {/* housing */}
      <Image
        src="/brand/keyswitch.avif"
        alt=""
        width={512}
        height={337}
        sizes="96px"
        className="ks-base"
      />
      {/* cap + its glow, tinted together so the glow matches the resin */}
      <span
        className="ks-capwrap"
        style={{ "--ks-tint": TINTS[tint] } as CSSProperties}
      >
        <span className="ks-glow" />
        <Image
          src="/brand/keycap.avif"
          alt=""
          width={512}
          height={414}
          sizes="96px"
          className="ks-capimg"
        />
      </span>
    </span>
  );
}
