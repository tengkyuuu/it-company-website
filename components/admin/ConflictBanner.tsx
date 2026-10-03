"use client";

import { conflictHeadline } from "@/app/admin/_lib/autosave";
import type { Autosave } from "./useAutosave";

/**
 * Someone saved this item after this form loaded. Autosave has stopped, so
 * nothing is overwritten until the person chooses:
 *
 *  - Reload their version — a full reload; the edits in this tab are dropped
 *    (the leave-page prompt is skipped: this IS the confirmation).
 *  - Keep mine — an explicit, informed overwrite: the save is re-sent
 *    expecting the version they were just told about. After an autosave
 *    conflict that's only the fields changed here; after a Save-button
 *    conflict it's the whole form, so the wording says which.
 */
export default function ConflictBanner({ autosave }: { autosave: Autosave }) {
  const c = autosave.conflict;
  if (!c) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-500/[0.07] px-4 py-3 text-sm"
    >
      <p className="font-medium text-amber-800 dark:text-amber-200">{conflictHeadline(c)}</p>
      <p className="mt-1 leading-relaxed text-ink/60">
        Autosave is paused so neither version is lost.{" "}
        {c.source === "save"
          ? "Keep mine saves this whole form over theirs."
          : "Keep mine re-saves just the fields you changed here."}{" "}
        Reloading discards your unsaved edits in this tab.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={autosave.reloadTheirs}
          className="rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
        >
          Reload their version
        </button>
        <button
          type="button"
          onClick={autosave.keepMine}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Keep mine
        </button>
      </div>
    </div>
  );
}
