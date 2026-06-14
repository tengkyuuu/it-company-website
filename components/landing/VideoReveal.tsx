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
          // The video is eased toward the scroll target every frame so seeking
          // is glass-smooth (the clip is re-encoded all-keyframes for this).
          const state = { target: 0, current: 0 };
          let raf = 0;
          const tick = () => {
            state.current += (state.target - state.current) * 0.13;
            if (vid.duration)
              vid.currentTime = state.current * (vid.duration - 0.05);
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: "+=240%",
              pin: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                state.target = self.progress;
              },
            },
          });

          // margins → full-bleed over the first ~45% of the scroll
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
              duration: 0.45,
            },
            0
          );

          return () => cancelAnimationFrame(raf);
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
