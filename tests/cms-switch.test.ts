import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmsEnabled, supabaseUrl } from "@/lib/supabase/env.mjs";
import { isSupabaseConfigured } from "@/lib/supabase/types";

/**
 * The CMS switch (lib/supabase/env.mjs) and the site's canonical origin.
 *
 * Both guard the same failure: the site quietly trusting configuration that
 * points at something that no longer exists. On 2026-10-19 the Supabase
 * project behind the Vercel settings had been deleted, and the canonical URL
 * fell back to https://mykt.studio — a domain nobody owns.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const URL_SET = "https://example-project.supabase.co";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the CMS switch", () => {
  it("is off unless NEXT_PUBLIC_CMS_ENABLED is exactly 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    for (const value of ["", "false", "1", "TRUE", "yes", " true"]) {
      vi.stubEnv("NEXT_PUBLIC_CMS_ENABLED", value);
      expect(cmsEnabled(), JSON.stringify(value)).toBe(false);
      // the keys being set must not be enough on their own
      expect(supabaseUrl()).toBe("");
      expect(isSupabaseConfigured()).toBe(false);
    }
  });

  it("is on with the switch and the keys", () => {
    vi.stubEnv("NEXT_PUBLIC_CMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(supabaseUrl()).toBe(URL_SET);
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("still needs the keys when switched on", () => {
    vi.stubEnv("NEXT_PUBLIC_CMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("can't be bypassed: nothing reads the Supabase URL around it", () => {
    // Every "are we talking to Supabase?" decision goes through env.mjs. The
    // client factories may read the URL directly — their callers are gated —
    // and so may the admin-only storage helpers.
    const allowed = new Set([
      "lib/supabase/env.mjs",
      "lib/supabase/admin.ts",
      "lib/supabase/client.ts",
      "lib/supabase/public.ts",
      "lib/supabase/server.ts",
      "app/admin/_lib/storage.ts",
      "components/admin/SetupNotice.tsx", // shows the var's name to copy
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(path.join(ROOT, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
        else if (/\.(ts|tsx|mjs)$/.test(name) && !allowed.has(rel)) {
          const src = readFileSync(path.join(ROOT, rel), "utf8");
          if (src.includes("process.env.NEXT_PUBLIC_SUPABASE_URL")) offenders.push(rel);
        }
      }
    };
    for (const dir of ["app", "components", "lib"]) walk(dir);
    for (const file of ["middleware.ts", "next.config.mjs"]) {
      if (readFileSync(path.join(ROOT, file), "utf8").includes("process.env.NEXT_PUBLIC_SUPABASE_URL")) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the canonical origin (site.url)", () => {
  const load = async () => (await import("@/lib/site")).site.url;

  it("prefers NEXT_PUBLIC_SITE_URL, without a trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rallys.tech/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "it-company.vercel.app");
    expect(await load()).toBe("https://rallys.tech");
  });

  it("falls back to the Vercel production domain — never an unowned one", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "it-company.vercel.app");
    expect(await load()).toBe("https://it-company.vercel.app");
  });

  it("is localhost when nothing says otherwise", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(await load()).toBe("http://localhost:3000");
  });

  it("names no domain the studio doesn't own", () => {
    const src = readFileSync(path.join(ROOT, "lib/site.ts"), "utf8");
    expect(src).not.toMatch(/https?:\/\/(www\.)?mykt\.studio/);
    expect(src).not.toMatch(/@mykt\.studio/);
  });
});
