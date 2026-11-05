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
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
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
      <div className="space-y-5" role="status" aria-live="polite">
        <span className="ai-pop inline-flex rounded-full size-12 items-center justify-center bg-ink text-paper">
          <svg aria-hidden viewBox="0 0 24 24" className="ai-tick size-6" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <p className="font-display text-lg font-semibold tracking-tight">{result.message}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">
            {toLogin ? "Taking you to sign in…" : "Taking you to the panel…"}
          </p>
        </div>
        {/* fills over the same 1.4 s as the redirect timer above */}
        <span aria-hidden className="block h-0.5 overflow-hidden bg-mist">
          <span className="ai-progress block h-full bg-gold" style={{ "--ai-ms": "1.4s" } as React.CSSProperties} />
        </span>
        <a
          href={next}
          className="group inline-flex w-full items-center justify-center rounded-full gap-2 bg-ink px-5 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-900"
        >
          {toLogin ? "Go to sign in" : "Go to the panel now"}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
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
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </Field>
      <Strength password={pw} />

      <Field label="Confirm password" error={fieldError("confirm")}>
        <PasswordInput
          name="confirm"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </Field>
      <Match password={pw} confirm={again} />

      <SubmitButton pending={pending} pendingLabel="Saving…" className="group w-full !py-3">
        {isReset ? "Save new password" : "Save and enter the panel"}
        {!pending && (
          <span aria-hidden className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        )}
      </SubmitButton>
    </form>
  );
}

/**
 * A rough guide, not a rule — the server only enforces 8–72 characters.
 * Gold only at "Strong", so the meter is the form's one gold moment.
 */
function score(pw: string) {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  let s = 2;
  if (pw.length >= 12) s++;
  const mixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
  if (mixed || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const LABELS = ["", "Too short", "Okay", "Good", "Strong"];

function Strength({ password }: { password: string }) {
  const s = score(password);
  return (
    <div className="-mt-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1 overflow-hidden bg-mist">
            <span
              className={`ai-bar block h-full ${
                s === 4 ? "bg-gold" : s === 1 ? "bg-ink/35" : "bg-ink"
              }`}
              style={{ transform: `scaleX(${i <= s ? 1 : 0})`, transitionDelay: `${(i - 1) * 60}ms` }}
            />
          </span>
        ))}
      </div>
      <p className="mt-1.5 h-4 font-mono text-[10px] uppercase tracking-[0.18em] text-slatey">
        {s > 0 && <span>Strength · {LABELS[s]}</span>}
      </p>
    </div>
  );
}

function Match({ password, confirm }: { password: string; confirm: string }) {
  const show = confirm.length > 0;
  const ok = show && confirm === password && password.length >= 8;
  const off = show && !ok && confirm.length >= password.length;
  return (
    <p className="-mt-1.5 flex h-4 items-center gap-1.5 text-xs" aria-live="polite">
      {ok && (
        <>
          <svg aria-hidden viewBox="0 0 24 24" className="ai-tick size-3.5 text-ink" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-ink/70">Passwords match</span>
        </>
      )}
      {off && <span className="text-slatey">Doesn’t match yet</span>}
    </p>
  );
}
