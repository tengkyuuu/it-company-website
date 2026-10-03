"use server";

import { createClient } from "@/lib/supabase/server";
import { isJobClosed, manilaToday } from "@/lib/cms";
import {
  NOTHING_CHANGED,
  dbFail,
  fail,
  isUuid,
  ok,
  requireStaff,
  str,
  type Result,
} from "./_lib/server";
import {
  parseJobForm,
  parsePostForm,
  parseProductForm,
  stampPublishedAt,
  type JobValues,
  type PostValues,
  type ProductValues,
} from "./_lib/schemas";
import {
  STALE_FORM,
  guardedUpdate,
  outcomeFail,
  postImages,
  productImages,
  revalidateSection,
} from "./_lib/content";
import { removeOrphanedUploads } from "./_lib/storage";

/**
 * Server actions for the studio's own catalogue: products, open roles (the
 * careers page) and blog posts. Same contract as actions.ts / content-actions.ts:
 *
 *  - every exported action calls requireStaff() first — a Server Action is a
 *    public POST endpoint, middleware doesn't run for it (action-guards.test.ts
 *    fails the build otherwise);
 *  - zod with per-field messages (./_lib/schemas.ts, shared with autosave); a
 *    slug collision lands on the slug input;
 *  - an edit writes only if the row is still at the `updated_at` the form was
 *    loaded with (./_lib/content.ts → guardedUpdate) — a stale tab gets a
 *    conflict instead of overwriting a newer save;
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

export type ActionResult = Result;

type Supabase = Awaited<ReturnType<typeof createClient>>;

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

const PRODUCT_GONE = "This product no longer exists — it may have been deleted in another tab.";

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That product id isn't valid — reload the page.");

  const parsed = parseProductForm(formData);
  if (parsed.message) return fail(parsed.message, parsed.fieldErrors);
  const row = parsed.values as ProductValues;

  const supabase = await createClient();

  if (id) {
    const expected = str(formData, "updated_at");
    if (!expected) return fail(STALE_FORM);

    // the previous version, so images this edit dropped can be cleaned out of
    // Storage once the new version is safely saved
    const { data: before, error: readError } = await supabase
      .from("products")
      .select("published, image, gallery")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail(PRODUCT_GONE);

    const write = await guardedUpdate(supabase, "products", id, expected, row, { actorId: me.id });
    if (write.kind !== "ok") {
      return outcomeFail(write, PRODUCT_GONE, (e) => writeFail(e, row.slug, "product"));
    }

    await removeOrphanedUploads(supabase, productImages(before));
    revalidateSection("products", before.published !== row.published);
    return ok(row.published ? "Product saved — live on the site." : "Product saved as a draft.", {
      updatedAt: write.updatedAt,
    });
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

const JOB_GONE = "This role no longer exists — it may have been deleted in another tab.";

/** Would /careers list it? (published, and its last day isn't behind us) */
const listed = (r: { published: boolean; closes_at: string | null }, today: string) =>
  r.published && !isJobClosed(r.closes_at, today);

export async function saveJob(formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That role's id isn't valid — reload the page.");

  const parsed = parseJobForm(formData);
  if (parsed.message) return fail(parsed.message, parsed.fieldErrors);
  const row = parsed.values as JobValues;

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
    const expected = str(formData, "updated_at");
    if (!expected) return fail(STALE_FORM);

    const { data: before, error: readError } = await supabase
      .from("jobs")
      .select("published, closes_at")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail(JOB_GONE);

    const write = await guardedUpdate(supabase, "jobs", id, expected, row, { actorId: me.id });
    if (write.kind !== "ok") return outcomeFail(write, JOB_GONE, (e) => writeFail(e, row.slug, "role"));

    revalidateSection("careers", listed(before, today) !== listed(row, today));
    return ok(savedMessage(false), { updatedAt: write.updatedAt });
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

const POST_GONE = "This post no longer exists — it may have been deleted in another tab.";

export async function savePost(formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That post id isn't valid — reload the page.");

  const parsed = parsePostForm(formData);
  if (parsed.message) return fail(parsed.message, parsed.fieldErrors);
  // published_at is the form's DAY; stampPublishedAt turns it into a timestamp
  const { published_at: day, ...row } = parsed.values as PostValues;

  const supabase = await createClient();

  if (id) {
    const expected = str(formData, "updated_at");
    if (!expected) return fail(STALE_FORM);

    const { data: before, error: readError } = await supabase
      .from("posts")
      .select("published, published_at, cover_image")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail(POST_GONE);

    // an untouched date keeps its exact timestamp, so re-saving a post never
    // reshuffles posts published the same day (or logs a no-op revision)
    const write = await guardedUpdate(
      supabase,
      "posts",
      id,
      expected,
      { ...row, published_at: stampPublishedAt(day, before.published_at) },
      { actorId: me.id }
    );
    if (write.kind !== "ok") return outcomeFail(write, POST_GONE, (e) => writeFail(e, row.slug, "post"));

    await removeOrphanedUploads(supabase, postImages(before));
    revalidateSection("blog", before.published !== row.published);
    return ok(row.published ? "Post saved — live on the blog." : "Post saved as a draft.", {
      updatedAt: write.updatedAt,
    });
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...row, published_at: stampPublishedAt(day, null) })
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

  await removeOrphanedUploads(supabase, postImages(data[0]));
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
