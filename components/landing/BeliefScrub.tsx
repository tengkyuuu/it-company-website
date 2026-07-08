"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import KeySwitch from "@/components/fx/KeySwitch";

const SENTENCE =
  "Good software shouldn’t announce itself. It should feel obvious — like it was always meant to work this way.";

/**
 * The studio belief, read by the scrollbar: words start as ghosts and ink in
 * one by one as the band crosses the viewport. "obvious" carries the accent.
 */
export default function BeliefScrub() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      gsap.fromTo(
        ".belief-word",
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.5,
          scrollTrigger: {
            trigger: root.current,
            start: "top 80%",
            end: "center 45%",
            scrub: true,
          },
        }
      );
    },
    { scope: root }
  );

  return (
    <div
      ref={root}
      className="relative overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-paper grain md:px-16 md:py-24"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 opacity-50 aurora"
        aria-hidden
      />
      <div className="relative">
        <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey">
          <span className="h-px w-6 bg-accent" />
          Our belief
        </span>
        <p className="mt-8 max-w-4xl text-balance font-display text-3xl font-semibold leading-snug tracking-tight md:text-5xl">
          {SENTENCE.split(" ").map((word, i) => (
            <span
              key={i}
              className={`belief-word inline ${
                word.startsWith("obvious") ? "text-accent" : ""
              }`}
            >
              {word}{" "}
            </span>
          ))}
        </p>
        <p className="mt-10 flex items-center gap-4 font-mono text-xs uppercase tracking-widest text-paper/50">
          — The MYKTECH studio
          <KeySwitch size={42} tint="mint" />
        </p>
      </div>
    </div>
  );
}
