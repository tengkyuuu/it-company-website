import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isSupabaseConfigured, type LeadRow } from "@/lib/supabase/types";
import { services as staticServices } from "@/lib/services";
import { team as staticTeam } from "@/lib/team";
import { isJobClosed, manilaToday } from "@/lib/cms";
import { Card, Notice, Pill } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import { describeDbError, isMissingTable } from "./_lib/server";
import { LEAD_KIND_LABEL, LEAD_LITE_COLUMNS, threadLeads, type LeadLite } from "./_lib/inbox";

export const metadata = { title: "Overview", robots: { index: false } };

type DbError = { code?: string; message?: string } | null;

/**
 * The panel's front page. Every number is a real query; each query succeeds or
 * fails on its own, so one missing table shows "Not set up" on its tile instead
 * of taking the whole page down — and nothing is ever invented to fill a gap.
 */
export default async function AdminHome() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const profile = await getProfile();
  const supabase = await createClient();

  const [
    projectsRes,
    servicesRes,
    rosterRes,
    teamRes,
    leadsRes,
    productsRes,
    jobsRes,
    postsRes,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, published, img, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("services").select("id, published"),
    supabase.from("team_members").select("id, published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select(`${LEAD_LITE_COLUMNS}, name, email, message`)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("products").select("id, published"),
    supabase.from("jobs").select("id, published, closes_at"),
    supabase.from("posts").select("id, published"),
  ]);

  const projects = projectsRes.data ?? [];
  const services = servicesRes.data ?? [];
  const roster = rosterRes.data ?? [];
  const products = productsRes.data ?? [];
  const posts = postsRes.data ?? [];
  const today = manilaToday();
  const jobs = (jobsRes.data ?? []).map((j) => ({
    published: Boolean(j.published),
    closed: isJobClosed(j.closes_at as string | null, today),
  }));
  const openJobs = jobs.filter((j) => j.published && !j.closed).length;
  const threads = threadLeads(
    (leadsRes.data ?? []) as unknown as (LeadLite & Pick<LeadRow, "name" | "email" | "message">)[]
  );
  const openThreads = threads.filter((t) => !t.handled);

  // team management is the owner's alone; admins edit content
  const isOwner = profile?.role === "owner";

  /** what a tile shows when its query failed */
  const failed = (error: DbError) =>
    isMissingTable(error)
      ? { value: "Not set up", sub: "Run supabase/schema.sql" }
      : { value: "—", sub: "Couldn’t load" };

  const tiles: { label: string; value: string; sub: string; href: string; attention?: boolean }[] = [
    {
      label: "Inbox",
      href: "/admin/inbox",
      ...(leadsRes.error
        ? failed(leadsRes.error)
        : {
            value: `${openThreads.length} open`,
            sub: `${threads.length} total`,
            attention: openThreads.length > 0,
          }),
    },
    {
      label: "Projects",
      href: "/admin/projects",
      ...(projectsRes.error
        ? failed(projectsRes.error)
        : projects.length === 0
          ? { value: "Built-in", sub: "Not imported yet" }
          : {
              value: `${projects.filter((p) => p.published).length} live`,
              sub: `${projects.filter((p) => !p.published).length} draft`,
            }),
    },
    {
      label: "Products",
      href: "/admin/products",
      ...(productsRes.error
        ? failed(productsRes.error)
        : products.length === 0
          ? { value: "None yet", sub: "Hidden on the site" }
          : {
              value: `${products.filter((p) => p.published).length} live`,
              sub: `${products.filter((p) => !p.published).length} draft`,
            }),
    },
    {
      label: "Services",
      href: "/admin/services",
      ...(servicesRes.error
        ? failed(servicesRes.error)
        : services.length === 0
          ? { value: "Built-in", sub: `${staticServices.length} from lib/services.ts` }
          : {
              value: `${services.filter((s) => s.published).length} live`,
              sub: `${services.filter((s) => !s.published).length} hidden`,
            }),
    },
    {
      label: "Blog",
      href: "/admin/blog",
      ...(postsRes.error
        ? failed(postsRes.error)
        : posts.length === 0
          ? { value: "None yet", sub: "Hidden on the site" }
          : {
              value: `${posts.filter((p) => p.published).length} published`,
              sub: `${posts.filter((p) => !p.published).length} draft`,
            }),
    },
    {
      label: "Careers",
      href: "/admin/careers",
      ...(jobsRes.error
        ? failed(jobsRes.error)
        : jobs.length === 0
          ? { value: "None yet", sub: "Hidden on the site" }
          : {
              value: `${openJobs} open`,
              sub: `${jobs.filter((j) => !j.published).length} draft · ${jobs.filter((j) => j.published && j.closed).length} closed`,
            }),
    },
    {
      label: "Roster",
      href: "/admin/roster",
      ...(rosterRes.error
        ? failed(rosterRes.error)
        : roster.length === 0
          ? { value: "Built-in", sub: `${staticTeam.length} from lib/team.ts` }
          : {
              value: `${roster.filter((m) => m.published).length} shown`,
              sub: `${roster.filter((m) => !m.published).length} hidden`,
            }),
    },
    {
      label: "Panel logins",
      href: "/admin/team",
      ...(teamRes.error
        ? failed(teamRes.error)
        : { value: String(teamRes.count ?? 0), sub: teamRes.count === 1 ? "account" : "accounts" }),
    },
  ];

  const anyFailed = [
    projectsRes,
    servicesRes,
    rosterRes,
    teamRes,
    leadsRes,
    productsRes,
    jobsRes,
    postsRes,
  ].find((r) => r.error && !isMissingTable(r.error));

  const quick = [
    { href: "/admin/projects/new", label: "Add a project" },
    { href: "/admin/blog/new", label: "Write a post" },
    { href: "/admin/careers/new", label: "Post a role" },
    { href: "/admin/products/new", label: "Add a product" },
    { href: "/admin/services", label: "Edit services" },
    { href: "/admin/settings", label: "Edit contact details" },
    ...(isOwner ? [{ href: "/admin/team", label: "Invite a teammate" }] : []),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {greeting()}
          {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          Everything you publish here appears on the public site straight away.
        </p>
      </header>

      {anyFailed?.error && (
        <Notice tone="error" title="Some numbers couldn’t be loaded">
          {describeDbError(anyFailed.error)} The public site is unaffected — it falls
          back to the built-in content.
        </Notice>
      )}

      {/* eight tiles: 4 rows of 2 on phones, 2 rows of 4 on desktop */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
            >
              <Card className="h-full !p-5 transition-colors group-hover:border-mist">
                <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slatey">
                  {t.label}
                  {t.attention && (
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-to" />
                  )}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {t.value}
                </p>
                <p className="mt-0.5 text-xs text-ink/50">{t.sub}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Needs a reply
            </h2>
            <Link
              href="/admin/inbox"
              className="text-sm text-ink/55 transition-colors hover:text-ink"
            >
              Inbox →
            </Link>
          </div>
          {leadsRes.error ? (
            <p className="text-sm text-ink/55">The inbox couldn’t be loaded.</p>
          ) : openThreads.length === 0 ? (
            <p className="text-sm text-ink/55">
              {threads.length === 0
                ? "No enquiries, applications or conversations yet."
                : "All caught up — nothing open."}
            </p>
          ) : (
            <ul className="divide-y divide-mist/70">
              {openThreads.slice(0, 5).map(({ head }) => (
                <li key={head.id} className="flex items-start gap-3 py-2.5">
                  <Pill tone={head.kind === "chat" ? "muted" : "live"}>
                    {LEAD_KIND_LABEL[head.kind] ?? head.kind}
                  </Pill>
                  <Link
                    href={`/admin/inbox?kind=${head.kind}`}
                    className="min-w-0 flex-1 text-sm transition-colors hover:text-accent"
                  >
                    <span className="block truncate font-medium">
                      {head.kind === "chat" ? "Website visitor" : head.name || head.email || "(no name)"}
                    </span>
                    <span className="block truncate text-ink/55">{head.message || "(empty)"}</span>
                  </Link>
                  <time
                    dateTime={head.created_at}
                    className="shrink-0 font-mono text-[11px] text-ink/45"
                  >
                    {ago(head.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Recently edited
            </h2>
            <Link
              href="/admin/projects"
              className="text-sm text-ink/55 transition-colors hover:text-ink"
            >
              All →
            </Link>
          </div>
          {projectsRes.error ? (
            <p className="text-sm text-ink/55">Projects couldn’t be loaded.</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-ink/55">
              No projects in the database yet.{" "}
              <Link href="/admin/projects" className="text-accent">
                Import the existing ones
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <ul className="divide-y divide-mist/70">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="min-w-0 flex-1 truncate text-sm transition-colors hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  {!p.img && <Pill tone="draft">No screenshot</Pill>}
                  <Pill tone={p.published ? "live" : "draft"}>
                    {p.published ? "Live" : "Draft"}
                  </Pill>
                  <time
                    dateTime={p.updated_at}
                    className="hidden shrink-0 font-mono text-[11px] text-ink/45 sm:block"
                  >
                    {ago(p.updated_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {quick.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
            >
              {a.label}
            </Link>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          >
            View the site ↗
          </a>
        </div>
      </Card>
    </div>
  );
}

function greeting() {
  // the studio runs on Manila time
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Manila",
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "5m", "3h", "2d", then a date — compact enough for a list row. */
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}
