"use client";

import { scrollToTop } from "@/components/fx/SmoothScroll";

/** Circular back-to-top control for the footer bottom bar. */
export default function BackToTop() {
  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      data-cursor
      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-paper/70 transition-all duration-300 hover:border-transparent hover:bg-accent hover:text-ink"
    >
      <span
        aria-hidden
        className="transition-transform duration-300 group-hover:-translate-y-0.5"
      >
        ↑
      </span>
    </button>
  );
}
