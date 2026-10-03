import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectForm from "@/components/admin/ProjectForm";
import HistoryPanel from "@/components/admin/HistoryPanel";
import { getServices, getTeam } from "@/lib/cms";
import { Pill } from "@/components/admin/ui";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type ProjectRow } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";
import { describeDbError, isUuid } from "../../_lib/server";

export const metadata = { title: "Edit project", robots: { index: false } };

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const [{ id }, { created }] = await Promise.all([params, searchParams]);

  // a malformed id is a 404, not a Postgres "invalid input syntax for uuid"
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data, error }, services, team] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    // chip options — these fall back to the built-in lists, so never empty
    getServices(),
    getTeam(),
  ]);

  // a database failure is NOT "not found" — let the error boundary offer a retry
  if (error) throw new Error(describeDbError(error));
  if (!data) notFound();

  const project = data as ProjectRow;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/projects"
          className="font-mono text-[11px] uppercase tracking-widest text-slatey transition-colors hover:text-ink"
        >
          ← Projects
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <Pill tone={project.published ? "live" : "draft"}>
            {project.published ? "Published" : "Draft"}
          </Pill>
        </div>
        <p className="mt-1 font-mono text-[11px] text-slatey">
          Last updated{" "}
          {new Date(project.updated_at).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          })}{" "}
          PHT
        </p>
      </header>
      {/* keyed by id so moving between projects never carries one's edits into the next */}
      <ProjectForm
        key={project.id}
        project={project}
        justCreated={created === "1"}
        serviceOptions={services.map((s) => s.title)}
        rosterOptions={team.map((m) => m.name)}
      />
      <HistoryPanel entityType="projects" entityId={project.id} noun="project" />
    </div>
  );
}
