"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  siNextdotjs,
  siReact,
  siTypescript,
  siTailwindcss,
  siNodedotjs,
  siPython,
  siPostgresql,
  siMongodb,
  siPrisma,
  siExpo,
  siDocker,
  siFigma,
  siThreedotjs,
  siGreensock,
  siVercel,
} from "simple-icons";

// The stack we actually build on — frontend → backend → mobile → infra → design.
const stack = [
  siNextdotjs,
  siReact,
  siTypescript,
  siTailwindcss,
  siNodedotjs,
  siPython,
  siPostgresql,
  siMongodb,
  siPrisma,
  siExpo,
  siDocker,
  siFigma,
  siThreedotjs,
  siGreensock,
  siVercel,
];

const labelFor = (title: string) =>
  ({ "GreenSock": "GSAP", "Three.js": "Three.js", Expo: "React Native" }[
    title
  ] ?? title);

export default function TechMarquee() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const track = root.current?.querySelector<HTMLElement>(".tm-track");
      if (!track) return;

      const loop = gsap.to(track, {
        xPercent: -50,
        repeat: -1,
        duration: 36,
        ease: "none",
      });
      if (reduce) return;

      let dir = 1;
      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          const v = self.getVelocity();
          if (Math.abs(v) > 1) dir = v > 0 ? 1 : -1;
          const boost = gsap.utils.clamp(0, 5, Math.abs(v) / 260);
          gsap.to(loop, {
            timeScale: dir * (1 + boost),
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

  const row = [...stack, ...stack];

  return (
    <div ref={root} className="relative overflow-hidden py-7">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-paper to-transparent" />
      <div className="tm-track flex w-max items-center gap-10 will-change-transform md:gap-14">
        {row.map((icon, i) => (
          <span
            key={i}
            style={{ ["--c" as string]: `#${icon.hex}` }}
            className="group flex shrink-0 items-center gap-3 text-ink/45 transition-colors duration-300 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-6 w-6 fill-current opacity-70 transition-all duration-300 group-hover:opacity-100 group-hover:[fill:var(--c)] md:h-7 md:w-7"
            >
              <path d={icon.path} />
            </svg>
            <span className="whitespace-nowrap text-lg font-medium tracking-tight md:text-xl">
              {labelFor(icon.title)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
