"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { isStandaloneLaunch } from "@/components/pwa/display-mode";
import { markReady } from "./ready";

/**
 * Opening sequence, played on every full load of the site.
 *
 * 1. a faint MykTech mark sits centred on the page colour (follows the theme)
 * 2. a band of gold light sweeps left→right, inking the mark in behind it
 * 3. the gold spark resolves — the mark is now identical to the nav's
 * 4. the mark shrinks and flies to the nav's centre slot while the splash
 *    background fades away and the hero comes in beneath it; at the landing
 *    the real nav logo takes over (it's hidden until this component unmounts)
 *
 * The choreography is **CSS**, not GSAP (see `.pl-*` in globals.css): it starts at
 * first paint instead of waiting for React to hydrate, and every keyframe animates
 * only `transform` / `opacity`, so it composites and stays smooth while hydration
 * fights for the main thread. The landing spot is computed in CSS from the same
 * constants the Nav uses (`--nav-h`, 160px / 176px logo, centred).
 *
 * This component only decides two moments:
 * - READY_MS (the flight begins): markReady() → `mykt:ready`, so the hero copy
 *   and reel come in *during* the flight, as on the reference;
 * - TOTAL_MS (the flight lands): unlock scrolling and unmount.
 *
 * No sessionStorage gate — the client asked for this on each opening. It replays
 * on a real page load only; client-side route changes don't remount it.
 *
 * Installed-app launch (PWA): the head script marks <html data-display="standalone">
 * before first paint, CSS hides `.pl`, and this hands over at once.
 */
const READY_MS = 1150; // keep in sync with the pl-rise / pl-fade delay in globals.css
const TOTAL_MS = 1950; // …and with that delay + duration

export default function Preloader() {
  const [done, setDone] = useState(false);
  const clock = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (isStandaloneLaunch()) {
      finished.current = true;
      markReady();
      setDone(true);
      return;
    }

    const html = document.documentElement;
    html.classList.add("lenis-stopped");

    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      html.classList.remove("lenis-stopped");
      markReady(); // in case the ready timer was skipped
      setDone(true);
    };
    finishRef.current = finish;

    // Schedule off the animation's OWN clock, not its animationend event: the
    // event dispatches on the busy main thread and measured ~700ms late.
    // `.pl-bg` carries exactly one animation (pl-fade) — read it off the
    // element, since a minifier is free to rename keyframes.
    const anim = clock.current?.getAnimations()?.[0];
    let elapsed = 0;
    if (anim) {
      const t = Number(anim.currentTime ?? 0);
      if (Number.isFinite(t)) elapsed = t;
      anim.finished.then(finish).catch(() => {});
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const readyTimer = window.setTimeout(markReady, reduce ? 0 : Math.max(0, READY_MS - elapsed));
    const doneTimer = window.setTimeout(finish, reduce ? 300 : Math.max(0, TOTAL_MS - elapsed));

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(doneTimer);
      html.classList.remove("lenis-stopped");
    };
  }, []);

  if (done) return null;

  return (
    <div className="pl" aria-hidden>
      <div
        ref={clock}
        className="pl-bg"
        onAnimationEnd={(e) => {
          if (e.target === clock.current) finishRef.current();
        }}
      />
      <div className="pl-travel">
        <div className="pl-stage">
          {/* resting state */}
          <Logo className="pl-layer pl-faint" />

          {/* full ink, revealed left→right as the light passes */}
          <span className="pl-ink-wrap">
            <Logo className="pl-layer pl-ink" />
          </span>

          {/* the light itself, clipped to the letterforms */}
          <span className="pl-ray">
            <span className="pl-ray-band" />
          </span>

          {/* resolved: the nav's exact mark, gold spark included */}
          <span className="pl-final">
            <Logo accent className="pl-layer pl-ink" />
          </span>
        </div>
      </div>
    </div>
  );
}
