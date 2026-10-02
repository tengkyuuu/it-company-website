"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isJobClosed, manilaToday } from "@/lib/cms";
import {
  MAX_FEATURES,
  MAX_LIST_ITEMS,
  MAX_POST_TAGS,
  MAX_PRODUCT_GALLERY,
  manilaDate,
} from "./_lib/catalog";
import {
  NOTHING_CHANGED,
  dbFail,
  fail,
  int,
  isUuid,
  ok,
  readGallery,
  requireStaff,
  str,
  toList,
  zodFail,
} from "./_lib/server";
import { galleryUrls, removeOrphanedUploads } from "./_lib/storage";
import { ctaUrl, imagePath } from "./_lib/validators";

/**
 * Server actions for the studio's own catalogue: products, open roles (the
 * careers page) and blog posts. Same contract as actions.ts / content-actions.ts:
 *
 *  - every exported action calls requireStaff() first — a Server Action is a
 *    public POST endpoint, middleware doesn't run for it (action-guards.test.ts
 *    fails the build otherwise);
 *  - zod with per-field messages; a slug collision lands on the slug input;
 *  - every UPDATE/DELETE asks for the affected rows back, because RLS reports a
 *    refused write as a success that touched nothing;
 *  - images a save or delete dropped are removed from Storage only once nothing
 *    (no other row, no stored revision) references them — see _lib/storage.ts.
 *
 * Revalidation uses ROUTE PATTERNS: the public pages live under app/[lang]/…
 * (English + /fil), so "/[lang]/products/[slug]" refreshes every language and
 * every slug — including the OLD url after a rename — in one call. Revalidating
 * a pattern no page matches yet is harmless.
 */

export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Section = "products" | "careers" | "blog";

/**
 * `listingChanged` = the nav/footer link may have appeared or disappeared
 * (getPublishedSections in lib/cms.ts). That link lives in the [lang] layout,
 * so the whole layout is refreshed — only then, since it re-renders every page.
 */
