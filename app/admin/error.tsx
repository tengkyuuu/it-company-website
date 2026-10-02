"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Error boundary for panel pages. Renders inside the admin shell, so the nav
 * stays usable. "Try again" refreshes the server data *and* resets the
 * boundary — reset() alone would re-render the same failed server payload.
 *
 * In production Next replaces server error messages with a generic one (only
 * the digest survives), so the copy here never depends on the message.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  const dev = process.env.NODE_ENV !== "production";

  return (
    <div role="alert" className="rounded-2xl border border-red-500/35 bg-red-500/[0.06] p-6 md:p-8">
      <p className="font-mono text-[11px] uppercase tracking-widest text-red-700 dark:text-red-300">
        Something went wrong
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
        This page couldn’t load.
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink/65">
        Usually the database was briefly unreachable — free Supabase projects pause
        after a week without traffic and take a moment to wake. Nothing you saved
        earlier is affected, and the public site keeps running on its fallback
        content.
      </p>
      {dev && error.message && (
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-mist/70 bg-paper p-3 font-mono text-xs text-ink/70">
          {error.message}
        </pre>
      )}
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-slatey">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-full border border-mist/70 px-5 py-2.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
