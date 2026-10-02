"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { services as staticServices } from "@/lib/services";
import { team as staticTeam } from "@/lib/team";
import {
  NOTHING_CHANGED,
  dbFail,
  fail,
  ids,
  int,
  isUuid,
  ok,
  requireStaff,
  str,
  toList,
  zodFail,
} from "./_lib/server";

/**
 * Server actions for the three things the panel couldn't edit before:
 * services, the public team roster, and the leads inbox.
 *
 * Separate file from actions.ts purely to keep that one readable — Next.js is
 * happy with server actions spread across modules. The shared helpers live in
 * ./_lib/server.ts because a `"use server"` module may only export async
 * functions, so `ok`/`fail` can't be exported from here.
 *
 * Every UPDATE/DELETE asks for the affected rows back: Supabase reports a write
 * that row-level security filtered out as a success touching zero rows, and
 * without the check the panel would say "Saved." when nothing was.
 */

export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ===========================================================================
   services

   Note the revalidate set: services render on the landing page, on /services,
   AND in the footer of every page. The footer lives in the root layout, so a
   save must invalidate the layout too — without that an edit looks saved but
   the footer keeps the old list until the next deploy.
   =========================================================================== */

const ICON_VALUES = ["web", "app", "design", "cloud", "ai", "consult"] as const;

const ServiceSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(60, "Keep the slug under 60 characters")
    .regex(slugRe, "Use lowercase letters, numbers and single hyphens"),
  title: z.string().min(1, "Title is required").max(120),
  blurb: z.string().max(300),
  detail: z.string().max(2000),
  icon: z.enum(ICON_VALUES, { message: "Pick one of the six icons" }),
  published: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

function revalidateServices() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]/services", "page");
  revalidatePath("/[lang]", "page");
  revalidatePath("/[lang]", "layout"); // the footer lists services on every public page
}

export async function saveService(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That service id isn't valid — reload the page.");

  const parsed = ServiceSchema.safeParse({
    slug: str(formData, "slug").toLowerCase(),
    title: str(formData, "title"),
    blurb: str(formData, "blurb"),
    detail: str(formData, "detail"),
    icon: str(formData, "icon") || "web",
    published: formData.get("published") === "on",
    sort_order: int(formData, "sort_order"),
  });
  if (!parsed.success) return zodFail(parsed.error);

  const record = { ...parsed.data, deliverables: toList(formData.get("deliverables"), { max: 12, maxLen: 60 }) };
  const taken = `“${record.slug}” is already used by another service.`;

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase
      .from("services")
      .update(record)
      .eq("id", id)
      .select("id");
    if (error) return error.code === "23505" ? fail(taken, { slug: taken }) : dbFail(error);
    if (!data?.length) return fail(NOTHING_CHANGED);
    revalidateServices();
    return ok("Service updated — live on the site now.");
  }

  const { data, error } = await supabase.from("services").insert(record).select("id").single();
  if (error) return error.code === "23505" ? fail(taken, { slug: taken }) : dbFail(error);

  revalidateServices();
  return ok(
    record.published ? "Service created and published." : "Service created (hidden).",
    { id: data.id as string }
  );
}

export async function deleteService(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing service id.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .select("title");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateServices();
  return ok(`Deleted “${data[0].title}”.`);
}

/**
 * Seed from lib/services.ts — the same "import what's already on the site"
 * escape hatch the projects page has, so a fresh database doesn't start empty
 * and force someone to retype the six offerings. ON CONFLICT (slug) DO NOTHING
 * makes a double click — or two tabs — import each service exactly once.
 */
