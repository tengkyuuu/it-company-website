"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import type { ActionResult } from "@/app/admin/actions";
import {
  describeDbError,
  isMissingTable,
  isUuid,
  logActivity,
  requireOwner,
} from "@/app/admin/_lib/server";
import {
  adminLinkOrigin,
  emailConfigured,
  sendInviteEmail,
  sendPasswordResetEmail,
  tokenLink,
} from "@/lib/admin-email";
import {
  INVITE_TTL_HOURS,
  RESET_TTL_HOURS,
  dropOpenTokens,
  issueToken,
  ttlLabel,
} from "@/app/admin/auth/_lib/tokens";

/**
 * Team management — the OWNER's alone (admins edit content, not the team):
 * invites (single + bulk), resend / copy link, revoke, disable / enable,
 * "send password reset", remove.
 *
 * The invite flow, end to end:
 *   1. upsert public.invitations (service role) — that row is what lets
 *      handle_new_user() give the account a profile later;
 *   2. mint one of OUR tokens (auth_tokens keeps only its SHA-256) — no auth
 *      user is created yet;
 *   3. mail /admin/auth/confirm?t=<raw> through Resend, or hand the link back
 *      to share by chat when Resend can't deliver (sandbox sender);
 *   4. the invitee opens it, chooses their own password, and only THEN is the
 *      auth user created (app/admin/auth/actions.ts → redeemToken).
 *
 * The owner never chooses or sees anyone's password. Every action is
 * re-authorised here (requireOwner) and again by RLS (is_owner()).
 */

export type InviteOutcome = ActionResult & {
  /** the link, when the owner should (or may) pass it on by hand */
  link?: string;
  /** true when Resend accepted the email */
  emailed?: boolean;
  /** true when nothing was done because they're already on the panel */
  skipped?: boolean;
};

export type BulkRowResult = {
  name: string;
  email: string;
  status: "sent" | "link" | "skipped" | "error";
  message: string;
  link?: string;
};

export type BulkResult = ActionResult & { results: BulkRowResult[] };

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

const NO_SERVICE_KEY =
  "Add SUPABASE_SERVICE_ROLE_KEY to the server environment — Supabase only lets the service role create, invite and remove users.";

type AdminClient = ReturnType<typeof createAdminClient>;
type Me = ProfileRow;
type TeamProfile = Pick<ProfileRow, "id" | "email" | "full_name" | "role"> & {
  disabled?: boolean | null;
};

const actorOf = (me: Me) => ({ id: me.id, name: me.full_name || me.email || "Owner" });
const inviterName = (me: Me) => me.full_name || me.email || "The owner";

function adminClient(): AdminClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** Postgres/PostgREST error → something the owner can act on. */
function dbMessage(error: { code?: string; message: string }) {
  if (isMissingTable(error)) {
    return "A table the team page needs is missing — re-run supabase/schema.sql in the Supabase SQL editor (it’s safe to run again).";
  }
  return describeDbError(error);
}

/** Owner + service role, or the sentence explaining why not. */
async function ownerGate(): Promise<{ me: Me; admin: AdminClient } | { denied: ActionResult }> {
  const gate = await requireOwner();
  if ("denied" in gate) return gate;
  const admin = adminClient();
  if (!admin) return { denied: fail(NO_SERVICE_KEY) };
  return { me: gate.me, admin };
}

async function loadTarget(admin: AdminClient, id: string) {
  if (!isUuid(id)) return null;
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, role, disabled")
    .eq("id", id)
    .maybeSingle<TeamProfile>();
  return data ?? null;
}

const EmailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

// ---------------------------------------------------------------------------
// delivery
// ---------------------------------------------------------------------------

