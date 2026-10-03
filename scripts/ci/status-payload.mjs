/**
 * Pure builders for the /status ingest payloads (no I/O, no network) — used by
 * scripts/ci/post-status.mjs, and imported by tests/status-ingest.test.ts so
 * the payloads CI builds are checked against the endpoint's real zod schema
 * (lib/status-schema.ts). If the two drift, `npm test` fails, not production.
 *
 * Honesty rules — numbers are never rounded in the flattering direction:
 *   - Lighthouse category scores (higher = better) are FLOORED to an integer.
 *     Lighthouse already reports them to two decimals, so this only absorbs
 *     float error: 0.29 * 100 === 28.999999999999996, hence the epsilon.
 *   - LCP / TBT / CLS and the suite's duration (lower = better) are rounded UP.
 *   - A score or metric Lighthouse didn't produce stays null. Never 0.
 */

export const MAX_FAILING = 20;
export const DEFAULT_PATHS = ["/", "/projects", "/services", "/about"];
export const DEFAULT_FORM_FACTORS = ["mobile", "desktop"];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_METRIC_MS = 600_000;

// ── small helpers ────────────────────────────────────────────────────────────

/** @param {unknown} v */
const finite = (v) => typeof v === "number" && Number.isFinite(v);

/** @param {unknown} v */
const nonNegInt = (v) => (finite(v) && v >= 0 ? Math.floor(/** @type {number} */ (v)) : 0);

/**
 * Visible text: control characters out, whitespace collapsed, length capped.
 * @param {unknown} v
 * @param {number} max
 */
