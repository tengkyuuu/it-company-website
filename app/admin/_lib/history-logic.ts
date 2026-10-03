import { CONTENT_TABLES, type ContentEntityType } from "@/lib/supabase/types";

/**
 * Pure logic behind the panel's history, restore, "recently deleted" and
 * activity feed. A plain module ON PURPOSE — no "server-only", no Supabase, no
 * React — so tests/history-logic.test.ts can pin every rule without a database
 * and the server loaders (./history.ts) stay thin.
 *
 * Vocabulary: a *revision* is content_revisions' snapshot of a row as it was
 * just BEFORE a change (the trigger stores to_jsonb(OLD)). So the change a
 * revision "belongs to" is the difference between its snapshot and the next
 * newer version — the next revision's snapshot, or the live row for the newest.
 */

/** content_revisions keeps this many per item (the trigger prunes to it; restore backups too). */
export const REVISION_KEEP = 20;

/** Coalescing window of the revision trigger, in ms (one snapshot per editor per window). */
export const COALESCE_MS = 5 * 60 * 1000;

/**
 * Reserved key inside a snapshot that marks a revision written by server code
 * rather than the trigger (today: the backup taken right before a restore).
 * Column names never start with "__", so it can't collide with real data, and
 * restore drops it (it isn't a column). Schema-free on purpose — see the
 * report for the `kind` column this could become.
 */
export const META_KEY = "__revision";

export type RevisionMeta = {
  kind: "pre-restore";
  /** the revision whose restore this backup preceded */
  restoring_revision_id: number;
};

/** Never written back from a snapshot (identity + bookkeeping the database owns). */
export const NEVER_RESTORED = new Set(["id", "created_at", "updated_at"]);

const IDENT = /^[a-z_][a-z0-9_]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isMetaKey = (k: string) => k.startsWith("__");

export function isContentTable(v: unknown): v is ContentEntityType {
  return typeof v === "string" && (CONTENT_TABLES as readonly string[]).includes(v);
}

/** entity_id as content_revisions / activity_log store it: '1' for site_settings, else a uuid. */
export function isValidEntityId(table: ContentEntityType, id: unknown): id is string {
  if (typeof id !== "string") return false;
  return table === "site_settings" ? id === "1" : UUID.test(id);
}

/** The value to `.eq("id", …)` on: site_settings' id is an integer. */
export const rowIdFor = (table: ContentEntityType, entityId: string): string | number =>
  table === "site_settings" ? 1 : entityId;

// ---------------------------------------------------------------------------
// entities
// ---------------------------------------------------------------------------

type EntityInfo = {
  /** "the project “X”" */
  noun: string;
  /** filter label on /admin/activity */
  section: string;
  listHref: string;
  /** where its editor lives (services / roster edit inline on the list page) */
  editHref: (id: string) => string;
  /** how a publish flip reads for this kind of item (active / passive voice) */
  publishWords: { on: string; off: string; onPassive: string; offPassive: string };
};

const PUBLISH = { on: "published", off: "unpublished", onPassive: "published", offPassive: "unpublished" };

export const ENTITY: Record<ContentEntityType, EntityInfo> = {
  projects: {
    noun: "project",
    section: "Projects",
    listHref: "/admin/projects",
    editHref: (id) => `/admin/projects/${id}`,
    publishWords: PUBLISH,
  },
  products: {
    noun: "product",
    section: "Products",
    listHref: "/admin/products",
    editHref: (id) => `/admin/products/${id}`,
    publishWords: PUBLISH,
  },
  services: {
    noun: "service",
    section: "Services",
    listHref: "/admin/services",
    editHref: () => "/admin/services",
    publishWords: { on: "made live", off: "hid", onPassive: "made live", offPassive: "hidden" },
  },
  posts: {
    noun: "post",
    section: "Blog",
    listHref: "/admin/blog",
    editHref: (id) => `/admin/blog/${id}`,
    publishWords: PUBLISH,
  },
  jobs: {
    noun: "role",
    section: "Careers",
    listHref: "/admin/careers",
    editHref: (id) => `/admin/careers/${id}`,
    publishWords: PUBLISH,
  },
  team_members: {
    noun: "roster entry",
    section: "Roster",
    listHref: "/admin/roster",
    editHref: () => "/admin/roster",
    publishWords: { on: "showed", off: "hid", onPassive: "shown", offPassive: "hidden" },
  },
  site_settings: {
    noun: "site settings",
    section: "Site settings",
    listHref: "/admin/settings",
    editHref: () => "/admin/settings",
    publishWords: PUBLISH,
  },
};

