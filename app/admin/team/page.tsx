import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient, getProfile, ownerEmail } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvitationRow, ProfileRow } from "@/lib/supabase/types";
import { getTeam } from "@/lib/cms";
import { emailConfigured, usingSandboxSender } from "@/lib/admin-email";
import { Card } from "@/components/admin/ui";
import { InviteForm, TeamList, type TeamRowView } from "@/components/admin/TeamManager";
import TeamBulkInvite from "@/components/admin/TeamBulkInvite";
import type { RosterRow } from "@/components/admin/TeamBulkInvite";
import { isMissingTable } from "../_lib/server";

export const metadata = { title: "Team", robots: { index: false } };

// A bulk invite sends mail one at a time; give the server action (which runs
// under this route's config) room to finish.
export const maxDuration = 60;

const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Manila",
});
const fmt = (iso: string | null | undefined) => (iso ? date.format(new Date(iso)) : "");

type TeamProfile = ProfileRow & { disabled?: boolean | null };
type Person = { full_name: string | null; email: string | null };

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Loose "is this roster person that panel account / invite?" — the public
 * roster uses full names ("Jhade Japhet Banquiao"), accounts often don't
 * ("Jhade Banquiao", or no name at all and jhadebanquiao@…). First + last name
 * agree, or the email's local part contains both.
 */
function samePerson(rosterName: string, p: Person) {
  const r = tokens(rosterName);
  if (!r.length) return false;
  const first = r[0];
  const last = r[r.length - 1];
  const n = tokens(p.full_name ?? "");
  if (n.length && n[0] === first && n[n.length - 1] === last) return true;
  const local = (p.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
  return local.length > 0 && local.includes(first) && local.includes(last);
}

/** Profiles through the viewer's own client — RLS (is_staff) decides. */
async function loadProfiles(supabase: SupabaseClient) {
  const full = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, disabled")
    .order("created_at", { ascending: true });
  if (!full.error) return { profiles: (full.data ?? []) as TeamProfile[], error: null, outdated: false };
  if (full.error.code === "42703") {
    // schema predates `disabled`: show the team, flag the re-run
    const legacy = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true });
    return {
      profiles: (legacy.data ?? []) as TeamProfile[],
      error: legacy.error,
      outdated: true,
    };
  }
  return { profiles: [] as TeamProfile[], error: full.error, outdated: false };
}

