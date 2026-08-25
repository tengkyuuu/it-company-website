import { createClient, getProfile } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import { Card } from "@/components/admin/ui";
import { InviteForm, TeamList } from "@/components/admin/TeamManager";

export const metadata = { title: "Team", robots: { index: false } };

export default async function TeamPage() {
  const profile = await getProfile();
  const canManage = profile?.role === "owner" || profile?.role === "admin";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });

  const members = (data ?? []) as ProfileRow[];
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-ink/55">
          Who can sign in and manage the site.
        </p>
      </header>

      {error && (
        <Card>
          <p className="text-sm text-red-600">Couldn’t load the team: {error.message}</p>
        </Card>
      )}

      {canManage && !hasServiceKey && (
        <Card>
          <p className="text-sm leading-relaxed text-ink/70">
            Add{" "}
            <code className="font-mono text-[13px]">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            to your environment to send invites — Supabase requires it for
            creating and removing users. Find it under Project Settings → API;
            keep it server-side only.
          </p>
        </Card>
      )}

      {canManage && hasServiceKey && <InviteForm />}

      {!canManage && (
        <Card>
          <p className="text-sm text-ink/65">
            Only owners and admins can invite or remove teammates.
          </p>
        </Card>
      )}

      {members.length > 0 && profile && (
        <TeamList members={members} me={profile.id} canManage={Boolean(canManage)} />
      )}
    </div>
  );
}
