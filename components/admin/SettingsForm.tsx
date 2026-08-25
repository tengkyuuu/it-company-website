"use client";

import { useActionState, useState } from "react";
import { saveSettings, type ActionResult } from "@/app/admin/actions";
import type { SiteSettingsRow, SocialLink } from "@/lib/supabase/types";
import {
  Banner,
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  SubmitButton,
} from "./ui";

export default function SettingsForm({ settings }: { settings: SiteSettingsRow }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => saveSettings(fd),
    null
  );

  const [socials, setSocials] = useState<SocialLink[]>(
    settings.socials?.length ? settings.socials : [{ label: "", href: "" }]
  );

  return (
    <form action={action} className="space-y-6">
      {result && <Banner result={result} />}

      <Card>
        <CardTitle hint="Used in the footer, the contact page and the site's metadata.">
          Brand
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand name">
            <Input name="brand_name" required defaultValue={settings.brand_name} />
          </Field>
          <Field label="Tagline">
            <Input name="tagline" defaultValue={settings.tagline} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Contact</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email">
            <Input name="email" type="email" required defaultValue={settings.email} />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={settings.phone} />
          </Field>
          <Field label="Address line 1">
            <Input name="address_line1" defaultValue={settings.address_line1} />
          </Field>
          <Field label="Address line 2">
            <Input name="address_line2" defaultValue={settings.address_line2} />
          </Field>
          <Field label="Office hours" hint="e.g. Mon–Fri · 9:00–18:00 PHT">
            <Input name="hours" defaultValue={settings.hours} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="The status line in the footer.">Availability</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Status text">
            <Input name="availability" defaultValue={settings.availability} />
          </Field>
          <div>
            <Label>Show the pulsing dot</Label>
            <label className="flex items-center gap-3 rounded-xl border border-mist/70 bg-paper px-3.5 py-3">
              <input
                type="checkbox"
                name="available"
                defaultChecked={settings.available}
                className="h-4 w-4 accent-[var(--color-accent-to)]"
              />
              <span className="text-sm">Currently taking on work</span>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Shown as chips in the footer. Blank rows are ignored.">
          Social links
        </CardTitle>
        <div className="space-y-3">
          {socials.map((s, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
              <Input
                name="social_label"
                defaultValue={s.label}
                placeholder="LinkedIn"
                aria-label={`Social ${i + 1} label`}
              />
              <Input
                name="social_href"
                defaultValue={s.href}
                placeholder="https://linkedin.com/company/…"
                aria-label={`Social ${i + 1} URL`}
              />
              <button
                type="button"
                onClick={() => setSocials(socials.filter((_, j) => j !== i))}
                className="rounded-xl border border-mist/70 px-3 py-2 text-xs transition-colors hover:border-mist"
                aria-label={`Remove social link ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSocials([...socials, { label: "", href: "" }])}
          className="mt-4 rounded-full border border-mist/70 px-4 py-2 text-sm transition-colors hover:border-mist"
        >
          Add link
        </button>
      </Card>

      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
