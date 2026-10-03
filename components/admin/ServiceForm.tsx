"use client";

import { useRef, useState } from "react";
import { saveService, deleteService } from "@/app/admin/content-actions";
import type { ServiceRow } from "@/lib/supabase/types";
import AutosaveStatus from "./AutosaveStatus";
import ConflictBanner from "./ConflictBanner";
import { useAutosave } from "./useAutosave";
import {
  Banner,
  Field,
  Input,
  Label,
  Select,
  SubmitButton,
  Textarea,
  Toggle,
  useFormAction,
} from "./ui";

/**
 * Create/edit a service, as a <details> disclosure rather than a modal — no
 * focus-trap or portal to get wrong.
 *
 * `icon` is a Select, not a text field, because the value has to be one of the
 * six names in the IconName union — a typo there renders a missing glyph on the
 * live site, and lib/cms.ts can only fall back to "web" after the fact.
 */
const ICONS = [
  { value: "web", label: "Web" },
  { value: "app", label: "App" },
  { value: "design", label: "Design" },
  { value: "cloud", label: "Cloud" },
  { value: "ai", label: "AI" },
  { value: "consult", label: "Consulting" },
] as const;

function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function ServiceForm({
  mode,
  service,
  nextOrder = 0,
}: {
  mode: "create" | "edit";
  service?: ServiceRow;
  /** default position for a new service — the end of the list */
  nextOrder?: number;
}) {
  const editing = mode === "edit" && service ? service : null;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const [slug, setSlug] = useState(service?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(editing));

  // the action reaches `autosave` through a closure — it only runs on submit
  const save = useFormAction((fd) => autosave.wrapSave(saveService)(fd), {
    onSuccess: (_r, form) => {
      if (editing) return;
      // a fresh create form for the next one, folded away
      form?.reset();
      setSlug("");
      setSlugTouched(false);
      if (detailsRef.current) detailsRef.current.open = false;
    },
  });
  // an existing service autosaves its text as you type; slug, order and
  // visibility still need Save. A new one saves on Create.
  const autosave = useAutosave(save.formProps.ref, {
    entity: "services",
    id: editing?.id,
    updatedAt: editing?.updated_at,
  });
  const del = useFormAction(deleteService);

  return (
    <details ref={detailsRef} className="group w-full md:w-auto">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-mist/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 [&::-webkit-details-marker]:hidden">
        {editing ? "Edit" : "New service"}
        <span aria-hidden className="transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <form {...save.formProps} className="mt-4 w-full space-y-4 md:w-[34rem]">
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={autosave.fieldError("title")}>
            <Input
              name="title"
              required
              maxLength={120}
              defaultValue={service?.title ?? ""}
              placeholder="Web Development"
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug" hint="Lowercase, hyphens only." error={autosave.fieldError("slug")}>
            <Input
              name="slug"
              required
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Lowercase letters, numbers and single hyphens"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              placeholder="web-development"
              spellCheck={false}
            />
          </Field>
        </div>

        <Field label="Blurb" hint="One line, used in compact places." error={autosave.fieldError("blurb")}>
          <Input
            name="blurb"
            maxLength={300}
            defaultValue={service?.blurb ?? ""}
            placeholder="Fast, accessible sites and web apps that feel effortless."
          />
        </Field>

        <Field label="Detail" hint="The longer paragraph on /services." error={autosave.fieldError("detail")}>
          <Textarea
            name="detail"
            rows={4}
            maxLength={2000}
            defaultValue={service?.detail ?? ""}
          />
        </Field>

        <Field label="Deliverables" hint="One per line, or comma-separated — up to 12.">
          <Textarea
            name="deliverables"
            rows={4}
            defaultValue={(service?.deliverables ?? []).join("\n")}
            placeholder={"Next.js / React\nHeadless CMS\nDesign systems"}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Icon" error={autosave.fieldError("icon")}>
            <Select name="icon" defaultValue={service?.icon ?? "web"}>
              {ICONS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Order" hint="Lower shows first." error={autosave.fieldError("sort_order")}>
            <Input
              name="sort_order"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              step={1}
              defaultValue={service?.sort_order ?? nextOrder}
            />
          </Field>
        </div>

        <div>
          <Label>Visibility</Label>
          <Toggle name="published" defaultChecked={service?.published ?? true}>
            Show on the site
          </Toggle>
        </div>

        {editing && <input {...autosave.tokenInputProps} />}
        <ConflictBanner autosave={autosave} />
        <Banner result={autosave.conflict ? null : save.result} />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <SubmitButton pending={save.pending} pendingLabel={editing ? "Saving…" : "Creating…"}>
            {editing ? "Save changes" : "Create service"}
          </SubmitButton>
          <AutosaveStatus autosave={autosave} />
        </div>
      </form>

      {editing && (
        <form
          {...del.formProps}
          onSubmit={(e) => {
            if (
              !window.confirm(
                `Delete “${editing.title}”? It disappears from the landing page, /services and the footer straight away.`
              )
            ) {
              e.preventDefault();
              return;
            }
            del.formProps.onSubmit(e);
          }}
          className="mt-3 space-y-3 md:w-[34rem]"
        >
          <input type="hidden" name="id" value={editing.id} />
          <Banner result={del.result} />
          <SubmitButton variant="danger" pending={del.pending} pendingLabel="Deleting…">
            Delete “{editing.title}”
          </SubmitButton>
        </form>
      )}
    </details>
  );
}
