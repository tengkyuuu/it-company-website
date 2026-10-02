"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { isOwnerEmail, ownerEmail } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, consumeLimit, hashIp, hashKey } from "@/lib/security";
import type { ActionResult } from "@/app/admin/actions";
import { logActivity, zodFail } from "@/app/admin/_lib/server";
import {
  emailConfigured,
  sendPasswordResetEmail,
  tokenLink,
  trustedLinkOrigin,
} from "@/lib/admin-email";
import {
  RESET_TTL_HOURS,
  alreadyRegistered,
  consumeToken,
  dropOpenTokens,
  findAuthUserByEmail,
  hasServiceKey,
  issueToken,
  passwordMessage,
  passwordProblem,
  peekToken,
  releaseToken,
  ttlLabel,
  type TokenRow,
} from "./_lib/tokens";

/**
 * The panel's unauthenticated auth actions:
 *   requestPasswordReset — "Forgot password?" on /admin/login
 *   redeemToken          — the form on /admin/auth/confirm (invite or reset)
 *   createOwnerAccount   — first-run owner bootstrap, OWNER_EMAIL only
 *
 * None of them trusts the client for anything that matters: a token's purpose,
 * email and account come from the auth_tokens row, never from the form.
 *
 * ⚠ None of them sets cookies or calls revalidatePath. Either makes Next
 * re-render the current route inside the action's response — and a re-render
 * of /admin/auth/confirm after the token is spent is the "link already used"
 * screen, which unmounted the success state before it could navigate. So on
 * success they return `signInAs` and the CLIENT signs in with the browser
 * client (the same path as the normal sign-in form), then navigates.
 */

