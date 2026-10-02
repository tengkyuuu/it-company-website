"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { whenReady } from "@/components/fx/ready";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * Scroll-driven showreel. Instead of scrubbing a <video> (which forces a
 * seek + frame decode on every scroll tick → lag/drops), we pre-extract the
 * clip into an image sequence and paint the right frame onto a <canvas>.
 * Drawing a pre-decoded image is instant, so scrubbing is perfectly smooth.
 *
 * Desktop: pin → expand to full-bleed → THEN scrub the frames with scroll.
 * Mobile: contained card, frames auto-loop. Reduced-motion: static frame.
 */
/**
 * 80 frames at 1280x960, not 160 at 1600x1200. That halving is a memory
 * decision as much as a bandwidth one: every frame we hold is a *decoded*
 * bitmap, so the old sequence had a ceiling of ~1.14 GB of bitmap
 * (160 x 1600 x 1200 x 4 bytes) against ~0.37 GB now. On the wire it went
 * 7.07 MB -> 2.14 MB. The canvas is full-bleed `object-cover`, so 1280 wide
 * is enough at desktop widths. Re-encode with scripts/build-reel.mjs.
 */
const FRAME_COUNT = 80;
const FRAME_W = 1280;
const FRAME_H = 960;
const frameSrc = (i: number) =>
  `/brand/reel/f-${String(i + 1).padStart(3, "0")}.webp`;

export default function VideoReveal() {
  const { t } = useI18n();
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
      const ready = (im?: HTMLImageElement) =>
        !!im && im.complete && im.naturalWidth > 0;

      const draw = (idx: number, force = false) => {
        idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(idx)));
        if (idx === current && !force) return;
        let im: HTMLImageElement | undefined = images[idx];
        // Fall back to the nearest frame that HAS arrived. This is what makes the
        // coarse-first pass below usable: a scrub over not-yet-loaded frames
        // shows the closest neighbour instead of freezing on the last one.
        for (let d = 1; d <= 6 && !ready(im); d++) {
          im = ready(images[idx - d])
            ? images[idx - d]
            : ready(images[idx + d])
              ? images[idx + d]
              : undefined;
        }
        if (!im || !ready(im)) return;
        current = idx;
        ctx.drawImage(im, 0, 0, FRAME_W, FRAME_H);
        cv.dataset.frame = String(idx);
      };

      const loadFrame = (i: number) => {
        if (images[i]) return;
        const im = new Image();
        im.decoding = "async";
        im.src = frameSrc(i);
        if (i === 0) im.onload = () => draw(0, true);
        // Decode on the browser's image threads as soon as the bytes land, so
        // the scrub's drawImage() isn't what pays for a synchronous decode
        // mid-scroll. Best-effort: if it rejects, drawImage decodes as before.
        im.decode().catch(() => {});
        images[i] = im;
      };

      let preloadStarted = false;
      const startPreload = () => {
        if (preloadStarted) return;
        preloadStarted = true;
        // Every 4th frame first (20 requests) so the section is scrubbable almost
        // at once, then backfill the rest when the main thread is idle. Firing all
        // 80 at once saturates the connection and delays the coarse pass too.
        for (let i = 0; i < FRAME_COUNT; i += 4) loadFrame(i);
        const backfill = () => {
          for (let i = 0; i < FRAME_COUNT; i++) loadFrame(i);
        };
        const ric = (
          window as unknown as {
            requestIdleCallback?: (
              cb: () => void,
              opts?: { timeout: number }
            ) => void;
          }
        ).requestIdleCallback;
        if (ric) ric(backfill, { timeout: 2500 });
        else window.setTimeout(backfill, 700);
      };

      // TWO gates, both required. `mykt:ready` keeps these requests from starving
      // the opening sequence; the IntersectionObserver keeps us from spending
      // 2 MB on a visitor who never scrolls this far — which the old code did on
      // every single load.
      let splashDone = false;
      let isNear = false;
      const maybeStart = () => {
        if (splashDone && isNear) startPreload();
      };
      const onSplashDone = () => {
        splashDone = true;
        maybeStart();
      };
      // immediate if the splash already ran (client-side nav back to /)
      const offReady = whenReady(onSplashDone);
      // …and a backstop in case that event never lands
      const preloadFallback = window.setTimeout(onSplashDone, 4000);

      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            isNear = true;
            io.disconnect();
            maybeStart();
          }
        },
        // 400px of runway, in PIXELS not %, and measured deliberately:
        // at 1440x900 this section starts 805px below the fold, so 400px defers
        // it past first load while still warming up before the visitor arrives.
        // A percentage can't work here — 150% was 1350px, which reached the
        // section at scroll 0 and defeated the whole gate.
        // Caveat: on a 390x844 phone the section is only 130px down (the hero is
        // 100svh there, not 175vh), so mobile still starts immediately. The
        // coarse-first pass above is what keeps that cheap.
        { rootMargin: "400px 0px" }
      );
      if (section.current) io.observe(section.current);

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

      return () => {
        offReady();
        window.clearTimeout(preloadFallback);
        io.disconnect();
      };
    },
    { scope: section }
  );

  return (
    <section
      ref={section}
      className="relative h-screen overflow-hidden"
      aria-label={t("showreel.label")}
    >
      <div
        ref={frame}
        // Tight shadow on purpose: this box is resized every frame of the expand,
        // so its shadow is re-rasterised each frame — a 140px blur cost a frame.
        className="band absolute overflow-hidden bg-ink shadow-[0_36px_64px_-36px_rgba(15,23,42,0.5)]"
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
          aria-label={t("showreel.label")}
        />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        <span className="pointer-events-none absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
          ● {t("showreel.tag")}
        </span>
      </div>
    </section>
  );
}
