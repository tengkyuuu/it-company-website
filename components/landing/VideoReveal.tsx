"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

/**
 * Scroll-driven showreel. Starts as an inset, rounded card; as you scroll it
 * pins, expands to full-bleed, and the video scrubs frame-by-frame with the
 * scroll. Releases back into normal flow afterwards.
 * Mobile / reduced-motion: a contained autoplaying loop (no pin/scrub).
 */
export default function VideoReveal() {
  const section = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);
      const vid = video.current;
      const fr = frame.current;
      if (!vid || !fr) return;

      const mm = gsap.matchMedia();

      // ---- Desktop: pin + expand + scrub ----
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          // Two tweens on ONE scrubbed timeline. The zoom occupies [0, EXPAND_END];
          // the video scrub occupies [EXPAND_END, 1] — so GSAP guarantees the clip
          // cannot advance until the frame has fully zoomed in. Both share the same
          // playhead, so they can never desync.
          const EXPAND_END = 0.34;
          const scrub = { t: 0 };

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: "+=320%",
              pin: true,
              scrub: 1.2,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          // 1) margins → full-bleed
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

          // 2) scrub the clip — starts only once the zoom tween is finished
          tl.fromTo(
            scrub,
            { t: 0 },
            {
              t: 1,
              ease: "none",
              duration: 1 - EXPAND_END,
              onUpdate: () => {
                if (vid.duration) vid.currentTime = scrub.t * (vid.duration - 0.05);
              },
            },
            EXPAND_END
          );
        }
      );

      // ---- Mobile / reduced-motion: contained autoplay loop ----
      mm.add("(max-width: 767px), (prefers-reduced-motion: reduce)", () => {
        gsap.set(fr, {
          top: "8vh",
          bottom: "8vh",
          left: "4vw",
          right: "4vw",
          borderRadius: "1.25rem",
        });
        vid.muted = true;
        vid.loop = true;
        const st = ScrollTrigger.create({
          trigger: section.current,
          start: "top 80%",
          end: "bottom top",
          onEnter: () => vid.play().catch(() => {}),
          onEnterBack: () => vid.play().catch(() => {}),
          onLeave: () => vid.pause(),
          onLeaveBack: () => vid.pause(),
        });
        return () => st.kill();
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
        <video
          ref={video}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="auto"
        >
          <source src="/brand/landing-page-vid.mp4" type="video/mp4" />
        </video>

        {/* subtle frame vignette + label */}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        <span className="pointer-events-none absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
          ● Inside the studio
        </span>
      </div>
    </section>
  );
}
