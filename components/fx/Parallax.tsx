"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Scroll parallax for a photo: drifts `distance` px down → up while it crosses
 * the viewport, scrubbed to the scroll position. Translate-only (photos are
 * never scaled — see CLAUDE.md "Imagery"), so it composites; and scrubbed, so
 * nothing runs while the visitor isn't scrolling.
 *
 * Off with reduced motion, and below `md` unless `mobile` — on a phone the
 * layouts stack, where drift just reads as jitter.
 */
export default function Parallax({
  distance = 40,
  mobile = false,
  className = "",
  style,
  children,
}: {
  /** total travel is 2 × distance px; larger = feels closer to the viewer */
  distance?: number;
  mobile?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!mobile && !window.matchMedia("(min-width: 768px)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const tween = gsap.fromTo(
      el,
      { y: distance },
      {
        y: -distance,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [distance, mobile]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`} style={style}>
      {children}
    </div>
  );
}
