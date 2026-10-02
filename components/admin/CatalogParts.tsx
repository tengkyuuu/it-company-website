import Link from "next/link";

/*
 * Server-safe bits shared by the products / careers / blog panel pages (no
 * hooks, no "use client" — these render inside server components).
 */

/** "← Products" above an edit/new page's title. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-[11px] uppercase tracking-widest text-slatey transition-colors hover:text-ink"
    >
      ← {children}
    </Link>
  );
}

/** "Last updated 2 Oct 2026, 3:04 pm PHT" under an edit page's title. */
export function UpdatedAt({ iso }: { iso: string }) {
  return (
    <p className="mt-1 font-mono text-[11px] text-slatey">
      Last updated{" "}
      {new Date(iso).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      })}{" "}
      PHT
    </p>
  );
}

/**
 * notFound() inside one section lands here — same card as the panel-wide
 * app/admin/not-found.tsx, but pointing back at the list it came from rather
 * than at Projects.
 */
export function SectionNotFound({ href, label }: { href: string; label: string }) {
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
          href={href}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          {label}
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
