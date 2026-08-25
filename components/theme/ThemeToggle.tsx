"use client";

import { useRef } from "react";
import { useTheme, type Theme } from "./ThemeProvider";

/** `document.startViewTransition` isn't in the DOM lib yet. */
type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type VTDocument = Document & {
  startViewTransition?: (cb: () => void) => ViewTransition;
};

const DURATION = 620;

/**
 * The light/dark switch. Flipping it opens a circular window at the button and
 * grows the incoming theme out of it across the whole page, via the View
 * Transitions API (the pseudo-element stacking lives in globals.css). Browsers
 * without the API — and anyone on prefers-reduced-motion — get an instant swap.
 *
 * The pill's own visual state (thumb position, sun/moon crossfade) is pure CSS
 * keyed off <html data-theme>, so it is already correct on the first paint.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, mounted, setTheme } = useTheme();
  const busy = useRef(false);

  // Render a same-size placeholder until the stored preference is known, so
  // there's no hydration mismatch and no layout shift.
  if (!mounted) {
    return (
      <span
        className={`inline-block h-9 w-[68px] rounded-full border border-mist/70 ${className}`}
        aria-hidden
      />
    );
  }

  const next: Theme = theme === "dark" ? "light" : "dark";

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (busy.current) return;

    const doc = document as VTDocument;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || typeof doc.startViewTransition !== "function") {
      setTheme(next);
      return;
    }

    // grow from the middle of the button out to the furthest corner
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    busy.current = true;
    // setTheme writes data-theme synchronously — that's what gets snapshotted
    const vt = doc.startViewTransition(() => setTheme(next));

    vt.ready
      .then(() =>
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: DURATION,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        ).finished
      )
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={onClick}
      data-cursor
      className={`group relative inline-flex h-9 w-[68px] shrink-0 items-center rounded-full border border-mist/70 bg-ink/[0.04] px-1 transition-colors duration-300 hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${className}`}
    >
      {/* sliding thumb — CSS moves it on [data-theme="dark"] */}
      <span
        aria-hidden
        className="tt-thumb absolute left-1 top-1 h-7 w-7 rounded-full bg-accent shadow-[0_2px_8px_-2px_rgba(15,23,42,0.5)]"
      />
      {/* the two icons sit in the pill's halves; the active one fades in */}
      <span
        aria-hidden
        className="relative z-10 flex h-7 w-7 items-center justify-center text-paper"
      >
        <Sun className="tt-icon tt-sun absolute h-[15px] w-[15px]" />
      </span>
      <span
        aria-hidden
        className="relative z-10 flex h-7 w-7 items-center justify-center text-paper"
      >
        <Moon className="tt-icon tt-moon absolute h-[15px] w-[15px]" />
      </span>
    </button>
  );
}

function Sun({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2M12 19.6v2M2.4 12h2M19.6 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

function Moon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.1 11.1Z" />
    </svg>
  );
}
