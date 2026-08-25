import Link from "next/link";
import ProjectForm from "@/components/admin/ProjectForm";

export const metadata = { title: "New project", robots: { index: false } };

export default function NewProjectPage() {
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
      <ProjectForm />
    </div>
  );
}