export type AuthResult = ActionResult & {
  /** on success: the account's email, for the client's signInWithPassword */
  signInAs?: string;
};

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({
  ok: false,
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

const TOO_MANY = "Too many attempts — wait a few minutes and try again.";
const DEAD_LINK =
  "This link has expired or was already used. Ask the owner for a fresh one — or, if you’ve set a password before, use “Forgot password?” on the sign-in page.";

/** escape LIKE wildcards — "_" is common in email addresses */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function ipKey(scope: string) {
  const ip = clientIp(await headers());
  return hashKey(scope, "ip", hashIp(ip) ?? "unknown");
}

const Password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters");

// ---------------------------------------------------------------------------
// forgot password
// ---------------------------------------------------------------------------

/**
 * "Forgot password?" — mails one of OUR reset links through Resend.
 *
 * Always answers the same way whether or not the address has an account, and
 * does the real work in after(), once the response has gone — so neither the
 * message nor the response time tells a stranger who is on the team.
 *
 * Rate limits are durable (public.consume_security_limit) and FAIL CLOSED: per
 * IP and per address, so the form can't be used to flood a teammate's inbox,
 * and a database blip doesn't open an unmetered window.
 *
 * The link's origin is allow-listed (trustedLinkOrigin), never taken from the
 * Host header as-is: a spoofed Host would otherwise mail a teammate a reset
 * link pointing at an attacker's server ("password-reset poisoning").
 */
export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return fail("Enter a valid email address.");
  const email = parsed.data;

  // before the limiter: it fails closed without the service key, which would
  // otherwise read as "too many requests"
  if (!hasServiceKey() || !emailConfigured()) {
    return fail(
      "Password reset emails aren’t set up on this site yet — ask the owner for help."
    );
  }

  const [byIp, byEmail] = await Promise.all([
    ipKey("reset").then((k) => consumeLimit(k, 8, 15 * 60, { failClosed: true })),
    consumeLimit(hashKey("reset", "email", email), 3, 15 * 60, { failClosed: true }),
  ]);
  if (!byIp || !byEmail) {
    return fail("Too many reset requests — wait a few minutes and try again.");
  }

  const origin = await trustedLinkOrigin();

  after(async () => {
    try {
      const admin = createAdminClient();
      let userId: string | null = null;
      let name: string | null = null;

      // Only panel members get mail: a stray auth user has nothing to reset into.
      const { data: rows } = await admin
        .from("profiles")
        .select("id, email, full_name, disabled")
        .ilike("email", likeLiteral(email))
        .limit(5);
      const member = rows?.find((r) => r.email?.toLowerCase() === email);
      if (member && (!member.disabled || isOwnerEmail(email))) {
        userId = member.id;
        name = member.full_name;
      } else if (!member && isOwnerEmail(email)) {
        // the owner anchor: even with the profile row gone, the owner can reset
        userId = (await findAuthUserByEmail(admin, email))?.id ?? null;
      }
      if (!userId) return;

      const issued = await issueToken(admin, { purpose: "reset", email, userId });
      if (!issued.ok) {
        console.error("[password-reset] couldn't create a token:", issued.error.message);
        return;
      }
      const sent = await sendPasswordResetEmail({
        to: email,
        name,
        link: tokenLink(origin, issued.raw),
        expiresIn: ttlLabel(RESET_TTL_HOURS),
      });
      if (!sent.ok) console.error("[password-reset] email failed:", sent.message);
    } catch (e) {
      console.error("[password-reset]", e);
    }
  });

  return ok(
    "If an account exists for that email, a reset link is on its way. Check your inbox (and spam)."
  );
}

// ---------------------------------------------------------------------------
// redeem an invite or reset link
// ---------------------------------------------------------------------------

const RedeemSchema = z
  .object({
    t: z.string().min(1),
    full_name: z.string().trim().max(120),
    password: Password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "The two passwords don’t match",
    path: ["confirm"],
  });

/**
 * The POST behind /admin/auth/confirm. Order matters:
 *   1. validate the form and rate-limit (per IP, fail closed) — BEFORE the
 *      token is touched, so a typo never burns a link;
 *   2. peek, run the purpose-specific checks that don't need the token spent;
 *   3. consume atomically (the one statement that decides a race);
 *   4. create / update the account; if Supabase rejects the password, release
 *      the token so the same link can be retried;
 *   5. return signInAs; the client signs in and navigates into /admin.
 */
export async function redeemToken(formData: FormData): Promise<AuthResult> {
  const parsed = RedeemSchema.safeParse({
    t: String(formData.get("t") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const { t, password } = parsed.data;

  if (!hasServiceKey()) {
    return fail("Account links aren’t set up on this site yet — ask the owner for help.");
  }
  if (!(await consumeLimit(await ipKey("redeem"), 10, 15 * 60, { failClosed: true }))) {
    return fail(TOO_MANY);
  }

  const admin = createAdminClient();
  const peek = await peekToken(admin, t);
  if (peek.error) return fail("Couldn’t check this link just now — try again in a minute.");
  if (!peek.row) return fail(DEAD_LINK);

  if (peek.row.purpose === "invite") {
    const name = parsed.data.full_name;
    if (!name) return fail("Enter your name", { full_name: "Enter your name" });
    return redeemInvite(admin, t, peek.row, name, password);
  }
  return redeemReset(admin, t, peek.row, password);
}

type Admin = ReturnType<typeof createAdminClient>;

async function openInvitation(admin: Admin, email: string) {
  const { data } = await admin
    .from("invitations")
    .select("email, full_name, accepted_at")
    .eq("email", email)
    .maybeSingle<{ email: string; full_name: string | null; accepted_at: string | null }>();
  return data && !data.accepted_at ? data : null;
}

const WITHDRAWN = "This invite was withdrawn. Ask the owner to invite you again.";

async function redeemInvite(
  admin: Admin,
  raw: string,
  peeked: TokenRow,
  name: string,
  password: string
): Promise<AuthResult> {
  // checks that don't need the token spent
  const email = peeked.email;
  if (isOwnerEmail(email)) return fail("That address belongs to the owner and can’t be invited.");
  if (!(await openInvitation(admin, email))) return fail(WITHDRAWN);

  const { row } = await consumeToken(admin, raw);
  if (!row) return fail(DEAD_LINK);

  const create = () =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

  let created = await create();

  if (created.error && alreadyRegistered(created.error)) {
    // An account already holds this address, and it wasn't made by this link.
    // Adopting it would be unsafe — whoever created it may know its password —
    // so unless it's a real member who has signed in before, clear it and
    // start an account only this invitee can claim.
    let existing: User | null = null;
    try {
      existing = await findAuthUserByEmail(admin, email);
    } catch {
      existing = null;
    }
    if (existing) {
      const { data: prof } = await admin
        .from("profiles")
        .select("role")
        .eq("id", existing.id)
        .maybeSingle<{ role: string }>();
      if (prof?.role === "owner") {
        return fail("That address belongs to the owner and can’t be invited.");
      }
      if (prof && existing.last_sign_in_at) {
        await admin
          .from("invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("email", email);
        return fail(
          "You already have an account on the panel — sign in, or use “Forgot password?” on the sign-in page."
        );
      }
      const { error: delError } = await admin.auth.admin.deleteUser(existing.id);
      if (delError) {
        await releaseToken(admin, row.id);
        return fail(`Couldn’t set up your account (${delError.message}). Try again in a minute.`);
      }
      created = await create();
    }
  }

  if (created.error || !created.data.user) {
    const err = created.error;
    if (err && passwordProblem(err)) {
      await releaseToken(admin, row.id);
      return fail(passwordMessage(err), { password: passwordMessage(err) });
    }
    await releaseToken(admin, row.id);
    return fail(`Couldn’t create your account: ${err?.message ?? "unknown error"}. Try again.`);
  }
  const user = created.data.user;

  // handle_new_user() made the profile from the invitation. Re-check, since
  // the owner may have revoked the invite while we were creating the account.
  if (!(await openInvitation(admin, email))) {
    await admin.auth.admin.deleteUser(user.id);
    return fail(WITHDRAWN);
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  if (!profile) {
    await admin.from("profiles").insert({ id: user.id, email, full_name: name, role: "admin" });
  } else if (profile.role !== "admin") {
    // the trigger's "first profile ever = owner" branch must never make an
    // invitee the owner (e.g. if the owner's row had been deleted)
    await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
  }

  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("email", email);
  await dropOpenTokens(admin, { purpose: "invite", email });

  await logActivity({
    actor: { id: user.id, name },
    action: "team.accept",
    entityType: "team_member",
    entityId: user.id,
    detail: { email, label: name },
  });

  return { ok: true, message: "You’re in. Welcome to the team.", signInAs: user.email ?? email };
}

async function redeemReset(
  admin: Admin,
  raw: string,
  peeked: TokenRow,
  password: string
): Promise<AuthResult> {
  const userId = peeked.user_id;
  if (!userId) return fail(DEAD_LINK);

  const { data: found } = await admin.auth.admin.getUserById(userId);
  const user = found?.user;
  if (!user?.email) return fail("That account no longer exists.");
  const owner = isOwnerEmail(user.email);

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, disabled")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; disabled: boolean | null }>();
  if (!profile && !owner) return fail("That account isn’t on the panel any more.");
  if (profile?.disabled && !owner) {
    return fail("This account has been disabled. Ask the owner if you think that’s a mistake.");
  }

  const { row } = await consumeToken(admin, raw);
  if (!row) return fail(DEAD_LINK);

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    await releaseToken(admin, row.id);
    return passwordProblem(error)
      ? fail(passwordMessage(error), { password: passwordMessage(error) })
      : fail(`Couldn’t save the new password: ${error.message}. Try again.`);
  }

  // Signed out everywhere, now: sessions deleted (no more refreshes) and
  // sessions_valid_after stamped (is_staff() rejects tokens already issued).
  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_user: userId });
  if (revokeError) console.error("[password-reset] revoke_user_sessions:", revokeError.message);
  await dropOpenTokens(admin, { purpose: "reset", userId });

  await logActivity({
    actor: { id: userId, name: profile?.full_name ?? user.email },
    action: "auth.password_reset",
    entityType: "team_member",
    entityId: userId,
    detail: { email: user.email.toLowerCase(), label: profile?.full_name ?? user.email },
  });

  // The client signs in next, minting a session issued after the revocation
  // above (is_staff() floors sessions_valid_after to whole seconds, so a
  // same-second sign-in still counts as after it).
  const note = revokeError
    ? " (Other devices couldn’t be signed out automatically — tell the owner.)"
    : "";
  return { ok: true, message: `Password updated.${note}`, signInAs: user.email };
}

// ---------------------------------------------------------------------------
// first-run owner bootstrap
// ---------------------------------------------------------------------------

const OwnerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: Password,
});

async function ownerExists(admin: Admin): Promise<boolean> {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * "Create the owner account" on /admin/login — offered only while OWNER_EMAIL
 * is set and the panel has no owner. Replaces the old client-side signUp(),
 * so public sign-ups can be switched off in Supabase entirely.
 *
 * Refuses any address but OWNER_EMAIL, creates the user with the service role
 * (email_confirm: true — nothing is mailed), makes sure the profile is the
 * owner's, and returns signInAs so the login form signs in.
 */
export async function createOwnerAccount(formData: FormData): Promise<AuthResult> {
  const expected = ownerEmail();
  if (!expected) return fail("Set OWNER_EMAIL on the server to create the owner account here.");
  if (!hasServiceKey()) {
    return fail("Add SUPABASE_SERVICE_ROLE_KEY to the server environment first.");
  }

  const parsed = OwnerSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return zodFail(parsed.error);

  if (!(await consumeLimit(await ipKey("owner-bootstrap"), 5, 15 * 60, { failClosed: true }))) {
    return fail(TOO_MANY);
  }

  const { email, password } = parsed.data;
  if (email !== expected) {
    return fail("That email can’t create the owner account.", {
      email: "Use the owner’s address (OWNER_EMAIL).",
    });
  }

  const admin = createAdminClient();
  try {
    if (await ownerExists(admin)) {
      return fail("The panel already has an owner — sign in instead.");
    }
  } catch (e) {
    return fail(`Couldn’t reach the database: ${e instanceof Error ? e.message : "unknown error"}.`);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    if (error && alreadyRegistered(error)) {
      return fail(
        "An account with that email already exists — sign in with it (or use “Forgot password?”). Owner access is restored automatically when you sign in."
      );
    }
    if (error && passwordProblem(error)) {
      return fail(passwordMessage(error), { password: passwordMessage(error) });
    }
    return fail(`Couldn’t create the account: ${error?.message ?? "unknown error"}.`);
  }

  // handle_new_user() makes the very first profile the owner; if other
  // profiles already exist (the owner's row was deleted), it makes none — so
  // write it here either way.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: data.user.id, email, role: "owner", disabled: false },
      { onConflict: "id" }
    );
  if (profileError) console.error("[owner-bootstrap] profile:", profileError.message);

  await logActivity({
    actor: { id: data.user.id, name: email },
    action: "auth.owner_bootstrap",
    entityType: "team_member",
    entityId: data.user.id,
    detail: { email, label: email },
  });

  return { ok: true, message: "Owner account created.", signInAs: data.user.email ?? email };
}
