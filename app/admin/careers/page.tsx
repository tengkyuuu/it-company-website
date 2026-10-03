import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type JobRow } from "@/lib/supabase/types";
import { isJobClosed, manilaToday } from "@/lib/cms";
import { Card, Notice, Pill } from "@/components/admin/ui";
import CatalogRowActions from "@/components/admin/CatalogRowActions";
import SetupNotice from "@/components/admin/SetupNotice";
import RecentlyDeleted from "@/components/admin/RecentlyDeleted";
import { loadRecentlyDeleted } from "../_lib/history";
import { describeDbError, isMissingTable } from "../_lib/server";
import { employmentLabel, formatDay, workplaceLabel } from "../_lib/catalog";

export const metadata = { title: "Careers", robots: { index: false } };

const primaryLink =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/**
 * Open positions. A published role whose closing date has passed reads
 * "Closed": the careers page no longer lists it, but its own page still loads
 * (saying it has closed) so an old link doesn't 404. Applications land in the
 * inbox under "Applications".
 */
export default async function AdminCareersPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const [{ data, error }, deleted] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, slug, title, department, employment_type, workplace, closes_at, published, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    loadRecentlyDeleted("jobs"),
  ]);

  const jobs = (data ?? []) as Pick<
    JobRow,
    | "id"
    | "slug"
    | "title"
    | "department"
    | "employment_type"
    | "workplace"
    | "closes_at"
    | "published"
    | "sort_order"
  >[];
  const today = manilaToday();
  const closed = (j: (typeof jobs)[number]) => isJobClosed(j.closes_at, today);
  const open = jobs.filter((j) => j.published && !closed(j)).length;
  const closedCount = jobs.filter((j) => j.published && closed(j)).length;
  const drafts = jobs.filter((j) => !j.published).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Careers</h1>
          <p className="mt-1 text-sm text-ink/55">
            {jobs.length
              ? `${open} open · ${closedCount} closed · ${drafts} draft${drafts === 1 ? "" : "s"}`
              : "Open positions on the careers page."}{" "}
            <Link
              href="/admin/inbox?kind=application"
              className="underline decoration-mist underline-offset-2 transition-colors hover:text-ink hover:decoration-ink"
            >
              Applications →
            </Link>
          </p>
        </div>
        {!error && jobs.length > 0 && (
          <Link href="/admin/careers/new" className={primaryLink}>
            New role
          </Link>
        )}
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The jobs table isn't set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> in the
            Supabase SQL editor (it's safe to run twice), then reload.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load roles">
            {describeDbError(error)} The public site is unaffected — it simply lists no roles.
          </Notice>
        ))}

      {!error && jobs.length === 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold tracking-tight">Add your first role</h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink/60">
            Post a position and people can apply from its page — applications arrive in the
            inbox. There’s no Careers page or nav link on the site until a role is published.
          </p>
          <div className="mt-5">
            <Link href="/admin/careers/new" className={primaryLink}>
              Post a role
            </Link>
          </div>
        </Card>
      )}

      {!error && jobs.length > 0 && open === 0 && (
        <Notice tone="warn" title="No open roles">
          The Careers page and its nav link stay hidden until at least one role is published
          with a closing date that hasn’t passed (or no closing date).
        </Notice>
      )}

      {jobs.length > 0 && (
        <ol className="space-y-3">
          {jobs.map((j, i) => {
            const isClosed = closed(j);
            return (
              <li key={j.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/careers/${j.id}`}
                          className="truncate font-medium transition-colors hover:text-accent"
                        >
                          {j.title}
                        </Link>
                        {!j.published ? (
                          <Pill tone="draft">Draft</Pill>
                        ) : isClosed ? (
                          <Pill>Closed</Pill>
                        ) : (
                          <Pill tone="live">Published</Pill>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slatey">
                        {[
                          `/careers/${j.slug}`,
                          j.department,
                          employmentLabel(j.employment_type),
                          workplaceLabel(j.workplace),
                          j.closes_at
                            ? `${isClosed ? "closed" : "closes"} ${formatDay(j.closes_at)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <CatalogRowActions
                      kind="job"
                      id={j.id}
                      name={j.title}
                      slug={j.slug}
                      published={j.published}
                      // a closed role's page still loads (it says it has closed)
                      viewable={j.published}
                      isFirst={i === 0}
                      isLast={i === jobs.length - 1}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {!error && <RecentlyDeleted items={deleted} noun="role" />}
    </div>
  );
}