/** Email an invite link (or explain why not) — the invite itself already exists. */
async function deliverInvite(
  ctx: { admin: AdminClient; me: Me },
  args: { email: string; name: string | null; link: string }
): Promise<InviteOutcome> {
  const { email, name, link } = args;

  if (!emailConfigured()) {
    return {
      ok: true,
      emailed: false,
      link,
      message: `Invite ready for ${email}. Email isn’t set up (RESEND_API_KEY), so copy the link and send it to them yourself.`,
    };
  }

  const sent = await sendInviteEmail({
    to: email,
    inviteeName: name,
    inviterName: inviterName(ctx.me),
    link,
    expiresIn: ttlLabel(INVITE_TTL_HOURS),
  });

  if (sent.ok) {
    await ctx.admin
      .from("invitations")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("email", email);
    return { ok: true, emailed: true, link, message: `Invite emailed to ${email}.` };
  }

  return {
    ok: true,
    emailed: false,
    link,
    message: sent.sandbox
      ? `Email couldn’t be sent to ${email}: Resend’s test sender only delivers to your own Resend account until you verify a domain (resend.com/domains). The invite is ready — copy the link and send it to them by chat. (Resend said: ${sent.message})`
      : `Email couldn’t be sent to ${email} (${sent.message}). The invite is ready — copy the link and send it to them yourself.`,
  };
}

// ---------------------------------------------------------------------------
// invite one / many
// ---------------------------------------------------------------------------

type InviteCtx = {
  admin: AdminClient;
  me: Me;
  origin: string;
  profiles: TeamProfile[];
};

async function buildInviteCtx(me: Me, admin: AdminClient): Promise<InviteCtx | ActionResult> {
  const { data, error } = await admin.from("profiles").select("id, email, full_name, role, disabled");
  if (error) return fail(dbMessage(error));
  return {
    admin,
    me,
    origin: await adminLinkOrigin(),
    profiles: (data ?? []) as TeamProfile[],
  };
}

/** The core of an invite (also a re-invite of someone still pending). */
async function inviteOne(
  ctx: InviteCtx,
  input: { email: string; fullName: string | null }
): Promise<InviteOutcome> {
  const email = input.email.trim().toLowerCase();
  const name = input.fullName?.trim() || null;

  if (isOwnerEmail(email)) {
    return { ok: false, skipped: true, message: `${email} is the owner’s address — it can’t be invited.` };
  }
  const onPanel = ctx.profiles.find((p) => p.email?.toLowerCase() === email);
  if (onPanel) {
    return {
      ok: false,
      skipped: true,
      message: `${email} is already on the panel (${onPanel.role}${onPanel.disabled ? ", disabled" : ""}).`,
    };
  }

  const { data: before } = await ctx.admin
    .from("invitations")
    .select("accepted_at")
    .eq("email", email)
    .maybeSingle<{ accepted_at: string | null }>();
  const wasPending = Boolean(before && !before.accepted_at);

  const { error: inviteError } = await ctx.admin.from("invitations").upsert(
    {
      email,
      role: "admin",
      full_name: name,
      invited_by: ctx.me.id,
      created_at: new Date().toISOString(),
      last_sent_at: null,
      accepted_at: null,
    },
    { onConflict: "email" }
  );
  if (inviteError) return fail(dbMessage(inviteError));

  const issued = await issueToken(ctx.admin, { purpose: "invite", email, createdBy: ctx.me.id });
  if (!issued.ok) {
    // a fresh invite with no working link shouldn't linger as "pending"
    if (!before) await ctx.admin.from("invitations").delete().eq("email", email);
    return fail(`Couldn’t create the invite for ${email}: ${dbMessage(issued.error)}`);
  }

  await logActivity({
    actor: actorOf(ctx.me),
    action: wasPending ? "team.invite_resent" : "team.invite",
    entityType: "invitation",
    entityId: email,
    detail: { email, label: name ?? email },
  });

  return deliverInvite(ctx, { email, name, link: tokenLink(ctx.origin, issued.raw) });
}

const InviteSchema = z.object({
  email: EmailSchema,
  full_name: z.string().trim().max(120),
});

export async function inviteMember(formData: FormData): Promise<InviteOutcome> {
  const gate = await ownerGate();
  if ("denied" in gate) return gate.denied;

  const parsed = InviteSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const ctx = await buildInviteCtx(gate.me, gate.admin);
  if (!("admin" in ctx)) return ctx;

  const outcome = await inviteOne(ctx, {
    email: parsed.data.email,
    fullName: parsed.data.full_name || null,
  });
  revalidatePath("/admin/team");
  return outcome;
}

