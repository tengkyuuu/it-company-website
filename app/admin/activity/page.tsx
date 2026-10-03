import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import { Card, Notice } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import ActivityList from "@/components/admin/ActivityList";
import { loadActivity, loadPeople } from "../_lib/history";
import { ACTION_GROUPS, ACTIVITY_SECTIONS } from "../_lib/history-logic";

export const metadata = { title: "Activity", robots: { index: false } };

/**
 * The panel's audit feed: every content change (written by database triggers,
 * so nothing — not even a direct API call with someone's session — edits
 * content without a line here), plus team, sign-in and restore events written
 * by server code. Newest first, 30 a page, paged by id (stable while new rows
 * arrive). Filters are a plain GET form, so they work without JS and survive a
 * reload or a shared link.
 *
 * Chat messages and rate-limit hits are deliberately NOT activity — nothing
 * logs them, and the loader filters such prefixes out anyway (the reference
 * project's feed drowned in them).
 */

const PAGE = 30;

const selectClass =
  "w-full rounded-xl border border-mist/70 bg-paper px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent-to focus:outline-none focus:ring-2 focus:ring-accent-to/25";
const labelClass = "mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-slatey";

type Search = { section?: string; actor?: string; group?: string; before?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const sp = await searchParams;

  const section = ACTIVITY_SECTIONS.some((s) => s.value === sp.section) ? sp.section : undefined;
  const group = ACTION_GROUPS.some((g) => g.value === sp.group) ? sp.group : undefined;
  const actor = sp.actor && sp.actor.length <= 64 ? sp.actor : undefined;
  const before = sp.before && /^\d{1,15}$/.test(sp.before) ? Number(sp.before) : undefined;

  const [page, people] = await Promise.all([
    loadActivity({ section, actor, group, before, limit: PAGE }),
    loadPeople(),
  ]);

  const filtered = Boolean(section || group || actor);
  const query = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ section, actor, group, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/activity?${s}` : "/admin/activity";
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-ink/55">
          Who changed what, and when — content edits, publishing, restores, team and sign-in
          events. Times are Manila time.
        </p>
      </header>

      <Card className="!p-5">
        <form method="get" action="/admin/activity" className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label htmlFor="act-section" className={labelClass}>
              Section
            </label>
            <select id="act-section" name="section" defaultValue={section ?? ""} className={selectClass}>
              <option value="">Everything</option>
              {ACTIVITY_SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="act-actor" className={labelClass}>
              Person
            </label>
            <select id="act-actor" name="actor" defaultValue={actor ?? ""} className={selectClass}>
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="system">System (imports, server jobs)</option>
            </select>
          </div>
          <div>
            <label htmlFor="act-group" className={labelClass}>
              Kind
            </label>
            <select id="act-group" name="group" defaultValue={group ?? ""} className={selectClass}>
              <option value="">All kinds</option>
              {ACTION_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Filter
            </button>
            {filtered && (
              <Link
                href="/admin/activity"
                className="rounded-full border border-mist/70 px-4 py-2.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </Card>

      {!page.ok ? (
        <Notice tone={page.notSetUp ? "warn" : "error"} title="Couldn’t load activity">
          {page.message}
        </Notice>
      ) : page.items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/55">
            {before
              ? "No older activity."
              : filtered
                ? "Nothing matches those filters."
                : "No activity yet — it appears here as soon as anyone edits, publishes or invites."}
          </p>
        </Card>
      ) : (
        <Card className="!py-2">
          <ActivityList items={page.items} />
        </Card>
      )}

      {page.ok && (before || page.nextBefore) && (
        <nav aria-label="Activity pages" className="flex flex-wrap items-center justify-between gap-3">
          {before ? (
            <Link
              href={query({})}
              className="rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
            >
              ← Newest
            </Link>
          ) : (
            <span />
          )}
          {page.nextBefore && (
            <Link
              href={query({ before: String(page.nextBefore) })}
              className="rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
            >
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
