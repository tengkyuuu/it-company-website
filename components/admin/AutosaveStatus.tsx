"use client";

import { useEffect, useState } from "react";
import type { Autosave } from "./useAutosave";

/**
 * The autosave line in a form's save bar: "Saving…", "Saved · 2:41 pm",
 * "Offline — will retry", "Couldn't save some fields", "Conflict…".
 *
 * Two layers on purpose: the visible text follows every state, while the
 * screen-reader live region only gets OUTCOMES — otherwise "Saving… Saved"
 * would be read out after every pause in typing.
 */

const TONE = {
  muted: "text-slatey",
  ok: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-700 dark:text-amber-300",
  error: "text-red-600 dark:text-red-400",
} as const;

export default function AutosaveStatus({
  autosave,
  className = "",
}: {
  autosave: Autosave;
  className?: string;
}) {
  const status = autosave.status;
  const [spoken, setSpoken] = useState("");

  useEffect(() => {
    if (status?.announce) setSpoken(status.text);
    // back at rest (e.g. a slug typed back to its saved value): don't leave a
    // stale "need Save" sitting in the region for someone to read later
    else if (!status || status.rest) setSpoken("");
  }, [status]);

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {spoken}
      </span>
      {status && (
        <span
          aria-hidden
          className={`font-mono text-[11px] uppercase tracking-widest ${TONE[status.tone]} ${className}`}
        >
          {status.text}
        </span>
      )}
    </>
  );
}
