"use client";

import { useEffect, useRef, useState } from "react";
import { saveSettings } from "@/app/admin/actions";
import type { SiteSettingsRow } from "@/lib/supabase/types";
import {
  Banner,
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  SubmitButton,
  Toggle,
  useFormAction,
} from "./ui";

const MAX_SOCIALS = 12;

/**
 * Social rows carry a stable `key` and are controlled. They used to be keyed by
 * index with uncontrolled inputs, so removing a middle row made React reuse the
 * DOM nodes and the row *below* it was the one that visually disappeared.
 */
type SocialDraft = { key: number; label: string; href: string };

export default function SettingsForm({ settings }: { settings: SiteSettingsRow }) {
  const [dirty, setDirty] = useState(false);
  const { result, pending, formProps, fieldError } = useFormAction(saveSettings, {
    onSuccess: () => setDirty(false),
  });

  const nextKey = useRef(0);
  const draft = (label = "", href = ""): SocialDraft => ({ key: nextKey.current++, label, href });
  const [socials, setSocials] = useState<SocialDraft[]>(() =>
    (Array.isArray(settings.socials) && settings.socials.length
      ? settings.socials
      : [{ label: "", href: "" }]
    ).map((s) => draft(s.label, s.href))
  );

  const update = (key: number, patch: Partial<SocialDraft>) => {
    setDirty(true);
    setSocials((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <form {...formProps} onChange={() => setDirty(true)} className="space-y-6">
      <Card>
        <CardTitle hint="Used in the footer, the contact page and the site's metadata.">
          Brand
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand name" error={fieldError("brand_name")}>
            <Input name="brand_name" required maxLength={80} defaultValue={settings.brand_name} />
          </Field>
          <Field label="Tagline" error={fieldError("tagline")}>
            <Input name="tagline" maxLength={200} defaultValue={settings.tagline} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Blank fields fall back to the built-in values, so the site never shows an empty line.">
          Contact
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={fieldError("email")}>
            <Input
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="off"
              defaultValue={settings.email}
            />
          </Field>
          <Field label="Phone" error={fieldError("phone")}>
            <Input name="phone" type="tel" maxLength={60} defaultValue={settings.phone} />
          </Field>
          <Field label="Address line 1" error={fieldError("address_line1")}>
            <Input name="address_line1" maxLength={160} defaultValue={settings.address_line1} />
          </Field>
          <Field label="Address line 2" error={fieldError("address_line2")}>
            <Input name="address_line2" maxLength={160} defaultValue={settings.address_line2} />
          </Field>
          <Field label="Office hours" hint="e.g. Mon–Fri · 9:00–18:00 PHT" error={fieldError("hours")}>
            <Input name="hours" maxLength={120} defaultValue={settings.hours} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="The status line in the footer.">Availability</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Status text" error={fieldError("availability")}>
            <Input name="availability" maxLength={120} defaultValue={settings.availability} />
          </Field>
          <div>
            <Label>Show the pulsing dot</Label>
            <Toggle name="available" defaultChecked={settings.available}>
              Currently taking on work
            </Toggle>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Shown as chips in the footer. Fully blank rows are ignored; a row with only a label or only a URL is flagged.">
          Social links
        </CardTitle>
        <div className="space-y-3">
          {socials.map((s, i) => {
            const err = fieldError(`social_${i}`);
            const errId = `social-${s.key}-error`;
            return (
              <div key={s.key}>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                  <Input
                    name="social_label"
                    value={s.label}
                    onChange={(e) => update(s.key, { label: e.target.value })}
                    maxLength={40}
                    placeholder="LinkedIn"
                    aria-label={`Social ${i + 1} label`}
                    aria-invalid={(Boolean(err) && !s.label) || undefined}
                    aria-describedby={err ? errId : undefined}
                  />
                  <Input
                    name="social_href"
                    type="url"
                    value={s.href}
                    onChange={(e) => update(s.key, { href: e.target.value })}
                    maxLength={300}
                    placeholder="https://linkedin.com/company/…"
                    spellCheck={false}
                    aria-label={`Social ${i + 1} URL`}
                    aria-invalid={(Boolean(err) && Boolean(s.label)) || undefined}
                    aria-describedby={err ? errId : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDirty(true);
                      setSocials((list) => list.filter((x) => x.key !== s.key));
                    }}
                    className="rounded-xl border border-mist/70 px-3 py-2 text-xs transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
                    aria-label={`Remove social link ${i + 1}${s.label ? ` (${s.label})` : ""}`}
                  >
                    Remove
                  </button>
                </div>
                {err && (
                  <p id={errId} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {err}
                  </p>
                )}
              </div>
            );
          })}
          {socials.length === 0 && (
            <p className="text-sm text-ink/50">
              No links — the footer will show the built-in ones.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={socials.length >= MAX_SOCIALS}
          onClick={() => {
            setDirty(true);
            setSocials((list) => [...list, draft()]);
          }}
          className="mt-4 rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add link
        </button>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 space-y-3 rounded-2xl border border-mist/70 bg-paper/90 p-3 backdrop-blur-xl md:p-4">
        <Banner result={result} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending}>Save settings</SubmitButton>
          {dirty && !pending && (
            <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
              Unsaved changes
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
