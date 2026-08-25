"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Button from "@/components/Button";
import { Eyebrow } from "@/components/Section";
import LocalTime from "@/components/fx/LocalTime";
import KeySwitch from "@/components/fx/KeySwitch";
import { site } from "@/lib/site";
import { wants3D } from "@/lib/webgl";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
});

/**
 * Immersive hero: a 175vh runway with a sticky full-viewport stage.
 * Scroll progress is piped into the WebGL constellation (shapes scatter,
 * camera pulls back) while the headline lifts away at its own speed.
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    setShow3d(wants3D());
  }, []);

  // ---- scroll choreography (desktop only — mobile hero is one viewport tall)
  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
              onUpdate: (self) => {
                progress.current = self.progress;
              },
            },
            defaults: { ease: "none" },
          });
          tl.to(".hero-copy", { yPercent: -22, opacity: 0 }, 0)
            .to(".hero-meta", { opacity: 0 }, 0)
            .to(".hero-badge", { opacity: 0 }, 0)
            .to(".hero-canvas", { opacity: 0.15 }, 0.2);
        }
      );
    },
    { scope: root }
  );

  // ---- first-load intro, gated on the preloader's "mykt:ready"
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets =
      ".hero-eyebrow, .hero-line > span, .hero-sub, .hero-cta, .hero-cue, .hero-meta, .hero-badge";
    let played = false;
    let play: () => void = () => {};

    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set(targets, { opacity: 1, y: 0, yPercent: 0 });
        return;
      }
      play = () => {
        if (played) return;
        played = true;
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from(".hero-eyebrow", { opacity: 0, y: 16, duration: 0.6 })
          .from(
            ".hero-line > span",
            { yPercent: 115, duration: 1, stagger: 0.12 },
            "-=0.3"
          )
          .from(".hero-sub", { opacity: 0, y: 20, duration: 0.8 }, "-=0.6")
          .from(
            ".hero-cta",
            { opacity: 0, y: 20, duration: 0.7, stagger: 0.08 },
            "-=0.6"
          )
          .from(
            ".hero-meta, .hero-badge, .hero-cue",
            { opacity: 0, duration: 0.6 },
            "-=0.4"
          );
      };

      let hasPreloaded = false;
      try {
        hasPreloaded = !!sessionStorage.getItem("mykt-preloaded");
      } catch {}
      if (hasPreloaded) {
        play();
      } else {
        window.addEventListener("mykt:ready", play, { once: true });
        gsap.delayedCall(2.8, play); // safety net
      }
    }, root);

    return () => {
      window.removeEventListener("mykt:ready", play);
      ctx.revert();
    };
  }, []);

  return (
    <section ref={root} className="relative h-[100svh] md:h-[175vh]">
      {/* sticky stage */}
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        {/* visual layer */}
        <div className="hero-canvas pointer-events-none absolute inset-0 -z-10">
          {show3d ? (
            <HeroScene progress={progress} />
          ) : (
            <div
              className="absolute right-[-20%] top-[24%] h-[70vmin] w-[70vmin] rounded-full opacity-60 blur-[60px]"
              style={{ background: "var(--accent)" }}
            />
          )}
          <div className="absolute inset-0 grain" />
        </div>

        {/* copy */}
        <div className="hero-copy mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pt-24">
          <div className="hero-eyebrow">
            <Eyebrow>IT Studio · Dipolog City</Eyebrow>
          </div>

          <h1 className="mt-6 font-display text-[clamp(3.1rem,9.5vw,8.75rem)] font-bold leading-[0.98] tracking-[-0.03em]">
            <span className="hero-line block overflow-hidden">
              <span className="block">We build</span>
            </span>
            <span className="hero-line block overflow-hidden">
              <span className="text-stroke block">software that</span>
            </span>
            <span className="hero-line block overflow-hidden">
              <span className="block">
                feels <span className="text-accent">designed.</span>
              </span>
            </span>
          </h1>

          <div className="mt-9 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p className="hero-sub max-w-md text-pretty text-lg leading-relaxed text-ink/60">
              An IT studio crafting web, mobile, and cloud products — solid
              engineering with the eye of a design house.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="hero-cta inline-block">
                <Button href="/services" arrow>
                  Explore our work
                </Button>
              </span>
              <span className="hero-cta inline-block">
                <Button href="/about" variant="outline">
                  Meet the studio
                </Button>
              </span>
              <span className="hero-cta hidden sm:inline-block">
                <KeySwitch size={54} tint="gold" className="align-middle" />
              </span>
            </div>
          </div>
        </div>

        {/* rotating badge */}
        <div className="hero-badge pointer-events-none absolute right-10 top-28 hidden lg:block">
          <svg viewBox="0 0 120 120" className="h-28 w-28 ic-spin" aria-hidden>
            <defs>
              <path
                id="hero-circ"
                d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"
              />
              <linearGradient id="hero-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#9d5a8f" />
                <stop offset="50%" stopColor="#b85c7a" />
                <stop offset="100%" stopColor="#e0a23a" />
              </linearGradient>
            </defs>
            {/* no `uppercase` here — it would render the wordmark as MYKTECH() */}
            <text className="fill-slatey font-mono text-[9px] tracking-[0.32em]">
              <textPath href="#hero-circ">
                mykTech() · software · design · innovation ·
              </textPath>
            </text>
            <circle cx="60" cy="60" r="5" fill="url(#hero-grad)" />
          </svg>
        </div>

        {/* meta bar */}
        <div className="hero-meta pointer-events-none absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-7xl items-end justify-between px-6 pb-6 font-mono text-[10px] uppercase tracking-[0.25em] text-slatey">
            <span className="hidden sm:block">
              {site.geo.lat}° N — {site.geo.lng}° E
            </span>
            <span>
              Dipolog City · <LocalTime />
            </span>
          </div>
        </div>

        {/* scroll cue */}
        <div className="hero-cue absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slatey">
            Scroll
          </span>
          <span className="relative h-12 w-px overflow-hidden bg-mist">
            <span className="absolute left-0 top-0 h-4 w-px animate-[scrollcue_1.8s_ease-in-out_infinite] bg-accent" />
          </span>
        </div>
      </div>
    </section>
  );
}
