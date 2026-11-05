"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import ThemeToggle from "./theme/ThemeToggle";
import LocalTime from "./fx/LocalTime";
import { useI18n } from "./i18n/I18nProvider";
import { pauseSmoothScroll, resumeSmoothScroll } from "./fx/SmoothScroll";
import { site, visibleNav } from "@/lib/site";
import type { PublishedSections } from "@/lib/cms"; // type only — erased, never bundled
import { navLabel } from "@/lib/i18n/nav";
import { stripLocale } from "@/lib/i18n/paths";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The bar: burger (left) · logo (centre) · theme toggle (right). Nothing else —
 * every link lives in the drop-down menu, and search is keyboard-only
 * (⌘K / Ctrl K / "/", handled by components/search/SearchLauncher).
 *
 * The three-column grid (`1fr auto 1fr`) keeps the logo on the exact centre
 * line whatever the side controls measure. That matters beyond looks: the
 * opening sequence (fx/Preloader + `.pl-*` in globals.css) flies its logo to
 * this spot by pure CSS arithmetic — centre of the viewport, `--nav-h / 2` from
 * the top, 160px / 176px wide — and then hands over to this one. Change the
 * bar's height, the logo's width or its centring, and update `.pl-*` with it.
 *
 * Because the menu can hold any number of links, there's no longer any
 * breakpoint juggling for Products / Careers / Blog.
 */
export default function Nav({ sections }: { sections?: PublishedSections }) {
  const pathname = usePathname();
  const { t, href } = useI18n();
  const current = stripLocale(pathname ?? "/").path;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const items = visibleNav(sections);
  const isActive = (to: string) =>
    current === to || (to !== "/" && current.startsWith(`${to}/`));
  const themeLabels = { toDark: t("theme.toDark"), toLight: t("theme.toLight") };

  useEffect(() => {
    // only touch React state when the threshold is actually crossed
    let last: boolean | null = null;
    const onScroll = () => {
      const next = window.scrollY > 16;
      if (next !== last) setScrolled((last = next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: freeze the page, make everything behind the menu inert, Esc
  // closes, focus goes in and comes back to the burger.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.getPropertyValue("overflow");
    const prevGutter = root.style.getPropertyValue("scrollbar-gutter");
    if (window.innerWidth > root.clientWidth) root.style.setProperty("scrollbar-gutter", "stable");
    root.style.setProperty("overflow", "hidden");
    pauseSmoothScroll();

    const behind = Array.from(document.querySelectorAll<HTMLElement>("main, footer")).filter(
      (el) => !el.closest("header")
    );
    behind.forEach((el) => (el.inert = true));

    const first = panel.current?.querySelector<HTMLElement>("a[href]");
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const button = burger.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      behind.forEach((el) => (el.inert = false));
      root.style.setProperty("overflow", prevOverflow);
      root.style.setProperty("scrollbar-gutter", prevGutter);
      resumeSmoothScroll();
      if (button?.isConnected && document.activeElement?.closest("header")) {
        button.focus({ preventScroll: true });
      }
    };
  }, [open]);

  const solid = open || scrolled;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* No backdrop-filter: a blur behind a fixed bar is recomputed on every
          scroll frame. A near-opaque paper bar reads just as well, for free. */}
      <div
        // the hairline is an inset shadow, not a border: a border would eat 1px of
        // --nav-h and nudge the logo off the line the opening sequence lands on
        className={`relative z-20 grid h-[var(--nav-h)] grid-cols-[1fr_auto_1fr] items-center px-4 transition-[background-color,box-shadow] duration-500 md:px-8 ${
          open
            ? "bg-paper"
            : solid
              ? "bg-paper/[0.93] shadow-[inset_0_-1px_0_var(--color-mist)]"
              : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-start">
          <button
            ref={burger}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-ink/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={open}
            aria-controls="site-menu"
          >
            <span className="relative block h-3 w-6" aria-hidden>
              <span
                className={`absolute left-0 top-0 block h-[1.5px] w-6 bg-ink transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  open ? "translate-y-[5.25px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 block h-[1.5px] bg-ink transition-[transform,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  open ? "w-6 -translate-y-[5.25px] -rotate-45" : "w-4"
                }`}
              />
            </span>
          </button>
        </div>

        <Link
          href={href("/")}
          aria-label={t("nav.homeLabel")}
          className="flex items-center justify-center"
        >
          {/* `nav-logo`: hidden while the opening sequence's own copy flies in
              (see `.pl` in globals.css), so the two never show at once. */}
          <Logo accent className="nav-logo w-40 md:w-44" />
        </Link>

        <div className="flex items-center justify-end">
          <ThemeToggle labels={themeLabels} />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* scrim — click outside to close */}
            <motion.div
              key="scrim"
              aria-hidden
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-0 bg-ink/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            />
            <motion.div
              key="panel"
              ref={panel}
              id="site-menu"
              role="dialog"
              aria-modal="true"
              aria-label={t("nav.ariaLabel")}
              data-lenis-prevent
              className="fixed inset-x-0 top-0 z-10 max-h-[100svh] overflow-y-auto border-b border-mist/70 bg-paper pt-[var(--nav-h)] shadow-[0_30px_60px_-30px_rgba(12,10,9,0.35)]"
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%", transition: { duration: 0.45, ease: [0.64, 0, 0.78, 0] } }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-12 pt-6 md:grid-cols-[1fr_auto] md:gap-20 md:px-8 md:pb-16 md:pt-10">
                <nav aria-label={t("nav.ariaLabel")}>
                  <ul>
                    {items.map((item, i) => {
                      const active = isActive(item.href);
                      return (
                        <motion.li
                          key={item.href}
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.55, ease: EASE, delay: 0.18 + i * 0.05 }}
                        >
                          <Link
                            href={href(item.href)}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setOpen(false)}
                            className={`group flex items-baseline gap-4 py-1.5 font-display text-[clamp(2rem,5.2vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.04em] transition-colors focus:outline-none focus-visible:underline ${
                              active ? "text-ink" : "text-ink/40 hover:text-ink"
                            }`}
                          >
                            <span
                              aria-hidden
                              className="w-7 shrink-0 font-mono text-[11px] font-normal tracking-[0.12em] text-slatey"
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{navLabel(t, item)}</span>
                            {active && (
                              <span
                                aria-hidden
                                className="h-2 w-2 shrink-0 translate-y-[-0.35em] self-center rounded-full bg-ink"
                              />
                            )}
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                </nav>

                <motion.div
                  className="grid content-end gap-7 border-t border-mist/70 pt-8 text-sm md:min-w-60 md:border-l md:border-t-0 md:pl-10 md:pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slatey">
                      {t("nav.menuStudio")}
                    </p>
                    <p className="mt-2 text-ink">{site.address.line1}</p>
                    <p className="text-ink/60">{site.address.line2}</p>
                    <LocalTime className="mt-1 block font-mono text-xs text-slatey" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slatey">
                      {t("nav.menuReply")}
                    </p>
                    <p className="mt-2 text-ink">{t("nav.menuReplyValue")}</p>
                  </div>
                  <Link
                    href={href("/contact")}
                    onClick={() => setOpen(false)}
                    className="group inline-flex items-center gap-2 text-base font-medium text-ink"
                  >
                    <span className="border-b border-ink/30 pb-0.5 transition-colors group-hover:border-ink">
                      {t("hero.secondaryCta")}
                    </span>
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
