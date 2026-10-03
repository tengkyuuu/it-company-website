import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeLimit, hashKey } from "@/lib/security";
import { ingestSchema, MAX_INGEST_BYTES, toStoredPayload } from "@/lib/status-schema";
import { checkIngestToken, readCappedText } from "./request";

export const runtime = "nodejs"; // node:crypto (token check, lib/security)
export const dynamic = "force-dynamic";

/**
 * POST /api/status/ingest — GitHub Actions (.github/workflows/status.yml)
 * reports the latest test run / Lighthouse audit for the public /status page.
 *
 * Order matters; nothing is read, charged or written until the step before
 * it has passed:
 *   1. auth — `Authorization: Bearer <STATUS_INGEST_TOKEN>`, timing-safe
 *      (./request.ts). Unset/short env → 503, wrong token → 401; both bodies
 *      are a bare `{ ok: false }` — nothing about why.
 *   2. the store must be configured (service role) → else 503.
 *   3. durable rate limit: 30 per hour for the endpoint as a whole, FAIL
 *      CLOSED. Charged after auth on purpose: before it, anyone could burn the
 *      budget and lock CI out; after it, only a leaked token can, and even
 *      then it's capped. CI posts ~1 report per push and 1 per deploy.
 *   4. body: application/json, ≤ 64 KB counted on the stream, UTF-8.
 *   5. zod (lib/status-schema.ts) — strict, per kind. The caller is
 *      authenticated, so a 400 lists the issue paths to make CI logs useful.
 *   6. upsert `status_reports` (one row per kind) with the service role;
 *      `received_at` is the SERVER's clock, never the runner's.
 *   7. revalidate /status in both locales (the route pattern, not a URL).
 *
 * A Route Handler for the same reason as /api/contact: a stable URL that
 * survives redeploys. Middleware doesn't run for /api, so every check is here.
 */
const LIMIT = { limit: 30, windowSeconds: 60 * 60 };
const WRITE_TIMEOUT_MS = 5000;

const reply = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  // 1. auth
  const auth = checkIngestToken(req.headers.get("authorization"), process.env.STATUS_INGEST_TOKEN);
  if (auth === "unconfigured") return reply(503, { ok: false });
  if (auth !== "ok") return reply(401, { ok: false });

  // 2. somewhere to write
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return reply(503, { ok: false, error: "store" });
  }

  // 3. rate limit
  const allowed = await consumeLimit(hashKey("status:ingest"), LIMIT.limit, LIMIT.windowSeconds, {
    failClosed: true,
  });
  if (!allowed) {
    return reply(429, { ok: false, error: "rate" }, { "Retry-After": String(LIMIT.windowSeconds) });
  }

  // 4. body
  if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get("content-type") ?? "")) {
    return reply(415, { ok: false, error: "content_type" });
  }
  const body = await readCappedText(req, MAX_INGEST_BYTES);
  if (!body.ok) {
    return body.reason === "too_large"
      ? reply(413, { ok: false, error: "too_large" })
      : reply(400, { ok: false, error: "encoding" });
  }
  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return reply(400, { ok: false, error: "json" });
  }

  // 5. validate
  const parsed = ingestSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => ({
      path: i.path.map(String).join("."),
      message: i.message,
    }));
    return reply(400, { ok: false, error: "invalid", issues });
  }
  const report = parsed.data;

  // 6. store
  try {
    const { data, error } = await createAdminClient()
      .from("status_reports")
      .upsert(
        {
          kind: report.kind,
          payload: toStoredPayload(report),
          commit_sha: report.commitSha,
          received_at: new Date().toISOString(),
        },
        { onConflict: "kind" }
      )
      .select("kind")
      .abortSignal(AbortSignal.timeout(WRITE_TIMEOUT_MS));
    // every write checks affected rows: 0 rows is a failure, not "saved"
    if (error || !data?.length) {
      console.error("[status] ingest write failed:", error?.message ?? "no row written");
      return reply(502, { ok: false, error: "store" });
    }
  } catch (err) {
    console.error("[status] ingest write failed:", err instanceof Error ? err.message : err);
    return reply(502, { ok: false, error: "store" });
  }

  // 7. both locales of /status re-render on their next request
  revalidatePath("/[lang]/status", "page");
  return reply(200, { ok: true, kind: report.kind });
}