export async function importStaticServices(): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("services")
    .select("*", { count: "exact", head: true });
  if (countError) return dbFail(countError);
  if (count) {
    return fail(
      `There ${count === 1 ? "is" : "are"} already ${count} service${count === 1 ? "" : "s"} — nothing imported.`
    );
  }

  const rows = staticServices.map((s, i) => ({
    slug: s.slug,
    title: s.title,
    blurb: s.blurb,
    detail: s.detail,
    deliverables: s.deliverables,
    icon: s.icon,
    published: true,
    sort_order: i,
  }));

  const { data, error } = await supabase
    .from("services")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
    .select("id");
  if (error) return dbFail(error);

  revalidateServices();
  const n = data?.length ?? rows.length;
  return ok(`Imported ${n} service${n === 1 ? "" : "s"}.`);
}

/* ===========================================================================
   team_members — the PUBLIC roster on /about.
   Not panel logins; see the note on the table in supabase/schema.sql.
   =========================================================================== */

const MemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  role: z.string().max(160),
  initials: z
    .string()
    .max(4, "Up to 4 characters")
    .regex(/^[\p{L}\p{N}]*$/u, "Letters and numbers only"),
  published: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

function revalidateRoster() {
  revalidatePath("/admin", "layout");
  revalidatePath("/[lang]/about", "page");
}

export async function saveMember(formData: FormData): Promise<ActionResult> {
  await requireStaff();

  const id = str(formData, "id");
  if (id && !isUuid(id)) return fail("That member id isn't valid — reload the page.");

  const parsed = MemberSchema.safeParse({
    name: str(formData, "name"),
    role: str(formData, "role"),
    initials: str(formData, "initials").toUpperCase(),
    published: formData.get("published") === "on",
    sort_order: int(formData, "sort_order"),
  });
  if (!parsed.success) return zodFail(parsed.error);

  const row = parsed.data;
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("team_members")
      .update(row)
      .eq("id", id)
      .select("id");
    if (error) return dbFail(error);
    if (!data?.length) return fail(NOTHING_CHANGED);
    revalidateRoster();
    return ok(`${row.name} updated.`);
  }

  const { data, error } = await supabase.from("team_members").insert(row).select("id").single();
  if (error) return dbFail(error);

  revalidateRoster();
  return ok(`${row.name} added to the roster.`, { id: data.id as string });
}

export async function deleteMember(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Missing member id.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", id)
    .select("name");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateRoster();
  return ok(`${data[0].name} removed from the roster.`);
}

/**
 * team_members has no natural unique key to make this idempotent at the
 * database level, so it refuses when the table already has rows; the button
 * disables itself while pending, which covers the double click.
 */
export async function importStaticTeam(): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true });
  if (countError) return dbFail(countError);
  if (count) {
    return fail(
      `There ${count === 1 ? "is" : "are"} already ${count} member${count === 1 ? "" : "s"} — nothing imported.`
    );
  }

  const rows = staticTeam.map((m, i) => ({
    name: m.name,
    role: m.role,
    initials: m.initials,
    published: true,
    sort_order: i,
  }));

  const { error } = await supabase.from("team_members").insert(rows);
  if (error) return dbFail(error);

  revalidateRoster();
  return ok(`Imported ${rows.length} team members.`);
}

/* ===========================================================================
   leads inbox — contact submissions + chat transcripts

   A chat conversation is stored as several snapshot rows (see
   app/admin/_lib/inbox.ts), and the inbox shows them as one thread — so these
   actions take every `id` in the thread and apply to all of them. Otherwise
   "Mark handled" would leave the older snapshots open and the badge would
   never clear.
   =========================================================================== */

function revalidateInbox() {
  // the layout too: it renders the unread badge in the nav
  revalidatePath("/admin", "layout");
}

export async function setLeadHandled(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const leadIds = ids(formData);
  const raw = str(formData, "handled");
  if (!leadIds.length || (raw !== "true" && raw !== "false")) return fail("Invalid request.");
  const handled = raw === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ handled })
    .in("id", leadIds)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateInbox();
  return ok(handled ? "Marked as handled." : "Reopened.");
}

export async function deleteLead(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const leadIds = ids(formData);
  if (!leadIds.length) return fail("Missing lead id.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .delete()
    .in("id", leadIds)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidateInbox();
  return ok("Deleted.");
}
