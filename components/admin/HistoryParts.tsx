"use client";

import { useEffect, useState } from "react";
import { getRevisionPreview } from "@/app/admin/history-actions";
import type { PreviewResponse } from "@/app/admin/_lib/history";
import type { FieldChange, PreviewField } from "@/app/admin/_lib/history-logic";

/**
 * Pieces shared by HistoryPanel and RecentlyDeleted: change rows, the full
 * "preview this version" view, thumbnails, and a safe wrapper for calling a
 * server action from a click handler. Theme tokens only, so both follow
 * light/dark with the rest of the panel.
 */

/** Call a server action; a network failure becomes a result, Next's redirects still propagate. */
export async function safely<T extends { ok: boolean }>(
  run: () => Promise<T>
): Promise<T | { ok: false; message: string }> {
  try {
    return await run();
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_")) throw e;
    return { ok: false, message: "Couldn't reach the server — check your connection and try again." };
  }
}

export const smallButton =
  "inline-flex items-center gap-1.5 rounded-full border border-mist/70 px-3.5 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-not-allowed disabled:opacity-60";

export const solidButton =
  "inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-60";

export function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/** Only our own kinds of image address: https, or a site path (never `//host`). */
const safeSrc = (url: string | null) =>
  url && (/^https:\/\//i.test(url) || /^\/(?![/\\])/.test(url)) ? url : null;

export function Thumb({ url, label }: { url: string | null; label?: string }) {
  const src = safeSrc(url);
  if (!src) {
    return (
      <span className="inline-flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-mist/70 font-mono text-[10px] text-slatey">
        {url ? "unsafe" : "none"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label ?? ""}
      loading="lazy"
      className="h-12 w-20 rounded-lg border border-mist/70 bg-ink/[0.06] object-cover object-top"
    />
  );
}

const isHex = (c: string) => /^#[0-9a-f]{3,8}$/i.test(c);

function Swatches({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="text-ink/45">(none)</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {colors.map((c, i) =>
        isHex(c) ? (
          <span
            key={`${c}-${i}`}
            title={c}
            className="h-4 w-4 rounded-full border border-mist/70"
            style={{ background: c }}
          />
        ) : (
          <span key={`${c}-${i}`} className="font-mono text-[11px]">
            {c}
          </span>
        )
      )}
    </span>
  );
}

function Chip({ tone, children }: { tone: "add" | "remove"; children: React.ReactNode }) {
  return tone === "add" ? (
    <span className="rounded-full border border-emerald-500/35 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
      <span aria-hidden>+ </span>
      <span className="sr-only">added </span>
      {children}
    </span>
  ) : (
    <span className="rounded-full border border-red-500/30 px-2 py-0.5 text-xs text-red-700 line-through decoration-red-500/40 dark:text-red-300">
      <span aria-hidden>− </span>
      <span className="sr-only">removed </span>
      {children}
    </span>
  );
}

function ChangeValue({ change }: { change: FieldChange }) {
  switch (change.type) {
    case "text": {
      const short = change.before.length + change.after.length < 90;
      if (short) {
        return (
          <span className="text-sm leading-relaxed">
            <span className="sr-only">from </span>
            <span className="text-ink/45 line-through decoration-ink/25">{change.before}</span>
            <span aria-hidden className="mx-1.5 text-slatey">
              →
            </span>
            <span className="sr-only"> to </span>
            <span className="text-ink">{change.after}</span>
          </span>
        );
      }
      return (
        <span className="grid gap-1 text-sm leading-relaxed">
          <span className="text-ink/45">
            <span className="mr-1.5 font-mono text-[10px] uppercase tracking-widest">Before</span>
            {change.before}
          </span>
          <span className="text-ink">
            <span className="mr-1.5 font-mono text-[10px] uppercase tracking-widest text-slatey">After</span>
            {change.after}
          </span>
        </span>
      );
    }
    case "list":
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          {change.removed.map((s, i) => (
            <Chip key={`r-${i}`} tone="remove">
              {s}
            </Chip>
          ))}
          {change.added.map((s, i) => (
            <Chip key={`a-${i}`} tone="add">
              {s}
            </Chip>
          ))}
          {change.note && <span className="text-xs italic text-ink/55">{change.note}</span>}
        </span>
      );
    case "image":
      return (
        <span className="flex items-center gap-2">
          <Thumb url={change.before} label="before" />
          <span aria-hidden className="text-slatey">
            →
          </span>
          <Thumb url={change.after} label="after" />
        </span>
      );
    case "images":
      return (
        <span className="flex flex-wrap items-center gap-2">
          {change.removed.map((u) => (
            <span key={`r-${u}`} className="relative opacity-60">
              <Thumb url={u} label="removed image" />
              <span className="absolute -right-1 -top-1 rounded-full bg-surface px-1 font-mono text-[10px] text-red-700 dark:text-red-300">
                −
              </span>
            </span>
          ))}
          {change.added.map((u) => (
            <span key={`a-${u}`} className="relative">
              <Thumb url={u} label="added image" />
              <span className="absolute -right-1 -top-1 rounded-full bg-surface px-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                +
              </span>
            </span>
          ))}
          {change.note && <span className="text-xs italic text-ink/55">{change.note}</span>}
        </span>
      );
    case "colors":
      return (
        <span className="flex items-center gap-2">
          <Swatches colors={change.before} />
          <span aria-hidden className="text-slatey">
            →
          </span>
          <Swatches colors={change.after} />
        </span>
      );
  }
}

export function ChangeList({ changes }: { changes: FieldChange[] }) {
  if (!changes.length) return null;
  return (
    <dl className="mt-2.5 space-y-2">
      {changes.map((c) => (
        <div key={c.key} className="grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
          <dt className="pt-0.5 font-mono text-[10px] uppercase tracking-widest text-slatey">{c.label}</dt>
          <dd className="min-w-0 break-words">
            <ChangeValue change={c} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PreviewValue({ field }: { field: PreviewField }) {
  switch (field.type) {
    case "text":
      return <span className="text-sm">{field.value}</span>;
    case "longtext":
      return field.value ? (
        <div
          data-lenis-prevent
          className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-mist/70 bg-surface p-3 text-sm leading-relaxed"
        >
          {field.value}
        </div>
      ) : (
        <span className="text-sm text-ink/45">(empty)</span>
      );
    case "list":
      return field.items.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {field.items.map((s, i) => (
            <li key={i} className="rounded-full border border-mist/70 px-2 py-0.5 text-xs">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-sm text-ink/45">(none)</span>
      );
    case "image":
      return <Thumb url={field.url} label={field.label} />;
    case "images":
      return field.items.length ? (
        <ul className="flex flex-wrap gap-2">
          {field.items.map((s, i) => (
            <li key={`${s.src}-${i}`} className="w-20">
              <Thumb url={s.src} label={s.caption} />
              {s.caption && <p className="mt-1 truncate text-[11px] text-ink/55">{s.caption}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-sm text-ink/45">(none)</span>
      );
    case "colors":
      return <Swatches colors={field.items} />;
  }
}

/** "Preview this version": every field of one stored version, fetched on first open. */
export function RevisionPreview({ revisionId }: { revisionId: number }) {
  const [state, setState] = useState<PreviewResponse | null>(null);

  useEffect(() => {
    let live = true;
    void safely(() => getRevisionPreview(revisionId)).then((r) => {
      if (live) setState(r as PreviewResponse);
    });
    return () => {
      live = false;
    };
  }, [revisionId]);

  if (!state) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-ink/55">
        <Spinner /> Loading this version…
      </p>
    );
  }
  if (!state.ok) {
    return <p className="mt-3 text-sm text-red-700 dark:text-red-300">{state.message}</p>;
  }
  return (
    <div className="mt-3 rounded-xl border border-mist/70 bg-paper p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slatey">
        {state.backup ? "Backup" : "Version"} from {state.when} · {state.actor}
      </p>
      <dl className="mt-3 space-y-3">
        {state.fields.map((f) => (
          <div key={f.key} className="grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
            <dt className="pt-0.5 font-mono text-[10px] uppercase tracking-widest text-slatey">{f.label}</dt>
            <dd className="min-w-0 break-words">
              <PreviewValue field={f} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
