import { createClient } from "@/lib/supabase/server";
import type { SiteSettingsRow } from "@/lib/supabase/types";
import { Card } from "@/components/admin/ui";
import SettingsForm from "@/components/admin/SettingsForm";

export const metadata = { title: "Site settings", robots: { index: false } };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Site settings
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          Content that appears across the public site.
        </p>
      </header>

      {error || !data ? (
        <Card>
          <p className="text-sm text-red-600">
            Couldn’t load settings{error ? `: ${error.message}` : "."}
          </p>
          <p className="mt-2 text-sm text-ink/55">
            Run <code className="font-mono text-[13px]">supabase/schema.sql</code>{" "}
            — it seeds the single settings row.
          </p>
        </Card>
      ) : (
        <SettingsForm settings={data as SiteSettingsRow} />
      )}
    </div>
  );
}
