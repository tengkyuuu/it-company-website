"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Field, Input, SubmitButton, type FormResult } from "./ui";

/*
 * Pieces shared by the product, job and post forms — the same behaviour the
 * project form has (slug follows the title until edited, unsaved-changes
 * guard, sticky save bar), factored out once there were three more forms.
 * ProjectForm keeps its own copy; it predates these.
 */

/** "Rally's Équities" -> "rallys-equities" */
export function slugify(s: string) {
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

/**
 * Slug state. On a NEW item it follows the title (`follow`) until someone
 * edits it by hand (`edit`); an existing item's slug never moves on its own —
 * it's a public URL.
 */
export function useAutoSlug(saved: string | undefined) {
  const [slug, setSlug] = useState(saved ?? "");
  const [touched, setTouched] = useState(Boolean(saved));
  return {
    slug,
    follow: (source: string) => {
      if (!touched) setSlug(slugify(source));
    },
    edit: (value: string) => {
      setTouched(true);
      setSlug(value.toLowerCase().replace(/\s+/g, "-"));
    },
  };
}

/** Closing the tab / reloading with unsaved edits asks first. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

export function SlugField({
  slug,
  onEdit,
  base,
  saved,
  published,
  placeholder,
  error,
}: {
  slug: string;
  onEdit: (value: string) => void;
  /** the public prefix, e.g. "/products" */
  base: string;
  /** the slug currently in the database (edit forms) */
  saved?: string;
  /** renaming a live item breaks links — say so */
  published?: boolean;
  placeholder: string;
  error?: string;
}) {
  const renaming = Boolean(published && saved && slug !== saved);
  return (
    <Field
      label="Slug"
      hint={
        renaming
          ? `Changes the public URL — links to ${base}/${saved} will stop working.`
          : `The URL: ${base}/${slug || "your-slug"}`
      }
      error={error}
    >
      <Input
        name="slug"
        required
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        title="Lowercase letters, numbers and single hyphens"
        maxLength={60}
        value={slug}
        onChange={(e) => onEdit(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </Field>
  );
}

/**
 * Sticky so the save button and its result are always in reach on a long
 * form — the banner sits right where the eye is after clicking.
 */
export function SaveBar({
  result,
  pending,
  uploading,
  dirty,
  isNew,
  noun,
  backHref,
  viewHref,
}: {
  result: FormResult | { ok: boolean; message: string } | null;
  pending: boolean;
  /** uploads in flight — saving now would store an empty image */
  uploading: number;
  dirty: boolean;
  isNew: boolean;
  /** "product", "role", "post" */
  noun: string;
  backHref: string;
  /** the public page, when there is one to view */
  viewHref?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 space-y-3 rounded-2xl border border-mist/70 bg-paper/90 p-3 backdrop-blur-xl md:p-4">
      <Banner result={result} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pending={pending}
          disabled={uploading > 0}
          pendingLabel={isNew ? "Creating…" : "Saving…"}
        >
          {uploading > 0 ? "Waiting for upload…" : isNew ? `Create ${noun}` : "Save changes"}
        </SubmitButton>
        <Link
          href={backHref}
          onClick={(e) => {
            if (dirty && !window.confirm("Discard your unsaved changes?")) e.preventDefault();
          }}
          className="rounded-full border border-mist/70 px-5 py-2.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
        >
          {isNew ? "Cancel" : "Back"}
        </Link>
        {dirty && !pending && (
          <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
            Unsaved changes
          </span>
        )}
        {viewHref && (
          <Link
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm text-ink/55 transition-colors hover:text-ink"
          >
            View on site ↗
          </Link>
        )}
      </div>
    </div>
  );
}
