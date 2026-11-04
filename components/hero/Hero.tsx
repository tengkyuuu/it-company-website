"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import Button from "@/components/Button";
import { Eyebrow } from "@/components/Section";
import LocalTime from "@/components/fx/LocalTime";
import KeySwitch from "@/components/fx/KeySwitch";
import { whenReady } from "@/components/fx/ready";
import { useI18n } from "@/components/i18n/I18nProvider";
import CurvedReel from "@/components/hero/CurvedReel";
import type { HeroShot } from "@/lib/hero-shots";
import { site } from "@/lib/site";
import { observeVisible } from "@/lib/webgl";

/**
 * v2 hero: one viewport. The headline sits over a curved reel of our real
 * project screenshots (CurvedReel — pure CSS 3D, no WebGL); the gold keycap is
 * the hero's one gold moment. The reel plays only while the hero is on screen and
 * the opening sequence is done.
 */
export default function Hero({ shots }: { shots: HeroShot[] }) {
  // headline + sub stay English in both locales (marketing copy, and the line
  // mask is choreographed per line); eyebrow, CTAs are chrome
  const { t, href } = useI18n();
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  // the reel animates only while on screen and once the splash is gone
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let visible = true;
    let ready = false;
    const sync = () => setActive(visible && ready);
    const stopObserving = observeVisible(
      el,
      (v) => {
        visible = v;
        sync();
      },
      "120px 0px"
    );
    const offReady = whenReady(() => {
      ready = true;
      sync();
    });
    return () => {
      stopObserving();
      offReady();
    };
  }, []);

  // ---- first-load intro, gated on the preloader's "mykt:ready"
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = ".hero-eyebrow, .hero-line > span, .hero-sub, .hero-cta, .hero-meta";
    let played = false;
    let play: () => void = () => {};
    let offReady: () => void = () => {};

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
          .from(".hero-line > span", { yPercent: 115, duration: 1, stagger: 0.12 }, "-=0.3")
          .from(".hero-sub", { opacity: 0, y: 20, duration: 0.8 }, "-=0.6")
          .from(".hero-cta", { opacity: 0, y: 20, duration: 0.7, stagger: 0.08 }, "-=0.6")
          .from(".hero-meta", { opacity: 0, duration: 0.6 }, "-=0.4");
      };

      let hasPreloaded = false;
      try {
        hasPreloaded = !!sessionStorage.getItem("mykt-preloaded");
      } catch {}
      if (hasPreloaded) {
        play();
      } else {
        // immediate when the splash already ran (client-side nav back to /),
        // instead of sitting out the safety net below
        offReady = whenReady(play);
        gsap.delayedCall(2.8, play); // safety net
      }
    }, root);

    return () => {
      offReady();
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={root}
      className="relative flex h-[100svh] min-h-[640px] flex-col overflow-hidden"
    >
      {/* the reel fills the stage behind the copy */}
      <CurvedReel shots={shots} active={active} className="absolute inset-0" />

      {/* headline */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-28 md:pt-32">
        <div className="hero-eyebrow">
          <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
        </div>
        <h1 className="mt-5 font-display text-[clamp(2.5rem,6.6vw,6rem)] font-medium leading-[1] tracking-[-0.045em]">
          <span className="hero-line block overflow-hidden">
            <span className="block">We build software</span>
          </span>
          <span className="hero-line block overflow-hidden">
            <span className="block">
              that feels <span className="text-stroke">designed.</span>
            </span>
          </span>
        </h1>
      </div>

      {/* bottom: sub + CTAs + the gold keycap */}
      <div className="relative z-10 mx-auto mt-auto w-full max-w-7xl px-6 pb-14 md:pb-16">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <p className="hero-sub max-w-md text-pretty text-lg leading-relaxed text-ink/60">
            An IT studio crafting web, mobile, and cloud products — solid engineering
            with the eye of a design house.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hero-cta inline-block">
              <Button href={href("/projects")} arrow>
                {t("hero.primaryCta")}
              </Button>
            </span>
            <span className="hero-cta inline-block">
              <Button href={href("/contact")} variant="outline">
                {t("hero.secondaryCta")}
              </Button>
            </span>
            {/* the gold key has a job: press it to start a project */}
            <span className="hero-cta hidden sm:inline-block">
              <Link
                href={href("/contact")}
                aria-label={t("hero.secondaryCta")}
                className="ks-trigger inline-block rounded-2xl align-middle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold-ink)]"
              >
                <KeySwitch size={58} tint="gold" />
              </Link>
            </span>
          </div>
        </div>
      </div>

      {/* meta bar */}
      <div className="hero-meta pointer-events-none absolute inset-x-0 bottom-0">
        <div className="mx-auto flex max-w-7xl items-end justify-between px-6 pb-5 font-mono text-[10px] uppercase tracking-[0.25em] text-slatey">
          <span className="hidden sm:block">
            {site.geo.lat}° N — {site.geo.lng}° E
          </span>
          <span>
            Dipolog City · <LocalTime />
          </span>
        </div>
      </div>
    </section>
  );
}
