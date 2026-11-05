import Link from "next/link";
import { Notice } from "@/components/admin/ui";
import ActivityList from "@/components/admin/ActivityList";
import type { ActivityItem } from "@/app/admin/_lib/history";

/*
 * The panel's front page, as a pure view: app/admin/page.tsx runs the queries
 * and hands over finished strings (every time already formatted in Manila),
 * so this renders the same on the server and in a preview with sample data.
 *
 * Shape, top to bottom: one sentence that says whether anything needs you; a
 * ledger of what is on the public site (numeral first, like a contents page,
 * with empty sections set apart as "not on the site yet"); the activity log.
 * The right column holds what needs a reply and what moved last. No grid of
 * identical stat tiles, no pill cloud of quick actions.
 */

export type OverviewRow = {
  name: string;
  href: string;
  count: number | null;
  detail: string;
  action?: { href: string; label: string };
  state: "live" | "builtin" | "empty" | "error";
};

export type OverviewProps = {
  date: string;
  greeting: string;
  firstName: string | null;
  /** open conversations, or null when the inbox couldn't be read */
  waiting: number | null;
  summary: string;
  failedMessage: string | null;
  rows: OverviewRow[];
  replies:
    | { state: "error" }
    | {
        state: "ok";
        total: number;
        open: { id: string; href: string; who: string; kind: string; message: string; at: string; ago: string }[];
      };
  edited:
    | { state: "error" }
    | { state: "empty" }
    | { state: "ok"; items: { id: string; name: string; live: boolean; noShot: boolean; at: string; ago: string }[] };
  activity: { state: "error" | "notSetUp" | "empty" } | { state: "ok"; items: ActivityItem[] };
  shortcuts: { href: string; label: string }[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function OverviewView(p: OverviewProps) {
  const onSite = p.rows.filter((r) => r.state !== "empty");
  const notYet = p.rows.filter((r) => r.state === "empty");

  return (
    <div className="space-y-12 md:space-y-14">
      <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="ov-in font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">{p.date}</p>
          <h1
            className="ov-in mt-4 text-balance font-display text-[clamp(2rem,3.6vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.035em]"
            style={{ "--d": "60ms" } as React.CSSProperties}
          >
            {p.greeting}
            {p.firstName ? `, ${p.firstName}` : ""}.
            <span className="block text-ink/45">
              {p.waiting === null
                ? "The inbox couldn’t be checked."
                : p.waiting === 0
                  ? "Nothing is waiting for a reply."
                  : `${plural(p.waiting, "conversation")} waiting for a reply.`}
            </span>
          </h1>
          <p
            className="ov-in mt-4 text-sm leading-relaxed text-ink/55"
            style={{ "--d": "120ms" } as React.CSSProperties}
          >
            {p.summary} Anything you publish here appears on the public site straight away.
          </p>
        </div>
        <div className="ov-in flex shrink-0 items-center gap-3" style={{ "--d": "160ms" } as React.CSSProperties}>
          <Link
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            Add a project
          </Link>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-mist px-5 py-2.5 text-sm text-ink/75 transition-colors hover:border-ink hover:text-ink"
          >
            View site ↗
          </a>
        </div>
      </header>

      {p.failedMessage && (
        <Notice tone="error" title="Some numbers couldn’t be loaded">
          {p.failedMessage} The public site is unaffected — it falls back to the built-in content.
        </Notice>
      )}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14">
        {/* left: the ledger, then the log */}
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="ov-site" className="ov-in" style={{ "--d": "200ms" } as React.CSSProperties}>
            <SectionHead id="ov-site" title="On the site" />
            <ul className="overflow-hidden rounded-2xl border border-mist bg-surface">
              {onSite.map((r) => (
                <LedgerRow key={r.name} row={r} />
              ))}
            </ul>

            {notYet.length > 0 && (
              <>
                <h3 className="mb-3 mt-8 text-sm font-medium text-ink/55">Not on the site yet</h3>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {notYet.map((r) => (
                    <li key={r.name}>
                      <Link
                        href={r.action?.href ?? r.href}
                        className="group flex h-full flex-col justify-between gap-4 rounded-2xl sm:gap-6 border border-dashed border-ink/15 p-5 transition-colors duration-300 hover:border-ink/40 hover:bg-surface"
                      >
                        <span>
                          <span className="block font-display text-lg font-medium tracking-[-0.02em]">
                            {r.name}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-ink/50">{r.detail}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          {r.action?.label ?? "Open"}
                          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                            →
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="ov-activity" className="ov-in" style={{ "--d": "260ms" } as React.CSSProperties}>
            <SectionHead id="ov-activity" title="Recent activity" link={{ href: "/admin/activity", label: "All activity" }} />
            {p.activity.state === "ok" ? (
              <div className="border-t border-mist">
                <ActivityList items={p.activity.items} compact />
              </div>
            ) : (
              <p className="text-sm text-ink/55">
                {p.activity.state === "notSetUp"
                  ? "The activity log isn’t set up yet — re-run supabase/schema.sql."
                  : p.activity.state === "empty"
                    ? "Nothing yet — edits, publishing and invites will show up here."
                    : "Activity couldn’t be loaded."}
              </p>
            )}
          </section>
        </div>

        {/* right: what needs you, what moved */}
        <aside
          className="ov-in order-first min-w-0 space-y-12 lg:order-none lg:sticky lg:top-24 lg:self-start"
          style={{ "--d": "240ms" } as React.CSSProperties}
        >
          <section aria-labelledby="ov-reply">
            <SectionHead
              id="ov-reply"
              title="Needs a reply"
              count={p.waiting ?? undefined}
              link={{ href: "/admin/inbox", label: "Inbox" }}
            />
            {p.replies.state === "error" ? (
              <p className="text-sm text-ink/55">The inbox couldn’t be loaded.</p>
            ) : p.replies.open.length === 0 ? (
              <div className="flex items-start gap-3 rounded-2xl border border-mist bg-surface p-5">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed text-ink/65">
                  {p.replies.total === 0
                    ? "No enquiries, applications or conversations yet. When the contact form or the chat gets one, it lands here."
                    : "All caught up — every conversation has been handled."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-mist border-y border-mist">
                {p.replies.open.map((t) => (
                  <li key={t.id}>
                    <Link href={t.href} className="group flex items-start gap-3 py-3.5">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium underline-offset-4 group-hover:underline">
                            {t.who}
                          </span>
                          <time dateTime={t.at} className="shrink-0 font-mono text-[11px] text-ink/45">
                            {t.ago}
                          </time>
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-ink/55">
                          <span className="text-ink/40">{t.kind} · </span>
                          {t.message}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="ov-edited">
            <SectionHead id="ov-edited" title="Recently edited" link={{ href: "/admin/projects", label: "Projects" }} />
            {p.edited.state === "error" ? (
              <p className="text-sm text-ink/55">Projects couldn’t be loaded.</p>
            ) : p.edited.state === "empty" ? (
              <p className="text-sm text-ink/55">
                No projects in the panel yet.{" "}
                <Link href="/admin/projects" className="text-accent underline-offset-4 hover:underline">
                  Import the existing ones
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-mist border-y border-mist">
                {p.edited.items.map((x) => (
                  <li key={x.id}>
                    <Link href={`/admin/projects/${x.id}`} className="group flex items-center gap-3 py-3">
                      <span
                        aria-hidden
                        className={`size-1.5 shrink-0 rounded-full ${x.live ? "bg-ink" : "border border-ink/40"}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm underline-offset-4 group-hover:underline">
                        {x.name}
                      </span>
                      <span className="shrink-0 text-xs text-ink/45">
                        {x.noShot ? "No screenshot · " : ""}
                        {x.live ? "Live" : "Draft"}
                      </span>
                      <time dateTime={x.at} className="w-10 shrink-0 text-right font-mono text-[11px] text-ink/45">
                        {x.ago}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <nav aria-label="Shortcuts" className="-mx-3 space-y-0.5">
            {p.shortcuts.map((x) => (
              <Link
                key={x.href}
                href={x.href}
                className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-ink/65 transition-colors hover:bg-surface hover:text-ink"
              >
                {x.label}
                <span
                  aria-hidden
                  className="text-ink/35 transition-[transform,color] duration-300 group-hover:translate-x-1 group-hover:text-ink"
                >
                  →
                </span>
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({
  id,
  title,
  count,
  link,
}: {
  id: string;
  title: string;
  count?: number;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 id={id} className="flex items-baseline gap-2 font-display text-lg font-medium tracking-[-0.02em]">
        {title}
        {count ? <span className="font-mono text-xs tabular-nums text-accent">{count}</span> : null}
      </h2>
      {link && (
        <Link
          href={link.href}
          className="group inline-flex items-center gap-1 text-sm text-ink/50 transition-colors hover:text-ink"
        >
          {link.label}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
    </div>
  );
}

/** One section of the site: the count set large, the name, what the count means. */
function LedgerRow({ row }: { row: OverviewRow }) {
  return (
    <li className="group/row relative flex items-center gap-5 border-b border-mist px-5 py-4 transition-colors duration-300 last:border-b-0 hover:bg-paper md:gap-7 md:px-6 md:py-5">
      <span
        className={`w-12 shrink-0 text-right font-display text-[2rem] font-medium leading-none tabular-nums tracking-[-0.04em] md:w-14 md:text-[2.25rem] ${
          row.state === "builtin" ? "text-ink/35" : row.state === "error" ? "text-ink/25" : ""
        }`}
      >
        {row.count ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        {/* the name's link stretches over the whole row; the action button sits above it */}
        <Link href={row.href} className="block font-medium after:absolute after:inset-0">
          {row.name}
        </Link>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-ink/50">
          {row.state === "builtin" && (
            <span className="shrink-0 rounded-md border border-mist px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.14em] text-slatey">
              Code
            </span>
          )}
          <span className="truncate">{row.detail}</span>
        </span>
      </span>
      {row.action && (
        <Link
          href={row.action.href}
          className="relative z-10 hidden shrink-0 rounded-full border border-mist bg-surface px-3.5 py-1.5 text-xs font-medium text-ink/60 transition-[border-color,color] duration-300 hover:border-ink hover:text-ink group-hover/row:border-ink/30 group-hover/row:text-ink sm:inline-flex"
        >
          {row.action.label}
        </Link>
      )}
      <span
        aria-hidden
        className="shrink-0 text-ink/30 transition-[transform,color] duration-300 group-hover/row:translate-x-1 group-hover/row:text-ink"
      >
        →
      </span>
    </li>
  );
}
