"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import Button from "@/components/Button";
import { Eyebrow } from "@/components/Section";

const BlobScene = dynamic(() => import("./BlobScene"), { ssr: false });

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const big = window.matchMedia("(min-width: 768px)").matches;
    setShow3d(big && !reduce && webglOK());
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets =
      ".hero-eyebrow, .hero-line > span, .hero-sub, .hero-cta, .hero-cue";
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
          .from(".hero-cue", { opacity: 0, duration: 0.6 }, "-=0.3");
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
    <section
      ref={root}
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden"
    >
      {/* Visual layer */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {show3d ? (
          <div
            className="absolute right-[-10%] top-1/2 h-[80vmin] max-h-[720px] w-[80vmin] max-w-[720px] -translate-y-1/2 md:right-[-2%] lg:right-[4%]"
            style={{
              WebkitMaskImage:
                "radial-gradient(circle at 50% 50%, #000 44%, transparent 68%)",
              maskImage:
                "radial-gradient(circle at 50% 50%, #000 44%, transparent 68%)",
            }}
          >
            <BlobScene />
          </div>
        ) : (
          <div
            className="absolute right-[-20%] top-[24%] h-[70vmin] w-[70vmin] rounded-full opacity-60 blur-[60px]"
            style={{ background: "var(--accent)" }}
          />
        )}
        <div className="absolute inset-0 grain" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 pt-28">
        <div className="hero-eyebrow">
          <Eyebrow>IT Studio · Dipolog City</Eyebrow>
        </div>

        <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.03] tracking-[-0.02em] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
          <span className="hero-line block overflow-hidden">
            <span className="block">We build</span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block">software that</span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block">
              feels <span className="text-accent">designed.</span>
            </span>
          </span>
        </h1>

        <p className="hero-sub mt-8 max-w-md text-pretty text-lg leading-relaxed text-ink/60">
          An IT studio crafting web, mobile, and cloud products — solid
          engineering with the eye of a design house.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
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
    </section>
  );
}
