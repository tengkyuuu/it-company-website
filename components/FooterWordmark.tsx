"use client";

import { useRef } from "react";
import Logo from "@/components/Logo";

/**
 * The giant footer mykTech() — outlined by default; the accent gradient inks in
 * under a spotlight that follows the cursor (mask CSS lives in globals.css,
 * `.fw`). Touch devices get a quiet full-width fill instead. Decorative.
 *
 * Width-capped rather than full-bleed: the wordmark is a raster (1199px of ink),
 * so letting it span a 1152px container would upscale ~2x on a retina display
 * and go soft. Swap in an SVG export and the cap can go.
 */
export default function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--fw-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--fw-y", `${e.clientY - r.top}px`);
      }}
      className="fw mx-auto w-full max-w-[820px]"
    >
      <Logo variant="outline" className="fw-ghost w-full" />
      <span className="fw-reveal">
        <Logo className="fw-grad w-full" />
      </span>
    </div>
  );
}
