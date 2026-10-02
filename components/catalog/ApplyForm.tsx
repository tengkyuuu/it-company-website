"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ApplyErrorCode, ApplyField, ApplyState } from "@/lib/apply-schema";

/**
 * The inline application form on /careers/[slug], modelled on ContactForm
 * (pending / success / error / field errors, aria-live, aria-invalid, the same
 * honeypot + time-trap). It POSTs JSON to /api/apply — a Route Handler, so the
 * URL survives redeploys.
 *
 * Every string arrives as a prop, already in the page's language: the
 * `catalog` namespace is server-only, and the endpoint answers with field
 * names / error codes rather than sentences, which this maps back to `strings`.
 * Only TYPES are imported from lib/apply-schema, so zod stays off the client.
 */
export type ApplyStrings = {
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  phone: string;
  optional: string;
  phonePlaceholder: string;
  links: string;
  linksHint: string;
  linksPlaceholder: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  privacy: string;
  successTitle: string;
  /** already interpolated with the role */
  successBody: string;
  fields: Record<ApplyField, string>;
  codes: Record<ApplyErrorCode, string>;
  network: string;
};

const fieldCls =
  "w-full rounded-xl border border-mist bg-paper px-4 py-3 text-ink placeholder:text-slatey transition-colors duration-200 focus:border-ink/40 focus:outline-none focus:ring-4 focus:ring-ink/5 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-500/10";

export default function ApplyForm({ jobId, strings: s }: { jobId: string; strings: ApplyStrings }) {
  const [state, setState] = useState<ApplyState>({ status: "idle" });
  const [pending, setPending] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const startedAt = useRef(Date.now());

  const invalid = (f: ApplyField) => state.status === "invalid" && state.fields.includes(f);
  const errorFor = (f: ApplyField) => (invalid(f) ? s.fields[f] : undefined);
  const describe = (f: ApplyField, hint?: string) =>
    [invalid(f) ? `ap-${f}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setNetworkError(false);
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setState((await res.json()) as ApplyState);
    } catch {
      setNetworkError(true);
      setState({ status: "idle" });
    } finally {
      setPending(false);
    }
  }

  const banner = networkError ? s.network : state.status === "error" ? s.codes[state.code] : null;

  return (
    <div className="relative rounded-3xl border border-mist/70 bg-surface p-6 md:p-9">
      <AnimatePresence mode="wait">
        {state.status === "success" ? (
          <motion.div
            key="done"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[380px] flex-col items-center justify-center text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-ink">
              ✦
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">{s.successTitle}</h3>
            <p className="mt-2 max-w-sm text-pretty text-ink/60">{s.successBody}</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <input type="hidden" name="jobId" value={jobId} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={s.name} htmlFor="ap-name" error={errorFor("name")}>
                  <input
                    id="ap-name"
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder={s.namePlaceholder}
                    className={fieldCls}
                    aria-invalid={invalid("name")}
                    aria-describedby={describe("name")}
                  />
                </Field>
                <Field label={s.email} htmlFor="ap-email" error={errorFor("email")}>
                  <input
                    id="ap-email"
                    name="email"
                    type="email"
                    required
                    maxLength={200}
                    autoComplete="email"
                    placeholder={s.emailPlaceholder}
                    className={fieldCls}
                    aria-invalid={invalid("email")}
                    aria-describedby={describe("email")}
                  />
                </Field>
              </div>

              <Field
                label={s.phone}
                optional={s.optional}
                htmlFor="ap-phone"
                error={errorFor("phone")}
              >
                <input
                  id="ap-phone"
                  name="phone"
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  placeholder={s.phonePlaceholder}
                  className={fieldCls}
                  aria-invalid={invalid("phone")}
                  aria-describedby={describe("phone")}
                />
              </Field>

              <Field
                label={s.links}
                optional={s.optional}
                htmlFor="ap-links"
                error={errorFor("links")}
                hint={s.linksHint}
              >
                <textarea
                  id="ap-links"
                  name="links"
                  rows={3}
                  inputMode="url"
                  spellCheck={false}
                  autoCapitalize="off"
                  placeholder={s.linksPlaceholder}
                  className={`${fieldCls} resize-none font-mono text-sm`}
                  aria-invalid={invalid("links")}
                  aria-describedby={describe("links", "ap-links-hint")}
                />
              </Field>

              <Field label={s.message} htmlFor="ap-message" error={errorFor("message")}>
                <textarea
                  id="ap-message"
                  name="message"
                  required
                  rows={6}
                  maxLength={4000}
                  placeholder={s.messagePlaceholder}
                  className={`${fieldCls} resize-y`}
                  aria-invalid={invalid("message")}
                  aria-describedby={describe("message")}
                />
              </Field>

              {/* anti-spam: honeypot (hidden from people) + render timestamp */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <input type="hidden" name="startedAt" value={startedAt.current} />

              {banner && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-400/40 bg-red-500/[0.07] px-4 py-3 text-sm text-red-700 dark:text-red-300"
                >
                  {banner}
                </p>
              )}

              <motion.button
                type="submit"
                disabled={pending}
                whileHover={pending ? undefined : { y: -2 }}
                whileTap={pending ? undefined : { scale: 0.98 }}
                className="group relative mt-1 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10">{pending ? s.sending : s.submit}</span>
              </motion.button>

              <p className="text-center text-xs text-slatey">{s.privacy}</p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  optional,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  /** "optional" — shown beside the label */
  optional?: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-mono text-xs uppercase tracking-widest text-slatey">
        {label}
        {optional && <span className="ml-1.5 normal-case tracking-normal text-slatey/80">({optional})</span>}
      </label>
      {children}
      {hint && (
        <span id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-slatey">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${htmlFor}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
