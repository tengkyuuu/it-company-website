"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

/**
 * Small building blocks for the panel. Everything uses the site's semantic
 * tokens (paper / surface / mist / ink), so the admin follows light and dark
 * with the rest of the site for free.
 */

/** Shape every panel server action returns (see app/admin/_lib/server.ts). */
export type FormResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

/**
 * Call a server action, turning a network failure into a normal error result
 * instead of an exception that would blow up to the error boundary. Next's own
 * control-flow errors (redirect / notFound, e.g. an expired session bouncing to
 * the login page) are re-thrown so they still work.
 */
export async function callAction(run: () => Promise<FormResult>): Promise<FormResult | null> {
  try {
    // a redirect() inside the action resolves to nothing
    return (await run()) ?? null;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_")) {
      throw e;
    }
    return {
      ok: false,
      message: "Couldn't reach the server — check your connection and try again. Nothing was saved.",
    };
  }
}

/**
 * Run a server action from a form WITHOUT React 19's automatic form reset.
 *
 * `<form action={fn}>` resets every uncontrolled input once the action settles —
 * success or failure — so a "That slug is already used" error used to wipe the
 * whole project form back to its defaults. Submitting through onSubmit +
 * startTransition keeps the same pending/result semantics but leaves the
 * fields exactly as the user typed them. `onSuccess` gets the form so create
 * forms can clear themselves deliberately.
 *
 * Because this bypasses the form-action machinery, `useFormStatus()` won't see
 * the pending state — pass `pending` to <SubmitButton> explicitly.
 */
export function useFormAction(
  action: (fd: FormData) => Promise<FormResult>,
  {
    onSuccess,
  }: { onSuccess?: (result: FormResult, form: HTMLFormElement | null) => void } = {}
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, dispatch, pending] = useActionState<FormResult | null, FormData>(
    (_prev, fd) => callAction(() => action(fd)),
    null
  );

  const successRef = useRef(onSuccess);
  useEffect(() => {
    successRef.current = onSuccess;
  });

  useEffect(() => {
    if (!result) return;
    if (result.ok) {
      successRef.current?.(result, formRef.current);
      return;
    }
    // move focus to the first field the server flagged
    if (result.fieldErrors && formRef.current) {
      const first = formRef.current.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
    }
  }, [result]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };

  return {
    result,
    pending,
    /** spread onto the <form> */
    formProps: { ref: formRef, onSubmit },
    /** server-side message for one field, if any */
    fieldError: (name: string) => result?.fieldErrors?.[name],
  };
}

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
  "w-full rounded-xl border border-mist/70 bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-accent-to focus:outline-none focus:ring-2 focus:ring-accent-to/25 aria-[invalid=true]:border-red-500/60";

/**
 * Lets <Field> wire its label, hint and error to the control inside it without
 * every call site threading ids by hand. Explicit props on the control win.
 */
type FieldCtx = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

type A11yProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
};

function useFieldProps<T extends A11yProps>(props: T): T {
  const ctx = useContext(FieldContext);
  if (!ctx) return props;
  return {
    ...props,
    id: props.id ?? ctx.id,
    "aria-describedby": props["aria-describedby"] ?? ctx.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (ctx.invalid || undefined),
  };
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const p = useFieldProps(props);
  return <input {...p} className={`${fieldBase} ${props.className ?? ""}`} />;
}

/**
 * Password field with a Show / Hide reveal toggle. `type` is intentionally not
 * accepted — this component owns it.
 *
 * The toggle is a typographic pill, not an eye icon: the panel has no icon set
 * (simple-icons is brand logos only) and one glyph isn't worth a dependency.
 * It's styled as a visible control — bordered, ink-coloured, 11px — because an
 * earlier pass used bare 10px slatey text and nobody could find it. `pr-20`
 * keeps a long password from running underneath.
 */
export function PasswordInput({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={`pr-20 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-1.5 right-1.5 inline-flex items-center rounded-lg border border-mist/70 bg-surface px-2.5 text-[11px] font-medium text-ink/70 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const p = useFieldProps(props);
  return (
    <textarea
      {...p}
      className={`${fieldBase} resize-y leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const p = useFieldProps(props);
  return <select {...p} className={`${fieldBase} ${props.className ?? ""}`} />;
}

/**
 * Label + control + hint + error. The label is tied to the (single) Input /
 * Textarea / Select inside via context; the error is announced through
 * aria-describedby and flips the control to aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  /** only needed when the control sets its own id */
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs leading-relaxed text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ink/45">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A labelled checkbox row — the shape the panel uses for every on/off switch. */
export function Toggle({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-mist/70 bg-paper px-3.5 py-2.5 focus-within:border-accent-to focus-within:ring-2 focus-within:ring-accent-to/25">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 shrink-0 accent-[var(--color-accent-to)]"
      />
      <span className="text-sm">{children}</span>
    </label>
  );
}

/**
 * Submit button. Reports the enclosing form's pending state on its own for a
 * plain `<form action>`; forms driven by useFormAction pass `pending`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "solid",
  className = "",
  pending: pendingProp,
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "solid" | "outline" | "danger";
  pending?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;

  const styles = {
    solid: "bg-ink text-paper hover:bg-ink-900",
    outline: "border border-mist/70 text-ink hover:border-mist",
    danger:
      "border border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400",
  }[variant];

  return (
    <button
      type="submit"
      {...rest}
      // after the spread, so a caller's `disabled={false}` can't re-enable a
      // button mid-submit (that ordering bug allowed double submits)
      disabled={pending || rest.disabled}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
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

/**
 * Result line for a form. Errors use role="alert" because a live region that is
 * inserted together with its text isn't reliably announced as role="status".
 */
export function Banner({
  result,
  className = "",
}: {
  result: { ok: boolean; message: string } | null;
  className?: string;
}) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      aria-live={result.ok ? "polite" : "assertive"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        result.ok
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
      } ${className}`}
    >
      {result.message}
    </p>
  );
}

/**
 * Page-level notice — a failed query, a table that isn't created yet, a missing
 * permission. Calm by default; only `error` reads as alarming.
 */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "error";
  title: string;
  children?: React.ReactNode;
}) {
  const styles = {
    info: "border-mist/70 bg-surface",
    warn: "border-amber-500/40 bg-amber-500/[0.07]",
    error: "border-red-500/35 bg-red-500/[0.06]",
  }[tone];
  const titleTone = {
    info: "text-ink",
    warn: "text-amber-800 dark:text-amber-200",
    error: "text-red-700 dark:text-red-300",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-2xl border p-5 md:p-6 ${styles}`}
    >
      <p className={`text-sm font-medium ${titleTone}`}>{title}</p>
      {children && (
        <div className="mt-1.5 text-sm leading-relaxed text-ink/60">{children}</div>
      )}
    </div>
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
