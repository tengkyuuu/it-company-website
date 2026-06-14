"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

const stats = [
  { n: 48, suffix: "+", label: "products shipped" },
  { n: 9, suffix: " yrs", label: "average experience" },
  { n: 6, suffix: "", label: "specialists, no middle layers" },
  { n: 98, suffix: "%", label: "clients who come back" },
];

export default function StatsCounter() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const nums = gsap.utils.toArray<HTMLElement>(".stat-num");

      nums.forEach((el) => {
        const target = Number(el.dataset.n);
        const suffix = el.dataset.suffix ?? "";
        if (reduce) {
          el.textContent = target + suffix;
          return;
        }
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () =>
            gsap.to(obj, {
              v: target,
              duration: 1.4,
              ease: "power2.out",
              onUpdate: () => {
                el.textContent = Math.round(obj.v) + suffix;
              },
            }),
        });
      });
    },
    { scope: root }
  );

  return (
    <div
      ref={root}
      className="flex flex-col divide-y divide-mist/70 sm:flex-row sm:divide-x sm:divide-y-0"
    >
      {stats.map((s) => (
        <div
          key={s.label}
          data-animate
          className="flex-1 py-6 first:pt-0 last:pb-0 sm:px-8 sm:py-1 sm:first:pl-0 sm:last:pr-0"
        >
          <p
            className="stat-num text-5xl font-semibold tracking-tight md:text-6xl"
            data-n={s.n}
            data-suffix={s.suffix}
          >
            0{s.suffix}
          </p>
          <p className="mt-3 text-sm text-ink/55">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
