import Link from "next/link";
import ProjectForm from "@/components/admin/ProjectForm";
import { getServices, getTeam } from "@/lib/cms";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";

export const metadata = { title: "New project", robots: { index: false } };

export default async function NewProjectPage() {
  // the layout shows the setup notice too; this keeps the page from ever
  // building a Supabase client with no URL if it renders alongside it
  if (!isSupabaseConfigured()) return <SetupNotice />;

  // a new project goes to the end of the list rather than jumping to #0; a
  // failed lookup just means it starts at 0, which is harmless
  const supabase = await createClient();
  const [{ data }, services, team] = await Promise.all([
    supabase
      .from("projects")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // chip options — these fall back to the built-in lists, so never empty
    getServices(),
    getTeam(),
  ]);
  const nextOrder = data ? (data.sort_order ?? 0) + 1 : 0;

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
          New project
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          Save it as a draft first — it only appears on the site once published.
        </p>
      </header>
      <ProjectForm
        defaultSortOrder={nextOrder}
        serviceOptions={services.map((s) => s.title)}
        rosterOptions={team.map((m) => m.name)}
      />
    </div>
  );
}
