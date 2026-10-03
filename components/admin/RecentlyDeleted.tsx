"use client";

import { useState } from "react";
import { restoreRevision } from "@/app/admin/history-actions";
import type { DeletedItem } from "@/app/admin/_lib/history";
import { Banner } from "./ui";
import { RevisionPreview, Spinner, safely, smallButton, solidButton } from "./HistoryParts";

/**
 * "Recently deleted" at the foot of a list page: items whose newest revision
 * is their DELETE snapshot (the whole row) and that no longer exist. Restore
 * re-inserts the row with its original id, exactly as it was — then the page
 * reloads so the item is back in the list. Renders nothing when there's
 * nothing to bring back.
 */
export default function RecentlyDeleted({
  items,
  noun,
}: {
  items: DeletedItem[];
  /** singular, for the confirm text: "project", "post" */
  noun: string;
}) {
  if (!items.length) return null;
  return (
    <details className="group rounded-2xl border border-mist/70 bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium">Recently deleted</span>
          <span className="font-mono text-[11px] tabular-nums text-slatey">{items.length}</span>
        </span>
        <span className="shrink-0 rounded-full border border-mist/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors group-hover:border-mist group-hover:text-ink">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <ul className="divide-y divide-mist/70 border-t border-mist/70">
        {items.map((item) => (
          <DeletedRow key={item.revisionId} item={item} noun={noun} />
        ))}
      </ul>
    </details>
  );
}

function DeletedRow({ item, noun }: { item: DeletedItem; noun: string }) {
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const restore = async () => {
    setPending(true);
    setResult(null);
    const r = await safely(() => restoreRevision(item.revisionId));
    if (r.ok) {
      setResult({ ok: true, message: `${r.message} Reloading…` });
      window.location.reload();
      return;
    }
    setPending(false);
    setResult(r);
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.label}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slatey">
            {item.slug ? `${item.slug} · ` : ""}deleted by {item.actor} ·{" "}
            <span title={`${item.when} (Manila time)`}>{item.ago}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={smallButton}
            aria-expanded={preview}
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? "Hide preview" : "Preview"}
          </button>
          {!confirming && (
            <button type="button" className={smallButton} onClick={() => setConfirming(true)}>
              Restore
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div
          role="group"
          aria-label="Confirm restore"
          className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-4 text-sm"
        >
          <p className="font-medium text-ink">Bring back the {noun} “{item.label}”?</p>
          <p className="mt-1 leading-relaxed text-ink/65">
            It returns exactly as it was when it was deleted
            {item.published === true
              ? " — including being live on the site."
              : item.published === false
                ? ", as a draft."
                : "."}
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
      {preview && <RevisionPreview revisionId={item.revisionId} />}
    </li>
  );
}
