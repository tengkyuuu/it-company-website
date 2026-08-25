"use client";

import { useTransition } from "react";
import {
  deleteProject,
  moveProject,
  togglePublish,
} from "@/app/admin/actions";

/**
 * Inline row controls. Each is a real form posting to a server action, so they
 * work without JS; the transition just keeps the buttons disabled while the
 * revalidation lands.
 */
export default function ProjectRowActions({
  id,
  name,
  published,
}: {
  id: string;
  name: string;
  published: boolean;
}) {
  const [pending, start] = useTransition();

  const run = (action: (fd: FormData) => Promise<unknown>, fd: FormData) =>
    start(async () => {
      await action(fd);
    });

  const btn =
    "rounded-full border border-mist/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors hover:border-mist disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(["up", "down"] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          disabled={pending}
          aria-label={`Move ${name} ${dir}`}
          className={btn}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", id);
            fd.set("dir", dir);
            run(moveProject, fd);
          }}
        >
          {dir === "up" ? "↑" : "↓"}
        </button>
      ))}

      <button
        type="button"
        disabled={pending}
        className={btn}
        onClick={() => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("published", String(!published));
          run(togglePublish, fd);
        }}
      >
        {published ? "Unpublish" : "Publish"}
      </button>

      <button
        type="button"
        disabled={pending}
        className={`${btn} border-red-500/40 text-red-600 hover:bg-red-500/10`}
        onClick={() => {
          if (!confirm(`Delete “${name}”? This can't be undone.`)) return;
          const fd = new FormData();
          fd.set("id", id);
          run(deleteProject, fd);
        }}
      >
        Delete
      </button>
    </div>
  );
}
