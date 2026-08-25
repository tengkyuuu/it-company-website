import Link from "next/link";
import { notFound } from "next/navigation";
import ProjectForm from "@/components/admin/ProjectForm";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRow } from "@/lib/supabase/types";

export const metadata = { title: "Edit project", robots: { index: false } };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
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
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-slatey">
          Last updated {new Date(project.updated_at).toLocaleString()}
        </p>
      </header>
      <ProjectForm project={project} />
    </div>
  );
}