export function cleanText(v, max) {
  const s = String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Absolute test-file path → repo-relative, forward slashes.
 * @param {unknown} file
 * @param {string} rootDir
 */
export function relativeFile(file, rootDir) {
  const f = String(file ?? "").replace(/\\/g, "/");
  const root = rootDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const rel = root && f.toLowerCase().startsWith(`${root.toLowerCase()}/`) ? f.slice(root.length + 1) : f;
  return cleanText(rel, 200) || "(unknown file)";
}

// ── tests (Vitest JSON reporter) ─────────────────────────────────────────────

/**
 * @typedef {{ os: string; node: string; vitest: string }} RunnerInfo
 */

/**
 * Vitest `--reporter=json` output → the `tests` report.
 *
 * `skipped` is derived as total − passed − failed (skipped + todo + anything
 * that didn't run), so the totals always add up and nothing is double counted.
 * A file that failed to load has no failed tests but is listed with an empty
 * name; the page says "the file failed to load".
 *
 * @param {any} json parsed Vitest JSON report
 * @param {{ rootDir: string; runner: RunnerInfo }} opts
 */
export function buildTestsReport(json, { rootDir, runner }) {
  const results = Array.isArray(json?.testResults) ? json.testResults : [];
  const tests = nonNegInt(json?.numTotalTests);
  const passed = Math.min(nonNegInt(json?.numPassedTests), tests);
  const failed = Math.min(nonNegInt(json?.numFailedTests), tests - passed);
  const skipped = tests - passed - failed;
  const failedFiles = results.filter((/** @type {any} */ r) => r?.status === "failed").length;

  /** @type {{ file: string; name: string }[]} */
  const failing = [];
  for (const file of results) {
    const rel = relativeFile(file?.name, rootDir);
    const bad = (Array.isArray(file?.assertionResults) ? file.assertionResults : []).filter(
      (/** @type {any} */ a) => a?.status === "failed"
    );
    if (bad.length) {
      for (const a of bad) {
        // "" is reserved for "the file failed to load"
        failing.push({ file: rel, name: cleanText(a.fullName || a.title, 300) || "(unnamed test)" });
      }
    } else if (file?.status === "failed") {
      failing.push({ file: rel, name: "" });
    }
  }

  // wall time: first start → last file end. null rather than a guess.
  const ends = results.map((/** @type {any} */ r) => r?.endTime).filter(finite);
  const span = finite(json?.startTime) && ends.length ? Math.max(...ends) - json.startTime : NaN;
  const durationMs = finite(span) && span >= 0 && span <= DAY_MS ? Math.ceil(span) : null;

  return {
    success: json?.success === true && failed === 0 && failedFiles === 0,
    totals: { files: results.length, failedFiles, tests, passed, failed, skipped, durationMs },
    failing: failing.slice(0, MAX_FAILING),
    failingTotal: failing.length,
    runner: {
      os: cleanText(runner.os, 40) || "unknown",
      node: cleanText(runner.node, 24) || "unknown",
      vitest: cleanText(runner.vitest, 24) || "unknown",
    },
  };
}

// ── lighthouse ───────────────────────────────────────────────────────────────

/**
 * Where run-lighthouse writes one report, and where the builder looks for it.
 * @param {string} formFactor
 * @param {string} path
 * @param {number} run 1-based
 */
export function lighthouseFileName(formFactor, path, run) {
  const slug = path === "/" ? "home" : path.replace(/^\/+/, "").replace(/\//g, "-");
  return `${formFactor}--${slug}--${run}.json`;
}

/**
 * Category score 0–1 → integer 0–100, floored (see header). null stays null.
 * @param {unknown} raw
 */
export function toScore(raw) {
  if (!finite(raw)) return null;
  return Math.min(100, Math.max(0, Math.floor(/** @type {number} */ (raw) * 100 + 1e-6)));
}

/**
 * Lower-is-better timing → whole milliseconds, rounded up.
 * @param {unknown} raw
 */
export function toMillis(raw) {
  if (!finite(raw) || /** @type {number} */ (raw) < 0) return null;
  const v = Math.max(0, Math.ceil(/** @type {number} */ (raw) - 1e-9));
  return v > MAX_METRIC_MS ? null : v;
}

/**
 * CLS → three decimals, rounded up.
 * @param {unknown} raw
 */
export function toCls(raw) {
  if (!finite(raw) || /** @type {number} */ (raw) < 0) return null;
  const v = Math.max(0, Math.ceil(/** @type {number} */ (raw) * 1000 - 1e-9) / 1000);
  return v > 100 ? null : v;
}

/** @param {string} path @param {string} formFactor */
function failedPage(path, formFactor) {
  return {
    path,
    formFactor,
    ok: false,
    scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
    metrics: { lcpMs: null, cls: null, tbtMs: null },
  };
}

/**
 * One Lighthouse result (LHR) → one page entry. A missing report, a
 * runtimeError, or a run under the wrong form factor is an incomplete audit
 * (`ok: false`, everything null) — never partial numbers dressed up as a pass.
 *
 * @param {any} lhr
 * @param {string} path
 * @param {string} formFactor
 */
export function pageFromLhr(lhr, path, formFactor) {
  if (!lhr || typeof lhr !== "object" || lhr.runtimeError || !lhr.categories) {
    return failedPage(path, formFactor);
  }
  if (lhr.configSettings?.formFactor && lhr.configSettings.formFactor !== formFactor) {
    return failedPage(path, formFactor);
  }
  const score = (/** @type {string} */ id) => toScore(lhr.categories?.[id]?.score);
  const audit = (/** @type {string} */ id) => lhr.audits?.[id]?.numericValue;
  return {
    path,
    formFactor,
    ok: true,
    scores: {
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
    },
    metrics: {
      lcpMs: toMillis(audit("largest-contentful-paint")),
      cls: toCls(audit("cumulative-layout-shift")),
      tbtMs: toMillis(audit("total-blocking-time")),
    },
  };
}

/**
 * Of several runs of the same page, the one with the median performance score
 * (the lower median for an even count). Runs that didn't complete are ignored.
 * @param {any[]} lhrs
 */
export function medianRun(lhrs) {
  const done = lhrs
    .filter((l) => l && !l.runtimeError && finite(l.categories?.performance?.score))
    .sort((a, b) => a.categories.performance.score - b.categories.performance.score);
  return done.length ? done[Math.floor((done.length - 1) / 2)] : (lhrs.find(Boolean) ?? null);
}

/**
 * @param {{
 *   paths: string[];
 *   formFactors: string[];
 *   runs: number;
 *   gpu: boolean;
 *   pinnedVersion: string;
 *   read: (formFactor: string, path: string, run: number) => any;
 * }} opts `read` returns the parsed LHR, or null when the run left no report
 */
export function buildLighthouseReport({ paths, formFactors, runs, gpu, pinnedVersion, read }) {
  /** @type {ReturnType<typeof pageFromLhr>[]} */
  const pages = [];
  let version = "";
  for (const formFactor of formFactors) {
    for (const path of paths) {
      const lhrs = [];
      for (let run = 1; run <= runs; run++) lhrs.push(read(formFactor, path, run));
      const best = medianRun(lhrs);
      if (!version && typeof best?.lighthouseVersion === "string") version = best.lighthouseVersion;
      pages.push(pageFromLhr(best, path, formFactor));
    }
  }
  return {
    lighthouseVersion: version || pinnedVersion,
    gpu,
    runs,
    pages,
  };
}

// ── envelope ─────────────────────────────────────────────────────────────────

/**
 * The run's URL, only for github.com — the endpoint rejects anything else.
 * @param {Record<string, string | undefined>} env
 */
export function runUrlFromEnv(env) {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  if (GITHUB_SERVER_URL !== "https://github.com" || !GITHUB_REPOSITORY || !/^\d+$/.test(GITHUB_RUN_ID ?? "")) {
    return undefined;
  }
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

/**
 * @param {"tests" | "lighthouse"} kind
 * @param {object} report
 * @param {{ commitSha: string; runUrl?: string }} meta
 */
export function buildIngestBody(kind, report, { commitSha, runUrl }) {
  return { kind, commitSha, ...(runUrl ? { runUrl } : {}), report };
}
