"use client";

import { useEffect, useRef } from "react";
import Logo from "@/components/Logo";

/**
 * The giant footer R Ally's Tech — outlined by default; the accent gradient inks in
 * under a spotlight that follows the cursor (CSS lives in globals.css, `.fw`).
 * Touch devices get a quiet full-width fill instead. Decorative.
 *
 * Following the cursor costs one `transform` write per pointer event on an
 * already-composited layer: the element's box is measured once on enter (and
 * again only if the page scrolls underneath the pointer), never per move.
 *
 * Full-bleed: the width cap this used to carry existed because the mark was a
 * raster (1199px of ink) that went soft past ~820 CSS px. It's outlined vector
 * now (scripts/build-wordmark.mjs), so it scales cleanly at any size.
 */
export default function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);
  const hole = useRef<HTMLSpanElement>(null);
  const rect = useRef<DOMRect | null>(null);

  // stable identity, so the scroll listener can actually be removed again
  const invalidate = useRef(() => {
    rect.current = null;
  }).current;
  useEffect(
    () => () => window.removeEventListener("scroll", invalidate),
    [invalidate]
  );

  const follow = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    const h = hole.current;
    if (!el || !h) return;
    const r = (rect.current ??= el.getBoundingClientRect());
    // the hole sits at the centre of a 2W × 2H element
    const x = e.clientX - r.left - r.width;
    const y = e.clientY - r.top - r.height;
    h.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onPointerEnter={(e) => {
        invalidate();
        window.addEventListener("scroll", invalidate, { passive: true });
        follow(e);
      }}
      onPointerMove={follow}
      onPointerLeave={() => {
        window.removeEventListener("scroll", invalidate);
      }}
      className="fw mx-auto w-full"
    >
      <span className="fw-reveal">
        <Logo className="fw-grad w-full" />
        <span className="fw-cover">
          <span ref={hole} className="fw-hole" />
        </span>
      </span>
      <Logo variant="outline" className="fw-ghost w-full" />
    </div>
  );
}