/** The name a row goes by — same precedence as the activity trigger's detail.label. */
export function entityLabel(table: ContentEntityType | string, row: Record<string, unknown> | null) {
  if (table === "site_settings") return "Site settings";
  if (!row) return "";
  for (const k of ["name", "title", "slug"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return typeof row.id === "string" ? row.id : "";
}

// ---------------------------------------------------------------------------
// fields
// ---------------------------------------------------------------------------

export type FieldKind =
  | "text"
  | "longtext"
  | "list"
  | "image"
  | "gallery"
  | "pairs"
  | "colors"
  | "bool"
  | "number"
  | "position"
  | "date"
  | "datetime"
  | "enum";

export type FieldDef = {
  label: string;
  kind: FieldKind;
  /** bool: how true / false read */
  yes?: string;
  no?: string;
  /** pairs: the two keys of each object, e.g. ["value", "label"] */
  pair?: [string, string];
  /** enum: value -> label */
  options?: Record<string, string>;
};

const status = (yes: string, no: string): FieldDef => ({ label: "Status", kind: "bool", yes, no });
const order: FieldDef = { label: "Position", kind: "position" };
const slug: FieldDef = { label: "Slug", kind: "text" };
const gallery: FieldDef = { label: "Gallery", kind: "gallery" };

/**
 * Human labels per table, in the order the editor shows them. Also the list of
 * columns a restore can fall back to when it can't learn the live columns from
 * a sample row (an empty table). A column missing here still diffs and
 * restores — it just gets a generated label ("Cta label").
 */
export const FIELDS: Record<ContentEntityType, Record<string, FieldDef>> = {
  projects: {
    name: { label: "Name", kind: "text" },
    slug,
    category: { label: "Category", kind: "text" },
    year: { label: "Year", kind: "text" },
    url: { label: "Display domain", kind: "text" },
    live_url: { label: "Live URL", kind: "text" },
    summary: { label: "Summary", kind: "longtext" },
    description: { label: "Description", kind: "longtext" },
    highlights: { label: "Highlights", kind: "list" },
    tags: { label: "Tags", kind: "list" },
    dots: { label: "Colours", kind: "colors" },
    img: { label: "Main screenshot", kind: "image" },
    img2: { label: "Second screenshot", kind: "image" },
    client: { label: "Client", kind: "text" },
    industry: { label: "Industry", kind: "text" },
    timeline: { label: "Timeline", kind: "text" },
    services: { label: "Services", kind: "list" },
    team: { label: "Team", kind: "list" },
    stack: { label: "Stack", kind: "list" },
    challenge: { label: "Challenge", kind: "longtext" },
    approach: { label: "Approach", kind: "longtext" },
    outcome: { label: "Outcome", kind: "longtext" },
    results: { label: "Results", kind: "pairs", pair: ["value", "label"] },
    gallery,
    testimonial_quote: { label: "Testimonial", kind: "longtext" },
    testimonial_author: { label: "Testimonial author", kind: "text" },
    testimonial_role: { label: "Author's role", kind: "text" },
    published: status("Published", "Draft"),
    sort_order: order,
    embeddable: { label: "Embeddable", kind: "bool", yes: "Yes", no: "No" },
    embed_reason: { label: "Embed check", kind: "text" },
    embed_checked_at: { label: "Embed checked", kind: "datetime" },
  },
  services: {
    title: { label: "Title", kind: "text" },
    slug,
    blurb: { label: "Blurb", kind: "longtext" },
    detail: { label: "Detail", kind: "longtext" },
    deliverables: { label: "Deliverables", kind: "list" },
    icon: { label: "Icon", kind: "text" },
    published: status("Live", "Hidden"),
    sort_order: order,
  },
  team_members: {
    name: { label: "Name", kind: "text" },
    role: { label: "Role", kind: "text" },
    initials: { label: "Initials", kind: "text" },
    published: status("Shown", "Hidden"),
    sort_order: order,
  },
  site_settings: {
    brand_name: { label: "Brand name", kind: "text" },
    tagline: { label: "Tagline", kind: "text" },
    email: { label: "Email", kind: "text" },
    phone: { label: "Phone", kind: "text" },
    address_line1: { label: "Address line 1", kind: "text" },
    address_line2: { label: "Address line 2", kind: "text" },
    hours: { label: "Hours", kind: "text" },
    availability: { label: "Availability note", kind: "text" },
    available: { label: "Taking projects", kind: "bool", yes: "Yes", no: "No" },
    socials: { label: "Social links", kind: "pairs", pair: ["label", "href"] },
  },
  products: {
    name: { label: "Name", kind: "text" },
    slug,
    tagline: { label: "Tagline", kind: "text" },
    status: { label: "Badge", kind: "text" },
    summary: { label: "Summary", kind: "longtext" },
    description: { label: "Description", kind: "longtext" },
    features: { label: "Features", kind: "list" },
    image: { label: "Main image", kind: "image" },
    gallery,
    cta_label: { label: "Button label", kind: "text" },
    cta_url: { label: "Button link", kind: "text" },
    published: status("Published", "Draft"),
    sort_order: order,
  },
  jobs: {
    title: { label: "Title", kind: "text" },
    slug,
    department: { label: "Team", kind: "text" },
    location: { label: "Location", kind: "text" },
    employment_type: {
      label: "Type",
      kind: "enum",
      options: {
        "full-time": "Full-time",
        "part-time": "Part-time",
        contract: "Contract",
        internship: "Internship",
      },
    },
    workplace: {
      label: "Workplace",
      kind: "enum",
      options: { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" },
    },
    summary: { label: "Summary", kind: "longtext" },
    description: { label: "Description", kind: "longtext" },
    responsibilities: { label: "Responsibilities", kind: "list" },
    requirements: { label: "Requirements", kind: "list" },
    closes_at: { label: "Closes", kind: "date" },
    published: status("Published", "Draft"),
    sort_order: order,
  },
  posts: {
    title: { label: "Title", kind: "text" },
    slug,
    excerpt: { label: "Excerpt", kind: "longtext" },
    body: { label: "Body", kind: "longtext" },
    cover_image: { label: "Cover image", kind: "image" },
    tags: { label: "Tags", kind: "list" },
    author_name: { label: "Author", kind: "text" },
    published: status("Published", "Draft"),
    published_at: { label: "Published on", kind: "datetime" },
  },
};

/** "cta_label" -> "Cta label" — for columns added after this file was written. */
export function humanizeKey(key: string) {
  const s = key.replace(/_+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

function guessKind(sample: unknown): FieldKind {
  if (typeof sample === "boolean") return "bool";
  if (typeof sample === "number") return "number";
  if (Array.isArray(sample)) return sample.every((v) => typeof v === "string") ? "list" : "text";
  if (typeof sample === "string" && sample.length > 160) return "longtext";
  return "text";
}

export function fieldDef(table: ContentEntityType, key: string, sample?: unknown): FieldDef {
  return FIELDS[table]?.[key] ?? { label: humanizeKey(key), kind: guessKind(sample) };
}

export const fieldLabel = (table: ContentEntityType, key: string) => fieldDef(table, key).label;

/** Every column this file knows for a table, incl. the ones a restore never writes. */
export function knownColumns(table: ContentEntityType): string[] {
  return ["id", ...Object.keys(FIELDS[table]), "created_at", "updated_at"];
}

/** Table order first (the editor's order), then anything unknown alphabetically. */
function orderKeys(table: ContentEntityType, keys: Iterable<string>) {
  const known = Object.keys(FIELDS[table]);
  const set = new Set(keys);
  return [
    ...known.filter((k) => set.has(k)),
    ...[...set].filter((k) => !known.includes(k)).sort(),
  ];
}

// ---------------------------------------------------------------------------
// value helpers
// ---------------------------------------------------------------------------

/** JSON with sorted object keys, so two jsonb values compare by content. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

export const sameValue = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

/** null, "", [], {} — what a column added later "was" before it existed. */
function isEmptyish(v: unknown) {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

export function truncate(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Short before/after excerpts of two long texts, centred on where they first
 * differ — "…the new cafe opens in **May**…" says more than the first 120
 * characters of a blog body, which are usually identical.
 */
export function excerptPair(a: string, b: string, width = 140): { before: string; after: string } {
  const x = a.replace(/\s+/g, " ").trim();
  const y = b.replace(/\s+/g, " ").trim();
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const start = Math.max(0, i - Math.floor(width / 4));
  const cut = (s: string) => {
    if (!s) return "";
    const body = s.slice(start, start + width);
    return `${start > 0 ? "…" : ""}${body}${start + width < s.length ? "…" : ""}`;
  };
  return { before: cut(x), after: cut(y) };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

function pairStrings(v: unknown, [a, b]: [string, string]): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const o = item as Record<string, unknown>;
      const first = typeof o[a] === "string" ? (o[a] as string) : "";
      const second = typeof o[b] === "string" ? (o[b] as string) : "";
      return b === "href" ? (second ? `${first} (${second})` : first) : [first, second].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

type Shot = { src: string; caption: string; kind: string };
function shots(v: unknown): Shot[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((g) => {
      const o = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
      return {
        src: typeof o.src === "string" ? o.src : "",
        caption: typeof o.caption === "string" ? o.caption : "",
        kind: typeof o.kind === "string" ? o.kind : "",
      };
    })
    .filter((s) => s.src);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-31" -> "Oct 31, 2026" (a calendar date — no time zone involved). */
export function formatDate(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
}

/** One scalar value as a short string. */
export function displayValue(def: FieldDef, v: unknown): string {
  if (v === null || v === undefined) return "(none)";
  if (def.kind === "bool" || typeof v === "boolean") {
    if (typeof v !== "boolean") return String(v);
    return v ? (def.yes ?? "Yes") : (def.no ?? "No");
  }
  if (typeof v === "string") {
    if (!v) return "(empty)";
    if (def.kind === "date") return formatDate(v);
    if (def.kind === "datetime") return formatManila(v);
    if (def.kind === "enum") return def.options?.[v] ?? v;
    return v;
  }
  // sort_order is 0-based; people count list positions from 1
  if (typeof v === "number") return def.kind === "position" ? `#${v + 1}` : String(v);
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

export type FieldChange =
  | { key: string; label: string; type: "text"; before: string; after: string }
  | { key: string; label: string; type: "list"; added: string[]; removed: string[]; note?: string }
  | { key: string; label: string; type: "image"; before: string | null; after: string | null }
  | { key: string; label: string; type: "images"; added: string[]; removed: string[]; note?: string }
  | { key: string; label: string; type: "colors"; before: string[]; after: string[] };

const LIST_CAP = 8;
const ITEM_MAX = 80;
const TEXT_MAX = 160;

function setDiff(before: string[], after: string[]) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: after.filter((x) => !b.has(x)),
    removed: before.filter((x) => !a.has(x)),
  };
}

const capList = (items: string[]) => {
  const shown = items.slice(0, LIST_CAP).map((s) => truncate(s, ITEM_MAX));
  return items.length > LIST_CAP ? [...shown, `+${items.length - LIST_CAP} more`] : shown;
};

function changeFor(def: FieldDef, key: string, before: unknown, after: unknown): FieldChange | null {
  const base = { key, label: def.label };
  switch (def.kind) {
    case "image": {
      const s = (v: unknown) => (typeof v === "string" && v ? v : null);
      return { ...base, type: "image", before: s(before), after: s(after) };
    }
    case "gallery": {
      const b = shots(before);
      const a = shots(after);
      const { added, removed } = setDiff(
        b.map((s) => s.src),
        a.map((s) => s.src)
      );
      let note: string | undefined;
      if (!added.length && !removed.length) {
        note = sameValue(
          b.map((s) => s.src),
          a.map((s) => s.src)
        )
          ? "Captions edited"
          : "Reordered";
      }
      return { ...base, type: "images", added, removed, ...(note ? { note } : {}) };
    }
    case "colors":
      return { ...base, type: "colors", before: strings(before), after: strings(after) };
    case "list":
    case "pairs": {
      const b = def.kind === "pairs" ? pairStrings(before, def.pair ?? ["label", "value"]) : strings(before);
      const a = def.kind === "pairs" ? pairStrings(after, def.pair ?? ["label", "value"]) : strings(after);
      const { added, removed } = setDiff(b, a);
      if (!added.length && !removed.length) {
        if (sameValue(b, a)) {
          // only something we don't display changed (e.g. a non-string entry)
          return { ...base, type: "list", added: [], removed: [], note: "Edited" };
        }
        return { ...base, type: "list", added: [], removed: [], note: "Reordered" };
      }
      return { ...base, type: "list", added: capList(added), removed: capList(removed) };
    }
    case "longtext": {
      const sa = typeof before === "string" ? before : before == null ? "" : JSON.stringify(before);
      const sb = typeof after === "string" ? after : after == null ? "" : JSON.stringify(after);
      if (!sa || !sb) {
        return {
          ...base,
          type: "text",
          before: sa ? truncate(sa, TEXT_MAX) : displayValue(def, before),
          after: sb ? truncate(sb, TEXT_MAX) : displayValue(def, after),
        };
      }
      const { before: x, after: y } = excerptPair(sa, sb);
      return { ...base, type: "text", before: x, after: y };
    }
    default:
      return {
        ...base,
        type: "text",
        before: truncate(displayValue(def, before), TEXT_MAX),
        after: truncate(displayValue(def, after), TEXT_MAX),
      };
  }
}

/**
 * Field-level difference between two versions of one row. Ignores identity and
 * bookkeeping (id, created_at, updated_at) and the reserved meta key. A column
 * present on only one side (added to the schema in between) counts as a change
 * only when the side that has it holds a real value.
 */
export function diffRows(
  table: ContentEntityType,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): FieldChange[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = orderKeys(
    table,
    new Set([...Object.keys(b), ...Object.keys(a)].filter((k) => !NEVER_RESTORED.has(k) && !isMetaKey(k)))
  );
  const out: FieldChange[] = [];
  for (const key of keys) {
    const inB = key in b;
    const inA = key in a;
    if (inB !== inA && isEmptyish(inB ? b[key] : a[key])) continue;
    if (sameValue(b[key], a[key])) continue;
    const change = changeFor(fieldDef(table, key, inA ? a[key] : b[key]), key, b[key], a[key]);
    if (change) out.push(change);
  }
  return out;
}

/** "Title", "Title and Body", "Title, Body and 2 more". */
export function summarizeChanges(changes: { label: string }[]) {
  const labels = changes.map((c) => c.label);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  if (labels.length === 3) return `${labels[0]}, ${labels[1]} and ${labels[2]}`;
  return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`;
}

// ---------------------------------------------------------------------------
// preview (one version, every field)
// ---------------------------------------------------------------------------

export type PreviewField =
  | { key: string; label: string; type: "text"; value: string }
  | { key: string; label: string; type: "longtext"; value: string }
  | { key: string; label: string; type: "list"; items: string[] }
  | { key: string; label: string; type: "image"; url: string | null }
  | { key: string; label: string; type: "images"; items: { src: string; caption: string }[] }
  | { key: string; label: string; type: "colors"; items: string[] };

const PREVIEW_TEXT_MAX = 20_000;

export function buildPreview(table: ContentEntityType, snapshot: Record<string, unknown>): PreviewField[] {
  const keys = orderKeys(
    table,
    Object.keys(snapshot).filter((k) => !NEVER_RESTORED.has(k) && !isMetaKey(k))
  );
  return keys.map((key): PreviewField => {
    const v = snapshot[key];
    const def = fieldDef(table, key, v);
    const base = { key, label: def.label };
    switch (def.kind) {
      case "image":
        return { ...base, type: "image", url: typeof v === "string" && v ? v : null };
      case "gallery":
        return { ...base, type: "images", items: shots(v).map(({ src, caption }) => ({ src, caption })) };
      case "colors":
        return { ...base, type: "colors", items: strings(v) };
      case "list":
        return { ...base, type: "list", items: strings(v) };
      case "pairs":
        return { ...base, type: "list", items: pairStrings(v, def.pair ?? ["label", "value"]) };
      case "longtext":
        return {
          ...base,
          type: "longtext",
          value: typeof v === "string" ? (v.length > PREVIEW_TEXT_MAX ? `${v.slice(0, PREVIEW_TEXT_MAX)}…` : v) : displayValue(def, v),
        };
      default:
        return { ...base, type: "text", value: displayValue(def, v) };
    }
  });
}

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------

/**
 * The part of a snapshot a restore may write back over an existing row: only
 * keys that are CURRENT columns (the schema evolves — a dropped column in an
 * old snapshot is ignored, a column added since keeps its live value), never
 * id / created_at / updated_at, never the meta key.
 */
export function restorableValues(
  snapshot: Record<string, unknown>,
  columns: Iterable<string>
): Record<string, unknown> {
  const cols = new Set(columns);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (!IDENT.test(k) || isMetaKey(k) || NEVER_RESTORED.has(k) || !cols.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Same, for re-inserting a deleted row: keeps its original id. */
export function insertableValues(
  snapshot: Record<string, unknown>,
  columns: Iterable<string>
): Record<string, unknown> {
  const values = restorableValues(snapshot, columns);
  return typeof snapshot.id === "string" || typeof snapshot.id === "number"
    ? { id: snapshot.id, ...values }
    : values;
}

/** Keys of `values` whose value differs from the live row. */
export function differingKeys(values: Record<string, unknown>, current: Record<string, unknown>) {
  return Object.keys(values).filter((k) => !sameValue(values[k], current[k]));
}

export function revisionMeta(snapshot: Record<string, unknown> | null | undefined): RevisionMeta | null {
  const m = snapshot?.[META_KEY];
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  return o.kind === "pre-restore" && typeof o.restoring_revision_id === "number"
    ? { kind: "pre-restore", restoring_revision_id: o.restoring_revision_id }
    : null;
}

export const withRevisionMeta = (row: Record<string, unknown>, meta: RevisionMeta) => ({
  ...row,
  [META_KEY]: meta,
});

/** Ids beyond the newest `keep` — exactly what the trigger's prune deletes. */
export function idsToPrune(ids: number[], keep = REVISION_KEEP): number[] {
  return [...ids].sort((a, b) => b - a).slice(keep);
}

/** "This also unpublishes it." — when a restore flips visibility, the confirm says so. */
export function publishNote(
  table: ContentEntityType,
  now: unknown,
  then: unknown
): string | undefined {
  if (typeof now !== "boolean" || typeof then !== "boolean" || now === then) return undefined;
  if (table === "services") return then ? "This also makes it live on the site." : "This also hides it on the site.";
  if (table === "team_members") {
    return then ? "This also shows them on the roster." : "This also hides them from the roster.";
  }
  return then ? "This also publishes it." : "This also unpublishes it (back to a draft).";
}

// ---------------------------------------------------------------------------
// history entries (the panel's list)
// ---------------------------------------------------------------------------

export type RevisionLite = {
  id: number;
  snapshot: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
};

export type HistoryEntry = {
  id: number;
  at: string;
  when: string;
  ago: string;
  actor: string;
  kind: "edit" | "delete" | "backup";
  changes: FieldChange[];
  summary: string;
  publishNote?: string;
};

export function actorDisplay(actorId: string | null, names: Map<string, string>) {
  if (!actorId) return "System";
  return names.get(actorId) || "A former teammate";
}

const sameInstant = (a: string, b: string) => {
  const x = Date.parse(a);
  const y = Date.parse(b);
  return a === b || (Number.isFinite(x) && x === y);
};

/**
 * Revisions (any order) + the live row → the panel's entries, newest first.
 * Each entry's changes = its snapshot → the next newer version (the live row
 * for the newest; nothing to compare against once the row is gone).
 * `deleteTimes` are activity_log 'delete' timestamps for this item: the
 * delete's revision and log line are written in one transaction, so their
 * created_at match exactly — that's how a DELETE snapshot is recognised.
 */
export function buildHistoryEntries(
  table: ContentEntityType,
  revisions: RevisionLite[],
  current: Record<string, unknown> | null,
  opts: { names: Map<string, string>; deleteTimes?: string[]; now?: Date }
): HistoryEntry[] {
  const now = opts.now ?? new Date();
  const sorted = [...revisions].sort((a, b) => b.id - a.id);
  return sorted.map((rev, i) => {
    const next = i === 0 ? current : sorted[i - 1].snapshot;
    const changes = next ? diffRows(table, rev.snapshot, next) : [];
    const kind: HistoryEntry["kind"] = revisionMeta(rev.snapshot)
      ? "backup"
      : (opts.deleteTimes ?? []).some((t) => sameInstant(t, rev.created_at))
        ? "delete"
        : "edit";
    const note = current ? publishNote(table, current.published, rev.snapshot.published) : undefined;
    return {
      id: rev.id,
      at: rev.created_at,
      when: formatManila(rev.created_at, now),
      ago: relativeTime(rev.created_at, now),
      actor: actorDisplay(rev.actor_id, opts.names),
      kind,
      changes,
      summary: summarizeChanges(changes),
      ...(note ? { publishNote: note } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// recently deleted
// ---------------------------------------------------------------------------

export type RevisionHead = { id: number; entity_id: string; created_at: string; actor_id: string | null };

/**
 * Items that no longer exist, each with its NEWEST revision. A delete always
 * snapshots and nothing can write to a deleted row afterwards, so for a
 * missing item that newest revision is the full row at the moment it was
 * deleted (and its actor/created_at are who deleted it, and when). An item
 * restored since exists again and drops out.
 */
export function latestRevisionPerMissingEntity<T extends RevisionHead>(
  revisions: T[],
  existingIds: Set<string>
): T[] {
  const latest = new Map<string, T>();
  for (const r of revisions) {
    if (existingIds.has(r.entity_id)) continue;
    const seen = latest.get(r.entity_id);
    if (!seen || r.id > seen.id) latest.set(r.entity_id, r);
  }
  return [...latest.values()].sort((a, b) => b.id - a.id);
}

// ---------------------------------------------------------------------------
// activity feed
// ---------------------------------------------------------------------------

export type ActivityLite = {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type SentencePart = string | { label: string };
export type ActivitySentence = { actor: string | null; parts: SentencePart[] };

export type ActionGroup = "content" | "team" | "auth" | "other";

export const CONTENT_ACTIONS = ["create", "update", "delete", "publish", "unpublish"] as const;

export function actionGroup(action: string): ActionGroup {
  if ((CONTENT_ACTIONS as readonly string[]).includes(action)) return "content";
  if (action.startsWith("content.") || action.startsWith("storage.")) return "content";
  if (action.startsWith("team.")) return "team";
  if (action.startsWith("auth.")) return "auth";
  return "other";
}

export const ACTION_GROUPS: { value: Exclude<ActionGroup, "other">; label: string }[] = [
  { value: "content", label: "Content" },
  { value: "team", label: "Team" },
  { value: "auth", label: "Sign-in & passwords" },
];

/**
 * Section filter on /admin/activity → the entity_type values it covers. Team
 * events use 'invitation' / 'team_member' (panel logins — not the public
 * roster, which is 'team_members').
 */
export const ACTIVITY_SECTIONS: { value: string; label: string; entityTypes: string[] }[] = [
  ...CONTENT_TABLES.map((t) => ({ value: t, label: ENTITY[t].section, entityTypes: [t] })),
  { value: "team", label: "Team (logins)", entityTypes: ["invitation", "team_member"] },
  { value: "storage", label: "Storage", entityTypes: ["storage"] },
];

/**
 * Per-message noise that must never reach the feed. Nothing logs these today
 * (the chat route and the rate limiter write no activity rows, by design —
 * the reference project's feed drowned in chat lines); the loader excludes
 * them anyway so a future logger can't flood it.
 */
export const NOISY_ACTION_PREFIXES = ["chat.message", "chat.turn", "limit.", "rate_limit"];

const detailStr = (d: Record<string, unknown> | null, k: string) =>
  d && typeof d[k] === "string" ? (d[k] as string) : "";

/**
 * One activity row as a sentence: "Jhade published the product “X”",
 * "James restored the project “Y” to Sep 28, 10:02 AM", "Olive invited a@b.c".
 * A row with no actor (service-role writes) reads in the passive voice:
 * "Site settings were updated". `label` parts are what the feed links.
 */
export function describeActivity(
  row: ActivityLite,
  opts: { actorName?: string | null; formatTime?: (iso: string) => string } = {}
): ActivitySentence {
  const name = (row.actor_name || opts.actorName || "").trim();
  const actor = name || (row.actor_id ? "Someone" : null);
  const fmt = opts.formatTime ?? ((iso: string) => formatManila(iso));
  const d = row.detail ?? {};
  const label = detailStr(d, "label") || row.entity_id || "";
  const who = detailStr(d, "email") || detailStr(d, "label") || row.entity_id;
  const say = (active: SentencePart[], passive: SentencePart[]): ActivitySentence =>
    actor ? { actor, parts: active } : { actor: null, parts: passive };

  if (isContentTable(row.entity_type)) {
    const t = row.entity_type;
    const info = ENTITY[t];
    const settings = t === "site_settings";
    const object: SentencePart[] = settings ? ["the site settings"] : [`the ${info.noun} `, { label }];
    const Subject: SentencePart[] = settings ? ["Site settings"] : [`The ${info.noun} `, { label }];
    const was = settings ? " were" : " was";

    switch (row.action) {
      case "create":
        return say(["created ", ...object], [...Subject, `${was} created`]);
      case "update":
        return say(["updated ", ...object], [...Subject, `${was} updated`]);
      case "delete":
        return say(["deleted ", ...object], [...Subject, `${was} deleted`]);
      case "publish":
        return say([`${info.publishWords.on} `, ...object], [...Subject, `${was} ${info.publishWords.onPassive}`]);
      case "unpublish":
        return say([`${info.publishWords.off} `, ...object], [...Subject, `${was} ${info.publishWords.offPassive}`]);
      case "content.restore": {
        const from = detailStr(d, "restored_from");
        if (d.deleted === true) {
          return say(["restored the deleted ", `${info.noun} `, { label }], [...Subject, `${was} restored after being deleted`]);
        }
        const to = from ? [` to ${fmt(from)}`] : [" to an earlier version"];
        return say(["restored ", ...object, ...to], [...Subject, `${was} restored`, ...to]);
      }
    }
  }

  switch (row.action) {
    case "storage.cleanup": {
      const n = typeof d.count === "number" ? d.count : 0;
      const what = `${n} unused image${n === 1 ? "" : "s"}`;
      return say([`cleaned up ${what}`], [`${what[0].toUpperCase()}${what.slice(1)} were cleaned up`]);
    }
    case "team.invite":
      return say([`invited ${who}`], [`${who} was invited`]);
    case "team.invite_resent":
      return say(
        [d.via === "link" ? `made a new invite link for ${who}` : `re-sent the invite to ${who}`],
        [`The invite to ${who} was re-sent`]
      );
    case "team.invite_revoked":
      return say([`revoked the invite for ${who}`], [`The invite for ${who} was revoked`]);
    case "team.disable":
      return say([`disabled ${label}’s access`], [`${label}’s access was disabled`]);
    case "team.enable":
      return say([`re-enabled ${label}’s access`], [`${label}’s access was re-enabled`]);
    case "team.reset_sent":
      return say([`sent a password reset to ${label}`], [`A password reset was sent to ${label}`]);
    case "team.remove":
      return say([`removed ${label} from the panel`], [`${label} was removed from the panel`]);
    case "team.accept":
      return say(["accepted their invite and joined the panel"], [`${label} joined the panel`]);
    case "auth.password_reset":
      return say(["reset their password"], [`${label}’s password was reset`]);
    case "auth.owner_bootstrap":
      return say(["created the owner account"], ["The owner account was created"]);
    case "inbox.reply":
      return say([`replied to ${label || "an enquiry"}`], [`${label || "An enquiry"} was answered`]);
  }

  // anything newer than this file: still readable, never blank
  const what = row.action.replace(/[._]+/g, " ").trim();
  const tail: SentencePart[] = label ? [" · ", { label }] : [];
  return say([what, ...tail], [`${what[0]?.toUpperCase() ?? ""}${what.slice(1)}`, ...tail]);
}

/** The sentence as plain text (labels in curly quotes) — for titles, tests and screen readers. */
export function sentenceText(s: ActivitySentence) {
  const body = s.parts.map((p) => (typeof p === "string" ? p : `“${p.label}”`)).join("");
  return s.actor ? `${s.actor} ${body}` : body;
}

/**
 * Where an activity line links: the item's editor while it still exists
 * (`exists` answers for content rows), the Team page for team events, the
 * settings page for storage housekeeping.
 */
export function activityHref(
  row: Pick<ActivityLite, "action" | "entity_type" | "entity_id">,
  exists: (table: ContentEntityType, id: string) => boolean
): string | null {
  if (isContentTable(row.entity_type)) {
    if (row.entity_type === "site_settings") return ENTITY.site_settings.editHref("1");
    return exists(row.entity_type, row.entity_id) ? ENTITY[row.entity_type].editHref(row.entity_id) : null;
  }
  if (row.entity_type === "invitation" || row.entity_type === "team_member") return "/admin/team";
  if (row.action.startsWith("storage.")) return "/admin/settings#storage";
  return null;
}

// ---------------------------------------------------------------------------
// time (always Asia/Manila; preformatted on the server so nothing hydrates
// differently in the browser)
// ---------------------------------------------------------------------------

const manilaYear = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric" }).format(d);

/** "Sep 28, 10:02 AM" — with the year when it isn't this year. */
export function formatManila(iso: string, now: Date = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const withYear = manilaYear(d) !== manilaYear(now);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". */
export function relativeTime(iso: string, now: Date = new Date()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (now.getTime() - t) / 1000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (s < 45) return "just now";
  if (s < 90) return "a minute ago";
  if (s < 45 * 60) return plural(Math.round(s / 60), "minute");
  if (s < 90 * 60) return "an hour ago";
  if (s < 22 * 3600) return plural(Math.round(s / 3600), "hour");
  if (s < 36 * 3600) return "yesterday";
  if (s < 7 * 86400) return plural(Math.round(s / 86400), "day");
  if (s < 30 * 86400) return plural(Math.round(s / (7 * 86400)), "week");
  if (s < 365 * 86400) return plural(Math.round(s / (30 * 86400)), "month");
  return plural(Math.floor(s / (365 * 86400)), "year");
}

/** 1536 -> "1.5 KB" */
export function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
