"use client";

import { useState } from "react";
import { getEntityHistory, restoreRevision } from "@/app/admin/history-actions";
import type { HistoryResponse } from "@/app/admin/_lib/history";
import type { HistoryEntry } from "@/app/admin/_lib/history-logic";
import type { ContentEntityType } from "@/lib/supabase/types";
import { Banner } from "./ui";
import { ChangeList, RevisionPreview, Spinner, safely, smallButton, solidButton } from "./HistoryParts";

/**
 * Version history for one item, under its editor. Collapsed by default and
 * loaded only when opened, so an edit page costs nothing extra until someone
 * actually wants history.
 *
 * Each entry is a change — who, when, which fields, before → after — and the
 * version from just BEFORE it (that's what content_revisions stores). Restore
 * brings that version back; the server saves the current one as a backup
 * first, so a restore is itself undoable from this list.
 *
 * After a restore the page does a FULL reload, never router.refresh(): the edit
 * forms are uncontrolled and autosave with an updated_at concurrency token, so
 * only a fresh load gives them the restored values and a matching token.
 */

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; entries: HistoryEntry[]; exists: boolean }
  | { kind: "error"; message: string };

export default function HistoryPanel({
  entityType,
  entityId,
  noun = "item",
  subject,
  variant = "card",
}: {
  entityType: ContentEntityType;
  entityId: string;
  /** "project", "post"… — used in the panel's hint */
  noun?: string;
  /** overrides "this {noun}" in the copy, e.g. "the site settings" */
  subject?: string;
  /** "card" under an edit page; "inline" inside a list row (services, roster) */
  variant?: "card" | "inline";
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const what = subject ?? `this ${noun}`;

  const load = async () => {
    setStatus({ kind: "loading" });
    const r = (await safely(() => getEntityHistory(entityType, entityId))) as HistoryResponse;
    setStatus(r.ok ? { kind: "ready", entries: r.entries, exists: r.exists } : { kind: "error", message: r.message });
  };

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open && status.kind === "idle") void load();
  };

  const body = (
    <div className={variant === "card" ? "border-t border-mist/70 px-5 pb-6 pt-5 md:px-7" : "mt-4"}>
      {status.kind === "loading" && (
        <p className="flex items-center gap-2 text-sm text-ink/55">
          <Spinner /> Loading history…
        </p>
      )}
      {status.kind === "error" && (
        <div className="space-y-3">
          <Banner result={{ ok: false, message: status.message }} />
          <button type="button" className={smallButton} onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {status.kind === "ready" &&
        (status.entries.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink/55">
            No earlier versions yet. One is saved automatically the first time {what} {subject ? "are" : "is"}{" "}
            changed — then at most one per person every 5 minutes, newest 20 kept.
          </p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-prose text-xs leading-relaxed text-ink/55">
                Each entry shows a change and keeps the version from just before it.{" "}
                <span className="text-ink/70">Restore</span> brings that earlier version back —
                the current one is saved here first, so you can undo it.
              </p>
              <button type="button" className={smallButton} onClick={() => void load()}>
                Refresh
              </button>
            </div>
            <ol className="relative ml-1.5 space-y-6 border-l border-mist/70 pl-5">
              {status.entries.map((entry, i) => (
                <HistoryItem key={entry.id} entry={entry} newest={i === 0} />
              ))}
            </ol>
          </>
        ))}
    </div>
  );

  if (variant === "inline") {
    return (
      <details className="group w-full" onToggle={onToggle}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-mist/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 [&::-webkit-details-marker]:hidden">
          History
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        {body}
      </details>
    );
  }

  return (
    <details className="group rounded-2xl border border-mist/70 bg-surface" onToggle={onToggle}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 md:px-7 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-lg font-semibold tracking-tight">History</span>
          <span className="mt-0.5 block text-sm text-ink/55">
            Earlier versions of {what} — who changed what, and when.
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-mist/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors group-hover:border-mist group-hover:text-ink">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      {body}
    </details>
  );
}

function headline(entry: HistoryEntry) {
  if (entry.kind === "backup") {
    return (
      <>
        <span className="font-medium">Backup before restore</span>
        <span className="text-ink/55"> · {entry.actor} restored an earlier version</span>
      </>
    );
  }
  if (entry.kind === "delete") {
    return (
      <>
        <span className="font-medium">{entry.actor}</span>
        <span className="text-ink/70"> deleted it</span>
        <span className="text-ink/55"> — it was restored later</span>
      </>
    );
  }
  return entry.summary ? (
    <>
      <span className="font-medium">{entry.actor}</span>
      <span className="text-ink/70"> changed {entry.summary}</span>
    </>
  ) : (
    <>
      <span className="font-medium">{entry.actor}</span>
      <span className="text-ink/55"> saved — no visible changes since</span>
    </>
  );
}

function HistoryItem({ entry, newest }: { entry: HistoryEntry; newest: boolean }) {
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const restore = async () => {
    setPending(true);
    setResult(null);
    const r = await safely(() => restoreRevision(entry.id));
    if (r.ok && "id" in r && r.id) {
      setResult({ ok: true, message: `${r.message} Reloading…` });
      window.location.reload();
      return;
    }
    setPending(false);
    setResult(r);
  };

  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
          entry.kind === "backup" ? "bg-accent-to" : newest ? "bg-ink" : "bg-mist"
        }`}
      />
      <p className="text-sm leading-relaxed">{headline(entry)}</p>
      <p className="mt-0.5 font-mono text-[11px] text-slatey">
        <time dateTime={entry.at} title={`${entry.when} (Manila time)`}>
          {entry.ago}
        </time>{" "}
        · {entry.when}
      </p>

      <ChangeList changes={entry.changes} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={smallButton}
          aria-expanded={preview}
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? "Hide preview" : "Preview this version"}
        </button>
        {!confirming && (
          <button type="button" className={smallButton} onClick={() => setConfirming(true)}>
            Restore this version
          </button>
        )}
      </div>

      {confirming && (
        <div
          role="group"
          aria-label="Confirm restore"
          className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-4 text-sm"
        >
          <p className="font-medium text-ink">Restore the version from {entry.when}?</p>
          <p className="mt-1 leading-relaxed text-ink/65">
            It replaces what’s there now. The current version is saved to this list first, so you
            can switch back.
            {entry.publishNote && <span className="font-medium text-ink"> {entry.publishNote}</span>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={solidButton} disabled={pending} onClick={() => void restore()}>
              {pending && <Spinner />}
              {pending ? "Restoring…" : "Restore"}
            </button>
            <button
              type="button"
              className={smallButton}
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setResult(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && <Banner result={result} className="mt-3" />}
      {preview && <RevisionPreview revisionId={entry.id} />}
    </li>
  );
}
