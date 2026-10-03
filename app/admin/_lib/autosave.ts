import { CONTENT_TABLES, type ContentEntityType } from "@/lib/supabase/types";

/**
 * Autosave — the pure half, shared by the browser hook
 * (components/admin/useAutosave.ts) and the Route Handler
 * (app/api/admin/autosave/route.ts). No React, no Supabase, no zod: every
 * decision here is a plain function so tests/autosave-logic.test.ts can pin it.
 *
 * A plain module ON PURPOSE (no "use client", no "server-only"): a server
 * module importing a value out of a "use client" file gets a client-reference
 * proxy, not the value.
 *
 * The two rules this file exists to enforce:
 *
 *  1. Only what changed is sent. The reference project pushed its whole local
 *     copy, so an autosave from one tab overwrote another tab's newer edits to
 *     sections it never touched (it later grew `?sections=` to scope pushes).
 *     Here the unit of a write is a SaveUnit — one column, or a few columns
 *     that are only valid together — and only dirty units travel.
 *
 *  2. An edit is dirty until a save that INCLUDED it succeeded. The reference
 *     cleared its pending set before the request returned, so a failed push
 *     (a network blip, a cold function) silently dropped those edits. Here a
 *     field is cleared only by settleDirty() with the server's success in hand,
 *     and only if it wasn't edited again while the request was in flight.
 */

export const AUTOSAVE_ENTITIES = CONTENT_TABLES;
export type AutosaveEntity = ContentEntityType;

export const isAutosaveEntity = (v: unknown): v is AutosaveEntity =>
  typeof v === "string" && (AUTOSAVE_ENTITIES as readonly string[]).includes(v);

/** Quiet time after the last keystroke before a save goes out. */
export const AUTOSAVE_DEBOUNCE_MS = 1000;

/** Failed/offline saves retry on this schedule (the last value repeats). */
export const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000] as const;

