"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";

/**
 * Opening sequence, played on every full load of the site.
 *
 * 1. the mykTech() mark sits in gray on #111a24
 * 2. a raked band of white light sweeps left→right, leaving the mark white behind it
 * 3. it resolves to black with a thin white outline
 * 4. the panel lifts away and dispatches `mykt:ready` (the Hero headline waits on it)
 *
 * Every state is the same wordmark mask in a different colour, so there's no font
 * swap and no reflow. The choreography is **CSS**, not GSAP (see `.pl-*` in
 * globals.css): it therefore starts at first paint instead of waiting for React to
 * hydrate, and it runs on the compositor, so it stays smooth while hydration, the
 * hero's WebGL scene and the showreel preload all fight for the main thread.
 * This component only decides when the sequence is over.
 *
 * No sessionStorage gate — the client asked for this on each opening. It replays
 * on a real page load only; client-side route changes don't remount it.
 */
const TOTAL_MS = 2140; // keep in sync with the pl-out delay + duration in globals.css

export default function Preloader() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("lenis-stopped");

    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      html.classList.remove("lenis-stopped");
      window.dispatchEvent(new Event("mykt:ready"));
      setDone(true);
    };
    finishRef.current = finish;

    // Hand over on the animation's OWN clock, not on its animationend event.
    // The sequence is composited, so it finishes on time visually — but the
    // event dispatches on the main thread, which is busy hydrating and booting
    // WebGL, and measured ~700ms late. Waiting for it kept the scroll locked
    // long after the panel had already slid away.
    //
    // Read the animation off the element rather than by name: .pl carries
    // exactly one (pl-out), and a CSS minifier is free to rename keyframes.
    const anim = root.current?.getAnimations()?.[0];
    let remaining = TOTAL_MS;
    if (anim) {
      // currentTime counts up through the delay, so this is time-to-end
      const elapsed = Number(anim.currentTime ?? 0);
      if (Number.isFinite(elapsed)) remaining = Math.max(0, TOTAL_MS - elapsed);
      // belt and braces: whichever resolves first wins, finish() is idempotent
      anim.finished.then(finish).catch(() => {});
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finish, reduce ? 300 : remaining);

    return () => {
      window.clearTimeout(timer);
      html.classList.remove("lenis-stopped");
    };
  }, []);

  if (done) return null;

  return (
    <div
      ref={root}
      className="pl"
      aria-hidden
      // only .pl carries the lift-away animation, so its end is the sequence's end
      onAnimationEnd={(e) => {
        if (e.target === root.current) finishRef.current();
      }}
    >
      <div className="pl-stage">
        {/* resting state */}
        <Logo className="pl-layer pl-gray" />

        {/* white, revealed left→right as the light passes */}
        <span className="pl-white-wrap">
          <Logo className="pl-layer pl-white" />
        </span>

        {/* the light itself, clipped to the letterforms */}
        <span className="pl-ray">
          <span className="pl-ray-band" />
        </span>

        {/* resolved: white ring beneath a black fill */}
        <span className="pl-final">
          <Logo variant="outline" className="pl-layer pl-ring" />
          <Logo className="pl-layer pl-black" />
        </span>
      </div>
    </div>
  );
}
