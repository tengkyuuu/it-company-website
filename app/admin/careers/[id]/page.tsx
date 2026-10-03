import Link from "next/link";
import { notFound } from "next/navigation";
import JobForm from "@/components/admin/JobForm";
import HistoryPanel from "@/components/admin/HistoryPanel";
import { BackLink, UpdatedAt } from "@/components/admin/CatalogParts";
import { Pill } from "@/components/admin/ui";
import { isJobClosed, manilaToday } from "@/lib/cms";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type JobRow } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";
import { describeDbError, isUuid } from "../../_lib/server";

export const metadata = { title: "Edit role", robots: { index: false } };

export default async function EditJobPage({
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
  const [{ data, error }, applications] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    // best-effort: a missing column / table just hides the count
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("kind", "application")
      .eq("job_id", id),
  ]);

  // a database failure is NOT "not found" — let the error boundary offer a retry
  if (error) throw new Error(describeDbError(error));
  if (!data) notFound();

  const job = data as JobRow;
  const today = manilaToday();
  const closed = isJobClosed(job.closes_at, today);
  const applied = applications.error ? null : (applications.count ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/admin/careers">Careers</BackLink>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{job.title}</h1>
          {!job.published ? (
            <Pill tone="draft">Draft</Pill>
          ) : closed ? (
            <Pill>Closed</Pill>
          ) : (
            <Pill tone="live">Published</Pill>
          )}
          {applied !== null && applied > 0 && (
            <Link
              href={`/admin/inbox?kind=application&status=all&job=${job.id}`}
              className="text-sm text-ink/55 underline decoration-mist underline-offset-2 transition-colors hover:text-ink hover:decoration-ink"
            >
              {applied} application{applied === 1 ? "" : "s"} →
            </Link>
          )}
        </div>
        <UpdatedAt iso={job.updated_at} />
      </header>
      {/* keyed by id so moving between roles never carries one's edits into the next */}
      <JobForm key={job.id} job={job} today={today} justCreated={created === "1"} />
      <HistoryPanel entityType="jobs" entityId={job.id} noun="role" />
    </div>
  );
}
