"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

/** Infinite marquee whose speed + skew react to scroll velocity. */
export default function VelocityMarquee({ items }: { items: string[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const track = root.current?.querySelector<HTMLElement>(".vm-track");
      if (!track) return;

      const loop = gsap.to(track, {
        xPercent: -50,
        repeat: -1,
        duration: 24,
        ease: "none",
      });
      if (reduce) return;

      let dir = 1;
      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          const v = self.getVelocity();
          if (Math.abs(v) > 1) dir = v > 0 ? 1 : -1;
          const boost = gsap.utils.clamp(0, 6, Math.abs(v) / 200);
          gsap.to(loop, {
            timeScale: dir * (1 + boost),
            overwrite: true,
            duration: 0.4,
          });
          gsap.to(track, {
            skewX: gsap.utils.clamp(-10, 10, v / -340),
            overwrite: true,
            duration: 0.4,
          });
        },
      });

      return () => {
        st.kill();
        loop.kill();
      };
    },
    { scope: root }
  );

  const row = [...items, ...items];

  return (
    <div
      ref={root}
      className="relative overflow-hidden border-y border-mist/60 py-7"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-paper to-transparent" />
      <div className="vm-track flex w-max gap-12 will-change-transform">
        {row.map((c, i) => (
          <span
            key={i}
            className="flex items-center gap-12 whitespace-nowrap text-2xl font-medium tracking-tight text-ink/30 md:text-3xl"
          >
            {c}
            <span className="text-accent" aria-hidden>
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
