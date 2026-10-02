"use client";

import { useRef } from "react";
import { saveMember, deleteMember } from "@/app/admin/content-actions";
import type { TeamMemberRow } from "@/lib/supabase/types";
import { Banner, Field, Input, Label, SubmitButton, Toggle, useFormAction } from "./ui";

/**
 * Create/edit one person on the PUBLIC roster shown on /about.
 *
 * Not the same thing as /admin/team, which manages panel logins — someone can
 * appear on the website without an account, and giving someone an account must
 * not put them on the marketing page. The two lists are separate tables.
 */
export default function MemberForm({
  mode,
  member,
  nextOrder = 0,
}: {
  mode: "create" | "edit";
  member?: TeamMemberRow;
  /** default position for a new member — the end of the list */
  nextOrder?: number;
}) {
  const editing = mode === "edit" && member ? member : null;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const save = useFormAction(saveMember, {
    onSuccess: (_r, form) => {
      if (editing) return;
      form?.reset();
      if (detailsRef.current) detailsRef.current.open = false;
    },
  });
  const del = useFormAction(deleteMember);

  return (
    <details ref={detailsRef} className="group w-full md:w-auto">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-mist/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 [&::-webkit-details-marker]:hidden">
        {editing ? "Edit" : "Add member"}
        <span aria-hidden className="transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <form {...save.formProps} className="mt-4 w-full space-y-4 md:w-[30rem]">
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <Field label="Name" error={save.fieldError("name")}>
          <Input
            name="name"
            required
            maxLength={120}
            defaultValue={member?.name ?? ""}
            placeholder="James Vincent Calunsag"
            autoComplete="off"
          />
        </Field>

        <Field label="Role" error={save.fieldError("role")}>
          <Input
            name="role"
            maxLength={160}
            defaultValue={member?.role ?? ""}
            placeholder="UI/UX Designer"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Initials" hint="Blank = derived from the name." error={save.fieldError("initials")}>
            <Input
              name="initials"
              maxLength={4}
              defaultValue={member?.initials ?? ""}
              placeholder="JC"
              className="uppercase"
              autoComplete="off"
            />
          </Field>
          <Field label="Order" hint="Lower shows first." error={save.fieldError("sort_order")}>
            <Input
              name="sort_order"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              step={1}
              defaultValue={member?.sort_order ?? nextOrder}
            />
          </Field>
        </div>

        <div>
          <Label>Visibility</Label>
          <Toggle name="published" defaultChecked={member?.published ?? true}>
            Show on /about
          </Toggle>
        </div>

        <Banner result={save.result} />

        <SubmitButton pending={save.pending} pendingLabel="Saving…">
          {editing ? "Save changes" : "Add to roster"}
        </SubmitButton>
      </form>

      {editing && (
        <form
          {...del.formProps}
          onSubmit={(e) => {
            if (!window.confirm(`Remove ${editing.name} from the public roster on /about?`)) {
              e.preventDefault();
              return;
            }
            del.formProps.onSubmit(e);
          }}
          className="mt-3 space-y-3 md:w-[30rem]"
        >
          <input type="hidden" name="id" value={editing.id} />
          <Banner result={del.result} />
          <SubmitButton variant="danger" pending={del.pending} pendingLabel="Removing…">
            Remove {editing.name}
          </SubmitButton>
        </form>
      )}
    </details>
  );
}
