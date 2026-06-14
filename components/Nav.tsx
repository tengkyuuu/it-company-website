"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Wordmark from "./Wordmark";
import Button from "./Button";
import { nav } from "@/lib/site";

export default function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-5 py-3 transition-all duration-500 ${
          scrolled
            ? "border border-mist/70 bg-paper/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            : "border border-transparent bg-transparent"
        }`}
        style={{ marginInline: "max(1rem, calc((100% - 72rem) / 2))" }}
      >
        <Link
          href="/"
          aria-label="MYKT — home"
          data-cursor
          className="flex items-center gap-2.5"
        >
          <Image
            src="/brand/logo.png"
            alt="MYKT logo"
            width={40}
            height={52}
            priority
            className="h-9 w-auto"
          />
          <Wordmark href={null} className="text-2xl" />
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

        <div className="hidden md:block">
          <Button href="/location" arrow>
            Get in touch
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-mist/70 md:hidden"
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

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-4 mt-2 rounded-3xl border border-mist/70 bg-paper/95 p-4 shadow-xl backdrop-blur-xl md:hidden"
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
