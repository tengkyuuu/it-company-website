"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Button from "@/components/Button";
import KeySwitch from "@/components/fx/KeySwitch";
import { projects } from "@/lib/work";

/**
 * Selected work as a pinned horizontal gallery. The wheel drives the track
 * sideways; each plate's screenshot drifts against the travel direction
 * (parallax via containerAnimation) under a giant outlined index numeral.
 * A live counter + progress rail sit at the bottom. Mobile: vertical stack.
 */
export default function WorkGallery() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

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

          const tween = gsap.to(el, {
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
              onUpdate: (self) => {
                const n = projects.length;
                const i = Math.max(
                  1,
                  Math.min(n, Math.round(self.progress * (n - 1)) + 1)
                );
                if (counter.current)
                  counter.current.textContent = String(i).padStart(2, "0");
                if (bar.current)
                  bar.current.style.transform = `scaleX(${self.progress})`;
              },
            },
          });

          // counter-drift parallax inside each plate
          gsap.utils.toArray<HTMLElement>(".work-plate-img").forEach((img) => {
            gsap.fromTo(
              img,
              { xPercent: -6 },
              {
                xPercent: 6,
                ease: "none",
                scrollTrigger: {
                  trigger: img.closest(".work-plate") as HTMLElement,
                  containerAnimation: tween,
                  start: "left right",
                  end: "right left",
                  scrub: true,
                },
              }
            );
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
      aria-label="Selected work"
    >
      <div
        ref={track}
        className="flex flex-col gap-14 px-6 py-4 md:h-screen md:flex-row md:items-center md:gap-[6vw] md:px-[7vw] md:py-0"
      >
        {/* intro panel */}
        <div className="flex shrink-0 flex-col justify-center md:h-[70vh] md:w-[30vw]">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey">
            <span className="h-px w-6 bg-accent" />
            Selected work
          </span>
          <h2 className="mt-5 text-balance font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Things we’re proud to have shipped.
          </h2>
          <p className="mt-5 max-w-sm text-pretty leading-relaxed text-ink/60">
            Real products, in real hands — across fintech, health, retail, and
            beyond.
          </p>
          <div className="mt-8">
            <Button href="/location" variant="outline" arrow>
              Start a project
            </Button>
          </div>
          <span className="mt-10 hidden items-center gap-3 font-mono text-xs uppercase tracking-widest text-ink/40 md:inline-flex">
            Scroll sideways
            <span aria-hidden>→</span>
            <KeySwitch size={40} tint="sky" />
          </span>
        </div>

        {projects.map((p, i) => (
          <article
            key={p.name}
            className="work-plate group relative shrink-0 md:w-[56vw] md:max-w-[880px]"
          >
            {/* giant outlined numeral bleeding out of the plate */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-10 left-[-0.05em] z-10 select-none font-display text-[6rem] font-bold leading-none text-stroke-soft md:-top-16 md:text-[9rem]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-mist/70 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.5)] md:h-[64vh]">
              <Link
                href="/services"
                className="absolute inset-0 z-30"
                aria-label={p.name}
                data-cursor
              />

              {/* screenshot with room to drift */}
              <div className="relative aspect-[1536/900] md:absolute md:inset-0 md:aspect-auto">
                <div className="work-plate-img absolute inset-0 scale-[1.15]">
                  <Image
                    src={p.img}
                    alt={`${p.name} — ${p.category}`}
                    fill
                    quality={90}
                    sizes="(max-width: 768px) 100vw, 56vw"
                    className="object-cover object-top transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                {/* glare sweep */}
                <div className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full" />
              </div>

              {/* meta overlay */}
              <div className="relative z-20 flex items-end justify-between gap-4 bg-gradient-to-t from-ink via-ink/60 to-transparent p-6 text-paper md:absolute md:inset-x-0 md:bottom-0 md:p-8">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-paper/60">
                    <span className="flex items-center gap-1" aria-hidden>
                      {p.dots.map((c, j) => (
                        <span
                          key={j}
                          style={{ background: c }}
                          className="h-2 w-2 rounded-full ring-1 ring-white/20"
                        />
                      ))}
                    </span>
                    {p.category} · {p.year}
                  </p>
                  <h3 className="mt-1.5 truncate font-display text-2xl font-semibold tracking-tight md:text-3xl">
                    {p.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs text-paper/70"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 transition-all duration-300 group-hover:border-transparent group-hover:bg-accent group-hover:text-ink">
                  <span className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                    ↗
                  </span>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* live counter + progress rail (desktop, while pinned) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 hidden md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6">
          <span className="font-mono text-xs tracking-widest text-slatey">
            <span ref={counter}>01</span> / {String(projects.length).padStart(2, "0")}
          </span>
          <span className="relative h-px flex-1 bg-mist">
            <span
              ref={bar}
              className="absolute inset-0 origin-left bg-accent"
              style={{ transform: "scaleX(0)" }}
            />
          </span>
        </div>
      </div>
    </section>
  );
}
