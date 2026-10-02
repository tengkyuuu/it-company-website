"use client";

import { useState, useTransition } from "react";
import { setLeadHandled, deleteLead, type ActionResult } from "@/app/admin/content-actions";
import { callAction } from "./ui";

/**
 * Row controls for one inbox thread. Same shape as ProjectRowActions: real
 * calls to server actions, a transition to keep the buttons disabled while the
 * revalidation lands, and failures shown inline rather than swallowed.
 *
 * Takes every id in the thread — a chat conversation is stored as several
 * snapshot rows, and handling/deleting only the newest would leave the rest
 * behind (and the unread badge stuck).
 */
export default function LeadActions({
  ids,
  handled,
  label,
}: {
  ids: string[];
  handled: boolean;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (fd: FormData) => Promise<ActionResult>, extra: Record<string, string> = {}) => {
    setError(null);
    const fd = new FormData();
    for (const id of ids) fd.append("id", id);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    start(async () => {
      const r = await callAction(() => action(fd));
      if (r && !r.ok) setError(r.message);
    });
  };

  const btn =
    "rounded-full border border-mist/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5" aria-busy={pending || undefined}>
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => run(setLeadHandled, { handled: String(!handled) })}
        >
          {handled ? "Reopen" : "Mark handled"}
        </button>

        <button
          type="button"
          disabled={pending}
          className={`${btn} border-red-500/40 text-red-600 hover:border-red-500/60 hover:bg-red-500/10 dark:text-red-400`}
          onClick={() => {
            // a lead is someone's enquiry — make deletion deliberate
            if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
            run(deleteLead);
          }}
        >
          Delete
        </button>
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-xs leading-relaxed text-red-600 dark:text-red-400 sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
