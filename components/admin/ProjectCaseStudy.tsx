"use client";

import { useId, useState } from "react";
import type { GalleryShot, ProjectResult } from "@/lib/supabase/types";
import ImageField from "./ImageField";
import { Field, Input, Select } from "./ui";

/*
 * The case-study controls of the project form. Kept out of ProjectForm.tsx so
 * that file stays about the basics. Everything here submits through the same
 * <form>: repeating rows use repeated input names (result_value, gallery_src…),
 * which the server action reads back with getAll() as parallel arrays.
 *
 * Autosave treats each set of parallel arrays as ONE unit (results, gallery —
 * see app/admin/_lib/autosave.ts), always sent whole. Typing in a row fires a
 * native input event the form's autosave hears by itself; adding, removing or
 * reordering rows (and an upload landing) don't, so every such change calls
 * `onChange` — the form passes autosave's markDirty for the group.
 */

const chipBase =
  "inline-flex cursor-pointer select-none items-center rounded-full border border-mist/70 px-3.5 py-1.5 text-sm text-ink/70 transition-colors hover:border-mist peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-accent-to/40";

/** A row of toggle chips backed by real checkboxes (one repeated name). */
export function CheckChips({
  legend,
  hint,
  name,
  options,
  selected,
  empty,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: string[];
  selected: string[];
  /** shown when there's nothing to pick from yet */
  empty?: string;
}) {
  const hintId = useId();
  // keep anything already saved visible even if it's no longer an option
  // (e.g. someone who has since left the roster), so a save can't drop it
  const all = [...new Set([...options, ...selected])];

  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-2 font-mono text-[11px] uppercase tracking-widest text-slatey">
        {legend}
      </legend>
      {all.length ? (
        <div className="flex flex-wrap gap-2">
          {all.map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                name={name}
                value={o}
                defaultChecked={selected.includes(o)}
                className="peer sr-only"
              />
              <span className={chipBase}>{o}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/45">{empty}</p>
      )}
      {hint && (
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-ink/45">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

const rowButton =
  "rounded-full border border-mist/70 px-3 py-1.5 text-xs text-ink/65 transition-colors hover:border-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40";

let seq = 0;
const key = () => `r${++seq}`;

/** Up to `max` headline numbers. Real, measured figures only. */
export function ResultsEditor({
  initial,
  max,
  error,
  onChange,
}: {
  initial: ProjectResult[];
  max: number;
  error?: string;
  onChange: () => void;
}) {
  const [rows, setRows] = useState(() => initial.map((r) => ({ ...r, key: key() })));

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <p className="text-sm text-ink/45">
          No results yet. Only add a number you can stand behind — leave this empty rather than
          estimate.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={r.key} className="grid items-end gap-3 sm:grid-cols-[140px_1fr_auto]">
          <Field label={`Result ${i + 1} — number`}>
            <Input
              name="result_value"
              defaultValue={r.value}
              maxLength={16}
              placeholder="3×"
            />
          </Field>
          <Field label="What it measures">
            <Input
              name="result_label"
              defaultValue={r.label}
              maxLength={80}
              placeholder="faster order checkout"
            />
          </Field>
          <button
            type="button"
            className={rowButton}
            onClick={() => {
              setRows((rs) => rs.filter((x) => x.key !== r.key));
              onChange();
            }}
          >
            Remove
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        className={rowButton}
        disabled={rows.length >= max}
        onClick={() => {
          setRows((rs) => [...rs, { value: "", label: "", key: key() }]);
          onChange();
        }}
      >
        + Add a result{rows.length >= max ? ` (max ${max})` : ""}
      </button>
    </div>
  );
}

/** Extra screens beyond the two main shots: upload, caption, desktop/mobile, order. */
export function GalleryEditor({
  initial,
  max,
  error,
  onChange,
  onBusyChange,
}: {
  initial: GalleryShot[];
  max: number;
  error?: string;
  onChange: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [rows, setRows] = useState(() => initial.map((g) => ({ ...g, key: key() })));

  const move = (from: number, to: number) => {
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    onChange();
  };

  return (
    <div className="space-y-5">
      {rows.length === 0 && (
        <p className="text-sm text-ink/45">
          No extra screens yet. Add the views that tell the story — onboarding, a key flow, the
          mobile app.
        </p>
      )}
      {rows.map((g, i) => (
        // keyed by a stable id, so reordering moves each ImageField (and its
        // upload state) with its row instead of swapping values underneath it
        <div key={g.key} className="rounded-2xl border border-mist/70 p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <ImageField
              name="gallery_src"
              label={`Screen ${i + 1}`}
              defaultValue={g.src}
              hint={
                g.kind === "mobile"
                  ? "A phone capture at its native size."
                  : "Capture at 1536px wide or more — never upscaled."
              }
              onBusyChange={onBusyChange}
              onValueChange={onChange}
            />
            <div className="space-y-4">
              <Field label="Caption (optional)">
                <Input
                  name="gallery_caption"
                  defaultValue={g.caption ?? ""}
                  maxLength={200}
                  placeholder="Creator dashboard — weekly view"
                />
              </Field>
              <Field label="Shown as">
                <Select
                  name="gallery_kind"
                  defaultValue={g.kind}
                  onChange={(e) => {
                    const kind = e.target.value === "mobile" ? "mobile" : "desktop";
                    setRows((rs) => rs.map((x) => (x.key === g.key ? { ...x, kind } : x)));
                  }}
                >
                  <option value="desktop">Desktop screen</option>
                  <option value="mobile">Mobile screen</option>
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={rowButton}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  aria-label={`Move screen ${i + 1} up`}
                >
                  ↑ Up
                </button>
                <button
                  type="button"
                  className={rowButton}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label={`Move screen ${i + 1} down`}
                >
                  ↓ Down
                </button>
                <button
                  type="button"
                  className={`${rowButton} ml-auto border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400`}
                  onClick={() => {
                    setRows((rs) => rs.filter((x) => x.key !== g.key));
                    onChange();
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        className={rowButton}
        disabled={rows.length >= max}
        onClick={() => {
          setRows((rs) => [...rs, { src: "", caption: "", kind: "desktop", key: key() }]);
          onChange();
        }}
      >
        + Add a screen{rows.length >= max ? ` (max ${max})` : ""}
      </button>
    </div>
  );
}
