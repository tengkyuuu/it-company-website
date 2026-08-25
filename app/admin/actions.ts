"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/lib/site";
import { projects as staticProjects } from "@/lib/work";

export type ActionResult = { ok: boolean; message: string };

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

/** Every mutation goes through this: no session, no writes. */
async function requireStaff() {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  return profile;
}

async function requireAdmin() {
  const profile = await requireStaff();
  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new Error("Only owners and admins can manage the team.");
  }
  return profile;
}

/** "a, b\nc" → ["a","b","c"] */
function toList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
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

const ProjectSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(60)
    .regex(slugRe, "Use lowercase letters, numbers and single hyphens"),
  name: z.string().min(1, "Name is required").max(120),
  category: z.string().max(120).default(""),
  url: z.string().max(200).default(""),
  live_url: z
    .string()
    .trim()
    .url("Live URL must be a full https:// address")
    .optional()
    .or(z.literal("")),
  year: z.string().max(20).default(""),
  summary: z.string().max(400).default(""),
  description: z.string().max(4000).default(""),
  img: z.string().max(500).optional().or(z.literal("")),
  img2: z.string().max(500).optional().or(z.literal("")),
  published: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export async function saveProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const dots = [
    String(formData.get("dot1") ?? ""),
    String(formData.get("dot2") ?? ""),
    String(formData.get("dot3") ?? ""),
  ];
  if (!dots.every((d) => hexRe.test(d))) {
    return fail("All three signature colors must be 6-digit hex, e.g. #7c5cff.");
  }

  const parsed = ProjectSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    slug: String(formData.get("slug") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    url: String(formData.get("url") ?? "").trim(),
    live_url: String(formData.get("live_url") ?? "").trim(),
    year: String(formData.get("year") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    img: String(formData.get("img") ?? "").trim(),
    img2: String(formData.get("img2") ?? "").trim(),
    published: formData.get("published") === "on",
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const { id, ...values } = parsed.data;
  const row = {
    ...values,
    live_url: values.live_url ? values.live_url : null,
    img: values.img ? values.img : null,
    img2: values.img2 ? values.img2 : null,
    highlights: toList(formData.get("highlights")),
    tags: toList(formData.get("tags")),
    dots,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("projects").update(row).eq("id", id)
    : await supabase.from("projects").insert(row);

  if (error) {
    return fail(
      error.code === "23505"
        ? `The slug "${row.slug}" is already taken.`
        : error.message
    );
  }

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  revalidatePath(`/projects/${row.slug}`);
  revalidatePath("/");
  return ok(id ? "Project saved." : "Project created.");
}

export async function deleteProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Missing project id.");

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  revalidatePath("/");
  return ok("Project deleted.");
}

export async function togglePublish(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("published") ?? "") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ published: next })
    .eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  revalidatePath("/");
  return ok(next ? "Published." : "Unpublished.");
}

/** Nudge a project up or down by swapping sort_order with its neighbour. */
export async function moveProject(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "up") === "up" ? -1 : 1;

  const supabase = await createClient();
  const { data: all, error: listError } = await supabase
    .from("projects")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (listError || !all) return fail(listError?.message ?? "Could not reorder.");

  const i = all.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return ok("Already at the edge.");

  // rewrite the whole column so previously-equal sort_orders become distinct
  const reordered = [...all];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  for (let k = 0; k < reordered.length; k++) {
    const { error } = await supabase
      .from("projects")
      .update({ sort_order: k })
      .eq("id", reordered[k].id);
    if (error) return fail(error.message);
  }

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  revalidatePath("/");
  return ok("Order updated.");
}

/**
 * Seed the table from the projects checked into lib/work.ts, so the first run
 * starts from the real portfolio instead of an empty list. Skips any slug that
 * already exists, which makes it safe to press twice.
 */
export async function importStaticProjects(): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("projects")
    .select("slug");
  if (readError) return fail(readError.message);

  const have = new Set((existing ?? []).map((r) => r.slug));
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
      sort_order: have.size + i,
    }));

  if (rows.length === 0) return ok("Nothing new to import.");

  const { error } = await supabase.from("projects").insert(rows);
  if (error) return fail(error.message);

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  revalidatePath("/");
  return ok(`Imported ${rows.length} project${rows.length === 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------------------
// team
// ---------------------------------------------------------------------------

const InviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["admin", "editor"]),
  full_name: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Not allowed.");
  }

  const parsed = InviteSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "editor"),
    full_name: String(formData.get("full_name") ?? ""),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Service role key missing.");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || site.url;
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    // handle_new_user() reads role/full_name out of raw_user_meta_data
    data: { role: parsed.data.role, full_name: parsed.data.full_name || null },
    redirectTo: `${origin}/admin/login`,
  });

  if (error) return fail(error.message);

  revalidatePath("/admin/team");
  return ok(`Invite sent to ${parsed.data.email}.`);
}

export async function updateRole(formData: FormData): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Not allowed.");
  }

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["owner", "admin", "editor"].includes(role)) return fail("Unknown role.");
  if (id === me.id) return fail("You can't change your own role.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/admin/team");
  return ok("Role updated.");
}

export async function removeUser(formData: FormData): Promise<ActionResult> {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Not allowed.");
  }

  const id = String(formData.get("id") ?? "");
  if (id === me.id) return fail("You can't remove yourself.");

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();
  if (target?.role === "owner") return fail("The owner can't be removed.");

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Service role key missing.");
  }

  // deleting the auth user cascades to profiles
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return fail(error.message);

  revalidatePath("/admin/team");
  return ok("Teammate removed.");
}

// ---------------------------------------------------------------------------
// site settings
// ---------------------------------------------------------------------------

const SettingsSchema = z.object({
  brand_name: z.string().trim().min(1, "Brand name is required").max(80),
  tagline: z.string().trim().max(200).default(""),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(60).default(""),
  address_line1: z.string().trim().max(160).default(""),
  address_line2: z.string().trim().max(160).default(""),
  hours: z.string().trim().max(120).default(""),
  availability: z.string().trim().max(120).default(""),
  available: z.boolean().default(true),
});

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const parsed = SettingsSchema.safeParse({
    brand_name: String(formData.get("brand_name") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address_line1: String(formData.get("address_line1") ?? ""),
    address_line2: String(formData.get("address_line2") ?? ""),
    hours: String(formData.get("hours") ?? ""),
    availability: String(formData.get("availability") ?? ""),
    available: formData.get("available") === "on",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  // socials arrive as parallel social_label[] / social_href[] arrays
  const labels = formData.getAll("social_label").map(String);
  const hrefs = formData.getAll("social_href").map(String);
  const socials = labels
    .map((label, i) => ({ label: label.trim(), href: (hrefs[i] ?? "").trim() }))
    .filter((s) => s.label && s.href);

  for (const s of socials) {
    if (!/^https?:\/\//i.test(s.href)) {
      return fail(`"${s.label}" needs a full URL starting with https://`);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({ ...parsed.data, socials })
    .eq("id", 1);
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return ok("Settings saved.");
}