const BulkRowSchema = z.object({
  name: z.string().trim().max(120).catch(""),
  email: z.string().trim().toLowerCase(),
});

const MAX_BULK = 25;

/** The "Invite the Rally's Tech team" card. */
export async function inviteTeam(rows: { name: string; email: string }[]): Promise<BulkResult> {
  const gate = await ownerGate();
  if ("denied" in gate) return { ...gate.denied, results: [] };

  const parsed = z.array(BulkRowSchema).max(MAX_BULK).safeParse(rows);
  if (!parsed.success) {
    return { ...fail(`Send at most ${MAX_BULK} rows at a time.`), results: [] };
  }
  const filled = parsed.data.filter((r) => r.email);
  if (filled.length === 0) {
    return { ...fail("Add an email address to at least one row."), results: [] };
  }

  const ctx = await buildInviteCtx(gate.me, gate.admin);
  if (!("admin" in ctx)) return { ...ctx, results: [] };

  const emailOk = z.string().email();
  const results: BulkRowResult[] = [];
  const seen = new Set<string>();

  // Sequential on purpose: Resend's default limit is a couple of requests per
  // second. (send() retries a 429 once.)
  for (const row of filled) {
    if (!emailOk.safeParse(row.email).success) {
      results.push({ name: row.name, email: row.email, status: "error", message: "Not a valid email address." });
      continue;
    }
    if (seen.has(row.email)) {
      results.push({ name: row.name, email: row.email, status: "skipped", message: "Listed twice — invited once." });
      continue;
    }
    seen.add(row.email);

    const outcome = await inviteOne(ctx, { email: row.email, fullName: row.name || null });
    results.push({
      name: row.name,
      email: row.email,
      status: outcome.skipped
        ? "skipped"
        : !outcome.ok
          ? "error"
          : outcome.emailed
            ? "sent"
            : "link",
      message: outcome.message,
      link: outcome.link,
    });
  }

  revalidatePath("/admin/team");

  const count = (s: BulkRowResult["status"]) => results.filter((r) => r.status === s).length;
  const parts = [
    count("sent") && `${count("sent")} emailed`,
    count("link") && `${count("link")} link${count("link") === 1 ? "" : "s"} to share`,
    count("skipped") && `${count("skipped")} skipped`,
    count("error") && `${count("error")} failed`,
  ].filter(Boolean);

  return { ok: count("error") === 0, message: `${parts.join(" · ")}.`, results };
}

// ---------------------------------------------------------------------------
// pending invites: resend / copy link / revoke (keyed by email — there is no
// account yet)
// ---------------------------------------------------------------------------

async function reissue(formData: FormData, mode: "email" | "copy"): Promise<InviteOutcome> {
  const gate = await ownerGate();
  if ("denied" in gate) return gate.denied;
  const { admin, me } = gate;

  const parsed = EmailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return fail("That invite no longer exists.");
  const email = parsed.data;

  const { data: invite } = await admin
    .from("invitations")
    .select("email, full_name, accepted_at")
    .eq("email", email)
    .maybeSingle<{ email: string; full_name: string | null; accepted_at: string | null }>();
  if (!invite || invite.accepted_at) {
    return fail(`There’s no pending invite for ${email} any more — it was accepted or revoked.`);
  }

  const issued = await issueToken(admin, { purpose: "invite", email, createdBy: me.id });
  if (!issued.ok) return fail(`Couldn’t create a new link: ${dbMessage(issued.error)}`);
  // the previously emailed link just died with the old token
  await admin.from("invitations").update({ last_sent_at: null }).eq("email", email);

  await logActivity({
    actor: actorOf(me),
    action: "team.invite_resent",
    entityType: "invitation",
    entityId: email,
    detail: { email, label: invite.full_name ?? email, via: mode === "copy" ? "link" : "email" },
  });
  revalidatePath("/admin/team");

  const link = tokenLink(await adminLinkOrigin(), issued.raw);
  if (mode === "copy") {
    return {
      ok: true,
      emailed: false,
      link,
      message: `Fresh invite link for ${email} — it replaces any link sent before. Send it to them privately: whoever opens it chooses the password.`,
    };
  }
  return deliverInvite({ admin, me }, { email, name: invite.full_name, link });
}

