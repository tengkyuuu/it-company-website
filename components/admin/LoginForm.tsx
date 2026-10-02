"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createOwnerAccount, requestPasswordReset } from "@/app/admin/auth/actions";
import { Banner, Field, Input, PasswordInput } from "./ui";

type Mode = "signin" | "owner" | "reset";

/**
 * Sign-in for the panel.
 *
 * There is no client-side sign-up any more. "Create the owner account" is
 * offered only while OWNER_EMAIL is set and the panel has no owner
 * (`canCreateOwner`, decided server-side), and it runs a server action that
 * refuses every address but OWNER_EMAIL. Everyone else arrives by invite — so
 * public sign-ups can be switched off in Supabase.
 *
 * "Forgot password?" goes through a server action that mails one of our own
 * reset links via Resend.
 */
export default function LoginForm({
  next,
  canCreateOwner = false,
  setupHint = false,
}: {
  next: string;
  canCreateOwner?: boolean;
  /** no owner yet and OWNER_EMAIL unset: say how to create one */
  setupHint?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const go = (m: Mode) => {
    setMode(m);
    setResult(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);

    try {
      if (mode === "reset") {
        const fd = new FormData();
        fd.set("email", email);
        setResult(await requestPasswordReset(fd));
        return;
      }

      let signInAs = email;
      if (mode === "owner") {
        const fd = new FormData();
        fd.set("email", email);
        fd.set("password", password);
        const res = await createOwnerAccount(fd);
        if (!res.ok) {
          setResult(res);
          return;
        }
        // created server-side; signing in is the same as any other sign-in
        // (the action sets no cookies — see app/admin/auth/actions.ts)
        signInAs = res.signInAs ?? email;
      }

      const { error } = await createClient().auth.signInWithPassword({
        email: signInAs,
        password,
      });
      if (error) {
        setResult({ ok: false, message: error.message });
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Something went wrong — please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {result && <Banner result={result} />}

      <Field label="Email">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mykt.studio"
        />
      </Field>

      {mode !== "reset" && (
        <Field label="Password" hint={mode === "owner" ? "At least 8 characters." : undefined}>
          <PasswordInput
            name="password"
            autoComplete={mode === "owner" ? "new-password" : "current-password"}
            required
            // sign-in stays at Supabase's 6: older accounts may have one that short
            minLength={mode === "owner" ? 8 : 6}
            maxLength={mode === "owner" ? 72 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && (
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {mode === "signin" && (pending ? "Signing in…" : "Sign in")}
        {mode === "owner" && (pending ? "Creating…" : "Create owner account")}
        {mode === "reset" && (pending ? "Sending…" : "Send reset link")}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
        {mode !== "signin" ? (
          <button
            type="button"
            onClick={() => go("signin")}
            className="text-ink/60 transition-colors hover:text-ink"
          >
            ← Back to sign in
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => go("reset")}
              className="text-ink/60 transition-colors hover:text-ink"
            >
              Forgot password?
            </button>
            {canCreateOwner && (
              <button
                type="button"
                onClick={() => go("owner")}
                className="text-ink/60 transition-colors hover:text-ink"
              >
                First time? Create the owner account
              </button>
            )}
          </>
        )}
      </div>

      {mode === "owner" && (
        <p className="text-xs leading-relaxed text-ink/45">
          Only the owner’s address (set on the server as OWNER_EMAIL) can create this account.
        </p>
      )}
      {mode === "signin" && !canCreateOwner && !setupHint && (
        <p className="text-xs leading-relaxed text-ink/45">
          New to the team? Accounts are invite-only — ask the owner to invite you.
        </p>
      )}
      {mode === "signin" && setupHint && (
        <p className="text-xs leading-relaxed text-ink/45">
          This panel has no owner yet. Set <code className="font-mono">OWNER_EMAIL</code> on the
          server to create one here, or run{" "}
          <code className="font-mono">node scripts/create-owner.mjs</code>.
        </p>
      )}
    </form>
  );
}
