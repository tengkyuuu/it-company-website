"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

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

export default function ProcessTimeline() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const line = root.current?.querySelector<HTMLElement>(".timeline-line");
      if (line && !reduce) {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top 70%",
              end: "bottom 70%",
              scrub: true,
            },
          }
        );
      }
    },
    { scope: root }
  );

  return (
    <div ref={root} className="relative ml-1 mt-14">
      {/* track + animated fill */}
      <span
        className="absolute bottom-3 left-0 top-3 w-px bg-mist"
        aria-hidden
      />
      <span
        className="timeline-line absolute bottom-3 left-0 top-3 w-px origin-top bg-accent"
        aria-hidden
      />

      <div className="flex flex-col gap-10 md:gap-14">
        {steps.map((p) => (
          <div
            key={p.no}
            data-animate
            className="relative grid gap-2 pl-10 md:grid-cols-[14rem_1fr] md:gap-8 md:pl-12"
          >
            <span
              className="absolute left-[-4px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-paper"
              aria-hidden
            />
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-sm text-accent">{p.no}</span>
              <h3 className="text-2xl font-semibold tracking-tight">
                {p.title}
              </h3>
            </div>
            <p className="max-w-xl leading-relaxed text-ink/60">{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
