import { z } from "zod";

/**
 * The /status page's data contract, shared by
 *   - the CI ingest endpoint (app/api/status/ingest/route.ts), which validates
 *     what GitHub Actions posts before anything is stored;
 *   - the read layer (lib/status.ts), which re-validates what comes back out
 *     of `status_reports.payload` — jsonb is only as well-formed as whoever
 *     wrote it, and a malformed row must read as "nothing reported", never as
 *     made-up numbers;
 *   - scripts/ci/status-payload.mjs builds payloads to this shape (and
 *     tests/status-ingest.test.ts checks that it still does).
 *
 * NEUTRAL MODULE: no "server-only", no Node APIs — pure zod + pure functions.
 *
 * Honesty rules baked in here rather than left to the page:
 *   - Lighthouse scores are integers 0–100 or null. A category that didn't
 *     report stays null — never coerced to 0 (the reference project's
 *     `// 0` did exactly that) and never to 100.
 *   - Test totals must add up (passed + failed + skipped = tests), and a run
 *     with any failure can't claim success.
 */

/** The only repository whose runs / commits the page links to. */
export const STATUS_REPO = "tengkyuuu/it-company-website";

export const MAX_INGEST_BYTES = 64 * 1024;
/** Failing-test names kept per run (the rest is a count: `failingTotal`). */
export const MAX_FAILING = 20;
export const STALE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── primitives ───────────────────────────────────────────────────────────────

/** No C0 control characters / DEL: these strings end up as visible text. */
const NO_CONTROL = /^[^\u0000-\u001f\u007f]*$/;
const text = (max: number) => z.string().trim().min(1).max(max).regex(NO_CONTROL);

export const commitShaSchema = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character lowercase hex SHA");

export const runUrlSchema = z
  .string()
  .max(200)
  .regex(
    /^https:\/\/github\.com\/tengkyuuu\/it-company-website\/actions\/runs\/\d{1,20}(?:\/attempts\/\d{1,3})?$/,
    `a run URL of github.com/${STATUS_REPO}`
  );

const count = z.number().int().min(0).max(1_000_000);

// ── tests ────────────────────────────────────────────────────────────────────

export const testsReportSchema = z
  .strictObject({
    /** the runner's own verdict (Vitest `success`) — also false on errors outside tests */
    success: z.boolean(),
    totals: z.strictObject({
      files: count,
      /** files whose status is "failed" — failing tests OR failed to load */
      failedFiles: count,
      tests: count,
      passed: count,
      failed: count,
      /** everything that didn't run: skipped + todo */
      skipped: count,
      /** wall time of the run; null when it couldn't be determined */
      durationMs: z.number().int().min(0).max(DAY_MS).nullable(),
    }),
    /** first MAX_FAILING failures; `name` is "" for a file that failed to load */
    failing: z
      .array(
        z.strictObject({
          file: text(200),
          name: z.string().trim().max(300).regex(NO_CONTROL),
        })
      )
      .max(MAX_FAILING),
    /** how many failure entries there were before the list was capped */
    failingTotal: count,
    runner: z.strictObject({
      os: text(40),
      node: text(24),
      vitest: text(24),
    }),
  })
  .superRefine((r, ctx) => {
    const t = r.totals;
    const issue = (message: string, path: PropertyKey[]) =>
      ctx.addIssue({ code: "custom", message, path });
    if (t.passed + t.failed + t.skipped !== t.tests) {
      issue("passed + failed + skipped must equal tests", ["totals"]);
    }
    if (t.failedFiles > t.files) issue("failedFiles can't exceed files", ["totals", "failedFiles"]);
    if (r.success && (t.failed > 0 || t.failedFiles > 0)) {
      issue("a run with failures can't be a success", ["success"]);
    }
    if (r.failing.length > r.failingTotal) issue("failing has more entries than failingTotal", ["failing"]);
    if (r.failingTotal < t.failed || r.failingTotal > t.failed + t.failedFiles) {
      issue("failingTotal must cover every failed test and at most one entry per failed file", ["failingTotal"]);
    }
    if (t.failedFiles > 0 && r.failingTotal === 0) {
      issue("a failed file needs a failure entry", ["failingTotal"]);
    }
  });

export type TestsReport = z.infer<typeof testsReportSchema>;

// ── lighthouse ───────────────────────────────────────────────────────────────

export const LH_CATEGORIES = ["performance", "accessibility", "bestPractices", "seo"] as const;
export type LighthouseCategory = (typeof LH_CATEGORIES)[number];

export const FORM_FACTORS = ["mobile", "desktop"] as const;
export type FormFactor = (typeof FORM_FACTORS)[number];

const score = z.number().int().min(0).max(100).nullable();
const millis = z.number().int().min(0).max(600_000).nullable();

export const lighthousePageSchema = z
  .strictObject({
    /** site path only — never a URL, so the page can't be made to link anywhere */
    path: z
      .string()
      .max(100)
      .regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/, "a site path like / or /projects"),
    formFactor: z.enum(FORM_FACTORS),
    /** false = the audit didn't complete; every score and metric is then null */
    ok: z.boolean(),
    scores: z.strictObject({
      performance: score,
      accessibility: score,
      bestPractices: score,
      seo: score,
    }),
    metrics: z.strictObject({
      lcpMs: millis,
      cls: z.number().min(0).max(100).nullable(),
      tbtMs: millis,
    }),
  })
  .superRefine((p, ctx) => {
    if (p.ok) return;
    const filled = [...Object.values(p.scores), ...Object.values(p.metrics)].some((v) => v !== null);
    if (filled) {
      ctx.addIssue({ code: "custom", message: "a failed audit can't carry scores", path: ["ok"] });
    }
  });

