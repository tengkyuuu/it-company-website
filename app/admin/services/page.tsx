import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type ServiceRow } from "@/lib/supabase/types";
import { services as staticServices } from "@/lib/services";
import { Card, CardTitle, Notice, Pill } from "@/components/admin/ui";
import ServiceForm from "@/components/admin/ServiceForm";
import ImportButton from "@/components/admin/ImportButton";
import { describeDbError, isMissingTable } from "../_lib/server";
import SetupNotice from "@/components/admin/SetupNotice";

export const metadata = { title: "Services", robots: { index: false } };

/**
 * Services were the biggest hole in the panel: the six offerings render on the
 * landing page, on /services and in the footer, but lived only in
 * lib/services.ts and so couldn't be changed without a deploy.
 *
 * An empty table is NOT an error — lib/cms.ts treats it as "not set up yet" and
 * serves the static list, so the public site looks identical until someone
 * imports. That's why the empty state offers the import rather than warning.
 * (The layout already shows the setup notice when Supabase isn't configured.)
 */
export default async function AdminServicesPage() {
  // the layout shows the setup notice too; this keeps the page from ever
  // building a Supabase client with no URL if it renders alongside it
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as ServiceRow[];
  const live = rows.filter((s) => s.published).length;
  const nextOrder = rows.reduce((m, s) => Math.max(m, s.sort_order + 1), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Services
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            Shown on the landing page, /services and in the footer of every page.
            {rows.length > 0 && ` ${live} live · ${rows.length - live} hidden.`}
          </p>
        </div>
        {rows.length > 0 && <ServiceForm mode="create" nextOrder={nextOrder} />}
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The services table isn't set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> —
            the services table was added after the first version of it. Until then the
            site serves the built-in list from{" "}
            <code className="font-mono text-[13px]">lib/services.ts</code>.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load services">
            {describeDbError(error)}
          </Notice>
        ))}

      {!error && rows.length === 0 && (
        <Card>
          <CardTitle>Nothing here yet</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            The site is currently serving the {staticServices.length} built-in services
            from <code className="font-mono text-[13px]">lib/services.ts</code>. Import
            them to start editing — the public pages won’t change until you do.
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <ImportButton kind="services" count={staticServices.length} />
            <ServiceForm mode="create" />
          </div>
        </Card>
      )}

      {!error && rows.length > 0 && live === 0 && (
        <Notice tone="warn" title="Every service is hidden">
          With nothing live, the site falls back to the built-in list — so hiding
          them all doesn’t empty the Services section, it just stops your edits
          showing.
        </Notice>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold tracking-tight">
                        {s.title}
                      </h2>
                      <Pill tone={s.published ? "live" : "draft"}>
                        {s.published ? "Live" : "Hidden"}
                      </Pill>
                      <span className="font-mono text-[11px] text-ink/40">
                        {s.slug} · {s.icon} · #{s.sort_order}
                      </span>
                    </div>
                    {s.blurb && (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                        {s.blurb}
                      </p>
                    )}
                    {s.deliverables?.length > 0 && (
                      <p className="mt-2 text-xs text-ink/45">
                        {s.deliverables.join(" · ")}
                      </p>
                    )}
                  </div>
                  <ServiceForm mode="edit" service={s} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