export async function resendInvite(formData: FormData): Promise<InviteOutcome> {
  return reissue(formData, "email");
}

export async function copyInviteLink(formData: FormData): Promise<InviteOutcome> {
  return reissue(formData, "copy");
}

/** Withdraw a pending invite: the invitation and every open link for it go. */
export async function revokeInvite(formData: FormData): Promise<ActionResult> {
  const gate = await ownerGate();
  if ("denied" in gate) return gate.denied;
  const { admin, me } = gate;

  const parsed = EmailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return fail("That invite no longer exists.");
  const email = parsed.data;

  const { data, error } = await admin
    .from("invitations")
    .delete()
    .eq("email", email)
    .is("accepted_at", null)
    .select("email");
  if (error) return fail(dbMessage(error));
  await dropOpenTokens(admin, { purpose: "invite", email });
  if (!data?.length) return fail(`There’s no pending invite for ${email} any more.`);

  await logActivity({
    actor: actorOf(me),
    action: "team.invite_revoked",
    entityType: "invitation",
    entityId: email,
    detail: { email, label: email },
  });
  revalidatePath("/admin/team");
  return ok(`Invite for ${email} revoked — its link no longer works.`);
}

// ---------------------------------------------------------------------------
// members: disable / enable, password reset, remove
// ---------------------------------------------------------------------------

const REFUSALS = {
  disable: { self: "You can’t disable your own account.", owner: "The owner can’t be disabled." },
  enable: { self: "You can’t change your own access.", owner: "The owner is always enabled." },
  reset: {
    self: "For your own password, use “Forgot password?” on the sign-in page.",
    owner: "The owner resets their password with “Forgot password?” on the sign-in page.",
  },
  remove: { self: "You can’t remove yourself.", owner: "The owner can’t be removed." },
} as const;

/** Shared refusals for acting on an account: it exists, isn't you, isn't the owner. */
function refuse(
  me: Me,
  target: TeamProfile | null,
  verb: keyof typeof REFUSALS
): ActionResult | null {
  if (!target) return fail("That teammate no longer exists.");
  if (target.id === me.id) return fail(REFUSALS[verb].self);
  if (target.role === "owner" || isOwnerEmail(target.email)) return fail(REFUSALS[verb].owner);
  return null;
}

async function setDisabled(formData: FormData, disabled: boolean): Promise<ActionResult> {
  const gate = await ownerGate();
  if ("denied" in gate) return gate.denied;
  const { admin, me } = gate;

  const target = await loadTarget(admin, String(formData.get("id") ?? ""));
  const refused = refuse(me, target, disabled ? "disable" : "enable");
  if (refused || !target) return refused ?? fail("That teammate no longer exists.");
  const label = target.full_name || target.email || "Teammate";

  if (Boolean(target.disabled) === disabled) {
    return ok(`${label} is already ${disabled ? "disabled" : "enabled"}.`);
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ disabled })
    .eq("id", target.id)
    .select("id");
  if (error) return fail(dbMessage(error));
  if (!data?.length) return fail("That teammate no longer exists.");

  let note = "";
  if (disabled) {
    // signed out everywhere, now — not at the next token refresh
    const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user: target.id });
    if (revokeError) {
      console.error("[team] revoke_user_sessions:", revokeError.message);
      note =
        " Their open sessions couldn’t be ended automatically, but the database already refuses a disabled account.";
    }
    // and an outstanding reset link mustn't outlive the switch-off
    await dropOpenTokens(admin, { purpose: "reset", userId: target.id });
  }

  await logActivity({
    actor: actorOf(me),
    action: disabled ? "team.disable" : "team.enable",
    entityType: "team_member",
    entityId: target.id,
    detail: { email: target.email, label },
  });
  revalidatePath("/admin/team");
  return ok(
    disabled
      ? `${label} is disabled and has been signed out everywhere.${note}`
      : `${label} can sign in again.`
  );
}

