import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The CI → /status pipeline (app/api/status/ingest, lib/status-schema.ts,
 * scripts/ci/status-payload.mjs). What must never happen silently:
 *  - a report stored without the right token, or before it validated;
 *  - the token compared in a way that leaks it (early-exit / length);
 *  - a number shown that CI didn't report: a missing score coerced to 0, a
 *    score rounded UP, totals that don't add up, a "success" with failures;
 *  - CI's payload builder drifting from the endpoint's schema.
 * The database, the limiter and revalidatePath are mocked; the route's own
 * logic runs.
 */

// ── mocks ────────────────────────────────────────────────────────────────────

const consumeLimit = vi.fn<(key: string, limit: number, windowSeconds: number, opts?: { failClosed?: boolean }) => Promise<boolean>>();
const revalidatePath = vi.fn<(path: string, type?: string) => void>();

type UpsertCall = { table: string; row: Record<string, unknown>; opts: unknown };
const upserts: UpsertCall[] = [];
let writeResult: { data: unknown; error: { message: string } | null } = { data: [{ kind: "tests" }], error: null };

const fakeAdminClient = () => ({
  from: (table: string) => ({
    upsert: (row: Record<string, unknown>, opts: unknown) => {
      upserts.push({ table, row, opts });
      const chain = {
        select: () => chain,
        abortSignal: () => Promise.resolve(writeResult),
      };
      return chain;
    },
  }),
});
const createAdminClient = vi.fn(fakeAdminClient);

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));
vi.mock("@/lib/security", () => ({
  hashKey: (...parts: string[]) => parts.join("|"),
  consumeLimit: (k: string, l: number, w: number, o?: { failClosed?: boolean }) => consumeLimit(k, l, w, o),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string, t?: string) => revalidatePath(p, t),
}));

const { POST } = await import("@/app/api/status/ingest/route");
const { checkIngestToken, readCappedText, MIN_TOKEN_LENGTH } = await import("@/app/api/status/ingest/request");
const S = await import("@/lib/status-schema");
const P = await import("@/scripts/ci/status-payload.mjs");

// ── fixtures ─────────────────────────────────────────────────────────────────

const TOKEN = "a".repeat(32) + "0123456789abcdef0123456789abcdef"; // 64 chars
const SHA = "0123456789abcdef0123456789abcdef01234567";
const RUN = "https://github.com/tengkyuuu/it-company-website/actions/runs/123456789";

const testsReport = (over: Record<string, unknown> = {}) => ({
  success: true,
  totals: { files: 18, failedFiles: 0, tests: 460, passed: 458, failed: 0, skipped: 2, durationMs: 38_412 },
  failing: [],
  failingTotal: 0,
  runner: { os: "ubuntu24", node: "v22.20.0", vitest: "5.0.3" },
  ...over,
});

const page = (path: string, formFactor: "mobile" | "desktop", over: Record<string, unknown> = {}) => ({
  path,
  formFactor,
  ok: true,
  scores: { performance: 61, accessibility: 100, bestPractices: 96, seo: 100 },
  metrics: { lcpMs: 4210, cls: 0.002, tbtMs: 410 },
  ...over,
});

const lighthouseReport = (over: Record<string, unknown> = {}) => ({
  lighthouseVersion: "13.5.0",
  gpu: false,
  runs: 1,
  pages: [page("/", "mobile"), page("/", "desktop"), page("/projects", "mobile")],
  ...over,
});

const body = (kind: "tests" | "lighthouse" = "tests", over: Record<string, unknown> = {}) => ({
  kind,
  commitSha: SHA,
  runUrl: RUN,
  report: kind === "tests" ? testsReport() : lighthouseReport(),
  ...over,
});

