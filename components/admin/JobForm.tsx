"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveJob } from "@/app/admin/catalog-actions";
import {
  EMPLOYMENT_TYPES,
  MAX_LIST_ITEMS,
  PUBLIC_PATH,
  WORKPLACES,
} from "@/app/admin/_lib/catalog";
import type { JobRow } from "@/lib/supabase/types";
import { SaveBar, SlugField, useAutoSlug } from "./CatalogFormParts";
import { useAutosave } from "./useAutosave";
import {
  Card,
  CardTitle,
  Field,
  Input,
  Label,
  Select,
  Textarea,
  Toggle,
  useFormAction,
} from "./ui";

/**
 * An open position on the careers page. Applications arrive in the inbox
 * (kind "application"), so this form is only the listing itself.
 */
export default function JobForm({
  job,
  today,
  justCreated = false,
}: {
  job?: JobRow;
  /**
   * Today in Manila ('YYYY-MM-DD'), from the server — so the "closing date has
   * passed" hint renders the same on the server and in the browser.
   */
  today: string;
  justCreated?: boolean;
}) {
  const router = useRouter();
  const [closesAt, setClosesAt] = useState(job?.closes_at?.slice(0, 10) ?? "");
  const slug = useAutoSlug(job?.slug);

  // the action reaches `autosave` through a closure — it only runs on submit
  const { result, pending, formProps } = useFormAction((fd) => autosave.wrapSave(saveJob)(fd), {
    onSuccess: (r) => {
      if (!job && r.id) router.replace(`/admin/careers/${r.id}?created=1`);
    },
  });
  // an existing role's fields autosave as you type; slug / visibility / order need Save
  const autosave = useAutosave(formProps.ref, {
    entity: "jobs",
    id: job?.id,
    updatedAt: job?.updated_at,
  });
  const fieldError = autosave.fieldError;

  const shown =
    result ??
    (justCreated
      ? { ok: true, message: "Role created. Keep editing, or publish it when it's ready." }
      : null);
  const passed = Boolean(closesAt) && closesAt < today;

  return (
    <form {...formProps} className="space-y-6">
      <Card>
        <CardTitle hint="How the role is introduced on /careers and its own page.">The role</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" error={fieldError("title")}>
            <Input
              name="title"
              required
              maxLength={120}
              defaultValue={job?.title ?? ""}
              placeholder="Frontend Developer"
              onChange={(e) => slug.follow(e.target.value)}
            />
          </Field>

          <SlugField
            slug={slug.slug}
            onEdit={slug.edit}
            base={PUBLIC_PATH.job}
            saved={job?.slug}
            published={job?.published}
            placeholder="frontend-developer"
            error={fieldError("slug")}
          />

          <Field label="Department (optional)" error={fieldError("department")}>
            <Input
              name="department"
              maxLength={80}
              defaultValue={job?.department ?? ""}
              placeholder="Engineering"
            />
          </Field>

          <Field label="Location (optional)" error={fieldError("location")}>
            <Input
              name="location"
              maxLength={120}
              defaultValue={job?.location ?? ""}
              placeholder="Dipolog City"
            />
          </Field>

          <Field label="Employment type" error={fieldError("employment_type")}>
            <Select name="employment_type" defaultValue={job?.employment_type ?? "full-time"}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Workplace" error={fieldError("workplace")}>
            <Select name="workplace" defaultValue={job?.workplace ?? "onsite"}>
              {WORKPLACES.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Summary"
            hint="One or two lines, used on the careers index."
            className="sm:col-span-2"
            error={fieldError("summary")}
          >
            <Input name="summary" maxLength={400} defaultValue={job?.summary ?? ""} />
          </Field>

          <Field
            label="Description"
            hint="The team, the work, and what the first months look like. Leave a blank line between paragraphs."
            className="sm:col-span-2"
            error={fieldError("description")}
          >
            <Textarea
              name="description"
              rows={7}
              maxLength={6000}
              defaultValue={job?.description ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle hint={`One per line — commas stay part of the text. Up to ${MAX_LIST_ITEMS} each; duplicates are dropped.`}>
          The details
        </CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Responsibilities" error={fieldError("responsibilities")}>
            <Textarea
              name="responsibilities"
              rows={7}
              defaultValue={(job?.responsibilities ?? []).join("\n")}
            />
          </Field>
          <Field label="Requirements" error={fieldError("requirements")}>
            <Textarea
              name="requirements"
              rows={7}
              defaultValue={(job?.requirements ?? []).join("\n")}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Publishing</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Visibility</Label>
            <Toggle name="published" defaultChecked={job?.published ?? false}>
              Published — listed on the careers page
            </Toggle>
          </div>

          <Field
            label="Closing date (optional)"
            hint={
              passed
                ? "This date has passed — the role won't be listed, and its page will say it has closed."
                : "The last day applications are accepted (Manila time). Blank = open until you unpublish it."
            }
            error={fieldError("closes_at")}
          >
            <Input
              name="closes_at"
              type="date"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </Field>

          {job ? (
            <Field label="Sort order" hint="Lower numbers come first." error={fieldError("sort_order")}>
              <Input
                name="sort_order"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                step={1}
                defaultValue={job.sort_order}
              />
            </Field>
          ) : (
            <p className="self-end text-sm leading-relaxed text-ink/55 sm:col-span-2">
              New roles go to the end of the list — reorder them from the Careers page.
            </p>
          )}
        </div>
      </Card>

      <input type="hidden" name="id" value={job?.id ?? ""} />
      <input {...autosave.tokenInputProps} />

      <SaveBar
        result={shown}
        pending={pending}
        uploading={0}
        autosave={autosave}
        isNew={!job}
        noun="role"
        backHref="/admin/careers"
        viewHref={job?.published ? `${PUBLIC_PATH.job}/${job.slug}` : undefined}
      />
    </form>
  );
}