export default async function TeamPage() {
  const profile = await getProfile();
  const isOwner = profile?.role === "owner";

  const supabase = await createClient();
  const { profiles, error, outdated } = await loadProfiles(supabase);

  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasEmail = emailConfigured();
  let admin: ReturnType<typeof createAdminClient> | null = null;
  if (isOwner && hasServiceKey) {
    try {
      admin = createAdminClient();
    } catch {
      admin = null;
    }
  }

  // Owner-only extras: last sign-in (service role), pending invitations and
  // whether each still has a live link.
  let users: Map<string, User> | null = null;
  let invitations: InvitationRow[] = [];
  const liveLink = new Map<string, string>(); // email -> expires_at
  let schemaMissing = outdated;

  if (isOwner) {
    if (admin) {
      try {
        const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
        // on error leave it null ("unknown"), not empty — empty would read as
        // "nobody has ever signed in"
        if (!listError) users = new Map(list.users.map((u) => [u.id, u]));
      } catch {
        users = null;
      }
    }

    const inv = await (admin ?? supabase)
      .from("invitations")
      .select("*")
      .is("accepted_at", null)
      .order("created_at", { ascending: true });
    if (inv.error) schemaMissing = schemaMissing || isMissingTable(inv.error);
    else invitations = (inv.data ?? []) as InvitationRow[];

    if (admin) {
      const tok = await admin
        .from("auth_tokens")
        .select("email, expires_at")
        .eq("purpose", "invite")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString());
      if (tok.error) schemaMissing = schemaMissing || isMissingTable(tok.error);
      else for (const t of tok.data ?? []) liveLink.set(t.email, t.expires_at);
    }
  }

  const memberRows: TeamRowView[] = profiles.map((p) => {
    const lastIn = users?.get(p.id)?.last_sign_in_at ?? null;
    let detail: string;
    if (p.disabled) detail = `Disabled${lastIn ? ` · last signed in ${fmt(lastIn)}` : ""}`;
    else if (lastIn) detail = `Last signed in ${fmt(lastIn)}`;
    else if (users) detail = "Never signed in";
    else detail = `Joined ${fmt(p.created_at)}`;
    return {
      key: p.id,
      kind: "member",
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role === "owner" ? "owner" : "admin",
      status: p.disabled ? "disabled" : "active",
      detail,
    };
  });

  const onPanel = new Set(profiles.map((p) => p.email?.toLowerCase()).filter(Boolean));
  const pendingInvites = invitations.filter((i) => !onPanel.has(i.email));
  const inviteRows: TeamRowView[] = pendingInvites.map((i) => {
    const parts = [`Invited ${fmt(i.created_at)}`];
    if (!liveLink.has(i.email)) parts.push(admin ? "link expired — resend" : "link status unknown");
    else if (i.last_sent_at) parts.push(`emailed ${fmt(i.last_sent_at)}`);
    else parts.push("link not emailed");
    return {
      key: `invite:${i.email}`,
      kind: "invite",
      id: null,
      email: i.email,
      full_name: i.full_name,
      role: "admin",
      status: "pending",
      detail: parts.join(" · "),
    };
  });

  const rows = [...memberRows, ...inviteRows];

  const roster: RosterRow[] = isOwner
    ? (await getTeam()).map((t) => {
        const member = profiles.find((p) => samePerson(t.name, p));
        if (member) {
          return {
            name: t.name,
            onPanel: `${member.role} · ${member.disabled ? "disabled" : "active"}`,
          };
        }
        const invite = pendingInvites.find((i) => samePerson(t.name, i));
        return { name: t.name, onPanel: invite ? "admin · invited" : null };
      })
    : [];

  const owner = ownerEmail();
  const setupNeeded =
    !hasServiceKey || schemaMissing || !hasEmail || usingSandboxSender() || !owner;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-ink/55">
          Who can sign in and manage the site. Accounts are invite-only.
        </p>
      </header>

      {error && (
        <Card>
          <p className="text-sm text-red-600">Couldn’t load the team: {error.message}</p>
        </Card>
      )}

      {isOwner && setupNeeded && (
        <Card>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-slatey">
            Setup
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-ink/70">
            {schemaMissing && (
              <li>
                <strong className="font-medium text-ink">Re-run the database schema.</strong>{" "}
                Paste <code className="font-mono text-[13px]">supabase/schema.sql</code> into the
                Supabase SQL editor again — it’s safe to re-run, and it adds the tables invites,
                password resets and disabling accounts depend on.
              </li>
            )}
            {!owner && (
              <li>
                <strong className="font-medium text-ink">Anchor the owner account.</strong> Set{" "}
                <code className="font-mono text-[13px]">OWNER_EMAIL</code> on the server to your
                sign-in address. That account is then always the owner, even if its row in the
                database is deleted or changed.
              </li>
            )}
            {!hasServiceKey && (
              <li>
                <strong className="font-medium text-ink">Team management is off.</strong> Add{" "}
                <code className="font-mono text-[13px]">SUPABASE_SERVICE_ROLE_KEY</code> to the
                server environment (Supabase → Project Settings → API). Inviting, disabling and
                removing teammates needs it. Keep it server-side only.
              </li>
            )}
            {hasServiceKey && !hasEmail && (
              <li>
                <strong className="font-medium text-ink">Emails are off.</strong> Invites still
                work — you’ll get a link to copy and send by chat. Add{" "}
                <code className="font-mono text-[13px]">RESEND_API_KEY</code> to email them
                automatically.
              </li>
            )}
            {hasServiceKey && hasEmail && usingSandboxSender() && (
              <li>
                <strong className="font-medium text-ink">Sending from Resend’s test address.</strong>{" "}
                Until a domain is verified at resend.com/domains, Resend only delivers to your own
                Resend account’s email. Invites and reset links to anyone else come back as a link
                to copy and send by chat — set{" "}
                <code className="font-mono text-[13px]">ADMIN_FROM_EMAIL</code> once the domain is
                verified.
              </li>
            )}
          </ul>
        </Card>
      )}

      {isOwner && hasServiceKey && !schemaMissing && (
        <>
          <InviteForm />
          {roster.length > 0 && <TeamBulkInvite roster={roster} />}
        </>
      )}

      {!isOwner && (
        <Card>
          <p className="text-sm text-ink/65">
            Only the owner can invite, disable or remove teammates — you can edit all of the
            site’s content.
          </p>
        </Card>
      )}

      {rows.length > 0 && profile && (
        <TeamList rows={rows} me={profile.id} canManage={isOwner} hasServiceKey={hasServiceKey} />
      )}
    </div>
  );
}
