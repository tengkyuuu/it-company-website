"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let lenis: Lenis | null = null;

/** Smooth-scroll back to the top (footer control); falls back to native. */
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { duration: 1.4 });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Lenis smooth scroll synced to the GSAP ticker + ScrollTrigger. */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return; // honour reduced-motion → native scrolling

    // lerp 0.12 (was 0.1): still smooth, but the page catches up to the wheel
    // sooner, so it reads as responsive rather than floaty.
    // `autoRaf` stays off (the default) — the GSAP ticker below is the ONLY
    // loop driving Lenis, so there's never a second rAF running alongside it.
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  // Reset scroll + recalc triggers on client-side navigation.
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 80);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return <>{children}</>;
}