export function retryDelay(attempt: number): number {
  const i = Math.max(0, Math.min(Math.floor(attempt), RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[i];
}

/**
 * Never autosaved, whatever the form says:
 *  - slug: a half-typed slug on a published item would break its public URL
 *    mid-keystroke (and collide with another item's slug just as easily);
 *  - published: publishing is a deliberate act;
 *  - sort_order: so is reordering.
 * They are written by the explicit Save only.
 */
export const NEVER_AUTOSAVE = ["slug", "published", "sort_order"] as const;

/**
 * The smallest thing an autosave writes. Inputs are sent together, columns are
 * written together, and any error on one of `errorKeys` (or a key starting with
 * `errorPrefix`) holds back the whole unit — e.g. a gallery is three parallel
 * arrays that mean nothing apart, and a testimonial quote must not go live
 * without its author.
 */
export type SaveUnit = {
  inputs: readonly string[];
  columns: readonly string[];
  errorKeys: readonly string[];
  errorPrefix?: string;
};

const single = (name: string): SaveUnit => ({ inputs: [name], columns: [name], errorKeys: [name] });
const unit = (
  inputs: string[],
  columns: string[],
  errorKeys: string[] = inputs,
  errorPrefix?: string
): SaveUnit => ({ inputs, columns, errorKeys, ...(errorPrefix ? { errorPrefix } : {}) });

const galleryUnit = unit(["gallery_src", "gallery_caption", "gallery_kind"], ["gallery"], ["gallery"]);

/**
 * Every autosavable input of every editor, by entity. An input that isn't
 * listed here (slug, published, sort_order, id, updated_at, or anything a form
 * adds later) is simply not autosaved — it waits for the explicit Save.
 */
export const SAVE_UNITS: Record<AutosaveEntity, readonly SaveUnit[]> = {
  projects: [
    ...[
      "name",
      "category",
      "url",
      "live_url",
      "year",
      "summary",
      "description",
      // NEEDS_SHOT lands here: clearing the screenshot of a published project
      "img",
      "img2",
      "client",
      "industry",
      "timeline",
      "challenge",
      "approach",
      "outcome",
      "testimonial_role",
      "highlights",
      "tags",
      "stack",
      "team",
    ].map(single),
    // an unattributed quote reads as invented — the pair saves together or not at all
    unit(["testimonial_quote", "testimonial_author"], ["testimonial_quote", "testimonial_author"]),
    unit(["dot1", "dot2", "dot3"], ["dots"]),
    unit(["services", "services_other"], ["services"], ["services"]),
    unit(["result_value", "result_label"], ["results"], ["results"]),
    galleryUnit,
  ],
  services: ["title", "blurb", "detail", "icon", "deliverables"].map(single),
  team_members: ["name", "role", "initials"].map(single),
  site_settings: [
    ...[
      "brand_name",
      "tagline",
      "email",
      "phone",
      "address_line1",
      "address_line2",
      "hours",
      "availability",
      "available",
    ].map(single),
    unit(["social_label", "social_href"], ["socials"], ["socials"], "social_"),
  ],
  products: [
    ...["name", "tagline", "summary", "description", "image", "status", "features"].map(single),
    // half a call-to-action silently doesn't render
    unit(["cta_label", "cta_url"], ["cta_label", "cta_url"]),
    galleryUnit,
  ],
  jobs: [
    "title",
    "department",
    "location",
    "employment_type",
    "workplace",
    "summary",
    "description",
    "closes_at",
    "responsibilities",
    "requirements",
  ].map(single),
  posts: ["title", "excerpt", "body", "cover_image", "author_name", "tags", "published_at"].map(single),
};

const NEVER = new Set<string>(NEVER_AUTOSAVE);

export function unitForInput(entity: AutosaveEntity, name: string): SaveUnit | undefined {
  if (NEVER.has(name)) return undefined;
  return SAVE_UNITS[entity].find((u) => u.inputs.includes(name));
}

/** Would a change to this input be autosaved? (false = it waits for Save) */
export const isAutosaveInput = (entity: AutosaveEntity, name: string) =>
  Boolean(unitForInput(entity, name));

/** Does this field-error key belong to the unit? */
export const unitOwnsError = (u: SaveUnit, key: string) =>
  u.errorKeys.includes(key) || Boolean(u.errorPrefix && key.startsWith(u.errorPrefix));

/**
 * Dirty input names → the units to send and every input those units need.
 * Ineligible names are dropped; a unit appears once however many of its inputs
 * were touched.
 */
export function expandToUnits(entity: AutosaveEntity, names: Iterable<string>) {
  const units: SaveUnit[] = [];
  for (const name of names) {
    const u = unitForInput(entity, name);
    if (u && !units.includes(u)) units.push(u);
  }
  return { units, inputs: units.flatMap((u) => [...u.inputs]) };
}

/**
 * Of the inputs a request carried, the units it carried COMPLETELY. A partial
 * unit (say gallery_src without gallery_caption) would parse as half-empty rows
 * and wipe data, so the server ignores it rather than guess.
 */
export function completeUnits(entity: AutosaveEntity, sent: Iterable<string>) {
  const have = new Set(sent);
  return SAVE_UNITS[entity].filter(
    (u) => u.inputs.every((i) => have.has(i)) && !u.inputs.some((i) => NEVER.has(i))
  );
}

// ---------------------------------------------------------------------------
// dirty bookkeeping
// ---------------------------------------------------------------------------

/**
 * name → version. Every edit bumps the field's version, so a save can tell
 * "still the value I sent" from "edited again while I was in flight".
 */
export type DirtyState = { readonly versions: Readonly<Record<string, number>>; readonly clock: number };
export type DirtySnapshot = Readonly<Record<string, number>>;

export const emptyDirty = (): DirtyState => ({ versions: {}, clock: 0 });

export function markDirty(s: DirtyState, name: string): DirtyState {
  const clock = s.clock + 1;
  return { clock, versions: { ...s.versions, [name]: clock } };
}

/**
 * A Save-only field (slug, published, sort_order) typed back to the value it
 * was loaded with is no longer a pending change — otherwise "URL, visibility or
 * order changes need Save" nags about nothing. Only for those fields: an
 * autosaved field back at its loaded value may still differ from what the
 * server now holds, so it must still be sent.
 */
export function revertSaveOnly(s: DirtyState, name: string): DirtyState {
  if (!NEVER.has(name) || !(name in s.versions)) return s;
  const versions = { ...s.versions };
  delete versions[name];
  return { clock: s.clock, versions };
}

export const isSaveOnly = (name: string) => NEVER.has(name);

export const dirtyNames = (s: DirtyState) => Object.keys(s.versions);
export const isDirty = (s: DirtyState) => dirtyNames(s).length > 0;

/** The versions of `names` (default: everything dirty) at the moment values are read. */
export function snapshotDirty(s: DirtyState, names: Iterable<string> = dirtyNames(s)): DirtySnapshot {
  const snap: Record<string, number> = {};
  for (const n of names) if (n in s.versions) snap[n] = s.versions[n];
  return snap;
}

/**
 * A save that included `saved` SUCCEEDED: clear each of those fields — but only
 * if it is still at the version the request carried. An edit made during the
 * request stays dirty and goes in the next one. Call this only with the
 * server's success in hand; a failed save calls nothing, so its fields stay
 * dirty by construction.
 */
export function settleDirty(s: DirtyState, snapshot: DirtySnapshot, saved: Iterable<string>): DirtyState {
  const versions = { ...s.versions };
  let changed = false;
  for (const n of saved) {
    if (n in snapshot && versions[n] === snapshot[n]) {
      delete versions[n];
      changed = true;
    }
  }
  return changed ? { clock: s.clock, versions } : s;
}

/**
 * Inputs whose current value the server already refused (a validation error).
 * They stay dirty — nothing was saved — but re-sending the same bad value every
 * second is pointless, so they are parked until edited again (version moves).
 */
export type ParkedState = Readonly<Record<string, number>>;

export function parkInvalid(
  parked: ParkedState,
  snapshot: DirtySnapshot,
  sentUnits: readonly SaveUnit[],
  fieldErrors: Record<string, string> | undefined
): ParkedState {
  const next: Record<string, number> = { ...parked };
  for (const u of sentUnits) {
    const bad = Object.keys(fieldErrors ?? {}).some((k) => unitOwnsError(u, k));
    for (const input of u.inputs) {
      if (bad && input in snapshot) next[input] = snapshot[input];
      else if (!bad) delete next[input];
    }
  }
  return next;
}

/** Dirty, autosavable, and not parked at its current version. */
export function sendableNames(entity: AutosaveEntity, s: DirtyState, parked: ParkedState): string[] {
  return dirtyNames(s).filter((n) => isAutosaveInput(entity, n) && parked[n] !== s.versions[n]);
}

/** Dirty fields only the explicit Save can write (slug, published, sort_order…). */
export const unsavableNames = (entity: AutosaveEntity, s: DirtyState) =>
  dirtyNames(s).filter((n) => !isAutosaveInput(entity, n));

/**
 * After a response: drop the errors of every unit that was just checked, then
 * add what came back. Errors of units that weren't sent are left alone.
 */
export function mergeFieldErrors(
  prev: Record<string, string>,
  sentUnits: readonly SaveUnit[],
  returned: Record<string, string> | undefined
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (!sentUnits.some((u) => unitOwnsError(u, k))) next[k] = v;
  }
  return { ...next, ...(returned ?? {}) };
}

// ---------------------------------------------------------------------------
// wire format
// ---------------------------------------------------------------------------

export type FieldValue = string | string[];
export type AutosaveFields = Record<string, FieldValue>;

/** Form values of `names`. Repeated inputs (and checkbox groups) become arrays; [] = none. */
export function formToFields(fd: FormData, names: Iterable<string>): AutosaveFields {
  const out: AutosaveFields = {};
  for (const name of names) {
    const values = fd.getAll(name).filter((v): v is string => typeof v === "string");
    out[name] = values.length === 1 ? values[0] : values;
  }
  return out;
}

/** The inverse — what the server parses, so autosave and Save read identical FormData. */
export function fieldsToFormData(fields: AutosaveFields): FormData {
  const fd = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(name, v);
  }
  return fd;
}

