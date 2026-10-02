import JobForm from "@/components/admin/JobForm";
import { BackLink } from "@/components/admin/CatalogParts";
import { manilaToday } from "@/lib/cms";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import SetupNotice from "@/components/admin/SetupNotice";

export const metadata = { title: "New role", robots: { index: false } };

export default function NewJobPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <div className="space-y-6">
      <header>
        <BackLink href="/admin/careers">Careers</BackLink>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">New role</h1>
        <p className="mt-1 text-sm text-ink/55">
          Save it as a draft first — it only appears on the careers page once published.
        </p>
      </header>
      <JobForm today={manilaToday()} />
    </div>
  );
}
