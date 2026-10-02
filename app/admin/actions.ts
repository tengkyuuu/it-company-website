"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/lib/site";
import { projects as staticProjects } from "@/lib/work";
import {
  NOTHING_CHANGED,
  dbFail,
  int,
  isUuid,
  str,
  toList,
  zodFail,
} from "./_lib/server";
import { imagePath, isUrl } from "./_lib/validators";

export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({
  ok: false,
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

/** Every mutation goes through this: no session, no writes. */
async function requireStaff() {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  return profile;
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexRe = /^#[0-9a-fA-F]{6}$/;

const hex = z.string().regex(hexRe, "Use a 6-digit hex like #7c5cff");

const ProjectSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(60, "Keep the slug under 60 characters")
    .regex(slugRe, "Use lowercase letters, numbers and single hyphens"),
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
  sort_order: z.number().int().min(0).max(9999),
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

const MAX_RESULTS = 4;
const MAX_GALLERY = 12;

/**
 * The repeating rows (results, gallery) arrive as parallel arrays — every row
 * renders all of its inputs, so index i of each array belongs to the same row.
 * Fully blank rows are dropped; half-filled ones are an error, not a silent loss.
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

function readGallery(fd: FormData) {
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
  const bad = rows.find((r) => !imagePath.safeParse(r.src).success);
  if (bad) return { error: "One of the gallery images has an invalid address — re-upload it." } as const;
  return { rows: rows.slice(0, MAX_GALLERY) } as const;
}

/** Checkbox values (repeated name) + an optional free-text "other" list, merged. */
function readPicked(fd: FormData, key: string, otherKey: string | null, max: number) {
  const picked = fd.getAll(key).map((v) => String(v).trim().slice(0, 60)).filter(Boolean);
  const other = otherKey ? toList(fd.get(otherKey), { max, maxLen: 60 }) : [];
  return [...new Set([...picked, ...other])].slice(0, max);
}

/** Every Storage URL a project row references — screenshots and gallery alike. */
function shotUrls(r: { img?: string | null; img2?: string | null; gallery?: unknown }) {
  const gallery = Array.isArray(r.gallery)
    ? r.gallery.map((g: { src?: unknown }) => (typeof g?.src === "string" ? g.src : null))
    : [];
  return [r.img, r.img2, ...gallery];
}

/**
 * Everything that renders projects: the landing gallery, the index, every
 * detail page (each one's prev/next links depend on order and visibility, and
 * a rename has to refresh the OLD url too — the dynamic pattern covers both),
 * the sitemap, and the panel itself.
 */
function revalidateProjects() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/projects/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

const NEEDS_SHOT =
  "Add a main screenshot before publishing — without one the site falls back to a placeholder image.";

const STORAGE_MARKER = "/storage/v1/object/public/work/";

/** Object path inside the "work" bucket for one of OUR public URLs, else null. */
function storagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!base || !url.startsWith(base + STORAGE_MARKER)) return null;
  const path = url.slice(base.length + STORAGE_MARKER.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return null;
  }
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Best-effort: delete uploaded screenshots that no project references any more
 * (after a delete, or an edit that replaced/removed a shot). Checked against the
 * whole table so a shot reused by another project is never pulled out from under
 * it. Never fails the action — a leftover file costs pennies, a failed save
 * costs the edit.
 */
async function removeOrphanedShots(supabase: Supabase, urls: (string | null | undefined)[]) {
  const candidates = [...new Set(urls)]
    .map((url) => ({ url, path: storagePath(url) }))
    .filter((c): c is { url: string; path: string } => Boolean(c.url && c.path));
  if (!candidates.length) return;

  try {
    const { data, error } = await supabase.from("projects").select("img, img2, gallery");
    if (error || !data) return;
    const inUse = new Set(data.flatMap(shotUrls).filter(Boolean));
    const orphans = candidates.filter((c) => !inUse.has(c.url)).map((c) => c.path);
    if (orphans.length) await supabase.storage.from("work").remove(orphans);
  } catch {
    // cleanup only
  }
}

export async function saveProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That project id isn't valid — reload the page.");

  const parsed = ProjectSchema.safeParse({
    slug: str(formData, "slug").toLowerCase(),
    name: str(formData, "name"),
    category: str(formData, "category"),
    url: str(formData, "url"),
    live_url: str(formData, "live_url"),
    year: str(formData, "year"),
    summary: str(formData, "summary"),
    description: str(formData, "description"),
    img: str(formData, "img"),
    img2: str(formData, "img2"),
    dot1: str(formData, "dot1"),
    dot2: str(formData, "dot2"),
    dot3: str(formData, "dot3"),
    published: formData.get("published") === "on",
    sort_order: int(formData, "sort_order"),
    client: str(formData, "client"),
    industry: str(formData, "industry"),
    timeline: str(formData, "timeline"),
    challenge: str(formData, "challenge"),
    approach: str(formData, "approach"),
    outcome: str(formData, "outcome"),
    testimonial_quote: str(formData, "testimonial_quote"),
    testimonial_author: str(formData, "testimonial_author"),
    testimonial_role: str(formData, "testimonial_role"),
  });
  if (!parsed.success) return zodFail(parsed.error);

  const { dot1, dot2, dot3, ...values } = parsed.data;
  if (values.published && !values.img) return fail(NEEDS_SHOT, { img: NEEDS_SHOT });
  if (values.testimonial_quote && !values.testimonial_author) {
    const who = "Say who said it — an unattributed quote reads as invented.";
    return fail(who, { testimonial_author: who });
  }

  const results = readResults(formData);
  if ("error" in results) return fail(results.error!, { results: results.error! });
  const gallery = readGallery(formData);
  if ("error" in gallery) return fail(gallery.error!, { gallery: gallery.error! });

  const row = {
    ...values,
    live_url: values.live_url || null,
    img: values.img || null,
    img2: values.img2 || null,
    highlights: toList(formData.get("highlights"), { commas: false }),
    tags: toList(formData.get("tags"), { max: 12, maxLen: 40 }),
    dots: [dot1, dot2, dot3],
    services: readPicked(formData, "services", "services_other", 12),
    team: readPicked(formData, "team", null, 30),
    stack: toList(formData.get("stack"), { max: 24, maxLen: 40 }),
    results: results.rows,
    gallery: gallery.rows,
  };

  const supabase = await createClient();
  const taken = `“${row.slug}” is already used by another project.`;
  const onError = (error: { code?: string; message?: string }) =>
    error.code === "23505" ? fail(taken, { slug: taken }) : dbFail(error);

  if (id) {
    // read the previous version first, so screenshots this edit dropped can be
    // cleaned out of Storage once the new version is safely saved
    const { data: before, error: readError } = await supabase
      .from("projects")
      .select("img, img2, gallery")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) {
      return fail("This project no longer exists — it may have been deleted in another tab.");
    }

    const { data, error } = await supabase
      .from("projects")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) return onError(error);
    if (!data?.length) return fail(NOTHING_CHANGED);

    await removeOrphanedShots(supabase, shotUrls(before));
    revalidateProjects();
    return ok("Project saved.");
  }

  const { data, error } = await supabase.from("projects").insert(row).select("id").single();
  if (error) return onError(error);

  revalidateProjects();
  return { ok: true, message: "Project created.", id: data.id as string };
}