export async function disableMember(formData: FormData): Promise<ActionResult> {
  return setDisabled(formData, true);
}

export async function enableMember(formData: FormData): Promise<ActionResult> {
  return setDisabled(formData, false);
}

/**
 * Email a member one of our reset links. The owner never picks or sees the
 * password — the member chooses it on /admin/auth/confirm, which also signs
 * them out everywhere else. If Resend can't deliver (sandbox sender), the link
 * comes back to pass on privately, same as an invite.
 */
export async function sendMemberReset(formData: FormData): Promise<InviteOutcome> {
  const gate = await ownerGate();
  if ("denied" in gate) return gate.denied;
  const { admin, me } = gate;

  const target = await loadTarget(admin, String(formData.get("id") ?? ""));
  const refused = refuse(me, target, "reset");
  if (refused || !target) return refused ?? fail("That teammate no longer exists.");
  if (target.disabled) return fail("That account is disabled — enable it first.");

  const { data: found } = await admin.auth.admin.getUserById(target.id);
  const email = found?.user?.email?.toLowerCase();
  if (!email) return fail("That account has no email address to send a reset to.");

  const issued = await issueToken(admin, {
    purpose: "reset",
    email,
    userId: target.id,
    createdBy: me.id,
  });
  if (!issued.ok) return fail(`Couldn’t create a reset link: ${dbMessage(issued.error)}`);
  const link = tokenLink(await adminLinkOrigin(), issued.raw);

  await logActivity({
    actor: actorOf(me),
    action: "team.reset_sent",
    entityType: "team_member",
    entityId: target.id,
    detail: { email, label: target.full_name || email },
  });

  const expiry = ttlLabel(RESET_TTL_HOURS);
  if (!emailConfigured()) {
    return {
      ok: true,
      emailed: false,
      link,
      message: `Reset link ready for ${email} (valid ${expiry}). Email isn’t set up, so send it to them privately — whoever opens it chooses the new password.`,
    };
  }
  const sent = await sendPasswordResetEmail({
    to: email,
    name: target.full_name,
    link,
    expiresIn: expiry,
    requestedBy: inviterName(me),
  });
  if (sent.ok) {
    return { ok: true, emailed: true, link, message: `Password reset link emailed to ${email}.` };
  }
  return {
    ok: true,
    emailed: false,
    link,
    message: sent.sandbox
      ? `Email couldn’t be sent to ${email}: Resend’s test sender only delivers to your own address until a domain is verified. Send them this link privately (valid ${expiry}) — whoever opens it chooses the new password.`
      : `Email couldn’t be sent to ${email} (${sent.message}). Send them this link privately (valid ${expiry}) — whoever opens it chooses the new password.`,
  };
}

/** Remove an account outright: the auth user goes (profile cascades). */
export async function removeMember(formData: FormData): Promise<ActionResult> {
  const gate = await ownerGate();
  if ("denied" in gate) return gate.denied;
  const { admin, me } = gate;

  const target = await loadTarget(admin, String(formData.get("id") ?? ""));
  const refused = refuse(me, target, "remove");
  if (refused || !target) return refused ?? fail("That teammate no longer exists.");
  const label = target.full_name || target.email || "Teammate";

  const { error } = await admin.auth.admin.deleteUser(target.id);
  if (error) return fail(error.message);

  // auth_tokens.user_id cascades; tidy what's keyed by address too, so the
  // person can be invited again from scratch
  const email = target.email?.toLowerCase();
  if (email) {
    await admin.from("invitations").delete().eq("email", email);
    await dropOpenTokens(admin, { purpose: "invite", email });
  }

  await logActivity({
    actor: actorOf(me),
    action: "team.remove",
    entityType: "team_member",
    entityId: target.id,
    detail: { email: email ?? null, label },
  });
  revalidatePath("/admin/team");
  return ok(`${label} was removed from the panel.`);
}
