#!/usr/bin/env node
/**
 * CI → /status. Called by .github/workflows/status.yml; no dependencies
 * beyond Node 22 (global fetch). Three commands:
 *
 *   node scripts/ci/post-status.mjs tests <vitest-report.json>
 *       build the `tests` report from Vitest's JSON reporter and POST it
 *
 *   node scripts/ci/post-status.mjs run-lighthouse <out-dir>
 *       audit SITE_URL × LIGHTHOUSE_PATHS × LIGHTHOUSE_FORM_FACTORS with the
 *       pinned LIGHTHOUSE_PACKAGE via npx, one JSON report per run
 *
 *   node scripts/ci/post-status.mjs lighthouse <out-dir>
 *       build the `lighthouse` report from those files and POST it
 *
 * Env:
 *   SITE_URL               production origin, e.g. https://example.com (repo variable)
 *   STATUS_INGEST_TOKEN    bearer for /api/status/ingest (repo secret) — never logged
 *   COMMIT_SHA             40-hex commit the report describes (default: GITHUB_SHA)
 *   LIGHTHOUSE_PACKAGE     e.g. lighthouse@13.5.0 — pinned in the workflow
 *   LIGHTHOUSE_PATHS       space-separated, default "/ /projects /services /about"
 *   LIGHTHOUSE_FORM_FACTORS default "mobile desktop"
 *   LIGHTHOUSE_RUNS        audits per page (median reported), default 1
 *   LIGHTHOUSE_GPU         "true" ONLY on a runner with a real GPU. GitHub-hosted
 *                          runners have none: Chrome draws WebGL with SwiftShader,
 *                          so performance there is a lower bound. Default false.
 *   DRY_RUN=1              print the payload instead of posting it
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_FORM_FACTORS,
  DEFAULT_PATHS,
  buildIngestBody,
  buildLighthouseReport,
  buildTestsReport,
  lighthouseFileName,
  runUrlFromEnv,
} from "./status-payload.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = process.env;

const fail = (msg) => {
  console.log(`::error::${msg}`);
  process.exit(1);
};
const warn = (msg) => console.log(`::warning::${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function siteUrl() {
  const raw = (env.SITE_URL ?? "").trim();
  if (!raw) fail("Repository variable SITE_URL is not set (Settings → Secrets and variables → Actions → Variables).");
  let u;
  try {
    u = new URL(raw);
  } catch {
    fail(`SITE_URL is not a URL: ${raw}`);
  }
  if (u.protocol !== "https:" && u.hostname !== "localhost") fail("SITE_URL must be https://");
  return u.origin;
}

function commitSha() {
  const sha = (env.COMMIT_SHA || env.GITHUB_SHA || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) fail("COMMIT_SHA / GITHUB_SHA must be a full 40-character SHA.");
  return sha;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

const list = (v, fallback) => (v?.trim() ? v.trim().split(/\s+/) : fallback);

// ── POST ─────────────────────────────────────────────────────────────────────

/**
 * POST with a few retries for the cases that heal on their own: the network,
 * a 404 (this deploy predates the endpoint — e.g. the push that adds it), and
 * 5xx while Vercel swaps deployments. 400/401/413/429 won't heal by waiting.
 */
async function post(body) {
  if (env.DRY_RUN === "1") {
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  const token = (env.STATUS_INGEST_TOKEN ?? "").trim();
  if (!token) fail("Repository secret STATUS_INGEST_TOKEN is not set — nothing was published.");
  const url = `${siteUrl()}/api/status/ingest`;
  const payload = JSON.stringify(body);
  console.log(`Posting ${body.kind} report (${payload.length} bytes) for ${body.commitSha.slice(0, 7)} to ${url}`);

  const attempts = 6;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let status = 0;
    let text = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(20_000),
        redirect: "error", // never replay the bearer to wherever a redirect points
      });
      status = res.status;
      text = (await res.text()).slice(0, 2000);
    } catch (err) {
      text = err instanceof Error ? err.message : String(err);
    }

    if (status === 200) {
      console.log(`Published (attempt ${attempt}).`);
      return;
    }
    console.log(`Attempt ${attempt}: HTTP ${status || "network error"} ${text}`);
    if (status === 401) fail("The site rejected the token (401): the repo secret and Vercel's STATUS_INGEST_TOKEN must be the same value.");
    if (status === 503 && /"ok":false}$/.test(text)) {
      fail("STATUS_INGEST_TOKEN isn't configured on the site (503) — set it in Vercel and redeploy.");
    }
    const retriable = status === 0 || status === 404 || status >= 500;
    if (!retriable || attempt === attempts) break;
    await sleep(30_000);
  }
  fail("Could not publish the report — see the attempts above.");
}

// ── commands ─────────────────────────────────────────────────────────────────