export type AutosaveRequest = {
  entity: AutosaveEntity;
  id: string | number;
  expectedUpdatedAt: string;
  fields: AutosaveFields;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FIELDS = 80;
const MAX_VALUES = 60;
const MAX_CHARS = 70_000;

/** Validate a request body. Bounded, so a crafted payload can't make the server parse megabytes. */
export function parseAutosaveRequest(body: unknown): AutosaveRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "Expected a JSON object." };
  const b = body as Record<string, unknown>;
  if (!isAutosaveEntity(b.entity)) return { error: "Unknown entity." };
  const entity = b.entity;

  let id: string | number;
  if (entity === "site_settings") {
    if (b.id !== 1 && b.id !== "1") return { error: "Invalid id." };
    id = 1;
  } else {
    if (typeof b.id !== "string" || !UUID_RE.test(b.id)) return { error: "Invalid id." };
    id = b.id;
  }

  const expected = b.expectedUpdatedAt;
  if (typeof expected !== "string" || !expected || expected.length > 64) {
    return { error: "Missing version — reload the page." };
  }

  if (!b.fields || typeof b.fields !== "object" || Array.isArray(b.fields)) {
    return { error: "Missing fields." };
  }
  const entries = Object.entries(b.fields as Record<string, unknown>);
  if (entries.length > MAX_FIELDS) return { error: "Too many fields." };
  const fields: AutosaveFields = {};
  for (const [name, value] of entries) {
    if (typeof value === "string") {
      if (value.length > MAX_CHARS) return { error: `${name} is too long.` };
      fields[name] = value;
    } else if (Array.isArray(value) && value.length <= MAX_VALUES && value.every((v) => typeof v === "string")) {
      if (value.some((v) => v.length > MAX_CHARS)) return { error: `${name} is too long.` };
      fields[name] = value as string[];
    } else {
      return { error: `Invalid value for ${name}.` };
    }
  }
  return { entity, id, expectedUpdatedAt: expected, fields };
}

