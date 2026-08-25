"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Banner, Field, Input } from "./ui";

type Mode = "signin" | "signup" | "reset";

/**
 * Sign-in for the panel. Also offers first-run sign-up: the schema's
 * handle_new_user() trigger makes the FIRST account the owner, and everyone
 * after that arrives by invite instead.
 */
export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const supabase = createClient();

    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/admin/login`,
        });
        setResult(
          error
            ? { ok: false, message: error.message }
            : { ok: true, message: "Check your inbox for a reset link." }
        );
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setResult({ ok: false, message: error.message });
          return;
        }
        // With email confirmation on, there's no session yet.
        if (!data.session) {
          setResult({
            ok: true,
            message: "Account created — confirm your email, then sign in.",
          });
          setMode("signin");
          return;
        }
        router.replace(next);
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setResult({ ok: false, message: error.message });
        return;
      }
      router.replace(next);
      router.refresh();
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
        <Field
          label="Password"
          hint={mode === "signup" ? "At least 6 characters." : undefined}
        >
          <Input
            type="password"
            name="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
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
        {mode === "signup" && (pending ? "Creating…" : "Create owner account")}
        {mode === "reset" && (pending ? "Sending…" : "Send reset link")}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
        {mode !== "signin" ? (
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setResult(null);
            }}
            className="text-ink/60 transition-colors hover:text-ink"
          >
            ← Back to sign in
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setResult(null);
              }}
              className="text-ink/60 transition-colors hover:text-ink"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setResult(null);
              }}
              className="text-ink/60 transition-colors hover:text-ink"
            >
              First time? Create the owner account
            </button>
          </>
        )}
      </div>
    </form>
  );
}