async function tests(file) {
  if (!file || !existsSync(file)) fail(`No Vitest JSON report at ${file ?? "(missing argument)"} — did the suite run?`);
  const json = readJson(file);
  if (!json) fail(`${file} is not valid JSON.`);

  let vitest = "unknown";
  try {
    vitest = JSON.parse(readFileSync(path.join(ROOT, "node_modules", "vitest", "package.json"), "utf8")).version;
  } catch {
    /* reported as "unknown" */
  }
  const report = buildTestsReport(json, {
    rootDir: ROOT,
    runner: { os: env.ImageOS || `${env.RUNNER_OS || process.platform}`, node: process.version, vitest },
  });
  const t = report.totals;
  console.log(`Tests: ${t.passed}/${t.tests} passed, ${t.failed} failed, ${t.skipped} skipped, ${t.files} files.`);
  await post(buildIngestBody("tests", report, { commitSha: commitSha(), runUrl: runUrlFromEnv(env) }));
}

function lighthouseConfig() {
  const paths = list(env.LIGHTHOUSE_PATHS, DEFAULT_PATHS);
  const formFactors = list(env.LIGHTHOUSE_FORM_FACTORS, DEFAULT_FORM_FACTORS);
  const runs = Math.min(9, Math.max(1, Number.parseInt(env.LIGHTHOUSE_RUNS ?? "1", 10) || 1));
  for (const p of paths) if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(p)) fail(`Bad path in LIGHTHOUSE_PATHS: ${p}`);
  for (const f of formFactors) if (f !== "mobile" && f !== "desktop") fail(`Bad form factor: ${f}`);
  const pkg = (env.LIGHTHOUSE_PACKAGE ?? "").trim();
  const pinned = /^lighthouse@(\d+\.\d+\.\d+)$/.exec(pkg);
  if (!pinned) fail("LIGHTHOUSE_PACKAGE must pin an exact version, e.g. lighthouse@13.5.0");
  return { paths, formFactors, runs, pkg, version: pinned[1] };
}

function runLighthouse(outDir) {
  if (!outDir) fail("Usage: post-status.mjs run-lighthouse <out-dir>");
  const { paths, formFactors, runs, pkg } = lighthouseConfig();
  const origin = siteUrl();
  mkdirSync(outDir, { recursive: true });

  let completed = 0;
  for (const formFactor of formFactors) {
    for (const p of paths) {
      for (let run = 1; run <= runs; run++) {
        const out = path.join(outDir, lighthouseFileName(formFactor, p, run));
        const target = new URL(p, origin).href;
        console.log(`::group::Lighthouse ${formFactor} ${p} (run ${run}/${runs})`);
        const args = [
          "--yes",
          pkg,
          target,
          "--output=json",
          `--output-path=${out}`,
          "--only-categories=performance,accessibility,best-practices,seo",
          // No GPU flags on purpose: the runner has no GPU, and pretending
          // otherwise would make the numbers less honest, not better.
          "--chrome-flags=--headless=new --no-sandbox",
          "--quiet",
          ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
        ];
        const res = spawnSync("npx", args, {
          stdio: "inherit",
          timeout: 4 * 60_000,
          shell: process.platform === "win32",
        });
        console.log("::endgroup::");
        const lhr = readJson(out);
        if (res.status === 0 && lhr && !lhr.runtimeError) completed++;
        else warn(`Lighthouse didn't complete for ${formFactor} ${p} (run ${run})${lhr?.runtimeError ? `: ${lhr.runtimeError.code}` : ""}.`);
      }
    }
  }
  // Nothing at all completed → probably the runner or the site, not the
  // pages. Fail without posting, so the last good report stays up (and ages
  // into "stale" on the page) instead of being replaced by a wall of blanks.
  if (completed === 0) fail("No Lighthouse audit completed — nothing will be published.");
  console.log(`${completed}/${formFactors.length * paths.length * runs} audits completed.`);
}

async function lighthouse(outDir) {
  if (!outDir || !existsSync(outDir)) fail(`No Lighthouse output directory at ${outDir ?? "(missing argument)"}.`);
  const { paths, formFactors, runs, version } = lighthouseConfig();
  const report = buildLighthouseReport({
    paths,
    formFactors,
    runs,
    gpu: env.LIGHTHOUSE_GPU === "true",
    pinnedVersion: version,
    read: (formFactor, p, run) => readJson(path.join(outDir, lighthouseFileName(formFactor, p, run))),
  });
  if (!report.pages.some((p) => p.ok)) fail("No Lighthouse audit completed — nothing will be published.");
  for (const p of report.pages) {
    const s = p.scores;
    console.log(
      `${p.formFactor.padEnd(7)} ${p.path.padEnd(12)} ` +
        (p.ok ? `perf ${s.performance} · a11y ${s.accessibility} · bp ${s.bestPractices} · seo ${s.seo}` : "did not complete")
    );
  }
  await post(buildIngestBody("lighthouse", report, { commitSha: commitSha(), runUrl: runUrlFromEnv(env) }));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "tests") await tests(arg);
else if (cmd === "run-lighthouse") runLighthouse(arg);
else if (cmd === "lighthouse") await lighthouse(arg);
else fail("Usage: post-status.mjs <tests <report.json> | run-lighthouse <dir> | lighthouse <dir>>");
