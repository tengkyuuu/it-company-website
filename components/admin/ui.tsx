"use client";

import { useFormStatus } from "react-dom";

/**
 * Small building blocks for the panel. Everything uses the site's semantic
 * tokens (paper / surface / mist / ink), so the admin follows light and dark
 * with the rest of the site for free.
 */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-mist/70 bg-surface p-6 md:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {children}
      </h2>
      {hint && <p className="mt-1 text-sm leading-relaxed text-ink/55">{hint}</p>}
    </div>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-slatey"
    >
      {children}
    </label>
  );
}

const fieldBase =
  "w-full rounded-xl border border-mist/70 bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-accent-to focus:outline-none focus:ring-2 focus:ring-accent-to/25";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`${fieldBase} resize-y leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink/45">{hint}</p>}
    </div>
  );
}

/** Submit button that reports the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "solid",
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "solid" | "outline" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  const styles = {
    solid: "bg-ink text-paper hover:bg-ink-900",
    outline: "border border-mist/70 text-ink hover:border-mist",
    danger: "border border-red-500/40 text-red-600 hover:bg-red-500/10",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function Banner({
  result,
}: {
  result: { ok: boolean; message: string } | null;
}) {
  if (!result) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm ${
        result.ok
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
      }`}
    >
      {result.message}
    </p>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "live" | "draft";
}) {
  const styles = {
    muted: "border-mist/70 text-ink/55",
    live: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
    draft: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${styles}`}
    >
      {children}
    </span>
  );
}
