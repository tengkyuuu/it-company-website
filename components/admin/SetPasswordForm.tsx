"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { redeemToken, type AuthResult } from "@/app/admin/auth/actions";
import { Banner, Field, Input, PasswordInput, SubmitButton, callAction } from "./ui";

/**
 * The form on /admin/auth/confirm: name + password for an invite, password
 * alone for a reset. The token rides in a hidden field and is spent only when
 * this is submitted (redeemToken).
 *
 * Submitted by hand rather than through a form action: nothing is reset on a
 * failed attempt ("passwords don't match" keeps what was typed). On success the
 * action returns `signInAs` and THIS component signs in with the browser
 * client — the action deliberately sets no cookies (see app/admin/auth/
 * actions.ts) — then does a FULL navigation: the admin layout persists across
 * client-side navigations and it rendered this page bare, so a soft
 * router.push would keep the panel shell from ever appearing.
 */
export default function SetPasswordForm({
  token,
  purpose,
  email,
  defaultName,
}: {
  token: string;
  purpose: "invite" | "reset";
  email: string;
  defaultName: string;
}) {
  const [result, setResult] = useState<AuthResult | null>(null);
  const [pending, setPending] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isReset = purpose === "reset";

  // Take the token out of the address bar (and so out of history, analytics
  // page views and anything copied from it). It lives on in the hidden field.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("t")) {
        url.searchParams.delete("t");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
    } catch {
      // cosmetic only
    }
  }, []);

  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => window.location.assign(next), 1400);
    return () => clearTimeout(t);
  }, [next]);

  useEffect(() => {
    if (result?.ok === false && result.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [result]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = ((await callAction(() => redeemToken(fd))) ?? null) as AuthResult | null;
      if (res?.ok && res.signInAs) {
        const { error } = await createClient().auth.signInWithPassword({
          email: res.signInAs,
          password: String(fd.get("password") ?? ""),
        });
        if (error) {
          setResult({ ok: true, message: `${res.message} Sign in with your new password.` });
          setNext("/admin/login");
        } else {
          setResult(res);
          setNext("/admin?welcome=1");
        }
        return;
      }
      setResult(res);
    } finally {
      setPending(false);
    }
  }

  if (result?.ok && next) {
    const toLogin = next.startsWith("/admin/login");
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <p className="font-display text-lg font-semibold tracking-tight">{result.message}</p>
        <p className="text-sm leading-relaxed text-ink/60">
          {toLogin ? "Taking you to sign in…" : "Taking you to the panel…"}
        </p>
        <a
          href={next}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-900"
        >
          {toLogin ? "Go to sign in" : "Go to the panel now"}
        </a>
      </div>
    );
  }

  const fieldError = (name: string) => result?.fieldErrors?.[name];

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {result && <Banner result={result} />}
      <input type="hidden" name="t" value={token} />

      <Field label="Email">
        <Input
          type="email"
          name="email_display"
          value={email}
          readOnly
          autoComplete="username"
          className="text-ink/60"
        />
      </Field>

      {!isReset && (
        <Field
          label="Your name"
          hint="Shown to the rest of the team in the panel."
          error={fieldError("full_name")}
        >
          <Input
            name="full_name"
            required
            maxLength={120}
            autoComplete="name"
            defaultValue={defaultName}
            placeholder="Jhade Banquiao"
          />
        </Field>
      )}

      <Field label="New password" hint="At least 8 characters." error={fieldError("password")}>
        <PasswordInput
          name="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Confirm password" error={fieldError("confirm")}>
        <PasswordInput
          name="confirm"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </Field>

      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full !py-3">
        {isReset ? "Save new password" : "Save and enter the panel"}
      </SubmitButton>
    </form>
  );
}
