"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

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
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
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
