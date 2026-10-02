"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import Button from "./Button";
import ThemeToggle from "./theme/ThemeToggle";
import { nav } from "@/lib/site";

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          href="/"
          aria-label="R Ally's Tech — home"
          className="flex items-center gap-2.5"
        >
          {/* The `logo.png` shield used to sit here. It is the OLD brand — a
              gradient "KT" monogram — so it contradicted the R Ally's Tech
              wordmark beside it. Dropped rather than shipped wrong; restore the
              <Image> here once there's a shield for the new name.
              The link above carries the accessible name, so this is decorative. */}
          <Logo className="h-[26px]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-full px-4 py-2 text-sm text-ink/70 transition-colors hover:text-ink"
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-ink/[0.06]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={active ? "text-ink" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button href="/location" arrow>
            Get in touch
          </Button>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-mist/70"
            aria-label="Toggle menu"
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
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-4 mt-2 rounded-3xl border border-mist/70 bg-paper p-4 shadow-xl md:hidden"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-2xl px-4 py-3 text-lg ${
                  pathname === item.href ? "text-ink" : "text-ink/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="px-2 pt-2">
              <Button href="/location" arrow className="w-full">
                Get in touch
              </Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
