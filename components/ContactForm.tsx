"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { submitContact } from "@/app/actions/contact";
import { serviceOptions, type ContactState } from "@/lib/contact-schema";

const fieldCls =
  "w-full rounded-xl border border-mist bg-paper px-4 py-3 text-ink placeholder:text-slatey transition-colors duration-200 focus:border-ink/40 focus:outline-none focus:ring-4 focus:ring-ink/5 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-500/10";

const initial: ContactState = { status: "idle" };

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initial);
  const [showSuccess, setShowSuccess] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (state.status === "success") setShowSuccess(true);
  }, [state]);

  const errorFor = (name: string) =>
    state.status === "invalid" ? state.fieldErrors[name] : undefined;

  return (
    <div className="relative rounded-3xl border border-mist/70 bg-white p-7 md:p-9">
      <AnimatePresence mode="wait">
        {showSuccess ? (
          <motion.div
            key="done"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[440px] flex-col items-center justify-center text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-ink">
              ✦
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">
              Message on its way.
            </h3>
            <p className="mt-2 max-w-sm text-ink/60">
              Thanks for reaching out — a real human from the studio will reply
              within one business day.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="mt-6 text-sm font-medium text-ink/70 underline-offset-4 hover:underline"
            >
              Send another
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <form action={formAction} className="flex flex-col gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="cf-name" error={errorFor("name")}>
                  <input
                    id="cf-name"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Jane Dela Cruz"
                    className={fieldCls}
                    aria-invalid={!!errorFor("name")}
                    aria-describedby={errorFor("name") ? "cf-name-error" : undefined}
                  />
                </Field>
                <Field label="Email" htmlFor="cf-email" error={errorFor("email")}>
                  <input
                    id="cf-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="jane@company.com"
                    className={fieldCls}
                    aria-invalid={!!errorFor("email")}
                    aria-describedby={errorFor("email") ? "cf-email-error" : undefined}
                  />
                </Field>
              </div>

              <Field
                label="What do you need?"
                htmlFor="cf-service"
                error={errorFor("service")}
              >
                <select
                  id="cf-service"
                  name="service"
                  required
                  defaultValue=""
                  className={fieldCls}
                  aria-invalid={!!errorFor("service")}
                  aria-describedby={
                    errorFor("service") ? "cf-service-error" : undefined
                  }
                >
                  <option value="" disabled>
                    Select a service…
                  </option>
                  {serviceOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>

              <Field
                label="Tell us a little more"
                htmlFor="cf-message"
                error={errorFor("message")}
              >
                <textarea
                  id="cf-message"
                  name="message"
                  required
                  rows={5}
                  placeholder="A sentence or two about what you’re building…"
                  className={`${fieldCls} resize-none`}
                  aria-invalid={!!errorFor("message")}
                  aria-describedby={
                    errorFor("message") ? "cf-message-error" : undefined
                  }
                />
              </Field>

              {/* anti-spam: honeypot (hidden from users) + render timestamp */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <input type="hidden" name="startedAt" value={startedAt.current} />

              {state.status === "error" && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {state.message}
                </p>
              )}

              <motion.button
                type="submit"
                disabled={pending}
                whileHover={pending ? undefined : { y: -2 }}
                whileTap={pending ? undefined : { scale: 0.98 }}
                className="group relative mt-2 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 bg-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10">
                  {pending ? "Sending…" : "Send message →"}
                </span>
              </motion.button>

              <p className="text-center text-xs text-slatey">
                We’ll only use your details to reply — never shared.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase tracking-widest text-slatey">
        {label}
      </span>
      {children}
      {error && (
        <span id={`${htmlFor}-error`} className="text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
