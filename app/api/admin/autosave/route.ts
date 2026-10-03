import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isJobClosed, manilaToday } from "@/lib/cms";
import { describeDbError, requireStaffForRoute } from "@/app/admin/_lib/server";
import {
  parseAutosaveRequest,
  type AutosaveEntity,
  type AutosaveFields,
  type AutosaveResponse,
} from "@/app/admin/_lib/autosave";
import { autosavePatch, stampPublishedAt } from "@/app/admin/_lib/schemas";
import {
  guardedUpdate,
  postImages,
  productImages,
  projectImages,
  revalidateProjects,
  revalidateRoster,
  revalidateSection,
  revalidateServices,
  revalidateSettings,
  scheduleEmbedProbe,
} from "@/app/admin/_lib/content";
import { removeOrphanedUploads } from "@/app/admin/_lib/storage";
import { EMBED_UNCHECKED, planEmbedCheck } from "@/lib/net/embed-plan";

/**
 * POST /api/admin/autosave — the editors' debounced background save.
 *
 * A Route Handler, not a Server Action, for the same reason as the contact
 * form: a stable URL. A Server Action's id changes with each deploy, so a tab
 * left open across a deploy would start failing every autosave with "Failed to
 * find Server Action" mid-edit.
 *
 * Request  { entity, id, expectedUpdatedAt, fields: { input: value | value[] } }
 *          — only the inputs that changed (whole SaveUnits, see _lib/autosave.ts)
 * Response 200 { ok: true, updatedAt, saved: [inputs written], fieldErrors? }
 *          409 { ok: false, conflict: { updatedAt, by, at, self } }
 *          410 { ok: false, gone: true, error }
 *          401/403 (requireStaffForRoute), 400 bad request, 422 refused, 503 retry
 *
 * Never autosaved: slug, published, sort_order — those stay on the explicit
 * Save (a half-typed slug would break a live URL; publishing is deliberate).
 * Units that fail validation are reported, the rest are written: one bad field
 * doesn't block the others. Published items DO change live on autosave
 * (same as the reference project); the revision trigger keeps one snapshot
 * per editor per 5 minutes, so History stays useful.
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const reply = (body: AutosaveResponse, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

type Row = Record<string, unknown>;

/** Values the rules need from the stored row but that autosave never writes. */
function contextFor(entity: AutosaveEntity, before: Row): AutosaveFields {
  // clearing a PUBLISHED project's screenshot is refused, as on Save
  if (entity === "projects") return { published: before.published ? "on" : [] };
  return {};
}

/** Turn parser output into the exact columns the explicit Save would write. */
function finalize(entity: AutosaveEntity, patch: Row, before: Row): Row {
  if (entity === "posts" && "published_at" in patch) {
    return {
      ...patch,
      published_at: stampPublishedAt(
        patch.published_at as string,
        (before.published_at as string | null) ?? null
      ),
    };
  }
  return patch;
}

const IMAGE_COLUMNS = ["img", "img2", "gallery", "image", "cover_image"];

async function afterWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entity: AutosaveEntity,
  patch: Row,
  before: Row
) {
  if (IMAGE_COLUMNS.some((c) => c in patch)) {
    const urls =
      entity === "projects"
        ? projectImages(before)
        : entity === "products"
          ? productImages(before)
          : entity === "posts"
            ? postImages(before)
            : [];
    if (urls.length) await removeOrphanedUploads(supabase, urls as (string | null)[]);
  }

  switch (entity) {
    case "projects":
      return revalidateProjects();
    case "services":
      return revalidateServices();
    case "team_members":
      return revalidateRoster();
    case "site_settings":
      return revalidateSettings();
    case "products":
      // `published` is never autosaved, so the nav link can't appear/vanish
      return revalidateSection("products", false);
    case "posts":
      return revalidateSection("blog", false);
    case "jobs": {
      // …but moving a role's closing date can list or unlist it
      const today = manilaToday();
      const listed = (r: Row) =>
        Boolean(r.published) && !isJobClosed((r.closes_at as string | null) ?? null, today);
      return revalidateSection("careers", listed(before) !== listed({ ...before, ...patch }));
    }
  }
}

/** A database error: retry the transient kind (network, paused project), not the rest. */
function dbErrorReply(error: { code?: string; message?: string }) {
  const message = describeDbError(error);
  const transient = !error.code || /reach the database|session has expired/i.test(message);
  return reply({ ok: false, error: message, retry: transient }, transient ? 503 : 422);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit it; cookies are SameSite=Lax anyway
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const guard = await requireStaffForRoute();
  if ("response" in guard) return guard.response;

  // A cross-site <form enctype="text/plain"> can't set this header, and a
  // cross-site fetch() that sets it needs a CORS preflight we never grant.
  if (!(request.headers.get("content-type") ?? "").includes("application/json") || !sameOrigin(request)) {
    return reply({ ok: false, error: "Bad request.", retry: false }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "Bad request.", retry: false }, 400);
  }
  const req = parseAutosaveRequest(body);
  if ("error" in req) return reply({ ok: false, error: req.error, retry: false }, 400);
  const { entity, id, expectedUpdatedAt, fields } = req;

  const supabase = await createClient();
  const { data: before, error: readError } = await supabase
    .from(entity)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return dbErrorReply(readError);
  if (!before) {
    return reply({ ok: false, gone: true, error: "This item was deleted in another tab." }, 410);
  }

  const { patch, saved, fieldErrors } = autosavePatch(entity, fields, contextFor(entity, before));
  const errors = Object.keys(fieldErrors).length ? { fieldErrors } : {};

  // nothing valid to write: answer without touching the row (no version bump)
  if (!Object.keys(patch).length) {
    return reply({ ok: true, updatedAt: expectedUpdatedAt, saved: [], ...errors });
  }

  const row = finalize(entity, patch, before);
  // the live_url unit: a changed address clears the old embed verdict in this
  // same write, and is re-checked after the response (lib/net/embed-plan.ts)
  const embed =
    entity === "projects" ? planEmbedCheck(before, row, { explicit: false }) : null;
  const write = await guardedUpdate(
    supabase,
    entity,
    id,
    expectedUpdatedAt,
    embed?.reset ? { ...row, ...EMBED_UNCHECKED } : row,
    { actorId: guard.profile.id }
  );

  switch (write.kind) {
    case "ok":
      await afterWrite(supabase, entity, row, before);
      if (embed?.probe && embed.url) scheduleEmbedProbe(supabase, String(id), embed.url);
      return reply({ ok: true, updatedAt: write.updatedAt, saved, ...errors });
    case "conflict":
      return reply({ ok: false, conflict: write.conflict }, 409);
    case "gone":
      return reply({ ok: false, gone: true, error: "This item was deleted in another tab." }, 410);
    case "denied":
      return reply(
        {
          ok: false,
          error: "The database refused this for your account — ask the owner to check your access under Team.",
        },
        403
      );
    case "error":
      return dbErrorReply(write.error);
  }
}
