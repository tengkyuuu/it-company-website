import { signOut } from "@/app/admin/actions";
import type { NoAccessReason } from "@/lib/supabase/server";
import AuthCard from "./AuthCard";

/**
 * Signed in, but not let into the panel. A session alone grants nothing: only
 * the owner and invitees get a profile (handle_new_user() in schema.sql), the
 * owner can disable an account, and a password reset or disable revokes every
 * session issued before it (profiles.sessions_valid_after).
 *
 * `reason` comes from getAccess(); "error" means the lookup itself failed — we
 * still fail closed, but don't tell a real teammate they were never invited.
 */
export default function AuthNoAccess({
  email,
  reason,
  error,
}: {
  email: string | null;
  reason: NoAccessReason;
  error?: string;
}) {
  const who = email ? (
    <>
      You’re signed in as <span className="text-ink">{email}</span>
    </>
  ) : (
    "You’re signed in"
  );

  const copy: Record<NoAccessReason, { title: string; body: React.ReactNode }> = {
    "not-invited": {
      title: "You don’t have access yet",
      body: (
        <p>
          {who}, but that account isn’t on the R Ally's Tech panel. Ask the owner to invite
          you — the invite link sets up your access.
        </p>
      ),
    },
    disabled: {
      title: "Your account has been disabled",
      body: (
        <p>
          {who}, but the owner has switched this account off, so it can’t open the panel.
          If you think that’s a mistake, ask the owner to re-enable it.
        </p>
      ),
    },
    "session-ended": {
      title: "Please sign in again",
      body: (
        <p>
          {who}, but this session was ended — your password was reset or your access
          changed. Sign out, then sign in again with your current password.
        </p>
      ),
    },
    error: {
      title: "Couldn’t check your access",
      body: (
        <p>
          {who}, but the panel couldn’t load your profile just now
          {error ? ` (${error})` : ""}. Try again in a moment — if it keeps happening, the
          database may need attention.
        </p>
      ),
    },
  };
  const { title, body } = copy[reason];

  return (
    <AuthCard eyebrow="Admin panel" title={title} intro={body}>
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-full border border-mist/70 px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-mist"
        >
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
