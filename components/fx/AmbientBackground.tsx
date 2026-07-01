"use client";

import { useEffect, useRef } from "react";

/**
 * Site-wide ambient graphic: slow-drifting gray gradient clouds + a depth veil,
 * plus a soft cursor-following spotlight on fine-pointer devices (adds a subtle
 * "lit" depth without touching the reserved accent). CSS-driven; cheap.
 */
export default function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!fine || reduce) return;

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.25;
    let cx = tx;
    let cy = ty;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty("--mx", `${cx}px`);
      el.style.setProperty("--my", `${cy}px`);
      raf = requestAnimationFrame(loop);
    };

    el.classList.add("ambient--spot");
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      el.classList.remove("ambient--spot");
    };
  }, []);

  return (
    <div ref={ref} className="ambient" aria-hidden>
      <span className="ambient-orb ambient-orb--1" />
      <span className="ambient-orb ambient-orb--2" />
      <span className="ambient-orb ambient-orb--3" />
      <span className="ambient-spot" />
      <span className="ambient-veil" />
    </div>
  );
}