export async function deleteProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing project id.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("name, img, img2, gallery");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  await removeOrphanedShots(supabase, shotUrls(data[0]));
  revalidateProjects();
  return ok(`Deleted “${data[0].name}”.`);
}

export async function togglePublish(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  const raw = str(formData, "published");
  if (!isUuid(id) || (raw !== "true" && raw !== "false")) return fail("Invalid request.");
  const next = raw === "true";

  const supabase = await createClient();

  if (next) {
    const { data: current, error: readError } = await supabase
      .from("projects")
      .select("img")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!current) return fail(NOTHING_CHANGED);
    if (!current.img) return fail(NEEDS_SHOT);
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ published: next })
    .eq("id", id)
    .select("name");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateProjects();
  return ok(next ? `“${data[0].name}” is live.` : `“${data[0].name}” is now a draft.`);
}

/** Nudge a project up or down by swapping sort_order with its neighbour. */
export async function moveProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing project id.");
  const dir = str(formData, "dir") === "up" ? -1 : 1;

  const supabase = await createClient();
  const { data: all, error: listError } = await supabase
    .from("projects")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (listError || !all) return dbFail(listError);

  const i = all.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0) return fail(NOTHING_CHANGED);
  if (j < 0 || j >= all.length) return ok("Already at the edge.");

  // rewrite the column as 0..n-1 so previously-equal sort_orders become
  // distinct — but only touch the rows whose position actually changed
  const reordered = [...all];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  for (let k = 0; k < reordered.length; k++) {
    if (reordered[k].sort_order === k) continue;
    const { data, error } = await supabase
      .from("projects")
      .update({ sort_order: k })
      .eq("id", reordered[k].id)
      .select("id");
    if (error) return dbFail(error);
    if (!data?.length) return fail(NOTHING_CHANGED);
  }

  revalidateProjects();
  return ok("Order updated.");
}