function revalidateSection(section: Section, listingChanged: boolean) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/[lang]/${section}`, "page");
  revalidatePath(`/[lang]/${section}/[slug]`, "page");
  revalidatePath("/sitemap.xml");
  if (listingChanged) revalidatePath("/[lang]", "layout");
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slug = z
  .string()
  .min(1, "Slug is required")
  .max(60, "Keep the slug under 60 characters")
  .regex(slugRe, "Use lowercase letters, numbers and single hyphens");

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

/** Turn the unique-slug violation into a message on the slug field. */
function writeFail(error: { code?: string; message?: string }, value: string, noun: string) {
  if (error.code === "23505") {
    const taken = `“${value}” is already used by another ${noun}.`;
    return fail(taken, { slug: taken });
  }
  return dbFail(error);
}

/** Where a new row goes: after everything else. A failed read just means 0. */
async function nextSortOrder(supabase: Supabase, table: "products" | "jobs") {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data.sort_order ?? 0) + 1 : 0;
}

/**
 * Nudge a row up or down by swapping it with its neighbour. Rewrites the
 * column as 0..n-1 so previously-equal sort_orders become distinct, touching
 * only the rows whose position actually changed (same as moveProject).
 */
async function moveRow(table: "products" | "jobs", id: string, dir: -1 | 1) {
  const supabase = await createClient();
  const { data: all, error: listError } = await supabase
    .from(table)
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (listError || !all) return { result: dbFail(listError) };

  const i = all.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0) return { result: fail(NOTHING_CHANGED) };
  if (j < 0 || j >= all.length) return { result: ok("Already at the edge.") };

  const reordered = [...all];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  for (let k = 0; k < reordered.length; k++) {
    if (reordered[k].sort_order === k) continue;
    const { data, error } = await supabase
      .from(table)
      .update({ sort_order: k })
      .eq("id", reordered[k].id)
      .select("id");
    if (error) return { result: dbFail(error) };
    if (!data?.length) return { result: fail(NOTHING_CHANGED) };
  }
  return { result: ok("Order updated."), moved: true };
}

/** "true"/"false" from a row button, else null. */
function readPublished(fd: FormData) {
  const raw = str(fd, "published");
  return raw === "true" ? true : raw === "false" ? false : null;
}

/* ===========================================================================
   products
   =========================================================================== */

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
  sort_order: z.number().int().min(0).max(9999),
});

/** Every Storage URL a product row references. */
const productImages = (r: { image?: string | null; gallery?: unknown }) => [
  r.image,
  ...galleryUrls(r.gallery),
];

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That product id isn't valid — reload the page.");

  const parsed = ProductSchema.safeParse({
    slug: str(formData, "slug").toLowerCase(),
    name: str(formData, "name"),
    tagline: str(formData, "tagline"),
    summary: str(formData, "summary"),
    description: str(formData, "description"),
    image: str(formData, "image"),
    status: str(formData, "status"),
    cta_label: str(formData, "cta_label"),
    cta_url: str(formData, "cta_url"),
    published: formData.get("published") === "on",
    sort_order: int(formData, "sort_order"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const values = parsed.data;

  // a button needs both halves — half a CTA would silently not render
  if (values.cta_url && !values.cta_label) {
    const msg = "Say what the button says, e.g. “Try it free”.";
    return fail(msg, { cta_label: msg });
  }
  if (values.cta_label && !values.cta_url) {
    const msg = "Add where the button goes — or clear the label.";
    return fail(msg, { cta_url: msg });
  }

  const gallery = readGallery(formData, MAX_PRODUCT_GALLERY);
  if ("error" in gallery) return fail(gallery.error!, { gallery: gallery.error! });

  const row = {
    ...values,
    image: values.image || null,
    features: toList(formData.get("features"), { commas: false, max: MAX_FEATURES, maxLen: 200 }),
    gallery: gallery.rows,
  };

  const supabase = await createClient();

  if (id) {
    // the previous version, so images this edit dropped can be cleaned out of
    // Storage once the new version is safely saved
    const { data: before, error: readError } = await supabase
      .from("products")
      .select("published, image, gallery")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail("This product no longer exists — it may have been deleted in another tab.");

    const { data, error } = await supabase.from("products").update(row).eq("id", id).select("id");
    if (error) return writeFail(error, row.slug, "product");
    if (!data?.length) return fail(NOTHING_CHANGED);

    await removeOrphanedUploads(supabase, productImages(before));
    revalidateSection("products", before.published !== row.published);
    return ok(row.published ? "Product saved — live on the site." : "Product saved as a draft.");
  }

  // new products land at the end of the list, whatever the form said
  const { data, error } = await supabase
    .from("products")
    .insert({ ...row, sort_order: await nextSortOrder(supabase, "products") })
    .select("id")
    .single();
  if (error) return writeFail(error, row.slug, "product");

  revalidateSection("products", row.published);
  return ok(row.published ? "Product created and published." : "Product created as a draft.", {
    id: data.id as string,
  });
}

export async function deleteProduct(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing product id.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("name, published, image, gallery");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  await removeOrphanedUploads(supabase, productImages(data[0]));
  revalidateSection("products", Boolean(data[0].published));
  return ok(`Deleted “${data[0].name}”.`);
}

export async function toggleProductPublish(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  const next = readPublished(formData);
  if (!isUuid(id) || next === null) return fail("Invalid request.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ published: next })
    .eq("id", id)
    .select("name");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateSection("products", true);
  return ok(next ? `“${data[0].name}” is live.` : `“${data[0].name}” is now a draft.`);
}

export async function moveProduct(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing product id.");

  const { result, moved } = await moveRow("products", id, str(formData, "dir") === "up" ? -1 : 1);
  if (moved) revalidateSection("products", false);
  return result;
}

/* ===========================================================================
   jobs — the careers page
   =========================================================================== */

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
  sort_order: z.number().int().min(0).max(9999),
});

/** Would /careers list it? (published, and its last day isn't behind us) */
const listed = (r: { published: boolean; closes_at: string | null }, today: string) =>
  r.published && !isJobClosed(r.closes_at, today);

export async function saveJob(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That role's id isn't valid — reload the page.");

  const parsed = JobSchema.safeParse({
    slug: str(formData, "slug").toLowerCase(),
    title: str(formData, "title"),
    department: str(formData, "department"),
    location: str(formData, "location"),
    employment_type: str(formData, "employment_type"),
    workplace: str(formData, "workplace"),
    summary: str(formData, "summary"),
    description: str(formData, "description"),
    closes_at: str(formData, "closes_at"),
    published: formData.get("published") === "on",
    sort_order: int(formData, "sort_order"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const values = parsed.data;

  const row = {
    ...values,
    closes_at: values.closes_at || null,
    responsibilities: toList(formData.get("responsibilities"), {
      commas: false,
      max: MAX_LIST_ITEMS,
      maxLen: 300,
    }),
    requirements: toList(formData.get("requirements"), {
      commas: false,
      max: MAX_LIST_ITEMS,
      maxLen: 300,
    }),
  };

  const today = manilaToday();
  // saving a published role whose last day has passed is allowed (e.g. fixing
  // a typo on an old listing), but say plainly that it isn't on the site
  const savedMessage = (created: boolean) =>
    row.published && isJobClosed(row.closes_at, today)
      ? `${created ? "Role created" : "Saved"} — but its closing date has passed, so it isn't listed on the careers page. Move the date to reopen it.`
      : row.published
        ? `${created ? "Role created and published" : "Role saved — live on the careers page"}.`
        : `${created ? "Role created" : "Role saved"} as a draft.`;

  const supabase = await createClient();

  if (id) {
    const { data: before, error: readError } = await supabase
      .from("jobs")
      .select("published, closes_at")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail("This role no longer exists — it may have been deleted in another tab.");

    const { data, error } = await supabase.from("jobs").update(row).eq("id", id).select("id");
    if (error) return writeFail(error, row.slug, "role");
    if (!data?.length) return fail(NOTHING_CHANGED);

    revalidateSection("careers", listed(before, today) !== listed(row, today));
    return ok(savedMessage(false));
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...row, sort_order: await nextSortOrder(supabase, "jobs") })
    .select("id")
    .single();
  if (error) return writeFail(error, row.slug, "role");

  revalidateSection("careers", listed(row, today));
  return ok(savedMessage(true), { id: data.id as string });
}