/** Somebody else's newer save, as the server describes it. */
export type ConflictInfo = {
  /** the row's current updated_at — "Keep mine" expects this next */
  updatedAt: string;
  /** who changed it last (activity_log), when known */
  by: string | null;
  /** when the newer version was saved (the row's updated_at) */
  at: string | null;
  /** it was you, in another tab */
  self: boolean;
};

export type AutosaveResponse =
  | { ok: true; updatedAt: string; saved: string[]; fieldErrors?: Record<string, string> }
  | { ok: false; conflict: ConflictInfo }
  | { ok: false; gone: true; error: string }
  | { ok: false; error: string; retry?: boolean };

export type AutosaveOutcome =
  | { kind: "saved"; updatedAt: string; saved: string[]; fieldErrors: Record<string, string> }
  | { kind: "conflict"; conflict: ConflictInfo }
  | { kind: "gone"; message: string }
  /** signed out / access revoked — keep everything, retry later */
  | { kind: "auth"; message: string }
  /** network, timeout, 5xx, rate limit — retry with backoff */
  | { kind: "retry"; message: string; offline: boolean }
  /** the server refused the request itself — retrying the same thing won't help */
  | { kind: "fatal"; message: string };

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";

/**
 * HTTP status + parsed body (or null when it didn't parse / the network
 * failed: status 0) → what the hook does next.
 */
export function classifyAutosave(status: number, body: unknown): AutosaveOutcome {
  const b = isRecord(body) ? body : null;
  const message = typeof b?.error === "string" ? b.error : "";

  if (status === 0) {
    return { kind: "retry", message: "Offline — will retry", offline: true };
  }
  if (status >= 200 && status < 300) {
    if (b?.ok === true && typeof b.updatedAt === "string" && Array.isArray(b.saved)) {
      return {
        kind: "saved",
        updatedAt: b.updatedAt,
        saved: b.saved.filter((s): s is string => typeof s === "string"),
        fieldErrors: isRecord(b.fieldErrors) ? (b.fieldErrors as Record<string, string>) : {},
      };
    }
    return { kind: "retry", message: "Unexpected reply from the server — will retry", offline: false };
  }
  if (status === 409 && isRecord(b?.conflict) && typeof b.conflict.updatedAt === "string") {
    const c = b.conflict;
    return {
      kind: "conflict",
      conflict: {
        updatedAt: c.updatedAt as string,
        by: typeof c.by === "string" && c.by ? c.by : null,
        at: typeof c.at === "string" ? c.at : null,
        self: c.self === true,
      },
    };
  }
  if (status === 410) {
    return { kind: "gone", message: message || "This item was deleted in another tab." };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: message || "Your session has expired — sign in again in another tab. Your edits are kept here.",
    };
  }
  if (status === 408 || status === 429 || status >= 500) {
    if (b && b.retry === false) return { kind: "fatal", message: message || "Couldn't save." };
    return { kind: "retry", message: message || "Couldn't reach the server — will retry", offline: false };
  }
  return { kind: "fatal", message: message || "Couldn't save." };
}

