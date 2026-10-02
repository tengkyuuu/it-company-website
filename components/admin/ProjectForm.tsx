"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveProject } from "@/app/admin/actions";
import type { ProjectRow } from "@/lib/supabase/types";
import ImageField from "./ImageField";
import { CheckChips, GalleryEditor, ResultsEditor } from "./ProjectCaseStudy";
import {
  Banner,
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  SubmitButton,
  Textarea,
  Toggle,
  useFormAction,
} from "./ui";

const DEFAULT_DOTS = ["#7c5cff", "#4f46e5", "#15131f"];

/** "Rally's Équities" -> "rallys-equities" */
function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Swatch + hex text, kept in sync so either can be edited. */
function ColorField({
  name,
  label,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  const hexId = `${name}-hex`;
  const errId = `${name}-error`;
  const message = !valid ? "Needs to be #rrggbb" : error;

  return (
    <div>
      <Label htmlFor={hexId}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          // a color input rejects anything that isn't #rrggbb
          value={valid ? value.toLowerCase() : "#000000"}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-mist/70 bg-paper p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          aria-label={`${label} swatch`}
        />
        <Input
          id={hexId}
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value.trim())}
          spellCheck={false}
          maxLength={7}
          className="font-mono text-xs"
          aria-invalid={Boolean(message) || undefined}
          aria-describedby={message ? errId : undefined}
        />
      </div>
      {message && (
        <p id={errId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
    </div>
  );
}

export default function ProjectForm({
  project,
  defaultSortOrder = 0,
  justCreated = false,
  serviceOptions = [],
  rosterOptions = [],
}: {
  project?: ProjectRow;
  /** where a new project lands — the end of the list, not on top of #0 */
  defaultSortOrder?: number;
  /** arrived here straight from the create form */
  justCreated?: boolean;
  /** service titles offered as "what we did" chips (from the Services page) */
  serviceOptions?: string[];
  /** public roster names offered as "who worked on it" chips */
  rosterOptions?: string[];
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(0);

  const { result, pending, formProps, fieldError } = useFormAction(saveProject, {
    onSuccess: (r) => {
      setDirty(false);
      // a create lands on the edit page, so a second click can't insert a
      // duplicate and the URL now points at something real
      if (!project && r.id) router.replace(`/admin/projects/${r.id}?created=1`);
    },
  });

  // slug follows the name on a NEW project until someone edits it by hand
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(project));
  const renaming = Boolean(project?.published && slug !== project.slug);

  // closing the tab / reloading with unsaved edits asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const dots = project?.dots?.length === 3 ? project.dots : DEFAULT_DOTS;
  // saved services split into the chips we offer and free-text extras
  const savedServices = project?.services ?? [];
  const pickedServices = savedServices.filter((s) => serviceOptions.includes(s));
  const otherServices = savedServices.filter((s) => !serviceOptions.includes(s));
  const markDirty = () => setDirty(true);
  const onBusy = (busy: boolean) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1)));

  const shown =
    result ?? (justCreated ? { ok: true, message: "Project created. Keep editing, or publish it when it's ready." } : null);

  return (
    <form {...formProps} onChange={markDirty} className="space-y-6">
      <Card>
        <CardTitle hint="How the project is introduced on /projects and its own page.">
          The basics
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" error={fieldError("name")}>
            <Input
              name="name"
              required
              maxLength={120}
              defaultValue={project?.name ?? ""}
              placeholder="FameCRM"
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>

          <Field
            label="Slug"
            hint={
              renaming
                ? `Changes the public URL — links to /projects/${project?.slug} will stop working.`
                : `The URL: /projects/${slug || "your-slug"}`
            }
            error={fieldError("slug")}
          >
            <Input
              name="slug"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Lowercase letters, numbers and single hyphens"
              maxLength={60}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              placeholder="famecrm"
              spellCheck={false}
            />
          </Field>

          <Field label="Category" error={fieldError("category")}>
            <Input
              name="category"
              maxLength={120}
              defaultValue={project?.category ?? ""}
              placeholder="CRM Platform"
            />
          </Field>

          <Field label="Year" hint="Shown as-is, e.g. ’25" error={fieldError("year")}>
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
            error={fieldError("url")}
          >
            <Input
              name="url"
              maxLength={200}
              defaultValue={project?.url ?? ""}
              placeholder="famecrm.app"
              spellCheck={false}
            />
          </Field>

          <Field
            label="Live URL"
            hint="Full https:// address. Set this and the preview becomes a real embedded iframe; leave it blank to show the screenshot. Check the domain actually resolves first."
            error={fieldError("live_url")}
          >
            <Input
              name="live_url"
              type="url"
              pattern="https://.*"
              title="A full https:// address"
              maxLength={500}
              defaultValue={project?.live_url ?? ""}
              placeholder="https://famecrm.app"
              spellCheck={false}
            />
          </Field>

          <Field
            label="Summary"
            hint="One line, used on the index."
            className="sm:col-span-2"
            error={fieldError("summary")}
          >
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
            error={fieldError("description")}
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
        <CardTitle hint="Who it was for and how we worked. All optional — anything left blank simply doesn't show on the project page.">
          Client &amp; engagement
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Client" error={fieldError("client")}>
            <Input
              name="client"
              maxLength={120}
              defaultValue={project?.client ?? ""}
              placeholder="Company name"
            />
          </Field>
          <Field label="Industry" error={fieldError("industry")}>
            <Input
              name="industry"
              maxLength={120}
              defaultValue={project?.industry ?? ""}
              placeholder="Creator marketing"
            />
          </Field>
          <Field label="Timeline" hint="However you'd say it: “10 weeks”, “Jan–Apr 2025”." error={fieldError("timeline")}>
            <Input
              name="timeline"
              maxLength={120}
              defaultValue={project?.timeline ?? ""}
              placeholder="12 weeks"
            />
          </Field>
        </div>

        <div className="mt-6 space-y-6">
          <CheckChips
            legend="What we did"
            name="services"
            options={serviceOptions}
            selected={pickedServices}
            hint="Pick from your services. Anything else goes in the box below."
            empty="Your services list is empty — type them in the box below."
          />
          <Field label="Other work (optional)" hint="One per line, e.g. “Brand refresh”.">
            <Textarea
              name="services_other"
              rows={2}
              defaultValue={otherServices.join("\n")}
            />
          </Field>
          <CheckChips
            legend="Who worked on it"
            name="team"
            options={rosterOptions}
            selected={project?.team ?? []}
            hint="From the public roster (Admin → Roster)."
            empty="The roster is empty — add people under Roster first."
          />
        </div>
      </Card>

      <Card>
        <CardTitle hint="The case study, in three beats. Leave a blank line between paragraphs. Each one only appears on the page once it's written.">
          The story
        </CardTitle>
        <div className="space-y-5">
          <Field
            label="The challenge"
            hint="What the client was up against, and why it mattered."
            error={fieldError("challenge")}
          >
            <Textarea
              name="challenge"
              rows={5}
              maxLength={4000}
              defaultValue={project?.challenge ?? ""}
            />
          </Field>
          <Field
            label="Our approach"
            hint="The decisions that shaped the build — design, architecture, process."
            error={fieldError("approach")}
          >
            <Textarea
              name="approach"
              rows={5}
              maxLength={4000}
              defaultValue={project?.approach ?? ""}
            />
          </Field>
          <Field
            label="The outcome"
            hint="What shipped and what changed for the client."
            error={fieldError("outcome")}
          >
            <Textarea
              name="outcome"
              rows={5}
              maxLength={4000}
              defaultValue={project?.outcome ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint="Big numbers shown under the story. Only real, measured figures — the client should recognise every one.">
          Results
        </CardTitle>
        <ResultsEditor
          initial={project?.results ?? []}
          max={4}
          error={fieldError("results")}
          onChange={markDirty}
        />
      </Card>

      <Card>
        <CardTitle hint="Duplicates are dropped.">Lists</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tags" hint="Short scope chips, one per line or comma-separated — up to 12.">
            <Textarea
              name="tags"
              rows={4}
              defaultValue={(project?.tags ?? []).join("\n")}
              placeholder={"Web App\nSaaS\nDashboard"}
            />
          </Field>
          <Field label="Highlights" hint="What's visible in the build — one per line; commas stay part of the text.">
            <Textarea
              name="highlights"
              rows={4}
              defaultValue={(project?.highlights ?? []).join("\n")}
              placeholder={"Creator and account dashboard\nUsage metering with plan tiers"}
            />
          </Field>
          <Field
            label="Tech stack"
            hint="One per line or comma-separated — up to 24. Shown as chips on the project page."
            className="sm:col-span-2"
          >
            <Textarea
              name="stack"
              rows={2}
              defaultValue={(project?.stack ?? []).join(", ")}
              placeholder="Next.js, Supabase, Tailwind CSS, Vercel"
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
            hint="Required to publish. Capture at 1536px wide or more — the site never upscales."
            error={fieldError("img")}
            onBusyChange={onBusy}
            onValueChange={markDirty}
          />
          <ImageField
            name="img2"
            label="Secondary screenshot (optional)"
            defaultValue={project?.img2}
            error={fieldError("img2")}
            onBusyChange={onBusy}
            onValueChange={markDirty}
          />
        </div>
      </Card>

      <Card>
        <CardTitle hint="More screens for the project page, in this order, under the two main shots. Mobile captures get a phone-shaped frame.">
          Gallery
        </CardTitle>
        <GalleryEditor
          initial={project?.gallery ?? []}
          max={12}
          error={fieldError("gallery")}
          onChange={markDirty}
          onBusyChange={onBusy}
        />
      </Card>

      <Card>
        <CardTitle hint="Only the client's own words, with their permission. Leave it empty rather than paraphrase.">
          Client testimonial
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Quote" className="sm:col-span-2" error={fieldError("testimonial_quote")}>
            <Textarea
              name="testimonial_quote"
              rows={4}
              maxLength={1200}
              defaultValue={project?.testimonial_quote ?? ""}
            />
          </Field>
          <Field label="Who said it" error={fieldError("testimonial_author")}>
            <Input
              name="testimonial_author"
              maxLength={120}
              defaultValue={project?.testimonial_author ?? ""}
              placeholder="Full name"
            />
          </Field>
          <Field label="Their role" error={fieldError("testimonial_role")}>
            <Input
              name="testimonial_role"
              maxLength={120}
              defaultValue={project?.testimonial_role ?? ""}
              placeholder="Founder, Company"
            />
          </Field>
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
              error={fieldError(`dot${i + 1}`)}
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
            <Toggle name="published" defaultChecked={project?.published ?? false}>
              Published — visible on the public site
            </Toggle>
          </div>
          <Field label="Sort order" hint="Lower numbers come first." error={fieldError("sort_order")}>
            <Input
              name="sort_order"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              step={1}
              defaultValue={project?.sort_order ?? defaultSortOrder}
            />
          </Field>
        </div>
      </Card>

      <input type="hidden" name="id" value={project?.id ?? ""} />

      {/* sticky so the save button and its result are always in reach on a
          long form — the banner sits right where the eye is after clicking */}
      <div className="sticky bottom-0 z-10 -mx-1 space-y-3 rounded-2xl border border-mist/70 bg-paper/90 p-3 backdrop-blur-xl md:p-4">
        <Banner result={shown} />
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            pending={pending}
            disabled={uploading > 0}
            pendingLabel={project ? "Saving…" : "Creating…"}
          >
            {uploading > 0 ? "Waiting for upload…" : project ? "Save changes" : "Create project"}
          </SubmitButton>
          <Link
            href="/admin/projects"
            onClick={(e) => {
              if (dirty && !window.confirm("Discard your unsaved changes?")) e.preventDefault();
            }}
            className="rounded-full border border-mist/70 px-5 py-2.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          >
            {project ? "Back" : "Cancel"}
          </Link>
          {dirty && !pending && (
            <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
              Unsaved changes
            </span>
          )}
          {project?.slug && project.published && (
            <Link
              href={`/projects/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-sm text-ink/55 transition-colors hover:text-ink"
            >
              View on site ↗
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
