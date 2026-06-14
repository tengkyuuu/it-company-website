"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const quotes = [
  {
    text: "Design is not just what it looks like and feels like. Design is how it works.",
    name: "Steve Jobs",
    role: "Co-founder, Apple",
    initials: "SJ",
  },
  {
    text: "Good design is as little design as possible. Less, but better.",
    name: "Dieter Rams",
    role: "Industrial designer, Braun",
    initials: "DR",
  },
  {
    text: "The details are not the details. They make the design.",
    name: "Charles Eames",
    role: "Designer & architect",
    initials: "CE",
  },
  {
    text: "Simplicity is the soul of efficiency.",
    name: "Austin Freeman",
    role: "Author & inventor",
    initials: "AF",
  },
];

export default function Testimonials() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((v) => (v + 1) % quotes.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

  const q = quotes[i];

  return (
    <div
      className="relative mx-auto max-w-3xl text-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* big quote mark */}
      <span
        aria-hidden
        className="text-accent pointer-events-none mx-auto block w-fit font-serif text-[7rem] leading-[0.5]"
      >
        “
      </span>

      <div className="relative min-h-[220px] md:min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease }}
            className="absolute inset-0"
          >
            <p className="text-balance text-2xl font-medium leading-snug tracking-tight md:text-[2rem] md:leading-[1.25]">
              {q.text}
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-sm font-semibold ring-1 ring-mist">
                <span className="text-accent">{q.initials}</span>
              </span>
              <div className="text-left">
                <p className="font-semibold tracking-tight">{q.name}</p>
                <p className="font-mono text-xs uppercase tracking-widest text-slatey">
                  {q.role}
                </p>
              </div>
            </div>
          </motion.blockquote>
        </AnimatePresence>
      </div>

      {/* dots */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {quotes.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Show quote ${idx + 1}`}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: idx === i ? 28 : 8,
              background:
                idx === i ? "var(--accent)" : "var(--color-mist)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
