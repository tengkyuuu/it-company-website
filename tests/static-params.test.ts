import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No public page may set `dynamicParams = false`.
 *
 * It looks like a harmless "only /en and /fil exist" guard, but in Next 15 a
 * page with it 404s after ON-DEMAND revalidation: the admin's
 * revalidatePath("/[lang]", "layout") — or the status ingest's
 * revalidatePath("/[lang]/status", "page") — regenerates the page, the
 * regeneration throws `Internal: NoFallbackError`, and the page serves a 404
 * (or stale HTML that fails to hydrate, React #418) until the next deploy.
 * Measured 2026-10-03 on a production build: /fil/status, home and /projects.
 *
 * Unknown locales are already impossible without it: middleware only lets
 * /en/* and /fil/* reach app/[lang], and pageLocale() calls notFound() for
 * anything else.
 */

const root = join(process.cwd(), "app", "[lang]");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return pages(p);
    return /^page\.(t|j)sx?$/.test(name) ? [p] : [];
  });
}

describe("public pages and dynamicParams", () => {
  const files = pages(root);

  it("finds the public pages", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files.map((f) => [relative(process.cwd(), f), f]))("%s does not set dynamicParams = false", (_, file) => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/export\s+const\s+dynamicParams\s*=\s*false/);
  });

  it("every page still validates its locale (the guard that replaces it)", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (/\[\.\.\.missing\]/.test(f)) continue; // calls notFound() unconditionally
      // pageLocale(params), or the same check written out: isLocale(x) || notFound()
      const guarded = /pageLocale\(/.test(src) || (/isLocale\(/.test(src) && /notFound\(\)/.test(src));
      expect(guarded, relative(process.cwd(), f)).toBe(true);
    }
  });
});
