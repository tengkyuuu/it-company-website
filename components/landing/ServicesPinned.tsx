"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Icon from "@/components/Icon";
import { services } from "@/lib/services";

/**
 * Desktop: pins the section and scrolls the panels horizontally with the wheel.
 * Mobile / reduced-motion: panels stack vertically (no pin).
 */
export default function ServicesPinned() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();

      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const el = track.current;
          if (!el) return;
          const amount = () => el.scrollWidth - window.innerWidth;

          gsap.to(el, {
            x: () => -amount(),
            ease: "none",
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: () => "+=" + amount(),
              pin: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
        }
      );
    },
    { scope: section }
  );

  return (
    <section
      ref={section}
      className="relative md:h-screen md:overflow-hidden"
      aria-label="Services"
    >
      <div
        ref={track}
        className="flex flex-col gap-5 px-6 md:h-screen md:flex-row md:items-center md:gap-8 md:px-[6vw]"
      >
        {/* intro panel */}
        <div className="flex shrink-0 flex-col justify-center md:h-[68vh] md:w-[34vw]">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-slatey">
            ✦ What we do
          </span>
          <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            One studio, the whole product journey.
          </h2>
          <p className="mt-5 max-w-sm text-pretty leading-relaxed text-ink/60">
            Six core practices, one team. Scroll across — most clients start with
            one and grow into the rest.
          </p>
          <span className="mt-8 hidden items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink/40 md:inline-flex">
            Drag / scroll
            <span aria-hidden>→</span>
          </span>
        </div>

        {services.map((s, i) => (
          <article
            key={s.slug}
            className="group relative flex shrink-0 flex-col justify-between overflow-hidden rounded-[1.75rem] border border-mist/70 bg-white p-8 transition-colors duration-300 hover:bg-ink hover:text-paper md:h-[68vh] md:w-[30vw] md:p-10"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-sm text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-mist/70 transition-colors duration-300 group-hover:border-white/20">
                <Icon name={s.icon} />
              </div>
            </div>

            <div>
              <h3 className="text-3xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 max-w-xs leading-relaxed text-ink/60 transition-colors duration-300 group-hover:text-paper/70">
                {s.detail}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {s.deliverables.slice(0, 3).map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-mist/70 px-3 py-1 text-xs text-ink/60 transition-colors duration-300 group-hover:border-white/20 group-hover:text-paper/70"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