// ---------------------------------------------------------------------------
// wording
// ---------------------------------------------------------------------------

export type AutosavePhase =
  | "idle"
  | "saving"
  | "saved"
  /** some fields were refused by validation; they stay dirty until edited */
  | "invalid"
  | "offline"
  | "retrying"
  | "auth"
  | "error"
  | "conflict"
  | "gone";

export type StatusTone = "muted" | "ok" | "warn" | "error";

/**
 * Leaving the form inside the panel (Back, Cancel): ask first only when edits
 * would really be lost. Autosavable edits in a healthy session are sent on the
 * way out (keepalive), so they don't need a prompt; edits only Save can write,
 * a new item, or a session that can't save right now (conflict, offline,
 * refused fields…) do.
 */
export function leaveNeedsConfirm(s: {
  enabled: boolean;
  dirty: boolean;
  needsSave: boolean;
  phase: AutosavePhase;
}): boolean {
  if (!s.dirty) return false;
  if (!s.enabled || s.needsSave) return true;
  return ["conflict", "gone", "offline", "retrying", "auth", "error", "invalid"].includes(s.phase);
}

/**
 * The one line in the save bar. `announce` is false for the transient states
 * (typing, saving) so a screen reader isn't told "Saving… Saved" after every
 * pause — only outcomes are announced.
 */
export function autosaveLabel(s: {
  enabled: boolean;
  phase: AutosavePhase;
  message: string | null;
  savedAt: Date | null;
  /** autosavable edits not yet sent */
  waiting: boolean;
  /** edits only the Save button can write */
  needsSave: boolean;
  /** anything dirty at all (new items) */
  dirty: boolean;
}): { text: string; tone: StatusTone; announce: boolean; rest?: true } | null {
  if (!s.enabled) return s.dirty ? { text: "Unsaved changes", tone: "muted", announce: false } : null;
  switch (s.phase) {
    case "conflict":
      return { text: "Conflict — choose a version above", tone: "error", announce: true };
    case "gone":
      return { text: s.message ?? "Deleted in another tab", tone: "error", announce: true };
    case "saving":
      return { text: "Saving…", tone: "muted", announce: false };
    case "offline":
      return { text: "Offline — will retry", tone: "warn", announce: true };
    case "retrying":
      return { text: s.message ?? "Couldn't reach the server — will retry", tone: "warn", announce: true };
    case "auth":
      return { text: "Signed out — sign in again in another tab; edits are kept", tone: "warn", announce: true };
    case "error":
      return { text: s.message ? `Couldn't save — ${s.message}` : "Couldn't save", tone: "error", announce: true };
    case "invalid":
      return { text: "Couldn't save some fields", tone: "error", announce: true };
  }
  if (s.waiting) return { text: "Unsaved changes", tone: "muted", announce: false };
  if (s.needsSave) return { text: "URL, visibility or order changes need Save", tone: "warn", announce: true };
  if (s.phase === "saved" && s.savedAt) {
    return { text: `Saved · ${formatClock(s.savedAt)}`, tone: "ok", announce: true };
  }
  // nothing pending: the screen-reader region drops any warning it was holding
  return { text: "Autosaves as you type", tone: "muted", announce: false, rest: true };
}

/** 14:41 → "2:41 pm" (the viewer's local clock). */
export function formatClock(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
}

/** "just now" / "3 minutes ago" / "2 hours ago" / "4 days ago". */
export function timeAgo(at: string | null | undefined, now: Date = new Date()): string {
  const t = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) return "recently";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 45) return "just now";
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"} ago`;
  const m = Math.round(s / 60);
  if (m < 60) return unit(m, "minute");
  const h = Math.round(m / 60);
  if (h < 36) return unit(h, "hour");
  return unit(Math.round(h / 24), "day");
}

/** "Alice saved a newer version 3 minutes ago." */
export function conflictHeadline(c: ConflictInfo, now: Date = new Date()): string {
  const when = timeAgo(c.at, now);
  if (c.self) return `You saved a newer version in another tab ${when}.`;
  return `${c.by ?? "Someone"} saved a newer version ${when}.`;
}
