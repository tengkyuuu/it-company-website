"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import KeySwitch from "@/components/fx/KeySwitch";

const steps = [
  {
    no: "01",
    title: "Discover",
    body: "We dig into your users, goals, and constraints before proposing a single screen.",
  },
  {
    no: "02",
    title: "Design",
    body: "Flows, prototypes, and a tight visual system you can actually feel and click.",
  },
  {
    no: "03",
    title: "Build",
    body: "Engineering in weekly increments — you watch it come to life, not a black box.",
  },
  {
    no: "04",
    title: "Grow",
    body: "We measure, iterate, and keep the lights on long after launch day.",
  },
];

/**
 * The process as a deck: each phase is a sticky card that the next one
 * slides over, gently scaling the covered card back. Works on touch too —
 * it's plain position:sticky, with GSAP only adding the settle-back.
 */
export default function ProcessDeck() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      const wrappers = gsap.utils.toArray<HTMLElement>(".process-slot");
      wrappers.forEach((slot, i) => {
        if (i === wrappers.length - 1) return;
        const card = slot.querySelector(".process-card");
        if (!card) return;
        gsap.to(card, {
          scale: 0.94,
          opacity: 0.6,
          ease: "none",
          scrollTrigger: {
            trigger: wrappers[i + 1],
            start: "top bottom",
            end: "top 22%",
            scrub: true,
          },
        });
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="mt-14">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <div
            key={s.no}
            className="process-slot sticky"
            style={{ top: `calc(13vh + ${i * 1.75}rem)` }}
          >
            <div
              className={`process-card relative mb-10 flex min-h-[46vh] flex-col justify-between overflow-hidden rounded-[2rem] border p-8 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)] will-change-transform md:min-h-[52vh] md:p-12 ${
                last
                  ? "border-ink/40 bg-ink text-paper grain"
                  : "border-mist/70 bg-white"
              }`}
            >
              {last && (
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-40 aurora"
                  aria-hidden
                />
              )}

              <div className="relative flex items-start justify-between">
                <span
                  className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] ${
                    last ? "border-white/20 text-paper/60" : "border-mist/70 text-slatey"
                  }`}
                >
                  Phase {s.no} — 04
                </span>
                <span
                  aria-hidden
                  className={`select-none font-display text-[5rem] font-bold leading-none md:text-[8rem] ${
                    last ? "text-stroke-paper opacity-60" : "text-stroke-soft"
                  }`}
                >
                  {s.no}
                </span>
              </div>

              <div className="relative">
                <h3 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">
                  {s.title}
                </h3>
                <p
                  className={`mt-4 max-w-xl text-pretty text-lg leading-relaxed ${
                    last ? "text-paper/70" : "text-ink/60"
                  }`}
                >
                  {s.body}
                </p>
              </div>

              {last && (
                <KeySwitch
                  size={60}
                  tint="rose"
                  className="absolute bottom-10 right-10 hidden md:block"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