const post = (
  payload: unknown,
  { auth = `Bearer ${TOKEN}`, type = "application/json" }: { auth?: string | null; type?: string } = {}
) =>
  POST(
    new Request("http://localhost/api/status/ingest", {
      method: "POST",
      headers: {
        ...(auth === null ? {} : { Authorization: auth }),
        "Content-Type": type,
      },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );

beforeEach(() => {
  vi.stubEnv("STATUS_INGEST_TOKEN", TOKEN);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  consumeLimit.mockReset().mockResolvedValue(true);
  revalidatePath.mockReset();
  createAdminClient.mockReset().mockImplementation(fakeAdminClient);
  upserts.length = 0;
  writeResult = { data: [{ kind: "tests" }], error: null };
});

afterEach(() => vi.unstubAllEnvs());

// ── token check ──────────────────────────────────────────────────────────────

describe("checkIngestToken", () => {
  it("accepts the right token (scheme is case-insensitive)", () => {
    expect(checkIngestToken(`Bearer ${TOKEN}`, TOKEN)).toBe("ok");
    expect(checkIngestToken(`bearer ${TOKEN}`, TOKEN)).toBe("ok");
    expect(checkIngestToken(`Bearer ${TOKEN}`, `  ${TOKEN}\n`)).toBe("ok"); // env values get trimmed
  });

  it("denies a wrong token of the same length", () => {
    const wrong = TOKEN.slice(0, -1) + (TOKEN.endsWith("f") ? "e" : "f");
    expect(wrong).toHaveLength(TOKEN.length);
    expect(checkIngestToken(`Bearer ${wrong}`, TOKEN)).toBe("denied");
  });

  it("denies a wrong token of a different length (no throw from timingSafeEqual)", () => {
    expect(checkIngestToken(`Bearer ${TOKEN.slice(0, 40)}`, TOKEN)).toBe("denied");
    expect(checkIngestToken(`Bearer ${TOKEN}x`, TOKEN)).toBe("denied");
    expect(checkIngestToken(`Bearer x`, TOKEN)).toBe("denied");
  });

  it("denies a missing, malformed or oversized header", () => {
    expect(checkIngestToken(null, TOKEN)).toBe("denied");
    expect(checkIngestToken("", TOKEN)).toBe("denied");
    expect(checkIngestToken(TOKEN, TOKEN)).toBe("denied"); // no scheme
    expect(checkIngestToken(`Basic ${TOKEN}`, TOKEN)).toBe("denied");
    expect(checkIngestToken(`Bearer ${TOKEN} extra`, TOKEN)).toBe("denied");
    expect(checkIngestToken(`Bearer ${"x".repeat(5000)}`, TOKEN)).toBe("denied");
  });

  it("is 'unconfigured' when the env is missing, blank or too short — whatever the header says", () => {
    expect(checkIngestToken(`Bearer ${TOKEN}`, undefined)).toBe("unconfigured");
    expect(checkIngestToken(`Bearer ${TOKEN}`, "   ")).toBe("unconfigured");
    const short = "s".repeat(MIN_TOKEN_LENGTH - 1);
    expect(checkIngestToken(`Bearer ${short}`, short)).toBe("unconfigured");
  });

  it("compares digests with timingSafeEqual, never the raw strings", () => {
    const src = readFileSync(new URL("../app/api/status/ingest/request.ts", import.meta.url), "utf8");
    expect(src).toMatch(/timingSafeEqual\(\s*got\s*,\s*want\s*\)/);
    expect(src).toMatch(/createHash\("sha256"\)/);
    expect(src).not.toMatch(/match\[1\]\s*===|===\s*secret/);
  });
});

describe("readCappedText", () => {
  const req = (b: BodyInit, headers: Record<string, string> = {}) =>
    new Request("http://localhost/x", { method: "POST", body: b, headers });

  it("reads a body under the cap", async () => {
    expect(await readCappedText(req("hello"), 10)).toEqual({ ok: true, text: "hello" });
  });

  it("refuses an over-cap body even when Content-Length lies or is absent", async () => {
    expect(await readCappedText(req("x".repeat(11)), 10)).toEqual({ ok: false, reason: "too_large" });
    expect(await readCappedText(req("tiny", { "content-length": "999999" }), 10)).toEqual({
      ok: false,
      reason: "too_large",
    });
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 5; i++) c.enqueue(new Uint8Array(4));
        c.close();
      },
    });
    const streamed = new Request("http://localhost/x", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readCappedText(streamed, 10)).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects invalid UTF-8", async () => {
    expect(await readCappedText(req(new Uint8Array([0xff, 0xfe, 0x41])), 10)).toEqual({
      ok: false,
      reason: "encoding",
    });
  });
});

