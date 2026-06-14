"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Global scroll-reveal. Any element with `data-animate` fades/rises in when it
 * enters the viewport. Adds `reveal-ready` to <html> so the from-state only
 * applies once JS is live (graceful no-JS fallback).
 */
export default function ScrollFX() {
  const pathname = usePathname();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add("reveal-ready");

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>("[data-animate]");
      if (els.length) {
        gsap.set(els, { y: 30 });
        ScrollTrigger.batch("[data-animate]", {
          start: "top 88%",
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.85,
              stagger: 0.09,
              ease: "power3.out",
              overwrite: true,
            }),
        });
      }
    });

    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => {
      window.clearTimeout(id);
      ctx.revert();
    };
  }, [pathname]);

  return null;
}
