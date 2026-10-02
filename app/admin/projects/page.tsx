import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type ProjectRow } from "@/lib/supabase/types";
import { projects as staticProjects } from "@/lib/work";
import { Card, Notice, Pill } from "@/components/admin/ui";
import ProjectRowActions from "@/components/admin/ProjectRowActions";
import ImportStaticButton from "@/components/admin/ImportStaticButton";
import { describeDbError, isMissingTable } from "../_lib/server";
import SetupNotice from "@/components/admin/SetupNotice";

export const metadata = { title: "Projects", robots: { index: false } };

export default async function AdminProjectsPage() {
  // the layout shows the setup notice too; this keeps the page from ever
  // building a Supabase client with no URL if it renders alongside it
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const projects = (data ?? []) as ProjectRow[];
  const published = projects.filter((p) => p.published).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Projects
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            {projects.length
              ? `${projects.length} in the database · ${published} published · ${projects.length - published} draft${projects.length - published === 1 ? "" : "s"}`
              : "Nothing here yet."}
          </p>
        </div>
        {!error && (
          <Link
            href="/admin/projects/new"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            New project
          </Link>
        )}
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The projects table isn't set up yet">
            Run <code className="font-mono text-[13px]">supabase/schema.sql</code> in
            the Supabase SQL editor, then reload. Until then the public site keeps
            serving the projects in <code className="font-mono text-[13px]">lib/work.ts</code>.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load projects">
            {describeDbError(error)} The public site is unaffected — it falls back to
            the static projects.
          </Notice>
        ))}

      {!error && projects.length === 0 && (
        <Card>
          <p className="text-sm leading-relaxed text-ink/65">
            The public site is currently serving the {staticProjects.length} projects
            checked into <code className="font-mono text-[13px]">lib/work.ts</code>.
            Import them to start editing here — or create one from scratch.
          </p>
          <div className="mt-5">
            <ImportStaticButton count={staticProjects.length} />
          </div>
        </Card>
      )}

      {!error && projects.length > 0 && published === 0 && (
        <Notice tone="warn" title="Nothing is published">
          With no published projects the public site falls back to the built-in
          portfolio, so your edits here won’t show until at least one is published.
        </Notice>
      )}

      {projects.length > 0 && (
        <ol className="space-y-3">
          {projects.map((p, i) => (
            <li key={p.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div
                    aria-hidden
                    className="hidden h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-mist/70 bg-ink/10 sm:block"
                    // the project's own deep color, like its plate on the landing page
                    style={p.dots?.[2] ? { background: p.dots[2] } : undefined}
                  >
                    {p.img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.img}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover object-top"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="truncate font-medium transition-colors hover:text-accent"
                      >
                        {p.name}
                      </Link>
                      <Pill tone={p.published ? "live" : "draft"}>
                        {p.published ? "Published" : "Draft"}
                      </Pill>
                      {p.live_url && <Pill>Live embed</Pill>}
                      {!p.img && <Pill tone="draft">No screenshot</Pill>}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slatey">
                      /projects/{p.slug} · {p.category || "no category"}
                    </p>
                  </div>

                  <ProjectRowActions
                    id={p.id}
                    name={p.name}
                    slug={p.slug}
                    published={p.published}
                    isFirst={i === 0}
                    isLast={i === projects.length - 1}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

    </div>
  );
}
