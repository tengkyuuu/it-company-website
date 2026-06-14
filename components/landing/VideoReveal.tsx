"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

/**
 * Scroll-driven showreel. Instead of scrubbing a <video> (which forces a
 * seek + frame decode on every scroll tick → lag/drops), we pre-extract the
 * clip into an image sequence and paint the right frame onto a <canvas>.
 * Drawing a pre-decoded image is instant, so scrubbing is perfectly smooth.
 *
 * Desktop: pin → expand to full-bleed → THEN scrub the frames with scroll.
 * Mobile: contained card, frames auto-loop. Reduced-motion: static frame.
 */
const FRAME_COUNT = 160;
const FRAME_W = 1600;
const FRAME_H = 1200;
const frameSrc = (i: number) =>
  `/brand/reel/f-${String(i + 1).padStart(3, "0")}.webp`;

export default function VideoReveal() {
  const section = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const cv = canvas.current;
      const fr = frame.current;
      if (!cv || !fr) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      cv.width = FRAME_W;
      cv.height = FRAME_H;

      // ---- preload the frame sequence ----
      const images: HTMLImageElement[] = new Array(FRAME_COUNT);
      let current = -1;
      const draw = (idx: number, force = false) => {
        idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(idx)));
        if (idx === current && !force) return;
        const im = images[idx];
        if (!im || !im.complete || !im.naturalWidth) return;
        current = idx;
        ctx.drawImage(im, 0, 0, FRAME_W, FRAME_H);
        cv.dataset.frame = String(idx);
      };
      for (let i = 0; i < FRAME_COUNT; i++) {
        const im = new Image();
        im.decoding = "async";
        im.src = frameSrc(i);
        if (i === 0) im.onload = () => draw(0, true);
        images[i] = im;
      }

      const mm = gsap.matchMedia();

      // ---- Desktop: pin + expand, then scrub the frames ----
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const EXPAND_END = 0.34;
          const scrub = { t: 0 };
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: "+=320%",
              pin: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          tl.fromTo(
            fr,
            {
              top: "16vh",
              bottom: "16vh",
              left: "12vw",
              right: "12vw",
              borderRadius: "1.75rem",
            },
            {
              top: "0vh",
              bottom: "0vh",
              left: "0vw",
              right: "0vw",
              borderRadius: "0rem",
              ease: "power2.inOut",
              duration: EXPAND_END,
            },
            0
          );
          // frames advance only after the zoom tween is complete
          tl.fromTo(
            scrub,
            { t: 0 },
            {
              t: 1,
              ease: "none",
              duration: 1 - EXPAND_END,
              onUpdate: () => draw(scrub.t * (FRAME_COUNT - 1)),
            },
            EXPAND_END
          );
        }
      );

      // ---- Mobile: contained card, frames auto-loop ----
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.set(fr, {
          top: "8vh",
          bottom: "8vh",
          left: "4vw",
          right: "4vw",
          borderRadius: "1.25rem",
        });
        const o = { i: 0 };
        const loop = gsap.to(o, {
          i: FRAME_COUNT - 1,
          duration: FRAME_COUNT / 30,
          ease: "none",
          repeat: -1,
          paused: true,
          onUpdate: () => draw(o.i),
        });
        const st = ScrollTrigger.create({
          trigger: section.current,
          start: "top 85%",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
        });
        return () => {
          loop.kill();
          st.kill();
        };
      });

      // ---- Reduced-motion: static, contained ----
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(fr, {
          top: "10vh",
          bottom: "10vh",
          left: "6vw",
          right: "6vw",
          borderRadius: "1.25rem",
        });
        draw(0, true);
      });
    },
    { scope: section }
  );

  return (
    <section
      ref={section}
      className="relative h-screen overflow-hidden"
      aria-label="MYKT showreel"
    >
      <div
        ref={frame}
        className="absolute overflow-hidden bg-ink shadow-[0_50px_140px_-50px_rgba(15,23,42,0.55)]"
        style={{
          top: "16vh",
          bottom: "16vh",
          left: "12vw",
          right: "12vw",
          borderRadius: "1.75rem",
        }}
      >
        <canvas
          ref={canvas}
          className="block h-full w-full object-cover"
          aria-label="MYKT showreel"
        />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        <span className="pointer-events-none absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
          ● Inside the studio
        </span>
      </div>
    </section>
  );
}
