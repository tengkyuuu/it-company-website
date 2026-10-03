import { z } from "zod";
import {
  completeUnits,
  fieldsToFormData,
  unitOwnsError,
  type AutosaveEntity,
  type AutosaveFields,
} from "./autosave";
import { MAX_FEATURES, MAX_LIST_ITEMS, MAX_POST_TAGS, MAX_PRODUCT_GALLERY, manilaDate } from "./catalog";
import { ctaUrl, imagePath, isUrl } from "./validators";

/**
 * Form → row parsing for every content editor, shared by the explicit Save
 * (the server actions) and autosave (app/api/admin/autosave/route.ts), so the
 * two paths can't drift: the same FormData produces the same column values
 * whichever one writes it (tests/autosave-parity.test.ts pins that).
 *
 * A plain module ON PURPOSE — no "use server" (which may only export async
 * functions), no "server-only" (tests import it), no secrets.
 *
 * Each parser validates every column INDEPENDENTLY and returns
 *   { values, fieldErrors, message }
 * where `values` holds every column that parsed (a column with an error is
 * absent), `fieldErrors` is keyed by the input the message belongs next to, and
 * `message` is the banner line for the explicit Save (null = all good). The
 * explicit Save refuses the whole form on any error; autosave writes the units
 * that parsed and reports the rest — one bad field must not block the others.
 */

// ---------------------------------------------------------------------------
// FormData helpers (re-exported by ./server.ts for the other actions)
// ---------------------------------------------------------------------------

