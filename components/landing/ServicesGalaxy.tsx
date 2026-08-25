"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "@/components/Icon";
import KeySwitch from "@/components/fx/KeySwitch";
import { services } from "@/lib/services";
import { wants3D } from "@/lib/webgl";

const GlyphScene = dynamic(() => import("@/components/three/GlyphScene"), {
  ssr: false,
});

/**
 * Desktop: a sticky panel holds a WebGL glyph that morphs as the visitor
 * scrolls the service index on the right; each service has its own 3D form.
 * Mobile: the index stacks, each row carrying its animated icon.
 *
 * Follows the theme rather than using `.band` — it sits on `bg-surface`, which
 * is white in light mode and an elevated slate in dark, so the section still
 * reads as its own movement either way. That means no hardcoded white/XX
 * alphas inside: everything goes through the neutral ramp.
 */
export default function ServicesGalaxy() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [show3d, setShow3d] = useState(false);

  useEffect(() => {
    setShow3d(wants3D());
  }, []);

  // the row crossing the vertical middle of the viewport is "active"
  useEffect(() => {
    const rows = root.current?.querySelectorAll<HTMLElement>("[data-service-row]");
    if (!rows?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(Number((e.target as HTMLElement).dataset.serviceRow));
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, []);

  const current = services[active];

  return (
    <section
      ref={root}
      className="relative bg-surface text-ink"
      aria-label="Services"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="md:grid md:grid-cols-[0.95fr_1.05fr] md:gap-16">
          {/* sticky glyph panel (desktop) */}
          <div className="hidden md:block">
            <div className="sticky top-0 flex h-screen flex-col justify-center">
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey">
                <span className="h-px w-6 bg-accent" />
                What we do
              </span>

              <div className="relative mt-4 h-[44vh]">
                {show3d ? (
                  <GlyphScene active={active} />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border border-mist text-ink">
                      <Icon name={current.icon} className="h-14 w-14" />
                    </div>
                  </div>
                )}
              </div>

              {/* crossfading label */}
              <div className="mt-2 min-h-28">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.slug}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="font-mono text-sm text-accent">
                      {String(active + 1).padStart(2, "0")} / 06
                    </p>
                    <h3 className="mt-1 font-display text-4xl font-semibold tracking-tight">
                      {current.title}
                    </h3>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* index dots */}
              <div className="mt-6 flex items-center gap-2" aria-hidden>
                {services.map((s, i) => (
                  <span
                    key={s.slug}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i === active ? "w-8 bg-accent" : "w-3 bg-mist"
                    }`}
                  />
                ))}
                <KeySwitch size={44} tint="plum" className="ml-auto" />
              </div>
            </div>
          </div>

          {/* scrolling index */}
          <div className="py-20 md:py-0">
            {/* intro row */}
            <div className="flex flex-col justify-center md:min-h-[70vh] md:pt-24">
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey md:hidden">
                <span className="h-px w-6 bg-accent" />
                What we do
              </span>
              <h2 className="mt-5 max-w-lg text-balance font-display text-4xl font-semibold tracking-tight md:mt-0 md:text-5xl">
                One studio, the whole product journey.
              </h2>
              <p className="mt-5 max-w-sm text-pretty leading-relaxed text-slatey">
                Six core practices, one team. Most clients start with one and
                grow into the rest.
              </p>
            </div>

            {services.map((s, i) => (
              <article
                key={s.slug}
                data-service-row={i}
                className={`flex flex-col justify-center border-t border-mist py-12 transition-opacity duration-500 md:min-h-[62vh] md:py-0 ${
                  i === active ? "md:opacity-100" : "md:opacity-35"
                }`}
              >
                <div className="flex items-center gap-5">
                  <span className="font-mono text-sm text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* icon shows where the glyph can't (mobile / no WebGL) */}
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-mist md:hidden">
                    <Icon name={s.icon} />
                  </span>
                </div>
                <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-md text-pretty leading-relaxed text-slatey">
                  {s.detail}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {s.deliverables.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-mist px-3 py-1 text-xs text-slatey"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </article>
            ))}

            <div className="pb-8 md:pb-[12vh]" />
          </div>
        </div>
      </div>
    </section>
  );
}
