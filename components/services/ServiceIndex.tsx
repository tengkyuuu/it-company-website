"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "@/components/Icon";
import { services } from "@/lib/services";

/**
 * The six practices as an editorial accordion: giant outlined numerals,
 * titles that slide on hover, and a sprung open/close for the detail.
 */
export default function ServiceIndex() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-y border-mist/70">
      {services.map((s, i) => {
        const isOpen = open === i;
        return (
          <div key={s.slug} className={i > 0 ? "border-t border-mist/70" : ""}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="group flex w-full items-center gap-5 py-7 text-left md:gap-8 md:py-9"
              data-cursor
            >
              <span
                aria-hidden
                className={`w-14 select-none font-display text-3xl font-bold leading-none transition-colors duration-300 md:w-24 md:text-5xl ${
                  isOpen ? "text-accent" : "text-stroke-soft"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <h2 className="flex-1 font-display text-2xl font-semibold tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-2 md:text-4xl">
                {s.title}
              </h2>

              <span className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-mist/70 text-ink transition-colors duration-300 group-hover:bg-ink group-hover:text-paper sm:flex">
                <Icon name={s.icon} />
              </span>

              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-mist/70 text-lg text-ink/60"
                aria-hidden
              >
                +
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-6 pb-9 pl-0 md:flex-row md:items-start md:justify-between md:gap-12 md:pb-12 md:pl-32">
                    <p className="max-w-xl text-pretty text-lg leading-relaxed text-ink/60">
                      {s.detail}
                    </p>
                    <div className="flex max-w-xs flex-wrap gap-2">
                      {s.deliverables.map((d) => (
                        <span
                          key={d}
                          className="rounded-full border border-mist/70 bg-white px-3 py-1 text-xs text-ink/60"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
