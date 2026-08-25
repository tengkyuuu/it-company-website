"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveProject, type ActionResult } from "@/app/admin/actions";
import type { ProjectRow } from "@/lib/supabase/types";
import ImageField from "./ImageField";
import {
  Banner,
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  Select,
  SubmitButton,
  Textarea,
} from "./ui";

const DEFAULT_DOTS = ["#7c5cff", "#4f46e5", "#15131f"];

/** Swatch + hex text, kept in sync so either can be edited. */
function ColorField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          type="color"
          // a color input rejects anything that isn't #rrggbb
          value={valid ? value : "#000000"}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-mist/70 bg-paper p-1"
          aria-label={`${label} swatch`}
        />
        <Input
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          maxLength={7}
          className={`font-mono text-xs ${valid ? "" : "border-red-500/60"}`}
          aria-label={`${label} hex`}
        />
      </div>
      {!valid && <p className="mt-1 text-xs text-red-600">Needs to be #rrggbb</p>}
    </div>
  );
}

export default function ProjectForm({ project }: { project?: ProjectRow }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => saveProject(formData),
    null
  );

  const dots = project?.dots?.length === 3 ? project.dots : DEFAULT_DOTS;

  return (
    <form action={action} className="space-y-6">
      {result && <Banner result={result} />}

      <Card>
        <CardTitle hint="How the project is introduced on /projects and its own page.">
          The basics
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-1">
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={project?.name ?? ""}
              placeholder="FameCRM"
            />
          </Field>

          <Field
            label="Slug"
            hint="The URL: /projects/your-slug"
            className="sm:col-span-1"
          >
            <Input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={60}
              defaultValue={project?.slug ?? ""}
              placeholder="famecrm"
            />
          </Field>

          <Field label="Category">
            <Input
              name="category"
              maxLength={120}
              defaultValue={project?.category ?? ""}
              placeholder="CRM Platform"
            />
          </Field>

          <Field label="Year" hint="Shown as-is, e.g. ’25">
            <Input
              name="year"
              maxLength={20}
              defaultValue={project?.year ?? ""}
              placeholder="’25"
            />
          </Field>

          <Field
            label="Domain label"
            hint="Displayed in the preview's browser bar. Not a link."
          >
            <Input
              name="url"
              maxLength={200}
              defaultValue={project?.url ?? ""}
              placeholder="famecrm.app"
            />
          </Field>

          <Field
            label="Live URL"
            hint="Full https:// address. Set this and the preview becomes a real embedded iframe; leave it blank to show the screenshot."
          >
            <Input
              name="live_url"
              type="url"
              maxLength={500}
              defaultValue={project?.live_url ?? ""}
              placeholder="https://famecrm.app"
            />
          </Field>

          <Field label="Summary" hint="One line, used on the index." className="sm:col-span-2">
            <Input
              name="summary"
              maxLength={400}
              defaultValue={project?.summary ?? ""}
              placeholder="The agency operating system — creators, trends and team in one place."
            />
          </Field>

          <Field
            label="Description"
            hint="Two or three sentences for the detail page."
            className="sm:col-span-2"
          >
            <Textarea
              name="description"
              rows={5}
              maxLength={4000}
              defaultValue={project?.description ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="One per line (commas work too).">Lists</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tags" hint="Short scope chips, e.g. Web App, SaaS">
            <Textarea
              name="tags"
              rows={4}
              defaultValue={(project?.tags ?? []).join("\n")}
              placeholder={"Web App\nSaaS\nDashboard"}
            />
          </Field>
          <Field label="Highlights" hint="What's visible in the build.">
            <Textarea
              name="highlights"
              rows={4}
              defaultValue={(project?.highlights ?? []).join("\n")}
              placeholder={"Creator and account dashboard\nUsage metering with plan tiers"}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Two shots max. The second one layers in behind the first on the landing gallery.">
          Screenshots
        </CardTitle>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageField
            name="img"
            label="Main screenshot"
            defaultValue={project?.img}
            hint="Capture at 1536px wide or more — the site never upscales."
          />
          <ImageField
            name="img2"
            label="Secondary screenshot (optional)"
            defaultValue={project?.img2}
          />
        </div>
      </Card>

      <Card>
        <CardTitle hint="Three colors lifted from the project itself. They tint its plate on the landing gallery and colour the browser dots.">
          Signature colors
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <ColorField
              key={i}
              name={`dot${i + 1}`}
              label={["Primary", "Secondary", "Deep / background"][i]}
              defaultValue={dots[i]}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-ink/45">
          The third one should be the darkest — it becomes the plate background.
        </p>
      </Card>

      <Card>
        <CardTitle>Publishing</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Visibility</Label>
            <label className="flex items-center gap-3 rounded-xl border border-mist/70 bg-paper px-3.5 py-3">
              <input
                type="checkbox"
                name="published"
                defaultChecked={project?.published ?? false}
                className="h-4 w-4 accent-[var(--color-accent-to)]"
              />
              <span className="text-sm">
                Published — visible on the public site
              </span>
            </label>
          </div>
          <Field label="Sort order" hint="Lower numbers come first.">
            <Select name="sort_order" defaultValue={String(project?.sort_order ?? 0)}>
              {Array.from({ length: 20 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <input type="hidden" name="id" value={project?.id ?? ""} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{project ? "Save changes" : "Create project"}</SubmitButton>
        <Link
          href="/admin/projects"
          className="rounded-full border border-mist/70 px-5 py-2.5 text-sm transition-colors hover:border-mist"
        >
          Cancel
        </Link>
        {project?.slug && project.published && (
          <Link
            href={`/projects/${project.slug}`}
            target="_blank"
            className="text-sm text-ink/55 transition-colors hover:text-ink"
          >
            View on site ↗
          </Link>
        )}
      </div>
    </form>
  );
}
