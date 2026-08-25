import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRow } from "@/lib/supabase/types";
import { Card, Pill } from "@/components/admin/ui";
import ProjectRowActions from "@/components/admin/ProjectRowActions";
import ImportStaticButton from "@/components/admin/ImportStaticButton";

export const metadata = { title: "Projects", robots: { index: false } };

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const projects = (data ?? []) as ProjectRow[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Projects
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            {projects.length
              ? `${projects.length} in the database · ${projects.filter((p) => p.published).length} published`
              : "Nothing here yet."}
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-900"
        >
          New project
        </Link>
      </header>

      {error && (
        <Card>
          <p className="text-sm text-red-600">
            Couldn’t load projects: {error.message}
          </p>
          <p className="mt-2 text-sm text-ink/55">
            If this mentions a missing relation, run{" "}
            <code className="font-mono text-[13px]">supabase/schema.sql</code> in
            the Supabase SQL editor.
          </p>
        </Card>
      )}

      {!error && projects.length === 0 && (
        <Card>
          <p className="text-sm leading-relaxed text-ink/65">
            The public site is currently serving the five projects checked into{" "}
            <code className="font-mono text-[13px]">lib/work.ts</code>. Import
            them to start editing here — or create one from scratch.
          </p>
          <div className="mt-5">
            <ImportStaticButton />
          </div>
        </Card>
      )}

      {projects.length > 0 && (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.id} className="!p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div
                  aria-hidden
                  className="hidden h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-mist/70 sm:block"
                  style={{ background: p.dots?.[2] ?? "#1e293b" }}
                >
                  {p.img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.img}
                      alt=""
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
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slatey">
                    /projects/{p.slug} · {p.category || "no category"}
                  </p>
                </div>

                <ProjectRowActions
                  id={p.id}
                  name={p.name}
                  published={p.published}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
