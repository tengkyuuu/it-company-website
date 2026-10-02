import "server-only";

import type { AuthError, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256Hex } from "@/lib/security";

/**
 * Our own one-time links for invites and password resets (public.auth_tokens).
 *
 * Why not Supabase's generateLink(): the `hashed_token` it hands back is the
 * very value GoTrue stores, so anyone able to read the auth schema could have
 * redeemed a pending invite or reset with nothing but a SELECT. Here the raw
 * token exists only in the link we send; the table keeps its SHA-256, so a
 * database read alone can't produce a working link.
 *
 * Lifecycle:
 *   issueToken  → kills that person's earlier unconsumed token for the same
 *                 purpose, stores sha256(raw), returns raw for the link
 *   peekToken   → validates WITHOUT consuming (GET /admin/auth/confirm — chat
 *                 apps and mail scanners fetch every link to draw a preview)
 *   consumeToken→ one UPDATE … WHERE consumed_at IS NULL AND expires_at > now
 *                 RETURNING, so two concurrent redemptions can't both win
 *   releaseToken→ undo a consume when the step after it failed for a reason
 *                 the person can fix (e.g. Supabase rejected the password)
 *
 * The table is service-role only (RLS on, no policies, client grants revoked).
 */

export type TokenPurpose = "invite" | "reset";

export type TokenRow = {
  id: string;
  purpose: TokenPurpose;
  email: string;
  user_id: string | null;
  expires_at: string;
};

type Admin = ReturnType<typeof createAdminClient>;
type DbError = { code?: string; message: string };

export const INVITE_TTL_HOURS = 24 * 7;
export const RESET_TTL_HOURS = 1;

/** "7 days" / "1 hour" — for the email copy, so it always matches the TTL. */
export function ttlLabel(hours: number) {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

const COLUMNS = "id, purpose, email, user_id, expires_at";

/**
 * randomToken() is 32 bytes as base64url (43 chars). Checking the shape first
 * means junk in ?t= never costs a database round-trip.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const looksLikeToken = (raw: unknown): raw is string =>
  typeof raw === "string" && TOKEN_RE.test(raw);

export function hasServiceKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function issueToken(
  admin: Admin,
  args: {
    purpose: TokenPurpose;
    email: string;
    /** reset: the account being reset. invite: omitted (no account yet). */
    userId?: string | null;
    createdBy?: string | null;
  }
): Promise<{ ok: true; raw: string } | { ok: false; error: DbError }> {
  const email = args.email.trim().toLowerCase();
  const hours = args.purpose === "invite" ? INVITE_TTL_HOURS : RESET_TTL_HOURS;

  // One live link per person and purpose: issuing a new one kills the old.
  let supersede = admin
    .from("auth_tokens")
    .delete()
    .eq("purpose", args.purpose)
    .is("consumed_at", null);
  supersede =
    args.purpose === "reset" && args.userId
      ? supersede.eq("user_id", args.userId)
      : supersede.eq("email", email);
  const { error: delError } = await supersede;
  if (delError) return { ok: false, error: delError };

  const raw = randomToken();
  const { error } = await admin.from("auth_tokens").insert({
    token_hash: sha256Hex(raw),
    purpose: args.purpose,
    email,
    user_id: args.userId ?? null,
    expires_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
    created_by: args.createdBy ?? null,
  });
  if (error) return { ok: false, error };
  return { ok: true, raw };
}

/** Is this link still good? Reads only — never consumes. */
export async function peekToken(
  admin: Admin,
  raw: string
): Promise<{ row: TokenRow | null; error: DbError | null }> {
  if (!looksLikeToken(raw)) return { row: null, error: null };
  const { data, error } = await admin
    .from("auth_tokens")
    .select(COLUMNS)
    .eq("token_hash", sha256Hex(raw))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (error) return { row: null, error };
  return { row: ((data ?? [])[0] as TokenRow | undefined) ?? null, error: null };
}

/**
 * Spend the token. A single UPDATE … RETURNING with the "still open" checks in
 * its WHERE: Postgres locks the row and re-evaluates the WHERE against the
 * latest version, so of two concurrent requests exactly one gets the row back
 * and the other gets nothing.
 */
export async function consumeToken(
  admin: Admin,
  raw: string
): Promise<{ row: TokenRow | null; error: DbError | null }> {
  if (!looksLikeToken(raw)) return { row: null, error: null };
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("auth_tokens")
    .update({ consumed_at: now })
    .eq("token_hash", sha256Hex(raw))
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select(COLUMNS);
  if (error) return { row: null, error };
  return { row: ((data ?? [])[0] as TokenRow | undefined) ?? null, error: null };
}

/** Put a consumed token back, so the person can retry with the same link. */
export async function releaseToken(admin: Admin, id: string) {
  await admin.from("auth_tokens").update({ consumed_at: null }).eq("id", id);
}

/** Drop every unconsumed token of one kind for a person (after success, revoke…). */
export async function dropOpenTokens(
  admin: Admin,
  by: { purpose: TokenPurpose; email?: string; userId?: string }
) {
  let q = admin.from("auth_tokens").delete().eq("purpose", by.purpose).is("consumed_at", null);
  if (by.userId) q = q.eq("user_id", by.userId);
  else if (by.email) q = q.eq("email", by.email.toLowerCase());
  else return;
  await q;
}

/** GoTrue has no lookup-by-email in the admin API; a small team pages fast. */
export async function findAuthUserByEmail(admin: Admin, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

export const alreadyRegistered = (e: AuthError) =>
  e.code === "email_exists" ||
  e.code === "user_already_exists" ||
  (e.status === 422 && /registered|exists/i.test(e.message));

/** Errors the person can fix by choosing a different password. */
export const passwordProblem = (e: AuthError) =>
  e.code === "weak_password" ||
  e.code === "same_password" ||
  e.code === "validation_failed" ||
  /password/i.test(e.message);

export function passwordMessage(e: AuthError) {
  if (e.code === "same_password") return "That’s already your password — pick a different one.";
  if (e.code === "weak_password") {
    return "Supabase rejected that password as too weak — try a longer one, mixing words, numbers and symbols.";
  }
  return e.message;
}