/** Read a FormData field as a trimmed string. */
export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** A whole number from a form field, clamped — never NaN. */
export function int(fd: FormData, key: string, { min = 0, max = 9999 } = {}) {
  const n = Math.round(Number(fd.get(key) ?? 0));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/**
 * "a, b\nc" -> ["a","b","c"], de-duplicated and bounded so a paste can't bloat
 * a row. `commas: false` splits on newlines only — for sentence-like items
 * (project highlights), where a comma is punctuation, not a separator.
 */
export function toList(
  value: unknown,
  { max = 30, maxLen = 200, commas = true } = {}
): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  for (const raw of value.split(commas ? /[\n,]/ : /\n/)) {
    const s = raw.trim().slice(0, maxLen);
    if (s) seen.add(s);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export type GalleryRow = { src: string; caption: string; kind: "desktop" | "mobile" };

/**
 * The gallery rows GalleryEditor (components/admin/ProjectCaseStudy.tsx)
 * submits: parallel gallery_src / gallery_caption / gallery_kind arrays, one
 * index per row. Rows without an image are dropped; a bad address is an error,
 * not a silent loss. Over `max`: projects have always kept the first `max`
 * (`overflow: "slice"`), products refuse (`"error"`).
 */
export function readGallery(
  fd: FormData,
  max: number,
  { overflow = "error" }: { overflow?: "error" | "slice" } = {}
): { rows: GalleryRow[] } | { error: string } {
  const srcs = fd.getAll("gallery_src").map((v) => String(v).trim());
  const captions = fd.getAll("gallery_caption").map((v) => String(v).trim());
  const kinds = fd.getAll("gallery_kind").map(String);
  const rows = srcs
    .map((src, i) => ({
      src,
      caption: (captions[i] ?? "").slice(0, 200),
      kind: kinds[i] === "mobile" ? ("mobile" as const) : ("desktop" as const),
    }))
    .filter((r) => r.src);
  if (rows.some((r) => !imagePath.safeParse(r.src).success)) {
    return { error: "One of the gallery images has an invalid address — re-upload it." };
  }
  if (rows.length > max) {
    if (overflow === "slice") return { rows: rows.slice(0, max) };
    return { error: `Keep the gallery to ${max} images or fewer.` };
  }
  return { rows };
}

// ---------------------------------------------------------------------------
// parse plumbing
// ---------------------------------------------------------------------------

export type Parsed<T> = {
  /** every column that parsed; a column with an error is absent */
  values: Partial<T>;
  /** input name (or group key) → message */
  fieldErrors: Record<string, string>;
  /** banner line for the explicit Save; null when there are no errors */
  message: string | null;
};

/**
 * One message for the banner. Same wording zodFail has always used: the error
 * itself when there is one, a count when there are several.
 */
export function summarize(fieldErrors: Record<string, string>): string | null {
  const msgs = Object.values(fieldErrors);
  if (msgs.length === 0) return null;
  return msgs.length > 1 ? `Please fix the ${msgs.length} highlighted fields.` : msgs[0];
}

/**
 * Validate each key of a zod object on its own, so one bad field doesn't hide
 * the values of the good ones. Messages are exactly what a whole-object parse
 * reports for that key (first issue wins).
 */
function parseEach<S extends z.ZodRawShape>(
  schema: z.ZodObject<S>,
  raw: { [K in keyof S]: unknown }
): { data: Partial<z.output<z.ZodObject<S>>>; errors: Record<string, string> } {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const key of Object.keys(schema.shape)) {
    const field = schema.shape[key] as z.ZodType;
    const r = field.safeParse(raw[key as keyof S]);
    if (r.success) data[key] = r.data;
    else errors[key] = r.error.issues[0]?.message ?? "Check this value.";
  }
  return { data: data as Partial<z.output<z.ZodObject<S>>>, errors };
}

const done = <T>(values: Partial<T>, fieldErrors: Record<string, string>): Parsed<T> => ({
  values,
  fieldErrors,
  message: summarize(fieldErrors),
});

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = z
  .string()
  .min(1, "Slug is required")
  .max(60, "Keep the slug under 60 characters")
  .regex(slugRe, "Use lowercase letters, numbers and single hyphens");
const order = z.number().int().min(0).max(9999);

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

export const NEEDS_SHOT =
  "Add a main screenshot before publishing — without one the site falls back to a placeholder image.";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex like #7c5cff");

const ProjectSchema = z.object({
  slug,
  name: z.string().min(1, "Name is required").max(120),
  category: z.string().max(120),
  url: z.string().max(200),
  // https only: this becomes an <iframe src> on an https site, where http is
  // blocked as mixed content — and javascript: would run in our own origin
  live_url: z
    .string()
    .max(500)
    .refine((v) => v === "" || isUrl(v, /^https:\/\//i), "Live URL must be a full https:// address"),
  year: z.string().max(20),
  summary: z.string().max(400),
  description: z.string().max(4000),
  img: imagePath,
  img2: imagePath,
  dot1: hex,
  dot2: hex,
  dot3: hex,
  published: z.boolean(),
  sort_order: order,
  // case-study detail — all optional
  client: z.string().max(120),
  industry: z.string().max(120),
  timeline: z.string().max(120),
  challenge: z.string().max(4000),
  approach: z.string().max(4000),
  outcome: z.string().max(4000),
  testimonial_quote: z.string().max(1200),
  testimonial_author: z.string().max(120),
  testimonial_role: z.string().max(120),
});

export const MAX_RESULTS = 4;
export const MAX_PROJECT_GALLERY = 12;

export type ProjectValues = {
  slug: string;
  name: string;
  category: string;
  url: string;
  live_url: string | null;
  year: string;
  summary: string;
  description: string;
  img: string | null;
  img2: string | null;
  published: boolean;
  sort_order: number;
  client: string;
  industry: string;
  timeline: string;
  challenge: string;
  approach: string;
  outcome: string;
  testimonial_quote: string;
  testimonial_author: string;
  testimonial_role: string;
  highlights: string[];
  tags: string[];
  dots: string[];
  services: string[];
  team: string[];
  stack: string[];
  results: { value: string; label: string }[];
  gallery: GalleryRow[];
};

/**
 * The repeating result rows arrive as parallel arrays — every row renders all
 * of its inputs, so index i of each array belongs to the same row. Fully blank
 * rows are dropped; half-filled ones are an error, not a silent loss.
 */
function readResults(fd: FormData) {
  const values = fd.getAll("result_value").map((v) => String(v).trim());
  const labels = fd.getAll("result_label").map((v) => String(v).trim());
  const rows = values
    .map((value, i) => ({ value: value.slice(0, 16), label: (labels[i] ?? "").slice(0, 80) }))
    .filter((r) => r.value || r.label);
  if (rows.some((r) => !r.value || !r.label)) {
    return { error: "Each result needs both a number and what it measures." } as const;
  }
  return { rows: rows.slice(0, MAX_RESULTS) } as const;
}

/** Checkbox values (repeated name) + an optional free-text "other" list, merged. */
function readPicked(fd: FormData, key: string, otherKey: string | null, max: number) {
  const picked = fd.getAll(key).map((v) => String(v).trim().slice(0, 60)).filter(Boolean);
  const other = otherKey ? toList(fd.get(otherKey), { max, maxLen: 60 }) : [];
  return [...new Set([...picked, ...other])].slice(0, max);
}

export function parseProjectForm(fd: FormData): Parsed<ProjectValues> {
  const { data: d, errors } = parseEach(ProjectSchema, {
    slug: str(fd, "slug").toLowerCase(),
    name: str(fd, "name"),
    category: str(fd, "category"),
    url: str(fd, "url"),
    live_url: str(fd, "live_url"),
    year: str(fd, "year"),
    summary: str(fd, "summary"),
    description: str(fd, "description"),
    img: str(fd, "img"),
    img2: str(fd, "img2"),
    dot1: str(fd, "dot1"),
    dot2: str(fd, "dot2"),
    dot3: str(fd, "dot3"),
    published: fd.get("published") === "on",
    sort_order: int(fd, "sort_order"),
    client: str(fd, "client"),
    industry: str(fd, "industry"),
    timeline: str(fd, "timeline"),
    challenge: str(fd, "challenge"),
    approach: str(fd, "approach"),
    outcome: str(fd, "outcome"),
    testimonial_quote: str(fd, "testimonial_quote"),
    testimonial_author: str(fd, "testimonial_author"),
    testimonial_role: str(fd, "testimonial_role"),
  });

  // cross-field rules — each keyed to the input that has to change
  if (!errors.img && d.published && !d.img) errors.img = NEEDS_SHOT;
  if (!errors.testimonial_author && d.testimonial_quote && !d.testimonial_author) {
    errors.testimonial_author = "Say who said it — an unattributed quote reads as invented.";
  }

  const { dot1, dot2, dot3, ...rest } = d;
  const values: Partial<ProjectValues> = { ...rest };
  if ("live_url" in d) values.live_url = d.live_url || null;
  if ("img" in d) values.img = d.img || null;
  if ("img2" in d) values.img2 = d.img2 || null;
  if (dot1 !== undefined && dot2 !== undefined && dot3 !== undefined) values.dots = [dot1, dot2, dot3];

  values.highlights = toList(fd.get("highlights"), { commas: false });
  values.tags = toList(fd.get("tags"), { max: 12, maxLen: 40 });
  values.services = readPicked(fd, "services", "services_other", 12);
  values.team = readPicked(fd, "team", null, 30);
  values.stack = toList(fd.get("stack"), { max: 24, maxLen: 40 });

  const results = readResults(fd);
  if ("error" in results) errors.results = results.error!;
  else values.results = results.rows;

  const gallery = readGallery(fd, MAX_PROJECT_GALLERY, { overflow: "slice" });
  if ("error" in gallery) errors.gallery = gallery.error;
  else values.gallery = gallery.rows;

  return done(values, errors);
}

// ---------------------------------------------------------------------------
// site settings (the single row, id = 1)
// ---------------------------------------------------------------------------

const SettingsSchema = z.object({
  brand_name: z.string().min(1, "Brand name is required").max(80),
  tagline: z.string().max(200),
  email: z.string().min(1, "Email is required").max(200).email("Enter a valid email address"),
  phone: z.string().max(60),
  address_line1: z.string().max(160),
  address_line2: z.string().max(160),
  hours: z.string().max(120),
  availability: z.string().max(120),
  available: z.boolean(),
});

export const MAX_SOCIALS = 12;

export type SettingsValues = z.output<typeof SettingsSchema> & {
  socials: { label: string; href: string }[];
};

export function parseSettingsForm(fd: FormData): Parsed<SettingsValues> {
  const { data, errors } = parseEach(SettingsSchema, {
    brand_name: str(fd, "brand_name"),
    tagline: str(fd, "tagline"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address_line1: str(fd, "address_line1"),
    address_line2: str(fd, "address_line2"),
    hours: str(fd, "hours"),
    availability: str(fd, "availability"),
    available: fd.get("available") === "on",
  });
  const values: Partial<SettingsValues> = { ...data };

  // socials arrive as parallel social_label[] / social_href[] arrays. A fully
  // blank row is ignored; a HALF-filled one is an error rather than being
  // silently dropped, which used to lose a link someone thought they'd saved.
  // The key is the row's index, so the message lands under that row.
  const labels = fd.getAll("social_label").map((v) => String(v).trim());
  const hrefs = fd.getAll("social_href").map((v) => String(v).trim());
  const socials: { label: string; href: string }[] = [];
  let socialError: [string, string] | null = null;

  for (let i = 0; i < Math.max(labels.length, hrefs.length) && !socialError; i++) {
    const label = labels[i] ?? "";
    const href = hrefs[i] ?? "";
    if (!label && !href) continue;

    const key = `social_${i}`;
    if (!label) socialError = [key, `Social link ${i + 1} has a URL but no label.`];
    else if (!href) socialError = [key, `“${label}” needs a URL.`];
    else if (!/^(https?:\/\/\S+|mailto:\S+@\S+)$/i.test(href)) {
      socialError = [key, `“${label}” needs a full URL starting with https://`];
    } else socials.push({ label: label.slice(0, 40), href: href.slice(0, 300) });
  }
  if (socialError) errors[socialError[0]] = socialError[1];
  else if (socials.length > MAX_SOCIALS) errors.socials = `Keep it to ${MAX_SOCIALS} social links or fewer.`;
  else values.socials = socials;

  return done(values, errors);
}

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------

export const ICON_VALUES = ["web", "app", "design", "cloud", "ai", "consult"] as const;

const ServiceSchema = z.object({
  slug,
  title: z.string().min(1, "Title is required").max(120),
  blurb: z.string().max(300),
  detail: z.string().max(2000),
  icon: z.enum(ICON_VALUES, { message: "Pick one of the six icons" }),
  published: z.boolean(),
  sort_order: order,
});

export type ServiceValues = z.output<typeof ServiceSchema> & { deliverables: string[] };

export function parseServiceForm(fd: FormData): Parsed<ServiceValues> {
  const { data, errors } = parseEach(ServiceSchema, {
    slug: str(fd, "slug").toLowerCase(),
    title: str(fd, "title"),
    blurb: str(fd, "blurb"),
    detail: str(fd, "detail"),
    icon: str(fd, "icon") || "web",
    published: fd.get("published") === "on",
    sort_order: int(fd, "sort_order"),
  });
  return done<ServiceValues>(
    { ...data, deliverables: toList(fd.get("deliverables"), { max: 12, maxLen: 60 }) },
    errors
  );
}

// ---------------------------------------------------------------------------
// team_members — the PUBLIC roster on /about (not panel logins)
// ---------------------------------------------------------------------------

const MemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  role: z.string().max(160),
  initials: z
    .string()
    .max(4, "Up to 4 characters")
    .regex(/^[\p{L}\p{N}]*$/u, "Letters and numbers only"),
  published: z.boolean(),
  sort_order: order,
});

export type MemberValues = z.output<typeof MemberSchema>;

export function parseMemberForm(fd: FormData): Parsed<MemberValues> {
  const { data, errors } = parseEach(MemberSchema, {
    name: str(fd, "name"),
    role: str(fd, "role"),
    initials: str(fd, "initials").toUpperCase(),
    published: fd.get("published") === "on",
    sort_order: int(fd, "sort_order"),
  });
  return done(data, errors);
}

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

const ProductSchema = z.object({
  slug,
  name: z.string().min(1, "Name is required").max(120),
  tagline: z.string().max(160),
  summary: z.string().max(400),
  description: z.string().max(6000),
  image: imagePath,
  status: z.string().max(40, "Keep the badge to a word or two"),
  cta_label: z.string().max(40, "Keep the button label short"),
  cta_url: ctaUrl,
  published: z.boolean(),
  sort_order: order,
});

export type ProductValues = Omit<z.output<typeof ProductSchema>, "image"> & {
  image: string | null;
  features: string[];
  gallery: GalleryRow[];
};

export function parseProductForm(fd: FormData): Parsed<ProductValues> {
  const { data, errors } = parseEach(ProductSchema, {
    slug: str(fd, "slug").toLowerCase(),
    name: str(fd, "name"),
    tagline: str(fd, "tagline"),
    summary: str(fd, "summary"),
    description: str(fd, "description"),
    image: str(fd, "image"),
    status: str(fd, "status"),
    cta_label: str(fd, "cta_label"),
    cta_url: str(fd, "cta_url"),
    published: fd.get("published") === "on",
    sort_order: int(fd, "sort_order"),
  });

  // a button needs both halves — half a CTA would silently not render
  if (!errors.cta_label && !errors.cta_url) {
    if (data.cta_url && !data.cta_label) errors.cta_label = "Say what the button says, e.g. “Try it free”.";
    else if (data.cta_label && !data.cta_url) errors.cta_url = "Add where the button goes — or clear the label.";
  }

  const { image, ...rest } = data;
  const values: Partial<ProductValues> = { ...rest };
  if (image !== undefined) values.image = image || null;
  values.features = toList(fd.get("features"), { commas: false, max: MAX_FEATURES, maxLen: 200 });

  const gallery = readGallery(fd, MAX_PRODUCT_GALLERY);
  if ("error" in gallery) errors.gallery = gallery.error;
  else values.gallery = gallery.rows;

  return done(values, errors);
}

// ---------------------------------------------------------------------------
// jobs — the careers page
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' that is a real day (no 2026-02-31). */
const isCalendarDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

const optionalDate = z
  .string()
  .refine((v) => v === "" || isCalendarDate(v), "Use a real date, or leave it blank");

const JobSchema = z.object({
  slug,
  title: z.string().min(1, "Title is required").max(120),
  department: z.string().max(80),
  location: z.string().max(120),
  employment_type: z.enum(["full-time", "part-time", "contract", "internship"], {
    message: "Pick an employment type",
  }),
  workplace: z.enum(["onsite", "hybrid", "remote"], { message: "Pick where the work happens" }),
  summary: z.string().max(400),
  description: z.string().max(6000),
  closes_at: optionalDate,
  published: z.boolean(),
  sort_order: order,
});

export type JobValues = Omit<z.output<typeof JobSchema>, "closes_at"> & {
  closes_at: string | null;
  responsibilities: string[];
  requirements: string[];
};

export function parseJobForm(fd: FormData): Parsed<JobValues> {
  const { data, errors } = parseEach(JobSchema, {
    slug: str(fd, "slug").toLowerCase(),
    title: str(fd, "title"),
    department: str(fd, "department"),
    location: str(fd, "location"),
    employment_type: str(fd, "employment_type"),
    workplace: str(fd, "workplace"),
    summary: str(fd, "summary"),
    description: str(fd, "description"),
    closes_at: str(fd, "closes_at"),
    published: fd.get("published") === "on",
    sort_order: int(fd, "sort_order"),
  });
  const { closes_at, ...rest } = data;
  const values: Partial<JobValues> = { ...rest };
  if (closes_at !== undefined) values.closes_at = closes_at || null;
  values.responsibilities = toList(fd.get("responsibilities"), {
    commas: false,
    max: MAX_LIST_ITEMS,
    maxLen: 300,
  });
  values.requirements = toList(fd.get("requirements"), {
    commas: false,
    max: MAX_LIST_ITEMS,
    maxLen: 300,
  });
  return done(values, errors);
}

// ---------------------------------------------------------------------------
// posts — the blog
// ---------------------------------------------------------------------------

/** Today on the studio's calendar (Asia/Manila) — same as lib/cms's manilaToday. */
const manilaToday = () => manilaDate(new Date().toISOString());

const PostSchema = z.object({
  slug,
  title: z.string().min(1, "Title is required").max(160),
  excerpt: z.string().max(400),
  body: z.string().max(60000, "That's very long — consider splitting it into two posts"),
  cover_image: imagePath,
  author_name: z.string().max(120),
  published: z.boolean(),
  // a date, not a schedule: the index lists every published post, so a future
  // date would show "tomorrow" on a post that's already live
  published_at: optionalDate.refine(
    (v) => v === "" || v <= manilaToday(),
    "Scheduling isn't supported — pick today or an earlier date."
  ),
});

/**
 * `published_at` here is the DAY the form holds ('' or 'YYYY-MM-DD'); whoever
 * writes the row turns it into a timestamp with stampPublishedAt(), which needs
 * the stored value.
 */
export type PostValues = Omit<z.output<typeof PostSchema>, "cover_image"> & {
  cover_image: string | null;
  tags: string[];
};

export function parsePostForm(fd: FormData): Parsed<PostValues> {
  const { data, errors } = parseEach(PostSchema, {
    slug: str(fd, "slug").toLowerCase(),
    title: str(fd, "title"),
    excerpt: str(fd, "excerpt"),
    // not str(): trimming would eat a markdown body's meaningful indentation
    body: String(fd.get("body") ?? "").replace(/\s+$/, ""),
    cover_image: str(fd, "cover_image"),
    author_name: str(fd, "author_name"),
    published: fd.get("published") === "on",
    published_at: str(fd, "published_at"),
  });
  const { cover_image, ...rest } = data;
  const values: Partial<PostValues> = { ...rest };
  if (cover_image !== undefined) values.cover_image = cover_image || null;
  values.tags = toList(fd.get("tags"), { max: MAX_POST_TAGS, maxLen: 40 });
  return done(values, errors);
}

/**
 * The form only knows the day. Blank = let the database stamp it on first
 * publish; a date = midnight that day in Manila — unless the stored timestamp
 * already falls on that day, in which case it's kept exactly, so re-saving a
 * post never reshuffles posts published the same day (or logs a no-op revision).
 */
export function stampPublishedAt(day: string | undefined, keep: string | null): string | null {
  if (!day) return null;
  return keep && manilaDate(keep) === day ? keep : `${day}T00:00:00+08:00`;
}

// ---------------------------------------------------------------------------
// autosave
// ---------------------------------------------------------------------------

const PARSERS: Record<AutosaveEntity, (fd: FormData) => Parsed<Record<string, unknown>>> = {
  projects: parseProjectForm,
  services: parseServiceForm,
  team_members: parseMemberForm,
  site_settings: parseSettingsForm,
  products: parseProductForm,
  jobs: parseJobForm,
  posts: parsePostForm,
} as Record<AutosaveEntity, (fd: FormData) => Parsed<Record<string, unknown>>>;

export function parseForm(entity: AutosaveEntity, fd: FormData) {
  return PARSERS[entity](fd);
}

/**
 * What an autosave writes. Only COMPLETE, autosavable units in `fields` are
 * considered (slug / published / sort_order never are); each is written only
 * if none of its inputs failed validation, and the failures come back as
 * fieldErrors. `context` supplies values the rules need but that autosave
 * never writes — e.g. the row's current `published`, so clearing a published
 * project's screenshot is refused exactly as the explicit Save refuses it.
 */
export function autosavePatch(
  entity: AutosaveEntity,
  fields: AutosaveFields,
  context: AutosaveFields = {}
): { patch: Record<string, unknown>; saved: string[]; fieldErrors: Record<string, string> } {
  const units = completeUnits(entity, Object.keys(fields));
  const sent: AutosaveFields = {};
  for (const u of units) for (const i of u.inputs) sent[i] = fields[i];

  // context first: a sent field always wins (they never overlap in practice —
  // context carries only never-autosaved inputs)
  const parsed = parseForm(entity, fieldsToFormData({ ...context, ...sent }));

  const patch: Record<string, unknown> = {};
  const saved: string[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const u of units) {
    const errs = Object.entries(parsed.fieldErrors).filter(([k]) => unitOwnsError(u, k));
    if (errs.length) {
      for (const [k, m] of errs) fieldErrors[k] = m;
      continue;
    }
    const missing = u.columns.some((c) => !(c in parsed.values));
    if (missing) continue; // can't happen without an error — but never write undefined
    for (const c of u.columns) patch[c] = parsed.values[c];
    saved.push(...u.inputs);
  }
  return { patch, saved, fieldErrors };
}