export type LighthousePage = z.infer<typeof lighthousePageSchema>;

export const lighthouseReportSchema = z
  .strictObject({
    lighthouseVersion: z.string().max(32).regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[0-9A-Za-z.]+)?$/),
    /** false on GitHub-hosted runners: Chrome renders WebGL in software there */
    gpu: z.boolean(),
    /** audits per page / form factor (the median run is reported) */
    runs: z.number().int().min(1).max(9),
    pages: z.array(lighthousePageSchema).min(1).max(16),
  })
  .superRefine((r, ctx) => {
    const seen = new Set<string>();
    r.pages.forEach((p, i) => {
      const key = `${p.formFactor} ${p.path}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: `duplicate page: ${key}`, path: ["pages", i] });
      }
      seen.add(key);
    });
  });

export type LighthouseReport = z.infer<typeof lighthouseReportSchema>;

// ── ingest envelope (what CI POSTs) ──────────────────────────────────────────

export const ingestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("tests"),
    commitSha: commitShaSchema,
    runUrl: runUrlSchema.optional(),
    report: testsReportSchema,
  }),
  z.strictObject({
    kind: z.literal("lighthouse"),
    commitSha: commitShaSchema,
    runUrl: runUrlSchema.optional(),
    report: lighthouseReportSchema,
  }),
]);

export type IngestBody = z.infer<typeof ingestSchema>;

// ── stored shape (status_reports.payload) ────────────────────────────────────

/** Bump when the stored shape changes; old rows then read as "nothing reported". */
export const STATUS_PAYLOAD_VERSION = 1;

const storedTestsSchema = z.object({
  v: z.literal(STATUS_PAYLOAD_VERSION),
  runUrl: runUrlSchema.nullable(),
  report: testsReportSchema,
});

const storedLighthouseSchema = z.object({
  v: z.literal(STATUS_PAYLOAD_VERSION),
  runUrl: runUrlSchema.nullable(),
  report: lighthouseReportSchema,
});

/** What the ingest endpoint writes into `payload` (commit + time are columns). */
export function toStoredPayload(body: IngestBody) {
  return { v: STATUS_PAYLOAD_VERSION, runUrl: body.runUrl ?? null, report: body.report };
}

export type StatusEntry<R> = {
  commitSha: string;
  /** server time the report was received (never the runner's clock) */
  receivedAt: string;
  runUrl: string | null;
  report: R;
};

export type StatusReports = {
  tests: StatusEntry<TestsReport> | null;
  lighthouse: StatusEntry<LighthouseReport> | null;
};

type RowLike = { kind?: unknown; payload?: unknown; commit_sha?: unknown; received_at?: unknown };

/**
 * `status_reports` rows → typed entries. Anything that doesn't validate
 * (unknown kind, old payload version, hand-edited jsonb, bad SHA or date) is
 * dropped, so the page shows its empty state rather than a wrong number.
 */
export function parseStatusRows(rows: readonly RowLike[]): StatusReports {
  const out: StatusReports = { tests: null, lighthouse: null };
  for (const row of rows) {
    const commit = commitShaSchema.safeParse(row.commit_sha);
    const receivedAt = typeof row.received_at === "string" ? row.received_at : "";
    if (!commit.success || Number.isNaN(Date.parse(receivedAt))) continue;
    const base = { commitSha: commit.data, receivedAt };

    if (row.kind === "tests") {
      const p = storedTestsSchema.safeParse(row.payload);
      if (p.success) out.tests = { ...base, runUrl: p.data.runUrl, report: p.data.report };
    } else if (row.kind === "lighthouse") {
      const p = storedLighthouseSchema.safeParse(row.payload);
      if (p.success) out.lighthouse = { ...base, runUrl: p.data.runUrl, report: p.data.report };
    }
  }
  return out;
}

// ── derived state ────────────────────────────────────────────────────────────

/** Older than STALE_AFTER_DAYS (strictly). An unparseable date counts as stale. */
export function isStale(receivedAt: string, now: number): boolean {
  const t = Date.parse(receivedAt);
  return Number.isNaN(t) || now - t > STALE_AFTER_DAYS * DAY_MS;
}

/** Whole days elapsed since `receivedAt` (floored — "at least N days", which is always true). */
export function ageInDays(receivedAt: string, now: number): number {
  const t = Date.parse(receivedAt);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** A run passes only if the runner said so AND nothing failed. */
export function testsPassed(r: TestsReport): boolean {
  return r.success && r.totals.failed === 0 && r.totals.failedFiles === 0;
}

export type Health = "passing" | "failing" | "stale" | "unknown";

/**
 * The page's one-word verdict. Driven by the test suite only: Lighthouse is a
 * measurement (and a lower bound on a GPU-less runner), not a pass/fail gate.
 * Failing outranks stale — a red run stays red however old it is.
 */
export function overallHealth(tests: StatusEntry<TestsReport> | null, now: number): Health {
  if (!tests) return "unknown";
  if (!testsPassed(tests.report)) return "failing";
  if (isStale(tests.receivedAt, now)) return "stale";
  return "passing";
}

export const commitUrl = (sha: string) => `https://github.com/${STATUS_REPO}/commit/${sha}`;