// ── schema ───────────────────────────────────────────────────────────────────

describe("ingestSchema", () => {
  const ok = (b: unknown) => S.ingestSchema.safeParse(b).success;

  it("accepts a well-formed tests and lighthouse report", () => {
    expect(ok(body("tests"))).toBe(true);
    expect(ok(body("lighthouse"))).toBe(true);
    expect(ok({ ...body("tests"), runUrl: undefined })).toBe(true); // run URL is optional
    expect(ok(body("tests", { runUrl: `${RUN}/attempts/2` }))).toBe(true);
  });

  it("requires a full lowercase 40-hex commit SHA", () => {
    expect(ok(body("tests", { commitSha: SHA.slice(0, 7) }))).toBe(false);
    expect(ok(body("tests", { commitSha: SHA.toUpperCase() }))).toBe(false);
    expect(ok(body("tests", { commitSha: `${SHA}0` }))).toBe(false);
  });

  it("only links to this repository's runs, over https", () => {
    for (const runUrl of [
      "https://github.com/someone-else/it-company-website/actions/runs/1",
      "http://github.com/tengkyuuu/it-company-website/actions/runs/1",
      "https://github.com.evil.example/tengkyuuu/it-company-website/actions/runs/1",
      `${RUN}?x=1`,
      "https://github.com/tengkyuuu/it-company-website/commit/abc",
      "javascript:alert(1)",
    ]) {
      expect(ok(body("tests", { runUrl })), runUrl).toBe(false);
    }
  });

  it("is strict: unknown keys and unknown kinds are rejected", () => {
    expect(ok({ ...body("tests"), extra: 1 })).toBe(false);
    expect(ok(body("tests", { report: { ...testsReport(), coverage: 99 } }))).toBe(false);
    expect(ok(body("tests", { kind: "coverage" }))).toBe(false);
    // a tests report under the lighthouse kind
    expect(ok({ ...body("lighthouse"), report: testsReport() })).toBe(false);
  });

  it("tests totals must add up, and a run with failures can't be a success", () => {
    const totals = testsReport().totals;
    expect(ok(body("tests", { report: testsReport({ totals: { ...totals, passed: 459 } }) }))).toBe(false);
    expect(
      ok(
        body("tests", {
          report: testsReport({
            totals: { ...totals, passed: 457, failed: 1, failedFiles: 1 },
            failing: [{ file: "tests/a.test.ts", name: "a fails" }],
            failingTotal: 1,
          }),
        })
      )
    ).toBe(false); // success: true with a failure
    expect(
      ok(
        body("tests", {
          report: testsReport({
            success: false,
            totals: { ...totals, passed: 457, failed: 1, failedFiles: 1 },
            failing: [{ file: "tests/a.test.ts", name: "a fails" }],
            failingTotal: 1,
          }),
        })
      )
    ).toBe(true);
    expect(ok(body("tests", { report: testsReport({ totals: { ...totals, failedFiles: 19 } }) }))).toBe(false);
  });

  it("caps and cleans the failing list", () => {
    const many = Array.from({ length: S.MAX_FAILING + 1 }, (_, i) => ({ file: "tests/a.test.ts", name: `t${i}` }));
    const failing = (list: unknown[], total = list.length) =>
      body("tests", {
        report: testsReport({
          success: false,
          totals: { files: 1, failedFiles: 1, tests: 30, passed: 30 - total, failed: total, skipped: 0, durationMs: 1 },
          failing: list,
          failingTotal: total,
        }),
      });
    expect(ok(failing(many))).toBe(false);
    expect(ok(failing(many.slice(0, S.MAX_FAILING), S.MAX_FAILING + 1))).toBe(true); // capped list, true total
    expect(ok(failing([{ file: "tests/a.test.ts", name: "bad\u0007name" }]))).toBe(false);
    expect(ok(failing([{ file: "tests/a.test.ts", name: "x".repeat(301) }]))).toBe(false);
  });

  it("lighthouse scores are integers 0–100 or null — never fractional, never out of range", () => {
    const withScore = (performance: unknown) =>
      body("lighthouse", { report: lighthouseReport({ pages: [page("/", "mobile", { scores: { ...page("/", "mobile").scores, performance } })] }) });
    expect(ok(withScore(0))).toBe(true);
    expect(ok(withScore(100))).toBe(true);
    expect(ok(withScore(null))).toBe(true);
    expect(ok(withScore(101))).toBe(false);
    expect(ok(withScore(-1))).toBe(false);
    expect(ok(withScore(87.5))).toBe(false);
    expect(ok(withScore("87"))).toBe(false);
  });

  it("lighthouse pages: paths only, known form factors, no duplicates, no numbers on a failed audit", () => {
    const pages = (list: unknown[]) => body("lighthouse", { report: lighthouseReport({ pages: list }) });
    expect(ok(pages([page("https://evil.example/", "mobile")]))).toBe(false);
    expect(ok(pages([page("/Projects", "mobile")]))).toBe(false);
    expect(ok(pages([page("/projects/", "mobile")]))).toBe(false);
    expect(ok(pages([page("/", "tablet" as "mobile")]))).toBe(false);
    expect(ok(pages([page("/", "mobile"), page("/", "mobile")]))).toBe(false);
    expect(ok(pages([]))).toBe(false);
    expect(ok(pages([page("/", "mobile", { ok: false })]))).toBe(false); // scores on a failed audit
    expect(
      ok(
        pages([
          page("/", "mobile", {
            ok: false,
            scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
            metrics: { lcpMs: null, cls: null, tbtMs: null },
          }),
        ])
      )
    ).toBe(true);
  });
});

