import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import type { ProfileRow } from "./types";

/**
 * Supabase client for server components, route handlers and server actions.
 * Reads/writes the auth cookies so the session survives navigation.
 *
 * Server *components* cannot set cookies; the try/catch swallows that case —
 * `middleware.ts` is what actually refreshes the session cookie on each request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a server component — middleware handles the refresh
          }
        },
      },
    }
  );
}

// ---------------------------------------------------------------------------
// the owner anchor
// ---------------------------------------------------------------------------

/**
 * OWNER_EMAIL (server-only env) names the one account that is ALWAYS the
 * owner, whatever the database says. Lower-cased; null when unset.
 */
export function ownerEmail(): string | null {
  const v = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return v || null;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = ownerEmail();
  return Boolean(owner && email && email.trim().toLowerCase() === owner);
}

// ---------------------------------------------------------------------------
// access
// ---------------------------------------------------------------------------

/** Why a signed-in user isn't let into the panel. */
export type NoAccessReason =
  /** no profiles row: never invited (or removed) */
  | "not-invited"
  /** the owner switched the account off */
  | "disabled"
  /** a password reset / disable revoked this session (sessions_valid_after) */
  | "session-ended"
  /** the lookup itself failed — fail closed, but say so */
  | "error";

export type Access =
  | { state: "signed-out"; profile: null; email: null; userId: null }
  | {
      state: "no-access";
      profile: null;
      email: string | null;
      userId: string;
      reason: NoAccessReason;
      error?: string;
    }
  | { state: "ok"; profile: ProfileRow; email: string | null; userId: string };

/** A profile row plus the Phase 1 access columns. */
type AccessProfile = ProfileRow & {
  disabled?: boolean | null;
  sessions_valid_after?: string | null;
};

type DbError = { code?: string; message: string };
type AnyClient = SupabaseClient;

const COLUMNS = "id, email, full_name, role, created_at, disabled, sessions_valid_after";
const LEGACY_COLUMNS = "id, email, full_name, role, created_at";

/** 42703: the column doesn't exist — schema.sql hasn't been re-run yet. */
const missingColumn = (e: DbError | null) =>
  Boolean(e && (e.code === "42703" || e.code === "PGRST204"));

async function readProfile(
  client: AnyClient,
  id: string
): Promise<{ data: AccessProfile | null; error: DbError | null }> {
  const first = await client.from("profiles").select(COLUMNS).eq("id", id).maybeSingle();
  if (!missingColumn(first.error)) {
    return { data: (first.data as AccessProfile | null) ?? null, error: first.error };
  }
  // A database that predates `disabled` still lets the owner in to see the
  // "re-run the schema" notices, instead of a blank "couldn't check" screen.
  const legacy = await client.from("profiles").select(LEGACY_COLUMNS).eq("id", id).maybeSingle();
  return { data: (legacy.data as AccessProfile | null) ?? null, error: legacy.error };
}

function serviceClient(): AnyClient | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * `iat` of the access token this request is using. getUser() (called first)
 * has already verified that token with Supabase, so reading a claim out of it
 * is safe; only `access_token` is touched, never getSession()'s `user`.
 */
async function sessionIssuedAt(supabase: AnyClient): Promise<number | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const part = data.session?.access_token?.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const iat = (JSON.parse(json) as { iat?: unknown }).iat;
    return typeof iat === "number" ? iat : null;
  } catch {
    return null;
  }
}

/**
 * Was this session revoked? Mirrors is_staff() in schema.sql exactly:
 * a token is good while iat >= floor(sessions_valid_after) — floored because
 * iat is whole seconds, so signing in during the same second as a revocation
 * (which a password reset does) still counts as after it.
 */
async function sessionRevoked(supabase: AnyClient, validAfter?: string | null) {
  if (!validAfter) return false;
  const cutoff = Math.floor(Date.parse(validAfter) / 1000);
  if (!Number.isFinite(cutoff) || cutoff <= 0) return false;
  const iat = await sessionIssuedAt(supabase);
  return iat !== null && iat < cutoff;
}

/**
 * The owner anchor. The account whose confirmed email is OWNER_EMAIL gets an
 * owner profile (role 'owner', not disabled) written back with the service role
 * whenever the row is missing or has been altered — so deleting, demoting or
 * disabling that row in the database can't lock the owner out.
 *
 * Writes only when something is actually wrong. If it can't write (no service
 * key, database refusing), the env var still wins for the panel's own gate;
 * the database's RLS will simply refuse writes until the row is repaired.
 */
