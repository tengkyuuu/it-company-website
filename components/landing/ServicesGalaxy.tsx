"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ServiceKeycap from "@/components/services/ServiceKeycap";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Service } from "@/lib/services";

/** One photographic key follows the reading position; mobile pairs keys with copy. */
export default function ServicesGalaxy({ services }: { services: Service[] }) {
  const { t, href } = useI18n();
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const rows = root.current?.querySelectorAll<HTMLElement>("[data-service-row]");
    if (!rows?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.serviceRow));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [services.length]);

  const current = services[Math.min(active, services.length - 1)];
  if (!current) return null;

  function selectService(index: number) {
    setActive(index);
    root.current?.querySelector(`[data-service-row="${index}"]`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "center",
    });
  }

  return (
    <section ref={root} className="relative bg-surface py-20 text-ink md:py-28" aria-label={t("galaxy.sectionLabel")}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 md:mb-16 md:grid md:grid-cols-2 md:items-end md:gap-16">
          <h2 className="max-w-lg text-balance font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {t("galaxy.title")}
          </h2>
          <p className="mt-5 max-w-sm text-pretty leading-relaxed text-slatey md:mt-0">
            Six core practices, one team. Most clients start with one and grow into the rest.
          </p>
        </div>

        <div className="md:grid md:grid-cols-[0.95fr_1.05fr] md:gap-16">
          <div className="hidden md:block">
            <div className="sticky top-28 flex flex-col items-center py-4">
              <div className="relative w-full max-w-[min(356px,calc((100svh_-_280px)/1.18))]" data-featured-key={current.icon}>
                <ServiceKeycap icon={current.icon} />
              </div>
              <p className="mt-5 text-center font-display text-2xl font-semibold tracking-tight">{current.title}</p>
              <div className="mt-5 flex gap-1" role="group" aria-label={t("galaxy.sectionLabel")}>
                {services.map((service, index) => (
                  <button key={service.slug} type="button" aria-label={service.title}
                    aria-current={index === active ? "true" : undefined}
                    onClick={() => selectService(index)}
                    className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold-ink)]">
                    <span aria-hidden className={`h-0.5 w-6 transition-colors group-hover:bg-ink motion-reduce:transition-none ${index === active ? "bg-[var(--color-gold-ink)]" : "bg-slatey"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            {services.map((service, index) => (
              <article key={service.slug} data-service-row={index} className="flex items-center gap-5 border-t border-mist py-8 md:min-h-[34vh] md:py-12">
                <div className="w-24 shrink-0 md:hidden"><ServiceKeycap icon={service.icon} /></div>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-tight md:text-4xl">{service.title}</h3>
                  <p className="mt-3 max-w-md text-pretty leading-relaxed text-slatey md:text-lg">{service.blurb}</p>
                </div>
              </article>
            ))}
            <div className="border-t border-mist pt-10">
              <Link href={href("/services")} className="group inline-flex items-center gap-2 text-lg font-medium text-ink">
                <span className="underline decoration-mist underline-offset-[6px] transition-colors group-hover:decoration-ink">{t("galaxy.allServices")}</span>
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
