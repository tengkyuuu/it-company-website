import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Card, Pill } from "@/components/admin/ui";

export const metadata = { title: "Overview", robots: { index: false } };

export default async function AdminHome() {
  const profile = await getProfile();
  const supabase = await createClient();

  const [projectsRes, teamRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug, published, live_url, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const projects = projectsRes.data ?? [];
  const published = projects.filter((p) => p.published).length;
  const withLive = projects.filter((p) => p.live_url).length;

  const stats = [
    { label: "Projects", value: projects.length, href: "/admin/projects" },
    { label: "Published", value: published, href: "/admin/projects" },
    { label: "Live embeds", value: withLive, href: "/admin/projects" },
    { label: "Team", value: teamRes.count ?? 0, href: "/admin/team" },
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="!p-5 transition-colors hover:border-mist">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slatey">
                {s.label}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                {s.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {projectsRes.error && (
        <Card>
          <p className="text-sm text-red-600">
            Couldn’t reach the database: {projectsRes.error.message}
          </p>
          <p className="mt-2 text-sm text-ink/55">
            The public site is unaffected — it falls back to the static content in{" "}
            <code className="font-mono text-[13px]">lib/work.ts</code>. Running{" "}
            <code className="font-mono text-[13px]">supabase/schema.sql</code>{" "}
            usually fixes this.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
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
          {projects.length === 0 ? (
            <p className="text-sm text-ink/55">
              No projects yet.{" "}
              <Link href="/admin/projects" className="text-accent">
                Import the existing five
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
                  <Pill tone={p.published ? "live" : "draft"}>
                    {p.published ? "Live" : "Draft"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
            Quick actions
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {[
              { href: "/admin/projects/new", label: "Add a project" },
              { href: "/admin/team", label: "Invite a teammate" },
              { href: "/admin/settings", label: "Edit site content" },
              { href: "/projects", label: "View the site ↗" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
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
