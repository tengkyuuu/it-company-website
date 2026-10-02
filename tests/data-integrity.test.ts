import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { projects } from "@/lib/work";

/**
 * The static content is what the site serves whenever Supabase is unset,
 * erroring or empty (lib/cms.ts falls back field by field) — so a broken path
 * here is a broken public page, and nothing at build time notices.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const LIB = path.join(ROOT, "lib");

/** Every image a static project references: main, secondary, gallery. */
function projectImages() {
  return projects.flatMap((p) =>
    [
      { field: "img", src: p.img },
      { field: "img2", src: p.img2 },
      ...(p.gallery ?? []).map((g, i) => ({ field: `gallery[${i}]`, src: g.src })),
    ]
      .filter((x): x is { field: string; src: string } => typeof x.src === "string" && x.src !== "")
      .map((x) => ({ project: p.slug, ...x }))
  );
}

/** lib/**\/*.ts, recursively. */
function libFiles(dir = LIB): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return libFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const publicFile = (src: string) => path.join(PUBLIC, decodeURIComponent(src.split(/[?#]/)[0]));

describe("static project content (lib/work.ts)", () => {
  it("has projects to check", () => {
    expect(projects.length).toBeGreaterThan(0);
  });

  it("every local image path exists under public/", () => {
    // OneDrive has silently deleted public/work/*.jpg before (CLAUDE.md)
    const missing = projectImages()
      .filter((x) => x.src.startsWith("/"))
      .filter((x) => !existsSync(publicFile(x.src)))
      .map((x) => `${x.project}.${x.field} → public${x.src}`);
    expect(missing).toEqual([]);
  });

  it("every image is a public/ path or https URL — never inline, never relative", () => {
    const bad = projectImages()
      .filter((x) => !(/^\/(?![/\\])\S+$/.test(x.src) || /^https:\/\/\S+$/.test(x.src)))
      .map((x) => `${x.project}.${x.field} = ${x.src.slice(0, 60)}`);
    expect(bad).toEqual([]);
  });

  it("no static project sets liveUrl (the domains are placeholders)", () => {
    // checked 2026-08-03: four NXDOMAIN, shm.app is a parked for-sale page.
    // A liveUrl turns the preview into an iframe of whatever is there.
    const live = projects.filter((p) => p.liveUrl).map((p) => `${p.slug}: ${p.liveUrl}`);
    expect(live).toEqual([]);
  });

  it("slugs are unique and URL-safe", () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("each project has exactly three hex signature colours", () => {
    for (const p of projects) {
      expect(p.dots, p.slug).toHaveLength(3);
      for (const c of p.dots) expect(c, p.slug).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("lib/ static content", () => {
  const files = libFiles();

  it("never inlines a base64 image (it would ship in every visitor's bundle)", () => {
    const offenders = files
      .filter((f) => /data:image\//i.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("every quoted local image path anywhere in lib/ exists under public/", () => {
    // catches fallbacks like lib/cms.ts's `r.img ?? "/work/…"` too
    const re = /["'`](\/[^"'`\s]+\.(?:webp|png|jpe?g|avif|gif|svg))["'`]/gi;
    const missing: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(re)) {
        if (!existsSync(publicFile(m[1]))) missing.push(`${path.relative(ROOT, f)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
