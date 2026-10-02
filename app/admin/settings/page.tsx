import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type SiteSettingsRow } from "@/lib/supabase/types";
import { Notice } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import SettingsForm from "@/components/admin/SettingsForm";
import { describeDbError, isMissingTable } from "../_lib/server";

export const metadata = { title: "Site settings", robots: { index: false } };

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Site settings
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          Content that appears across the public site — saving updates every page.
          {data?.updated_at && (
            <>
              {" "}
              Last saved{" "}
              {new Date(data.updated_at).toLocaleString("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Manila",
              })}{" "}
              PHT.
            </>
          )}
        </p>
      </header>

      {error ? (
        isMissingTable(error) ? (
          <Notice tone="warn" title="The settings table isn't set up yet">
            Run <code className="font-mono text-[13px]">supabase/schema.sql</code> in the
            Supabase SQL editor — it creates the table and seeds its single row. The site
            uses the built-in values from{" "}
            <code className="font-mono text-[13px]">lib/site.ts</code> until then.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load settings">
            {describeDbError(error)}
          </Notice>
        )
      ) : !data ? (
        <Notice tone="warn" title="The settings row is missing">
          Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> —
          it’s safe to run again and re-seeds the single settings row.
        </Notice>
      ) : (
        <SettingsForm settings={data as SiteSettingsRow} />
      )}
    </div>
  );
}
