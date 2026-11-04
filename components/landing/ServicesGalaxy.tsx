"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "@/components/Icon";
import KeySwitch from "@/components/fx/KeySwitch";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Service } from "@/lib/services";

/**
 * Desktop: a sticky panel holds a macropad — one keycap per service, its icon
 * printed on the cap. As the visitor scrolls the index on the right, the row
 * crossing mid-viewport "presses" its key (cap travels home, gold glow lights)
 * and the previous one releases. Keys are buttons that jump to their row.
 * Mobile: the index stacks, each row carrying its own small key.
 * All CSS — no WebGL on the landing page any more.
 *
 * Follows the theme rather than using `.band` — it sits on `bg-surface`, which
 * is white in light mode and an elevated slate in dark, so the section still
 * reads as its own movement either way. That means no hardcoded white/XX
 * alphas inside: everything goes through the neutral ramp.
 */
export default function ServicesGalaxy({ services }: { services: Service[] }) {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

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
      aria-label={t("galaxy.sectionLabel")}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="md:grid md:grid-cols-[0.95fr_1.05fr] md:gap-16">
          {/* sticky glyph panel (desktop) */}
          <div className="hidden md:block">
            <div className="sticky top-0 flex h-screen flex-col justify-center">
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey">
                <span className="h-px w-6 bg-accent" />
                {t("galaxy.eyebrow")}
              </span>

              {/* the macropad: six keys, the active one held down */}
              <div className="mt-6 grid grid-cols-3 justify-items-center gap-x-2 gap-y-4 px-4">
                {services.map((s, i) => (
                  <button
                    key={s.slug}
                    type="button"
                    aria-label={s.title}
                    aria-current={i === active}
                    onClick={() =>
                      root.current
                        ?.querySelector(`[data-service-row="${i}"]`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold-ink)]"
                  >
                    <KeySwitch
                      size={132}
                      tint="onyx"
                      pressed={i === active}
                      legend={<Icon name={s.icon} className="h-full w-full" />}
                    />
                  </button>
                ))}
              </div>

              {/* crossfading label */}
              <div className="mt-6 min-h-28">
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
              </div>
            </div>
          </div>

          {/* scrolling index */}
          <div className="py-20 md:py-0">
            {/* intro row */}
            <div className="flex flex-col justify-center md:min-h-[70vh] md:pt-24">
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey md:hidden">
                <span className="h-px w-6 bg-accent" />
                {t("galaxy.eyebrow")}
              </span>
              <h2 className="mt-5 max-w-lg text-balance font-display text-4xl font-semibold tracking-tight md:mt-0 md:text-5xl">
                {t("galaxy.title")}
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
                  {/* the macropad is hidden on mobile: each row carries its own key */}
                  <span className="md:hidden">
                    <KeySwitch
                      size={64}
                      tint="onyx"
                      pressed={i === active}
                      legend={<Icon name={s.icon} className="h-full w-full" />}
                    />
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
