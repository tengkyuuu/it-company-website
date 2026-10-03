import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type TeamMemberRow } from "@/lib/supabase/types";
import { team as staticTeam } from "@/lib/team";
import { Card, CardTitle, Notice, Pill } from "@/components/admin/ui";
import MemberForm from "@/components/admin/MemberForm";
import ImportButton from "@/components/admin/ImportButton";
import { describeDbError, isMissingTable } from "../_lib/server";
import SetupNotice from "@/components/admin/SetupNotice";
import HistoryPanel from "@/components/admin/HistoryPanel";
import RecentlyDeleted from "@/components/admin/RecentlyDeleted";
import { loadRecentlyDeleted } from "../_lib/history";

export const metadata = { title: "Public roster", robots: { index: false } };

/**
 * The roster shown on /about — deliberately NOT /admin/team.
 *
 * /admin/team manages who can log into this panel. This page manages who the
 * website says the studio is. Conflating them would mean either handing out a
 * password to appear on the site, or leaking a login into the marketing page.
 */
export default async function AdminRosterPage() {
  // the layout shows the setup notice too; this keeps the page from ever
  // building a Supabase client with no URL if it renders alongside it
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const [{ data, error }, deleted] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    loadRecentlyDeleted("team_members"),
  ]);

  const rows = (data ?? []) as TeamMemberRow[];
  const live = rows.filter((m) => m.published).length;
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.sort_order + 1), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Public roster
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            The team shown on /about. Separate from panel logins under{" "}
            <span className="font-mono text-[13px]">Team</span>.
            {rows.length > 0 && ` ${live} shown · ${rows.length - live} hidden.`}
          </p>
        </div>
        {rows.length > 0 && <MemberForm mode="create" nextOrder={nextOrder} />}
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The roster table isn't set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code>.
            Until then /about serves the built-in roster from{" "}
            <code className="font-mono text-[13px]">lib/team.ts</code>.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load the roster">
            {describeDbError(error)}
          </Notice>
        ))}

      {!error && rows.length === 0 && (
        <Card>
          <CardTitle>Nothing here yet</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            /about is currently serving the built-in roster of {staticTeam.length} from{" "}
            <code className="font-mono text-[13px]">lib/team.ts</code>. Import it to
            start editing — the page won’t change until you do.
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <ImportButton kind="team" count={staticTeam.length} />
            <MemberForm mode="create" />
          </div>
        </Card>
      )}

      {!error && rows.length > 0 && live === 0 && (
        <Notice tone="warn" title="Everyone is hidden">
          With nobody shown, /about falls back to the built-in roster — your edits
          won’t appear until at least one person is visible.
        </Notice>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold tracking-tight">
                        {m.name}
                      </h2>
                      <Pill tone={m.published ? "live" : "draft"}>
                        {m.published ? "Live" : "Hidden"}
                      </Pill>
                      <span className="font-mono text-[11px] text-ink/40">
                        {m.initials || "auto"} · #{m.sort_order}
                      </span>
                    </div>
                    {m.role && (
                      <p className="mt-1.5 text-sm text-ink/60">{m.role}</p>
                    )}
                  </div>
                  <MemberForm mode="edit" member={m} />
                </div>
                <div className="mt-4 border-t border-mist/70 pt-4">
                  <HistoryPanel entityType="team_members" entityId={m.id} noun="roster entry" variant="inline" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!error && <RecentlyDeleted items={deleted} noun="roster entry" />}
    </div>
  );
}