/**
 * Seed the table from the projects checked into lib/work.ts, so the first run
 * starts from the real portfolio instead of an empty list. Skips any slug that
 * already exists, and inserts with ON CONFLICT DO NOTHING, so pressing it twice
 * (or from two tabs at once) imports each project exactly once.
 */
export async function importStaticProjects(): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("projects")
    .select("slug, sort_order");
  if (readError) return dbFail(readError);

  const have = new Set((existing ?? []).map((r) => r.slug));
  // append after whatever is already there instead of colliding with it
  const start = (existing ?? []).reduce((m, r) => Math.max(m, (r.sort_order ?? 0) + 1), 0);
  const rows = staticProjects
    .filter((p) => !have.has(p.slug))
    .map((p, i) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      url: p.url,
      live_url: p.liveUrl ?? null,
      year: p.year,
      summary: p.summary,
      description: p.description,
      highlights: p.highlights,
      tags: p.tags,
      dots: [...p.dots],
      img: p.img,
      img2: p.img2 ?? null,
      published: true,
      sort_order: start + i,
    }));

  if (rows.length === 0) {
    return ok("All the built-in projects are already in the database — nothing to import.");
  }

  const { data, error } = await supabase
    .from("projects")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
    .select("id");
  if (error) return dbFail(error);

  revalidateProjects();
  const n = data?.length ?? rows.length;
  if (n === 0) return ok("Those projects were just imported — nothing new to add.");
  return ok(`Imported ${n} project${n === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------------------
// team
// ---------------------------------------------------------------------------

// Team actions (invite / resend / revoke / role / remove) live in
// ./team-actions.ts — invites now go through Resend with a server-verified
// link, and none of that belongs in this file.

// ---------------------------------------------------------------------------
// site settings
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

const MAX_SOCIALS = 12;

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const parsed = SettingsSchema.safeParse({
    brand_name: str(formData, "brand_name"),
    tagline: str(formData, "tagline"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address_line1: str(formData, "address_line1"),
    address_line2: str(formData, "address_line2"),
    hours: str(formData, "hours"),
    availability: str(formData, "availability"),
    available: formData.get("available") === "on",
  });
  if (!parsed.success) return zodFail(parsed.error);

  // socials arrive as parallel social_label[] / social_href[] arrays. A fully
  // blank row is ignored; a HALF-filled one is an error rather than being
  // silently dropped, which used to lose a link someone thought they'd saved.
  const labels = formData.getAll("social_label").map((v) => String(v).trim());
  const hrefs = formData.getAll("social_href").map((v) => String(v).trim());
  const socials: { label: string; href: string }[] = [];

  for (let i = 0; i < Math.max(labels.length, hrefs.length); i++) {
    const label = labels[i] ?? "";
    const href = hrefs[i] ?? "";
    if (!label && !href) continue;

    const key = `social_${i}`;
    if (!label) return fail(`Social link ${i + 1} has a URL but no label.`, { [key]: "Add a label" });
    if (!href) return fail(`“${label}” needs a URL.`, { [key]: "Add the full URL" });
    if (!/^(https?:\/\/\S+|mailto:\S+@\S+)$/i.test(href)) {
      const msg = `“${label}” needs a full URL starting with https://`;
      return fail(msg, { [key]: msg });
    }
    socials.push({ label: label.slice(0, 40), href: href.slice(0, 300) });
  }
  if (socials.length > MAX_SOCIALS) return fail(`Keep it to ${MAX_SOCIALS} social links or fewer.`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .update({ ...parsed.data, socials })
    .eq("id", 1)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) {
    return fail(
      "The settings row is missing or locked — re-run supabase/schema.sql (it seeds the row), or check your account's permissions."
    );
  }

  revalidatePath("/", "layout");
  return ok("Settings saved — the public site is updated.");
}
