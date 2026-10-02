"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteJob,
  deletePost,
  deleteProduct,
  moveJob,
  moveProduct,
  toggleJobPublish,
  togglePostPublish,
  toggleProductPublish,
  type ActionResult,
} from "@/app/admin/catalog-actions";
import { ADMIN_PATH, PUBLIC_PATH, type CatalogKind } from "@/app/admin/_lib/catalog";
import { callAction } from "./ui";

type Action = (fd: FormData) => Promise<ActionResult>;

const KINDS: Record<
  CatalogKind,
  { toggle: Action; remove: Action; move?: Action; deleteWarning: string }
> = {
  product: {
    toggle: toggleProductPublish,
    remove: deleteProduct,
    move: moveProduct,
    deleteWarning: "It disappears from the site immediately and this can't be undone here.",
  },
  job: {
    toggle: toggleJobPublish,
    remove: deleteJob,
    move: moveJob,
    deleteWarning:
      "It disappears from the careers page immediately. Applications already received stay in the inbox.",
  },
  post: {
    toggle: togglePostPublish,
    remove: deletePost,
    deleteWarning: "It disappears from the blog immediately and this can't be undone here.",
  },
};

/**
 * Inline row controls for products, roles and posts — the same shape as
 * ProjectRowActions: real server-action calls inside a transition (buttons
 * stay disabled while the revalidation lands) and failures shown under the
 * row instead of vanishing. Posts have no manual order, so no arrows.
 */
export default function CatalogRowActions({
  kind,
  id,
  name,
  slug,
  published,
  viewable,
  isFirst = false,
  isLast = false,
}: {
  kind: CatalogKind;
  id: string;
  name: string;
  slug: string;
  published: boolean;
  /** there's a public page to open (published, and for a role: not closed) */
  viewable: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = KINDS[kind];

  const run = (action: Action, fields: Record<string, string>) => {
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      const r = await callAction(() => action(fd));
      if (r && !r.ok) setError(r.message);
    });
  };

  const btn =
    "rounded-full border border-mist/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5" aria-busy={pending || undefined}>
        {actions.move && (
          <>
            <button
              type="button"
              disabled={pending || isFirst}
              aria-label={`Move ${name} up`}
              title="Move up"
              className={btn}
              onClick={() => run(actions.move!, { id, dir: "up" })}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={pending || isLast}
              aria-label={`Move ${name} down`}
              title="Move down"
              className={btn}
              onClick={() => run(actions.move!, { id, dir: "down" })}
            >
              ↓
            </button>
          </>
        )}

        <Link href={`${ADMIN_PATH[kind]}/${id}`} className={btn} aria-label={`Edit ${name}`}>
          Edit
        </Link>

        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => run(actions.toggle, { id, published: String(!published) })}
        >
          {published ? "Unpublish" : "Publish"}
        </button>

        {viewable && (
          <Link
            href={`${PUBLIC_PATH[kind]}/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
            aria-label={`View ${name} on the site (opens in a new tab)`}
          >
            View ↗
          </Link>
        )}

        <button
          type="button"
          disabled={pending}
          className={`${btn} border-red-500/40 text-red-600 hover:border-red-500/60 hover:bg-red-500/10 dark:text-red-400`}
          onClick={() => {
            if (!window.confirm(`Delete “${name}”? ${actions.deleteWarning}`)) return;
            run(actions.remove, { id });
          }}
        >
          Delete
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="max-w-xs text-xs leading-relaxed text-red-600 dark:text-red-400 sm:text-right"
        >
          {error}
        </p>
      )}
    </div>
  );
}