// ── the route ────────────────────────────────────────────────────────────────

describe("POST /api/status/ingest", () => {
  it("503 with a bare body when STATUS_INGEST_TOKEN is unset — nothing charged, nothing written", async () => {
    vi.stubEnv("STATUS_INGEST_TOKEN", "");
    const res = await post(body());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(consumeLimit).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  it("401 with a bare body for a wrong / missing token — nothing charged, nothing written", async () => {
    for (const auth of [`Bearer ${"b".repeat(64)}`, `Bearer short`, null]) {
      const res = await post(body(), { auth });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false });
    }
    expect(consumeLimit).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("an authenticated but invalid payload is a 400 listing the issues — and writes nothing", async () => {
    const res = await post(body("tests", { commitSha: "abc" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid");
    expect(json.issues.map((i: { path: string }) => i.path)).toContain("commitSha");
    expect(upserts).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects non-JSON, the wrong content type and oversized bodies before parsing — writes nothing", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post(body(), { type: "text/plain" })).status).toBe(415);
    const huge = { ...body(), pad: "x".repeat(S.MAX_INGEST_BYTES) };
    expect((await post(huge)).status).toBe(413);
    expect(upserts).toHaveLength(0);
  });

  it("charges the durable limit (30/hour, fail closed) after auth; over it → 429, nothing written", async () => {
    consumeLimit.mockResolvedValue(false);
    const res = await post(body());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(consumeLimit).toHaveBeenCalledWith("status:ingest", 30, 3600, { failClosed: true });
    expect(upserts).toHaveLength(0);
  });

  it("503 when there is no service-role store to write to", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const res = await post(body());
    expect(res.status).toBe(503);
    expect(upserts).toHaveLength(0);
  });

  it("stores a valid report — one row per kind, server timestamp — and revalidates /status in both locales", async () => {
    const before = Date.now();
    const res = await post(body("lighthouse"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, kind: "lighthouse" });

    expect(upserts).toHaveLength(1);
    const { table, row, opts } = upserts[0];
    expect(table).toBe("status_reports");
    expect(opts).toEqual({ onConflict: "kind" });
    expect(row.kind).toBe("lighthouse");
    expect(row.commit_sha).toBe(SHA);
    expect(row.payload).toEqual({ v: 1, runUrl: RUN, report: lighthouseReport() });
    expect(Date.parse(row.received_at as string)).toBeGreaterThanOrEqual(before);

    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/status", "page");
  });

  it("a failed or zero-row write is a 502 and revalidates nothing", async () => {
    writeResult = { data: null, error: { message: "boom" } };
    expect((await post(body())).status).toBe(502);
    writeResult = { data: [], error: null };
    expect((await post(body())).status).toBe(502);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ── read side ────────────────────────────────────────────────────────────────

describe("parseStatusRows + derived state", () => {
  const row = (kind: string, report: unknown, over: Record<string, unknown> = {}) => ({
    kind,
    payload: { v: 1, runUrl: RUN, report },
    commit_sha: SHA,
    received_at: "2026-10-01T00:00:00Z",
    ...over,
  });

  it("returns typed entries for valid rows", () => {
    const out = S.parseStatusRows([row("tests", testsReport()), row("lighthouse", lighthouseReport())]);
    expect(out.tests?.report.totals.tests).toBe(460);
    expect(out.tests?.commitSha).toBe(SHA);
    expect(out.lighthouse?.report.pages).toHaveLength(3);
  });

  it("drops anything malformed rather than showing a wrong number", () => {
    const bad = [
      row("tests", { ...testsReport(), totals: { ...testsReport().totals, passed: 1 } }),
      row("lighthouse", lighthouseReport(), { commit_sha: "nope" }),
      row("tests", testsReport(), { received_at: "yesterday" }),
      { ...row("tests", testsReport()), payload: { v: 2, runUrl: null, report: testsReport() } },
      row("coverage", testsReport()),
    ];
    expect(S.parseStatusRows(bad)).toEqual({ tests: null, lighthouse: null });
  });

  it("stale strictly after 7 days; failing outranks stale; nothing reported is unknown", () => {
    const at = Date.parse("2026-10-01T00:00:00Z");
    const day = 86_400_000;
    const entry = (report: unknown = testsReport()) => ({
      commitSha: SHA,
      receivedAt: "2026-10-01T00:00:00Z",
      runUrl: null,
      report: S.testsReportSchema.parse(report), // also proves each fixture is valid
    });
    expect(S.isStale("2026-10-01T00:00:00Z", at + 7 * day)).toBe(false);
    expect(S.isStale("2026-10-01T00:00:00Z", at + 7 * day + 1)).toBe(true);
    expect(S.ageInDays("2026-10-01T00:00:00Z", at + 7.9 * day)).toBe(7);
    expect(S.overallHealth(null, at)).toBe("unknown");
    expect(S.overallHealth(entry(), at)).toBe("passing");
    expect(S.overallHealth(entry(), at + 8 * day)).toBe("stale");
    const red = testsReport({
      success: false,
      totals: { ...testsReport().totals, passed: 457, failed: 1, failedFiles: 1 },
      failing: [{ file: "tests/a.test.ts", name: "x" }],
      failingTotal: 1,
    });
    expect(S.overallHealth(entry(red), at + 8 * day)).toBe("failing");
    // runner said no, though nothing individual failed → still not passing
    expect(S.overallHealth(entry(testsReport({ success: false })), at)).toBe("failing");
  });
});

// ── CI payload builders (scripts/ci/status-payload.mjs) ─────────────────────

describe("CI payload builders match the endpoint's schema", () => {
  const ROOT = "/home/runner/work/it-company-website/it-company-website";
  const runner = { os: "ubuntu24", node: "v22.20.0", vitest: "5.0.3" };

  const vitestJson = {
    numTotalTests: 6,
    numPassedTests: 3,
    numFailedTests: 2,
    numPendingTests: 1,
    numTodoTests: 0,
    startTime: 1_000_000,
    success: false,
    testResults: [
      {
        name: `${ROOT}/tests/a.test.ts`,
        status: "failed",
        startTime: 1_000_100,
        endTime: 1_004_000,
        assertionResults: [
          { fullName: "a works", status: "passed" },
          { fullName: "a breaks", status: "failed" },
          { fullName: "a\nbreaks\tagain", status: "failed" },
        ],
      },
      { name: `${ROOT}/tests/b.test.ts`, status: "failed", startTime: 1_000_100, endTime: 1_000_200, assertionResults: [] },
      {
        name: `${ROOT}/tests/c.test.ts`,
        status: "passed",
        startTime: 1_000_100,
        endTime: 1_038_412,
        assertionResults: [
          { fullName: "c one", status: "passed" },
          { fullName: "c two", status: "passed" },
          { fullName: "c skipped", status: "skipped" },
        ],
      },
    ],
  };

  it("builds a tests report that validates, with honest totals and failure names", () => {
    const report = P.buildTestsReport(vitestJson, { rootDir: ROOT, runner });
    expect(S.testsReportSchema.safeParse(report).success).toBe(true);
    expect(report.success).toBe(false);
    expect(report.totals).toEqual({
      files: 3,
      failedFiles: 2,
      tests: 6,
      passed: 3,
      failed: 2,
      skipped: 1,
      durationMs: 38_412,
    });
    expect(report.failing).toEqual([
      { file: "tests/a.test.ts", name: "a breaks" },
      { file: "tests/a.test.ts", name: "a breaks again" },
      { file: "tests/b.test.ts", name: "" }, // failed to load
    ]);
    expect(report.failingTotal).toBe(3);
    const body = P.buildIngestBody("tests", report, { commitSha: SHA, runUrl: RUN });
    expect(S.ingestSchema.safeParse(body).success).toBe(true);
  });

  it("a green run is a success, and a list longer than the cap keeps its true total", () => {
    const green = P.buildTestsReport(
      { numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, success: true, startTime: 0, testResults: [{ name: "x", status: "passed", endTime: 5, assertionResults: [] }] },
      { rootDir: ROOT, runner }
    );
    expect(green.success).toBe(true);
    expect(S.testsReportSchema.safeParse(green).success).toBe(true);

    const n = P.MAX_FAILING + 7;
    const red = P.buildTestsReport(
      {
        numTotalTests: n,
        numPassedTests: 0,
        numFailedTests: n,
        success: false,
        testResults: [
          {
            name: `${ROOT}/tests/z.test.ts`,
            status: "failed",
            assertionResults: Array.from({ length: n }, (_, i) => ({ fullName: `t${i}`, status: "failed" })),
          },
        ],
      },
      { rootDir: ROOT, runner }
    );
    expect(red.failing).toHaveLength(P.MAX_FAILING);
    expect(red.failingTotal).toBe(n);
    expect(red.totals.durationMs).toBeNull(); // no startTime → unknown, not guessed
    expect(S.testsReportSchema.safeParse(red).success).toBe(true);
  });

  it("scores are floored (float error absorbed), timings rounded up, missing values stay null", () => {
    expect(P.toScore(0.29)).toBe(29); // 0.29 * 100 = 28.999999999999996
    expect(P.toScore(0.87)).toBe(87);
    expect(P.toScore(0.899)).toBe(89); // never up to 90
    expect(P.toScore(1)).toBe(100);
    expect(P.toScore(0)).toBe(0);
    expect(P.toScore(null)).toBeNull();
    expect(P.toScore(undefined)).toBeNull();
    expect(P.toMillis(3421.2)).toBe(3422);
    expect(P.toMillis(410)).toBe(410);
    expect(P.toMillis(undefined)).toBeNull();
    expect(P.toCls(0.0021)).toBe(0.003);
    expect(P.toCls(0.003)).toBe(0.003); // 0.003 * 1000 = 3.0000000000000004 must not become 0.004
    expect(P.toCls(0)).toBe(0);
  });

  it("builds a lighthouse report that validates; a failed run is an incomplete audit, not zeros", () => {
    const lhr = (perf: number | null, formFactor = "mobile") => ({
      lighthouseVersion: "13.5.0",
      configSettings: { formFactor },
      categories: {
        performance: { score: perf },
        accessibility: { score: 1 },
        "best-practices": { score: 0.96 },
        seo: { score: 1 },
      },
      audits: {
        "largest-contentful-paint": { numericValue: 4209.6 },
        "cumulative-layout-shift": { numericValue: 0.0016 },
        "total-blocking-time": { numericValue: 409.5 },
      },
    });
    const files: Record<string, unknown> = {
      [P.lighthouseFileName("mobile", "/", 1)]: lhr(0.61),
      [P.lighthouseFileName("desktop", "/", 1)]: lhr(0.9, "desktop"),
      [P.lighthouseFileName("mobile", "/projects", 1)]: { runtimeError: { code: "NO_FCP" } },
      // desktop /projects: no file at all
    };
    const report = P.buildLighthouseReport({
      paths: ["/", "/projects"],
      formFactors: ["mobile", "desktop"],
      runs: 1,
      gpu: false,
      pinnedVersion: "13.5.0",
      read: (ff: string, p: string, run: number) => files[P.lighthouseFileName(ff, p, run)] ?? null,
    });
    expect(S.lighthouseReportSchema.safeParse(report).success).toBe(true);
    const find = (ff: string, p: string) => report.pages.find((x: { formFactor: string; path: string }) => x.formFactor === ff && x.path === p)!;
    expect(find("mobile", "/").scores).toEqual({ performance: 61, accessibility: 100, bestPractices: 96, seo: 100 });
    expect(find("mobile", "/").metrics).toEqual({ lcpMs: 4210, cls: 0.002, tbtMs: 410 });
    expect(find("desktop", "/").scores.performance).toBe(90);
    expect(find("mobile", "/projects").ok).toBe(false);
    expect(find("mobile", "/projects").scores.performance).toBeNull();
    expect(find("desktop", "/projects").ok).toBe(false);
    // a report run under the wrong form factor isn't trusted
    expect(P.pageFromLhr(lhr(0.9, "desktop"), "/", "mobile").ok).toBe(false);
    // a missing category stays null, not 0
    expect(P.pageFromLhr({ ...lhr(0.5), categories: { performance: { score: 0.5 } } }, "/", "mobile").scores.seo).toBeNull();

    const body = P.buildIngestBody("lighthouse", report, { commitSha: SHA, runUrl: undefined });
    expect(body).not.toHaveProperty("runUrl");
    expect(S.ingestSchema.safeParse(body).success).toBe(true);
  });

  it("median of several runs by performance score", () => {
    const run = (s: number) => ({ categories: { performance: { score: s } } });
    expect(P.medianRun([run(0.5), run(0.9), run(0.7)])?.categories.performance.score).toBe(0.7);
    expect(P.medianRun([run(0.5), run(0.9)])?.categories.performance.score).toBe(0.5); // lower median
    expect(P.medianRun([null, { runtimeError: { code: "X" } }, run(0.6)])?.categories.performance.score).toBe(0.6);
  });

  it("only builds run URLs for this host's runs", () => {
    expect(
      P.runUrlFromEnv({ GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "tengkyuuu/it-company-website", GITHUB_RUN_ID: "42" })
    ).toBe("https://github.com/tengkyuuu/it-company-website/actions/runs/42");
    expect(P.runUrlFromEnv({ GITHUB_SERVER_URL: "https://ghe.example", GITHUB_REPOSITORY: "a/b", GITHUB_RUN_ID: "42" })).toBeUndefined();
    expect(P.runUrlFromEnv({})).toBeUndefined();
  });
});
