"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

type Variant = "solid" | "outline" | "ghost";

const base =
  "group relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-tight transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

const variants: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink-900",
  outline: "border border-ink/20 text-ink hover:border-ink/50",
  ghost: "text-ink/70 hover:text-ink",
};

export default function Button({
  children,
  href,
  variant = "solid",
  className = "",
  arrow = false,
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  className?: string;
  arrow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 250, damping: 18, mass: 0.4 });
  const y = useSpring(my, { stiffness: 250, damping: 18, mass: 0.4 });

  // The button's resting centre, measured once per hover — not on every pointer
  // move (a per-event getBoundingClientRect can force a synchronous layout, and
  // it also reads back the button's own magnetic offset). Dropped if the page
  // scrolls under the pointer, then re-measured on the next move.
  const center = useRef<{ x: number; y: number } | null>(null);
  const invalidate = useRef(() => {
    center.current = null;
  }).current;
  useEffect(
    () => () => window.removeEventListener("scroll", invalidate),
    [invalidate]
  );

  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    invalidate();
    window.addEventListener("scroll", invalidate, { passive: true });
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (!center.current) {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      // subtract the live offset so we store where the button RESTS
      center.current = {
        x: r.left + r.width / 2 - x.get(),
        y: r.top + r.height / 2 - y.get(),
      };
    }
    // magnetic pull toward the cursor, capped near the button bounds
    mx.set((e.clientX - center.current.x) * 0.35);
    my.set((e.clientY - center.current.y) * 0.4);
  };
  const reset = () => {
    window.removeEventListener("scroll", invalidate);
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={reset}
      whileTap={{ scale: 0.97 }}
      style={{ x, y }}
      className="inline-block"
    >
      <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
        {/* gradient sheen on hover (solid only) */}
        {variant === "solid" && (
          <span className="absolute inset-0 rounded-full bg-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        )}
        <span className="relative z-10 inline-flex items-center gap-2">
          {children}
          {arrow && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </Link>
    </motion.div>
  );
}
