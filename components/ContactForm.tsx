"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const fieldCls =
  "w-full rounded-xl border border-mist bg-paper px-4 py-3 text-ink placeholder:text-slatey transition-colors duration-200 focus:border-ink/40 focus:outline-none focus:ring-4 focus:ring-ink/5";

const services = [
  "Web Development",
  "App Development",
  "UI/UX Design",
  "Cloud & DevOps",
  "AI & Automation",
  "IT Consulting",
  "Not sure yet",
];

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  return (
    <div className="relative rounded-3xl border border-mist/70 bg-white p-7 md:p-9">
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[420px] flex-col items-center justify-center text-center"
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
              onClick={() => setSent(false)}
              className="mt-6 text-sm font-medium text-ink/70 underline-offset-4 hover:underline"
            >
              Send another
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input required placeholder="Jane Dela Cruz" className={fieldCls} />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  placeholder="jane@company.com"
                  className={fieldCls}
                />
              </Field>
            </div>

            <Field label="What do you need?">
              <select required defaultValue="" className={fieldCls}>
                <option value="" disabled>
                  Select a service…
                </option>
                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Tell us a little more">
              <textarea
                required
                rows={5}
                placeholder="A sentence or two about what you’re building…"
                className={`${fieldCls} resize-none`}
              />
            </Field>

            <motion.button
              type="submit"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group relative mt-2 inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper"
            >
              <span className="absolute inset-0 bg-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative z-10">Send message →</span>
            </motion.button>
            <p className="text-center text-xs text-slatey">
              Prototype form — submissions aren’t stored yet.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs uppercase tracking-widest text-slatey">
        {label}
      </span>
      {children}
    </label>
  );
}
