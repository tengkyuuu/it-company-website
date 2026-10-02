"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteProject,
  moveProject,
  togglePublish,
  type ActionResult,
} from "@/app/admin/actions";
import { callAction } from "./ui";

/**
 * Inline row controls. Each button posts to a server action; the transition
 * keeps them disabled while the revalidation lands, and a failure is shown
 * under the row instead of vanishing silently (it used to: the result was
 * awaited and dropped, so a refused publish just looked like a dead button).
 */
export default function ProjectRowActions({
  id,
  name,
  slug,
  published,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: (fd: FormData) => Promise<ActionResult>, fields: Record<string, string>) => {
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
        <button
          type="button"
          disabled={pending || isFirst}
          aria-label={`Move ${name} up`}
          title="Move up"
          className={btn}
          onClick={() => run(moveProject, { id, dir: "up" })}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          aria-label={`Move ${name} down`}
          title="Move down"
          className={btn}
          onClick={() => run(moveProject, { id, dir: "down" })}
        >
          ↓
        </button>

        <Link href={`/admin/projects/${id}`} className={btn} aria-label={`Edit ${name}`}>
          Edit
        </Link>

        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => run(togglePublish, { id, published: String(!published) })}
        >
          {published ? "Unpublish" : "Publish"}
        </button>

        {published && (
          <Link
            href={`/projects/${slug}`}
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
            if (
              !window.confirm(
                `Delete “${name}”? It disappears from the site immediately and this can't be undone.`
              )
            )
              return;
            run(deleteProject, { id });
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
