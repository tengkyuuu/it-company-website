import Link from "next/link";

/**
 * notFound() from any panel page lands here, inside the admin shell — e.g. a
 * project that was deleted in another tab, or a mistyped id in the URL.
 */
export default function AdminNotFound() {
  return (
    <div className="rounded-2xl border border-mist/70 bg-surface p-6 md:p-8">
      <p className="font-mono text-[11px] uppercase tracking-widest text-slatey">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
        That doesn’t exist (any more).
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink/65">
        It may have been deleted by someone else, or the link is out of date.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/projects"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          All projects
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-mist/70 px-5 py-2.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
        >
          Overview
        </Link>
      </div>
    </div>
  );
}
