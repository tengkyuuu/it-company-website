"use client";

import { useEffect, useRef, useState } from "react";
import type { InviteOutcome } from "@/app/admin/team-actions";

/**
 * Small pieces shared by the Team page's invite cards and list. Kept out of
 * ui.tsx (another workstream owns that file) — they're team-specific anyway.
 */

const tones = {
  ok: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  error: "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300",
  muted: "border-mist/70 bg-paper text-ink/70",
} as const;

export type Tone = keyof typeof tones;

/**
 * Like ui.tsx's Banner, with a fourth state that matters here: "the invite (or
 * reset link) exists but the email didn't go" (amber) — that's not a failure,
 * it's a link the owner now has to pass on, so it gets the link box right
 * underneath.
 */
export function OutcomeNotice({
  outcome,
  autoCopy = false,
}: {
  outcome: InviteOutcome | null;
  autoCopy?: boolean;
}) {
  if (!outcome) return null;
  const tone: Tone = outcome.skipped
    ? "muted"
    : !outcome.ok
      ? "error"
      : outcome.link && !outcome.emailed
        ? "warn"
        : "ok";

  return (
    <div role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <p className="leading-relaxed">{outcome.message}</p>
      {outcome.link && !outcome.emailed && (
        <div className="mt-3">
          <LinkBox link={outcome.link} autoCopy={autoCopy} />
        </div>
      )}
    </div>
  );
}

/**
 * A read-only link with a Copy button. The clipboard API needs a user gesture
 * in some browsers (Safari), and by the time a server action returns that
 * gesture has expired — so auto-copy is best-effort and the visible field +
 * button is the real path.
 */
export function LinkBox({ link, autoCopy = false }: { link: string; autoCopy?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const input = useRef<HTMLInputElement>(null);

  async function copy(fromClick: boolean) {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      if (fromClick) {
        input.current?.focus();
        input.current?.select();
        setState("manual");
      }
    }
  }

  useEffect(() => {
    setState("idle");
    if (autoCopy) void copy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, autoCopy]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={input}
        readOnly
        value={link}
        aria-label="Link to pass on"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-mist/70 bg-paper px-3 py-2 font-mono text-[11px] text-ink/70 focus:border-accent-to focus:outline-none"
      />
      <button
        type="button"
        onClick={() => copy(true)}
        className="shrink-0 rounded-full border border-mist/70 bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-mist"
      >
        {state === "copied" ? "Copied ✓" : state === "manual" ? "Press ⌘/Ctrl+C" : "Copy link"}
      </button>
    </div>
  );
}

/** Tiny pill button used for row actions (Resend, Copy link, Disable, Remove…). */
export function RowButton({
  children,
  danger = false,
  ...rest
}: { children: React.ReactNode; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-300"
          : "border-mist/70 text-ink/70 hover:border-mist hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
