import Link from "next/link";
import type { Metadata } from "next";
import AuthCard from "@/components/admin/AuthCard";
import SetPasswordForm from "@/components/admin/SetPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceKey, looksLikeToken, peekToken } from "../_lib/tokens";

export const metadata: Metadata = {
  title: "Continue",
  robots: { index: false, follow: false },
  // the URL carries a live one-time token — never hand it to another origin
  referrer: "no-referrer",
};

/**
 * Where every emailed / shared panel link lands (tokenLink() in
 * lib/admin-email.ts): /admin/auth/confirm?t=<raw token>.
 *
 * Rendering this page CHECKS the token but never spends it. Chat apps and mail
 * scanners GET every link to draw a preview; the token is consumed only when
 * the person submits the form (redeemToken in ../actions.ts).
 *
 * The raw token goes nowhere but the form's hidden field.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  const raw = typeof t === "string" ? t.trim() : "";

  if (!raw) {
    return (
      <Dead
        title="This link is incomplete"
        body="Some of it got cut off on the way — or it’s from an older invite that no longer works. Copy the whole link from the email (or message) and open it again, or ask the owner for a new one."
      />
    );
  }

  if (!hasServiceKey()) {
    return (
      <Dead
        title="Account links aren’t set up yet"
        body="The site is missing its server key (SUPABASE_SERVICE_ROLE_KEY), so it can’t check this link. Let the owner know."
      />
    );
  }

  const admin = createAdminClient();
  const { row, error } = looksLikeToken(raw)
    ? await peekToken(admin, raw)
    : { row: null, error: null };

  if (error) {
    return (
      <Dead
        title="Couldn’t check this link"
        body="The panel’s database didn’t answer just now. Wait a minute and open the link again — it hasn’t been used up."
      />
    );
  }
  if (!row) {
    return (
      <Dead
        title="This link has expired or was already used"
        body="Each link works once, and only for a limited time. Ask the owner to send a fresh one — or, if you’ve set a password before, use “Forgot password?” on the sign-in page."
      />
    );
  }

  let defaultName = "";
  if (row.purpose === "invite") {
    const { data: invite } = await admin
      .from("invitations")
      .select("full_name, accepted_at")
      .eq("email", row.email)
      .maybeSingle<{ full_name: string | null; accepted_at: string | null }>();
    if (!invite || invite.accepted_at) {
      return (
        <Dead
          title="This invite was withdrawn"
          body="The owner has cancelled it. If that’s a mistake, ask them to invite you again."
        />
      );
    }
    defaultName = invite.full_name ?? "";
  }

  // Someone else signed in on this browser (often: the owner, testing the
  // link they just copied). Finishing here would sign them out and, for an
  // invite, choose another person's password — say so.
  const {
    data: { user: current },
  } = await (await createClient()).auth.getUser();
  const otherSession =
    current?.email && current.email.toLowerCase() !== row.email ? current.email : null;

  const isReset = row.purpose === "reset";

  return (
    <AuthCard
      eyebrow={isReset ? "Password reset" : "You’re invited"}
      title={isReset ? "Choose a new password" : "Welcome to the R Ally's Tech panel"}
      intro={
        <>
          <p>
            {isReset
              ? "Pick something you haven’t used here before. Saving it signs your account out everywhere else."
              : "You’ve been invited to help run the website — projects, services and the site’s content. Confirm your name and choose a password; only you will ever know it."}
          </p>
          {otherSession && (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-amber-800 dark:text-amber-200">
              You’re signed in as <strong className="font-medium">{otherSession}</strong>. This
              link is for <strong className="font-medium">{row.email}</strong> — continuing signs
              you out. If it isn’t yours, don’t use it: pass it on to them.
            </p>
          )}
        </>
      }
      footer={<span />}
    >
      <SetPasswordForm
        token={raw}
        purpose={row.purpose}
        email={row.email}
        defaultName={defaultName}
      />
    </AuthCard>
  );
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <AuthCard eyebrow="Admin panel" title={title} intro={<p>{body}</p>}>
      <Link
        href="/admin/login"
        className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-900"
      >
        Go to sign in
      </Link>
    </AuthCard>
  );
}
