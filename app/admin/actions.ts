"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { projects as staticProjects } from "@/lib/work";
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
  NEEDS_SHOT,
  parseProjectForm,
  parseSettingsForm,
  type ProjectValues,
  type SettingsValues,
} from "./_lib/schemas";
import {
  STALE_FORM,
  guardedUpdate,
  outcomeFail,
  projectImages,
  revalidateProjects,
  revalidateSettings,
} from "./_lib/content";
import { removeOrphanedUploads } from "./_lib/storage";

/**
 * Field parsing lives in ./_lib/schemas.ts (shared with autosave, so the two
 * can't drift); the version-checked write, revalidation and image lists in
 * ./_lib/content.ts. Every edit-form save sends the row's `updated_at` as it
 * was when the form loaded (or as the last save returned it) and writes only
 * if the row is still at that version — a stale tab gets a conflict, never a
 * silent overwrite of someone's newer save.
 */

export type ActionResult = Result;

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/admin", "layout"); // public pages never read the session
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

const PROJECT_GONE = "This project no longer exists — it may have been deleted in another tab.";

// Uploads this edit dropped are cleaned out of Storage by
// removeOrphanedUploads (./_lib/storage.ts) — shared with products and posts,
// and it keeps any file another table or a stored revision still references.

export async function saveProject(formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That project id isn't valid — reload the page.");

  const parsed = parseProjectForm(formData);
  if (parsed.message) return fail(parsed.message, parsed.fieldErrors);
  const row = parsed.values as ProjectValues;

  const supabase = await createClient();
  const taken = `“${row.slug}” is already used by another project.`;
  const onError = (error: { code?: string; message?: string }) =>
    error.code === "23505" ? fail(taken, { slug: taken }) : dbFail(error);

  if (id) {
    const expected = str(formData, "updated_at");
    if (!expected) return fail(STALE_FORM);

    // read the previous version first, so screenshots this edit dropped can be
    // cleaned out of Storage once the new version is safely saved
    const { data: before, error: readError } = await supabase
      .from("projects")
      .select("img, img2, gallery")
      .eq("id", id)
      .maybeSingle();
    if (readError) return dbFail(readError);
    if (!before) return fail(PROJECT_GONE);

    const write = await guardedUpdate(supabase, "projects", id, expected, row, { actorId: me.id });
    if (write.kind !== "ok") return outcomeFail(write, PROJECT_GONE, onError);

    await removeOrphanedUploads(supabase, projectImages(before));
    revalidateProjects();
    return ok("Project saved.", { updatedAt: write.updatedAt });
  }

  const { data, error } = await supabase.from("projects").insert(row).select("id").single();
  if (error) return onError(error);

  revalidateProjects();
  return ok("Project created.", { id: data.id as string });
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

  await removeOrphanedUploads(supabase, projectImages(data[0]));
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

const SETTINGS_MISSING =
  "The settings row is missing or locked — re-run supabase/schema.sql (it seeds the row), or check your account's permissions.";

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();

  const parsed = parseSettingsForm(formData);
  if (parsed.message) return fail(parsed.message, parsed.fieldErrors);

  const expected = str(formData, "updated_at");
  if (!expected) return fail(STALE_FORM);

  const supabase = await createClient();
  const write = await guardedUpdate(
    supabase,
    "site_settings",
    1,
    expected,
    parsed.values as SettingsValues,
    { actorId: me.id }
  );
  if (write.kind === "gone" || write.kind === "denied") return fail(SETTINGS_MISSING);
  if (write.kind !== "ok") return outcomeFail(write, SETTINGS_MISSING);

  revalidateSettings();
  return ok("Settings saved — the public site is updated.", { updatedAt: write.updatedAt });
}
