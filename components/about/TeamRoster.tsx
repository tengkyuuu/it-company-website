"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import type { TeamMember } from "@/lib/team";

/** Each member gets their own tilt of the brand gradient. */
const orbGradient = (i: number) =>
  `linear-gradient(${105 + i * 42}deg, #9d5a8f, #b85c7a, #e0a23a)`;

/**
 * The team as an editorial roster. On desktop a gradient orb — the member's
 * "monogram" — springs after the cursor while their row stays inked and the
 * rest recede. On touch it's a clean list.
 */
export default function TeamRoster({ team }: { team: TeamMember[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 160, damping: 20, mass: 0.5 });
  const y = useSpring(my, { stiffness: 160, damping: 20, mass: 0.5 });

  // The roster's box is measured once per hover, not on every pointer move;
  // a page scroll under the pointer drops it so the next move re-measures.
  const origin = useRef<{ left: number; top: number } | null>(null);
  const invalidate = useRef(() => {
    origin.current = null;
  }).current;
  useEffect(
    () => () => window.removeEventListener("scroll", invalidate),
    [invalidate]
  );

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (!origin.current) {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      origin.current = { left: r.left, top: r.top };
    }
    mx.set(e.clientX - origin.current.left);
    my.set(e.clientY - origin.current.top);
  };

  return (
    <div
      ref={wrap}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        invalidate();
        window.addEventListener("scroll", invalidate, { passive: true });
      }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        window.removeEventListener("scroll", invalidate);
        setHovered(null);
      }}
      className="relative mt-14"
    >
      {/* cursor-following monogram orb — its own layer only while it's showing,
          so the springing follow is a composite rather than a repaint */}
      <motion.div
        style={{ x, y }}
        className={`pointer-events-none absolute left-0 top-0 z-10 hidden md:block ${
          hovered !== null ? "will-change-transform" : ""
        }`}
        aria-hidden
      >
        <AnimatePresence>
          {hovered !== null && (
            <motion.div
              key={hovered}
              initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 6 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex h-36 w-36 items-center justify-center rounded-full font-display text-4xl font-bold text-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
              style={{
                background: orbGradient(hovered),
                marginLeft: -72,
                marginTop: -72,
              }}
            >
              {team[hovered].initials}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="border-y border-mist/70">
        {team.map((m, i) => (
          <div
            key={m.name}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setHovered(i);
            }}
            className={`flex flex-col gap-1 py-6 transition-opacity duration-300 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 md:py-8 ${
              i > 0 ? "border-t border-mist/70" : ""
            } ${hovered !== null && hovered !== i ? "md:opacity-30" : ""}`}
          >
            <div className="flex items-baseline gap-5 md:gap-8">
              <span className="w-8 font-mono text-sm text-slatey" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
                className={`font-display text-2xl font-semibold tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:text-4xl ${
                  hovered === i ? "md:translate-x-3" : ""
                }`}
              >
                {m.name}
              </h3>
            </div>
            <p className="pl-13 font-mono text-xs uppercase tracking-widest text-slatey sm:pl-0">
              {m.role}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
