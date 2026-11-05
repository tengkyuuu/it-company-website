import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isSupabaseConfigured, type LeadRow } from "@/lib/supabase/types";
import { services as staticServices } from "@/lib/services";
import { team as staticTeam } from "@/lib/team";
import { isJobClosed, manilaToday } from "@/lib/cms";
import SetupNotice from "@/components/admin/SetupNotice";
import OverviewView, { type OverviewRow } from "@/components/admin/OverviewView";
import { loadActivity } from "./_lib/history";
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
  // runs alongside the tile queries below; never throws (errors come back as a result)
  const activityPromise = loadActivity({ limit: 8 }).catch(() => null);

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

  const activity = await activityPromise;
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

  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const errRow = (name: string, href: string, error: DbError): OverviewRow => ({
    name,
    href,
    count: null,
    detail: isMissingTable(error) ? "Not set up — run supabase/schema.sql" : "Couldn’t load",
    state: "error",
  });

  // one row per section of the public site; empty ones are shown apart as "not on the site yet"
  const rows: OverviewRow[] = [
    projectsRes.error
      ? errRow("Projects", "/admin/projects", projectsRes.error)
      : projects.length === 0
        ? {
            name: "Projects",
            href: "/admin/projects",
            count: null,
            detail: "Built into the site — import them to edit here",
            state: "builtin",
            action: { href: "/admin/projects", label: "Import" },
          }
        : {
            name: "Projects",
            href: "/admin/projects",
            count: projects.filter((p) => p.published).length,
            detail: `live · ${plural(projects.filter((p) => !p.published).length, "draft")}`,
            state: "live",
            action: { href: "/admin/projects/new", label: "Add" },
          },
    servicesRes.error
      ? errRow("Services", "/admin/services", servicesRes.error)
      : services.length === 0
        ? {
            name: "Services",
            href: "/admin/services",
            count: staticServices.length,
            detail: "built into the site — not editable here yet",
            state: "builtin",
          }
        : {
            name: "Services",
            href: "/admin/services",
            count: services.filter((x) => x.published).length,
            detail: `live · ${services.filter((x) => !x.published).length} hidden`,
            state: "live",
          },
    rosterRes.error
      ? errRow("Roster", "/admin/roster", rosterRes.error)
      : roster.length === 0
        ? {
            name: "Roster",
            href: "/admin/roster",
            count: staticTeam.length,
            detail: "people, built into the site",
            state: "builtin",
          }
        : {
            name: "Roster",
            href: "/admin/roster",
            count: roster.filter((m) => m.published).length,
            detail: `on the About page · ${roster.filter((m) => !m.published).length} hidden`,
            state: "live",
          },
    productsRes.error
      ? errRow("Products", "/admin/products", productsRes.error)
      : products.length === 0
        ? {
            name: "Products",
            href: "/admin/products",
            count: null,
            detail: "The page stays hidden until one is published.",
            state: "empty",
            action: { href: "/admin/products/new", label: "Add the first" },
          }
        : {
            name: "Products",
            href: "/admin/products",
            count: products.filter((x) => x.published).length,
            detail: `live · ${plural(products.filter((x) => !x.published).length, "draft")}`,
            state: "live",
            action: { href: "/admin/products/new", label: "Add" },
          },
    postsRes.error
      ? errRow("Blog", "/admin/blog", postsRes.error)
      : posts.length === 0
        ? {
            name: "Blog",
            href: "/admin/blog",
            count: null,
            detail: "The page stays hidden until a post is published.",
            state: "empty",
            action: { href: "/admin/blog/new", label: "Write the first" },
          }
        : {
            name: "Blog",
            href: "/admin/blog",
            count: posts.filter((x) => x.published).length,
            detail: `published · ${plural(posts.filter((x) => !x.published).length, "draft")}`,
            state: "live",
            action: { href: "/admin/blog/new", label: "Write" },
          },
    jobsRes.error
      ? errRow("Careers", "/admin/careers", jobsRes.error)
      : jobs.length === 0
        ? {
            name: "Careers",
            href: "/admin/careers",
            count: null,
            detail: "The page stays hidden until a role is open.",
            state: "empty",
            action: { href: "/admin/careers/new", label: "Post a role" },
          }
        : {
            name: "Careers",
            href: "/admin/careers",
            count: openJobs,
            detail: `open · ${jobs.filter((j) => !j.published).length} draft · ${jobs.filter((j) => j.published && j.closed).length} closed`,
            state: "live",
            action: { href: "/admin/careers/new", label: "Post" },
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

  const liveProjects = projects.filter((p) => p.published).length;
  const lastEdit = projects[0]?.updated_at as string | undefined;
  const lastAgo = lastEdit ? ago(lastEdit) : null;
  const summary =
    (liveProjects > 0 ? `${plural(liveProjects, "project")} live on the site` : "No projects live yet") +
    (lastAgo ? ` · last edit ${lastAgo === "now" ? "just now" : `${lastAgo} ago`}` : "") +
    ".";

  return (
    <OverviewView
      date={manilaDate()}
      greeting={greeting()}
      firstName={profile?.full_name ? profile.full_name.split(" ")[0] : null}
      waiting={leadsRes.error ? null : openThreads.length}
      summary={summary}
      failedMessage={anyFailed?.error ? describeDbError(anyFailed.error) : null}
      rows={rows}
      replies={
        leadsRes.error
          ? { state: "error" }
          : {
              state: "ok",
              total: threads.length,
              open: openThreads.slice(0, 5).map(({ head }) => ({
                id: head.id,
                href: `/admin/inbox?kind=${head.kind}`,
                who: head.kind === "chat" ? "Website visitor" : head.name || head.email || "(no name)",
                kind: LEAD_KIND_LABEL[head.kind] ?? head.kind,
                message: head.message || "(empty)",
                at: head.created_at,
                ago: ago(head.created_at),
              })),
            }
      }
      edited={
        projectsRes.error
          ? { state: "error" }
          : projects.length === 0
            ? { state: "empty" }
            : {
                state: "ok",
                items: projects.slice(0, 5).map((p) => ({
                  id: String(p.id),
                  name: p.name as string,
                  live: Boolean(p.published),
                  noShot: !p.img,
                  at: p.updated_at as string,
                  ago: ago(p.updated_at as string),
                })),
              }
      }
      activity={
        !activity || !activity.ok
          ? { state: activity && !activity.ok && activity.notSetUp ? "notSetUp" : "error" }
          : activity.items.length === 0
            ? { state: "empty" }
            : { state: "ok", items: activity.items }
      }
      shortcuts={[
        { href: "/admin/settings", label: "Contact details & availability" },
        { href: "/admin/activity", label: "Everything that changed" },
        ...(isOwner
          ? [{ href: "/admin/team", label: teamRes.error ? "Team" : `Team · ${plural(teamRes.count ?? 0, "login")}` }]
          : []),
      ]}
    />
  );
}

/** "Thursday, 5 November" in Manila — the panel runs on studio time. */
function manilaDate() {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Manila",
  }).format(new Date());
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