async function anchorOwner(user: User, seen: AccessProfile | null): Promise<AccessProfile> {
  const fine = (p: AccessProfile | null) => Boolean(p && p.role === "owner" && !p.disabled);
  if (seen && fine(seen)) return seen;

  const admin = serviceClient();
  if (admin) {
    try {
      // the viewer's own client can't see a disabled row, so look again
      const current = (await readProfile(admin, user.id)).data;
      if (current && fine(current)) return current;

      const write = async (row: Record<string, unknown>, columns: string) =>
        admin.from("profiles").upsert(row, { onConflict: "id" }).select(columns).single();
      // email/role/disabled only: an existing full_name and
      // sessions_valid_after are left exactly as they were
      let res = await write(
        { id: user.id, email: user.email ?? null, role: "owner", disabled: false },
        COLUMNS
      );
      if (missingColumn(res.error)) {
        res = await write({ id: user.id, email: user.email ?? null, role: "owner" }, LEGACY_COLUMNS);
      }
      if (!res.error && res.data) return res.data as unknown as AccessProfile;
      console.error("[getAccess] couldn't restore the owner profile:", res.error?.message);
      if (current) return { ...current, role: "owner", disabled: false };
    } catch (e) {
      console.error("[getAccess] owner anchor failed:", e);
    }
  }

  const meta = user.user_metadata as { full_name?: unknown } | undefined;
  return {
    ...(seen ?? {
      id: user.id,
      email: user.email ?? null,
      full_name: typeof meta?.full_name === "string" ? meta.full_name : null,
      created_at: user.created_at,
    }),
    role: "owner",
    disabled: false,
  } as AccessProfile;
}

/**
 * Who is asking, and are they on the panel?
 *
 * A session is not access. handle_new_user() only gives a profile to the
 * first account (owner) and to invitees, so an auth user can exist with no
 * profiles row — "no-access". So does a disabled account, and a session issued
 * before a revocation (password reset / disable).
 *
 * The decision comes from the viewer's OWN client: profiles_select is
 * `is_staff()`, so the row only comes back when the database itself agrees
 * this session is staff. When it doesn't, a service-role read is used purely
 * to say why (disabled vs revoked vs never invited) — never to grant access.
 * The one exception is OWNER_EMAIL (anchorOwner above).
 *
 * Memoised per request with React's cache(): the layout, the page and any
 * server action in the same render all ask, and each ask is a network
 * round-trip to Supabase Auth.
 */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out", profile: null, email: null, userId: null };

  const email = user.email ?? null;
  const noAccess = (reason: NoAccessReason, error?: string): Access => ({
    state: "no-access",
    profile: null,
    email,
    userId: user.id,
    reason,
    ...(error ? { error } : {}),
  });

  const own = await readProfile(supabase, user.id);

  if (isOwnerEmail(email) && user.email_confirmed_at) {
    const profile = await anchorOwner(user, own.data);
    if (await sessionRevoked(supabase, profile.sessions_valid_after)) {
      return noAccess("session-ended");
    }
    return { state: "ok", profile, email, userId: user.id };
  }

  if (own.data) {
    // is_staff() already vouched for this row; these are belt and braces for
    // a database that predates the Phase 1 columns
    if (own.data.disabled) return noAccess("disabled");
    if (await sessionRevoked(supabase, own.data.sessions_valid_after)) {
      return noAccess("session-ended");
    }
    return { state: "ok", profile: own.data, email, userId: user.id };
  }

  if (own.error) {
    console.error("[getAccess] profile lookup failed:", own.error.message);
    return noAccess("error", own.error.message);
  }

  // No row through RLS. Find out why, so the screen can say something true.
  const admin = serviceClient();
  if (admin) {
    try {
      const { data } = await readProfile(admin, user.id);
      if (data?.disabled) return noAccess("disabled");
      // a row that isn't disabled but that is_staff() still refused: the
      // token predates sessions_valid_after — sign in again
      if (data) return noAccess("session-ended");
    } catch {
      // fall through to the generic answer
    }
  }
  return noAccess("not-invited");
});

/**
 * The signed-in member's profile, or null when signed out OR without access
 * (no profile, disabled, revoked session). There is deliberately no fallback
 * to a synthetic profile: that would hand the panel to any authenticated user.
 * Use getAccess() when you need to tell those cases apart.
 */
export async function getProfile(): Promise<ProfileRow | null> {
  return (await getAccess()).profile;
}
