import AuthCard from "@/components/admin/AuthCard";
import LoginForm from "@/components/admin/LoginForm";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerEmail } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Is there an owner yet? Only then is "Create the owner account" hidden.
 * Asks has_owner() (schema.sql), and if that isn't deployed falls back to a
 * service-role count. Unknown → treated as "yes": the option stays hidden and
 * the first owner can still be made with scripts/create-owner.mjs.
 * (This is UX only — createOwnerAccount re-checks, and refuses any address
 * but OWNER_EMAIL.)
 *
 * Both reads fail fast (no retries, 3s cap): postgrest-js otherwise retries a
 * failed GET/HEAD with 1s/2s/4s backoff, so an unreachable project held the
 * login screen for ~7s before it could even render.
 */
async function ownerExists(): Promise<boolean> {
  try {
    const { data, error } = await createPublicClient()
      .rpc("has_owner")
      .abortSignal(AbortSignal.timeout(3000))
      .retry(false);
    if (!error && typeof data === "boolean") return data;
  } catch {
    // fall through
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { count, error } = await createAdminClient()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner")
        .abortSignal(AbortSignal.timeout(3000))
        .retry(false);
      if (!error && count !== null) return count > 0;
    } catch {
      // fall through
    }
  }
  return true;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // only allow internal redirects — never bounce to an attacker's URL
  const target = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  const noOwner = !(await ownerExists());
  // first-run owner creation is anchored to OWNER_EMAIL; without it, nobody
  // gets a sign-up form — the hint points at the env var / script instead
  const canCreateOwner = noOwner && Boolean(ownerEmail());
  const setupHint = noOwner && !ownerEmail();

  return (
    <AuthCard
      eyebrow="Admin panel"
      title="Sign in to the panel"
      intro={<p>Manage projects, the team and the site’s content.</p>}
    >
      <LoginForm next={target} canCreateOwner={canCreateOwner} setupHint={setupHint} />
    </AuthCard>
  );
}
