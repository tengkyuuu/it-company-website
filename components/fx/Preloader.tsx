"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import Wordmark from "@/components/Wordmark";

/** First-load intro: counts to 100, then wipes up to reveal the page. */
export default function Preloader() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const seen = (() => {
        try {
          return !!sessionStorage.getItem("mykt-preloaded");
        } catch {
          return false;
        }
      })();
      if (seen) {
        setDone(true);
        return;
      }
      const finish = () => {
        try {
          sessionStorage.setItem("mykt-preloaded", "1");
        } catch {}
        document.documentElement.classList.remove("lenis-stopped");
        window.dispatchEvent(new Event("mykt:ready"));
        setDone(true);
      };
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduce) {
        finish();
        return;
      }

      document.documentElement.classList.add("lenis-stopped");
      const counter = { v: 0 };
      const tl = gsap.timeline({ onComplete: finish });

      tl.to(counter, {
        v: 100,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => {
          if (numRef.current)
            numRef.current.textContent = String(Math.round(counter.v)).padStart(
              3,
              "0"
            );
        },
      })
        .to(".pl-bar", { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, 0)
        .to(
          [".pl-word", ".pl-meta"],
          { yPercent: -120, opacity: 0, duration: 0.6, ease: "power3.in", stagger: 0.05 },
          "+=0.1"
        )
        .to(
          root.current,
          { yPercent: -100, duration: 0.8, ease: "power4.inOut" },
          "-=0.2"
        );
    },
    { scope: root }
  );

  if (done) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-ink p-6 text-paper md:p-10"
      aria-hidden
    >
      <div className="flex items-start justify-between">
        <span className="pl-meta font-mono text-xs uppercase tracking-[0.2em] text-paper/50">
          MYKT Studio
        </span>
        <span className="pl-meta font-mono text-xs uppercase tracking-[0.2em] text-paper/50">
          Dipolog · PH
        </span>
      </div>

      <div className="overflow-hidden">
        <Wordmark
          href={null}
          invert
          className="pl-word text-[15vw] md:text-[9rem]"
        />
      </div>

      <div className="flex items-end justify-between">
        <span className="pl-meta max-w-xs text-sm text-paper/50">
          Software, designed with intent.
        </span>
        <span className="pl-meta font-mono text-5xl font-semibold tabular-nums md:text-7xl">
          <span ref={numRef}>000</span>
        </span>
      </div>

      {/* progress bar */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
        <div className="pl-bar h-full origin-left scale-x-0 bg-accent" />
      </div>
    </div>
  );
}
