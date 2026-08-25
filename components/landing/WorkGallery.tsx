"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Button from "@/components/Button";
import KeySwitch from "@/components/fx/KeySwitch";
import type { Project } from "@/lib/work";

/**
 * Selected work as a pinned horizontal gallery. The wheel drives the track
 * sideways; each plate is tinted with the project's own signature color and
 * layers one or two browser-framed screenshots (contained at native aspect —
 * never cover-cropped or upscaled, the sources are only ~1536px wide). The
 * frames drift vertically against the travel (translate-only parallax, no
 * scaling → no blur). A live counter + progress rail sit at the bottom.
 * Mobile: vertical stack, main shot only.
 */
export default function WorkGallery({ projects }: { projects: Project[] }) {
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

          // vertical counter-drift inside each plate; sign flips direction
          gsap.utils.toArray<HTMLElement>(".work-shot-drift").forEach((img) => {
            const depth = parseFloat(img.dataset.depth ?? "4");
            gsap.fromTo(
              img,
              { yPercent: depth },
              {
                yPercent: -depth,
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
            <Button href="/projects" variant="outline" arrow>
              See all projects
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

            <div
              className="band relative overflow-hidden rounded-[1.75rem] border border-white/10 text-paper shadow-[0_30px_80px_-45px_rgba(15,23,42,0.55)] md:h-[64vh] md:min-h-[540px]"
              style={{ background: p.dots[2] }}
            >
              {/* the project's own colors as a soft ambience */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(85% 70% at 18% 0%, color-mix(in oklab, ${p.dots[0]} 28%, transparent), transparent 62%), radial-gradient(70% 60% at 88% 100%, color-mix(in oklab, ${p.dots[1]} 20%, transparent), transparent 70%)`,
                }}
              />

              <Link
                href={`/projects/${p.slug}`}
                className="absolute inset-0 z-30"
                aria-label={`${p.name} — project detail`}
                data-cursor
              />

              {/* main shot — browser-framed, contained at native aspect */}
              <div
                className={`relative z-10 p-4 pb-0 md:absolute md:p-0 ${
                  p.img2
                    ? "md:left-[6%] md:top-[9%] md:w-[64%]"
                    : "md:left-1/2 md:top-[11%] md:w-[76%] md:-translate-x-1/2"
                }`}
              >
                <div className="work-shot-drift" data-depth="4">
                  <Shot
                    src={p.img}
                    alt={`${p.name} — ${p.category}`}
                    sizes={
                      p.img2
                        ? "(max-width: 768px) 92vw, 36vw"
                        : "(max-width: 768px) 92vw, 43vw"
                    }
                    chrome={{ url: p.url, dots: p.dots }}
                    glare
                    className="transition-transform duration-700 ease-out group-hover:-translate-y-1.5"
                  />
                </div>
              </div>

              {/* secondary shot floating in from the opposite corner */}
              {p.img2 && (
                <div className="absolute bottom-[24%] right-[5%] z-20 hidden w-[44%] md:block">
                  <div className="work-shot-drift" data-depth="-7">
                    <Shot
                      src={p.img2}
                      alt={`${p.name} — interface detail`}
                      sizes="25vw"
                      className="transition-transform duration-700 ease-out group-hover:translate-y-1.5"
                    />
                  </div>
                </div>
              )}

              {/* meta */}
              <div className="relative z-20 flex items-end justify-between gap-4 p-6 md:absolute md:inset-x-0 md:bottom-0 md:p-8">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
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

/** A screenshot in a minimal browser frame. All work sources are ~1536×743,
 *  so the fixed aspect shows them whole — displayed smaller than the source,
 *  which is what keeps them crisp. */
function Shot({
  src,
  alt,
  sizes,
  chrome,
  glare = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  /** title bar with the project's signature dots + live URL (main shot only) */
  chrome?: { url: string; dots: Project["dots"] };
  glare?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)] ${className}`}
    >
      {chrome && (
        <figcaption className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-3.5 py-2">
          {chrome.dots.map((c, j) => (
            <span
              key={j}
              style={{ background: c }}
              className="h-1.5 w-1.5 rounded-full ring-1 ring-white/20"
            />
          ))}
          <span className="ml-2 truncate font-mono text-[10px] tracking-wider text-paper/40">
            {chrome.url}
          </span>
        </figcaption>
      )}
      <div className="relative aspect-[1536/743]">
        <Image
          src={src}
          alt={alt}
          fill
          quality={90}
          sizes={sizes}
          className="object-cover object-top"
        />
        {glare && (
          <div className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full" />
        )}
      </div>
    </figure>
  );
}