export async function deleteJob(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing role id.");

  const supabase = await createClient();
  // applications keep their row: leads.job_id is ON DELETE SET NULL
  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id)
    .select("title, published, closes_at");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateSection("careers", listed(data[0], manilaToday()));
  return ok(`Deleted “${data[0].title}”. Applications already received stay in the inbox.`);
}

export async function toggleJobPublish(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  const next = readPublished(formData);
  if (!isUuid(id) || next === null) return fail("Invalid request.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({ published: next })
    .eq("id", id)
    .select("title, closes_at");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateSection("careers", true);
  const { title, closes_at } = data[0];
  if (!next) return ok(`“${title}” is now a draft.`);
  return ok(
    isJobClosed(closes_at)
      ? `“${title}” is published, but its closing date has passed — it won't be listed until you move the date.`
      : `“${title}” is live on the careers page.`
  );
}

export async function moveJob(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing role id.");

  const { result, moved } = await moveRow("jobs", id, str(formData, "dir") === "up" ? -1 : 1);
  if (moved) revalidateSection("careers", false);
  return result;
}

/* ===========================================================================
   posts — the blog. No manual order: newest published first.
   =========================================================================== */

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

export async function savePost(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That post id isn't valid — reload the page.");

  const parsed = PostSchema.safeParse({
    slug: str(formData, "slug").toLowerCase(),
    title: str(formData, "title"),
    excerpt: str(formData, "excerpt"),
    // not str(): trimming would eat a markdown body's meaningful indentation
    body: String(formData.get("body") ?? "").replace(/\s+$/, ""),
    cover_image: str(formData, "cover_image"),
    author_name: str(formData, "author_name"),
    published: formData.get("published") === "on",
    published_at: str(formData, "published_at"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const { published_at: day, ...values } = parsed.data;

  const row = {
    ...values,
    cover_image: values.cover_image || null,
    tags: toList(formData.get("tags"), { max: MAX_POST_TAGS, maxLen: 40 }),
  };
  // blank = let the database stamp it on first publish; a date = midnight
  // that day in Manila (the form only knows the day)
  const stamp = (keep: string | null) =>
    !day ? null : keep && manilaDate(keep) === day ? keep : `${day}T00:00:00+08:00`;

  const supabase = await createClient();

  if (id) {
    const { data: before, error: readError } = await supabase
      .from("posts")
      .select("published, published_at, cover_image")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail("This post no longer exists — it may have been deleted in another tab.");

    // an untouched date keeps its exact timestamp, so re-saving a post never
    // reshuffles posts published the same day (or logs a no-op revision)
    const { data, error } = await supabase
      .from("posts")
      .update({ ...row, published_at: stamp(before.published_at) })
      .eq("id", id)
      .select("id");
    if (error) return writeFail(error, row.slug, "post");
    if (!data?.length) return fail(NOTHING_CHANGED);

    await removeOrphanedUploads(supabase, [before.cover_image]);
    revalidateSection("blog", before.published !== row.published);
    return ok(row.published ? "Post saved — live on the blog." : "Post saved as a draft.");
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...row, published_at: stamp(null) })
    .select("id")
    .single();
  if (error) return writeFail(error, row.slug, "post");

  revalidateSection("blog", row.published);
  return ok(row.published ? "Post created and published." : "Post created as a draft.", {
    id: data.id as string,
  });
}

export async function deletePost(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing post id.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("title, published, cover_image");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  await removeOrphanedUploads(supabase, [data[0].cover_image]);
  revalidateSection("blog", Boolean(data[0].published));
  return ok(`Deleted “${data[0].title}”.`);
}

export async function togglePostPublish(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  const next = readPublished(formData);
  if (!isUuid(id) || next === null) return fail("Invalid request.");

  const supabase = await createClient();
  // published_at is stamped by the database on the first publish
  const { data, error } = await supabase
    .from("posts")
    .update({ published: next })
    .eq("id", id)
    .select("title");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateSection("blog", true);
  return ok(next ? `“${data[0].title}” is live.` : `“${data[0].title}” is now a draft.`);
}
