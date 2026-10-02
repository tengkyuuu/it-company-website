"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import Button from "./Button";
import ThemeToggle from "./theme/ThemeToggle";
import LanguageSwitcher from "./i18n/LanguageSwitcher";
import { useI18n } from "./i18n/I18nProvider";
import { openSearch } from "./search/open";
import { visibleNav } from "@/lib/site";
import type { PublishedSections } from "@/lib/cms"; // type only — erased, never bundled
import { navLabel } from "@/lib/i18n/nav";
import { stripLocale } from "@/lib/i18n/paths";

/**
 * Breakpoint note: the inline links switch on at `lg`, not `md`. With the
 * EN / FIL switcher in the bar (and Filipino labels running longer), the full
 * row no longer fits a 768–1023px viewport — the hamburger sheet covers that
 * range, and carries the switcher too.
 *
 * Products / Careers / Blog appear only while something is published in them
 * (`sections`, from getPublishedSections() in the [lang] layout). Each one
 * costs ~90px of a bar that is already close to full in Filipino, so:
 *   - any of them published (6+ links) → the inline row starts at `xl`
 *     instead of `lg`, with tighter link padding;
 *   - two or more (7+ links) → the "Get in touch" button leaves the desktop
 *     bar — it goes to /location, which is already a link in the row — and
 *     stays in the mobile sheet. (The bar is capped at max-w-6xl, so a wider
 *     screen doesn't buy more room; something has to give.)
 * Class strings below are spelled out in full so Tailwind can see them.
 */
export default function Nav({ sections }: { sections?: PublishedSections }) {
  const pathname = usePathname();
  const { t, href } = useI18n();
  // locale-free path for the active state — usePathname() is the internal
  // /en/… path while prerendering and the public one in the browser
  const current = stripLocale(pathname ?? "/").path;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const items = visibleNav(sections);
  const compact = items.length > 5;
  const crowded = items.length > 6;
  const desktopOnly = compact ? "hidden xl:flex" : "hidden lg:flex";
  const mobileOnly = compact ? "xl:hidden" : "lg:hidden";
  const linkPad = compact ? "px-3" : "px-3 xl:px-4";
  // a section's detail pages light up its link too (/blog/x → Blog)
  const isActive = (to: string) =>
    current === to || (to !== "/" && current.startsWith(`${to}/`));

  const themeLabels = { toDark: t("theme.toDark"), toLight: t("theme.toLight") };

  useEffect(() => {
    // only touch React state when the threshold is actually crossed — this
    // handler fires on every scroll frame
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

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* No backdrop-filter: a blur behind a fixed bar is re-computed on every
          scroll frame (and every frame over the WebGL hero). A near-opaque paper
          pill reads just as deliberate, in both themes, for free. */}
      <div
        className={`mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-5 py-3 transition-[background-color,border-color,box-shadow] duration-500 ${
          scrolled
            ? "border border-mist/70 bg-paper/[0.93] shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]"
            : "border border-transparent bg-transparent"
        }`}
        style={{ marginInline: "max(1rem, calc((100% - 72rem) / 2))" }}
      >
        <Link
          href={href("/")}
          aria-label={t("nav.homeLabel")}
          className="flex shrink-0 items-center gap-2.5"
        >
          {/* The `logo.png` shield used to sit here. It is the OLD brand — a
              gradient "KT" monogram — so it contradicted the R Ally's Tech
              wordmark beside it. Dropped rather than shipped wrong; restore the
              <Image> here once there's a shield for the new name.
              The link above carries the accessible name, so this is decorative. */}
          <Logo className="h-[26px]" />
        </Link>

        <nav aria-label={t("nav.ariaLabel")} className={`${desktopOnly} items-center gap-1`}>
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap rounded-full ${linkPad} py-2 text-sm text-ink/70 transition-colors hover:text-ink`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-ink/[0.06]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={active ? "text-ink" : ""}>{navLabel(t, item)}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`${desktopOnly} items-center gap-3`}>
          <SearchButton label={t("nav.search")} showShortcut={!compact || crowded} />
          <LanguageSwitcher />
          <ThemeToggle labels={themeLabels} />
          {!crowded && (
            <Button href={href("/location")} arrow>
              {t("nav.cta")}
            </Button>
          )}
        </div>

        {/* Mobile / tablet controls */}
        <div className={`flex items-center gap-2 ${mobileOnly}`}>
          <ThemeToggle labels={themeLabels} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-mist/70"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={open}
          >
            <div className="space-y-1.5">
              <span
                className={`block h-px w-5 bg-ink transition-transform duration-300 ${
                  open ? "translate-y-[3px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-px w-5 bg-ink transition-transform duration-300 ${
                  open ? "-translate-y-[3px] -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label={t("nav.ariaLabel")}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`mx-4 mt-2 rounded-3xl border border-mist/70 bg-paper p-4 shadow-xl ${mobileOnly}`}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openSearch();
              }}
              aria-keyshortcuts="Meta+K Control+K"
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-mist/70 bg-ink/[0.03] px-4 py-3 text-left text-base text-ink/60 transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to"
            >
              <SearchIcon className="h-4 w-4 shrink-0" />
              {t("nav.search")}
            </button>
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={href(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-2xl px-4 py-3 text-lg ${
                    active ? "text-ink" : "text-ink/60"
                  }`}
                >
                  {navLabel(t, item)}
                </Link>
              );
            })}
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-widest text-slatey">
                {t("lang.label")}
              </span>
              <LanguageSwitcher />
            </div>
            <div className="px-2 pt-2">
              <Button href={href("/location")} arrow className="w-full">
                {t("nav.cta")}
              </Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/**
 * Opens the Cmd+K palette (components/search). Same shell as the theme and
 * language pills (h-9, rounded-full, thin mist border, faint ink fill).
 *
 * The shortcut hint is the platform's own (⌘K on Apple, Ctrl K elsewhere) —
 * known only in the browser, so it renders after mount; until then the slot is
 * empty rather than guessing and flipping (which would also mismatch the
 * server HTML).
 */
function SearchButton({ label, showShortcut }: { label: string; showShortcut: boolean }) {
  const [mac, setMac] = useState<boolean | null>(null);
  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent;
    setMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label={label}
      title={label}
      aria-keyshortcuts="Meta+K Control+K"
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-mist/70 bg-ink/[0.04] px-2.5 text-ink/65 transition-colors duration-300 hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <SearchIcon className="h-[15px] w-[15px]" />
      {showShortcut && mac !== null && (
        <kbd
          aria-hidden
          className="hidden pr-0.5 font-mono text-[10px] tracking-[0.12em] text-ink/45 xl:inline"
        >
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}
    </button>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3.25 3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
