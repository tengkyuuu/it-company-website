import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS_POLICY,
  VERCEL_DEV_SCRIPTS,
  VERCEL_PREVIEW_SOURCES,
  contentSecurityPolicy,
  cspDirectives,
  securityHeaders,
  supabaseOrigins,
} from "@/lib/security-headers.mjs";

/**
 * The security headers (lib/security-headers.mjs → next.config.mjs headers()).
 * A CSP fails SILENTLY in two directions: too loose and nothing tells you; too
 * tight and a feature quietly stops working for visitors (a blocked map, a dead
 * Realtime socket). So this pins the directives, and — the part that catches the
 * second kind — inventories every absolute origin written in the source and
 * makes each one either provably allowed by the CSP or explicitly classified as
 * "the browser never fetches this".
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE = "https://mykt.studio";
const SUPABASE = "https://abcdefgh.supabase.co";

type Directives = Record<string, string[]>;

/** Would a browser enforcing `d` allow `target` under `directive`? (enough CSP for these sources) */
function allows(d: Directives, directive: string, target: string, self = SITE): boolean {
  const sources = d[directive] ?? d["default-src"] ?? [];
  const url = new URL(target, self);
  return sources.some((s) => {
    if (s === "'none'") return false;
    if (s === "'self'") return url.origin === new URL(self).origin;
    if (/^[a-z][a-z0-9+.-]*:$/.test(s)) return url.protocol === s;
    if (s.startsWith("'")) return false;
    try {
      return new URL(s).origin === url.origin;
    } catch {
      return false;
    }
  });
}

const prodPublic = cspDirectives({ dev: false, https: true, supabaseUrl: SUPABASE, area: "public" });
const prodAdmin = cspDirectives({ dev: false, https: true, supabaseUrl: SUPABASE, area: "admin" });
const devPublic = cspDirectives({ dev: true, https: false, supabaseUrl: SUPABASE, area: "public" });
const previewPublic = cspDirectives({ https: true, supabaseUrl: SUPABASE, area: "public", vercelPreview: true });
const previewAdmin = cspDirectives({ https: true, supabaseUrl: SUPABASE, area: "admin", vercelPreview: true });

const header = (rules: ReturnType<typeof securityHeaders>, source: string, key: string) =>
  rules.find((r) => r.source === source)?.headers.find((h) => h.key === key)?.value;

describe("CSP directives (production)", () => {
  it("locks down the defaults", () => {
    for (const d of [prodPublic, prodAdmin]) {
      expect(d["default-src"]).toEqual(["'self'"]);
      expect(d["object-src"]).toEqual(["'none'"]);
      expect(d["base-uri"]).toEqual(["'self'"]);
      expect(d["form-action"]).toEqual(["'self'"]);
      expect(d["frame-ancestors"]).toEqual(["'none'"]);
      expect(d["worker-src"]).toEqual(["'self'"]);
      expect(d["manifest-src"]).toEqual(["'self'"]);
      expect(d["font-src"]).toEqual(["'self'"]);
    }
  });

  it("scripts come only from this origin — 'unsafe-inline' (no nonce: static pages), never 'unsafe-eval'", () => {
    expect(prodPublic["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(prodAdmin["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("no 'unsafe-eval' anywhere in any production combination", () => {
    for (const https of [true, false]) {
      for (const area of ["public", "admin"] as const) {
        for (const supabaseUrl of [SUPABASE, null]) {
          expect(contentSecurityPolicy({ dev: false, https, supabaseUrl, area })).not.toContain("unsafe-eval");
        }
      }
    }
    for (const rule of securityHeaders({ dev: false, https: true, supabaseUrl: SUPABASE })) {
      for (const h of rule.headers) expect(h.value).not.toContain("unsafe-eval");
    }
  });

  it("connect-src is exactly self + the Supabase project over https and wss", () => {
    expect(prodPublic["connect-src"]).toEqual(["'self'", SUPABASE, "wss://abcdefgh.supabase.co"]);
    expect(prodAdmin["connect-src"]).toEqual(prodPublic["connect-src"]);
    expect(cspDirectives({ dev: false })["connect-src"]).toEqual(["'self'"]);
  });

  it("images: self, data:, blob: and any https host (CMS images may live anywhere)", () => {
    expect(prodPublic["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
    expect(allows(prodPublic, "img-src", "https://cdn.somewhere.example/shot.webp")).toBe(true);
    expect(allows(prodPublic, "img-src", "http://insecure.example/shot.png")).toBe(false);
  });

  it("frames: any https site on the public site (live previews, the map); nothing in the panel", () => {
    expect(prodPublic["frame-src"]).toEqual(["https:"]);
    expect(allows(prodPublic, "frame-src", "https://client-project.example/")).toBe(true);
    expect(allows(prodPublic, "frame-src", "http://client-project.example/")).toBe(false);
    expect(prodAdmin["frame-src"]).toEqual(["'none'"]);
    expect(allows(prodAdmin, "frame-src", "https://maps.google.com/maps")).toBe(false);
  });

  it("upgrade-insecure-requests only behind TLS (it would break `next start` on http://localhost)", () => {
    expect(prodPublic["upgrade-insecure-requests"]).toEqual([]);
    expect(contentSecurityPolicy({ https: true })).toMatch(/(^|; )upgrade-insecure-requests(;|$)/);
    expect(contentSecurityPolicy({ https: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("CSP directives (development)", () => {
  it("allows eval (React Refresh), the HMR socket and the Vercel debug scripts — dev only", () => {
    expect(devPublic["script-src"]).toContain("'unsafe-eval'");
    expect(devPublic["script-src"]).toContain(VERCEL_DEV_SCRIPTS);
    expect(devPublic["connect-src"]).toContain("ws:");
    expect(prodPublic["script-src"]).not.toContain(VERCEL_DEV_SCRIPTS);
    expect(prodPublic["connect-src"]).not.toContain("ws:");
  });
});

describe("CSP directives (Vercel preview deployments)", () => {
  it("adds what Vercel's toolbar needs — on previews only", () => {
    for (const [name, extra] of Object.entries(VERCEL_PREVIEW_SOURCES)) {
      for (const s of extra) expect(previewPublic[name], `${name} ${s}`).toContain(s);
    }
    expect(previewPublic["script-src"]).toContain("https://vercel.live");
    expect(previewPublic["connect-src"]).toContain("wss://ws-us3.pusher.com");
    // the panel's frame-src 'none' can't be combined with a source, so it's replaced
    expect(previewAdmin["frame-src"]).toEqual(["https://vercel.live"]);
    for (const area of ["public", "admin"] as const) {
      expect(contentSecurityPolicy({ https: true, area })).not.toContain("vercel.live");
      expect(contentSecurityPolicy({ https: true, area, vercelPreview: true })).not.toContain("unsafe-eval");
    }
  });
});

describe("supabaseOrigins", () => {
  it("derives the https origin and its Realtime twin", () => {
    expect(supabaseOrigins("https://abcdefgh.supabase.co/")).toEqual([SUPABASE, "wss://abcdefgh.supabase.co"]);
    expect(supabaseOrigins("http://127.0.0.1:54321")).toEqual(["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
  });
  it("is empty for missing or junk values", () => {
    expect(supabaseOrigins(undefined)).toEqual([]);
    expect(supabaseOrigins("")).toEqual([]);
    expect(supabaseOrigins("not a url")).toEqual([]);
    expect(supabaseOrigins("javascript:alert(1)")).toEqual([]);
  });
});

describe("header rules", () => {
  const rules = securityHeaders({ dev: false, https: true, supabaseUrl: SUPABASE });

  it("every route gets the baseline set", () => {
    expect(rules[0].source).toBe("/:path*");
    expect(header(rules, "/:path*", "X-Content-Type-Options")).toBe("nosniff");
    expect(header(rules, "/:path*", "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header(rules, "/:path*", "Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(header(rules, "/:path*", "Strict-Transport-Security")).toMatch(/^max-age=\d{8,}/);
    expect(header(rules, "/:path*", "Content-Security-Policy")).toBe(
      contentSecurityPolicy({ dev: false, https: true, supabaseUrl: SUPABASE, area: "public" })
    );
  });

  it("Permissions-Policy denies the powerful features nothing uses", () => {
    for (const f of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(PERMISSIONS_POLICY).toContain(`${f}=()`);
    }
    // a feature name Chrome doesn't know is a console error on every page
    expect(PERMISSIONS_POLICY).not.toMatch(/interest-cohort|battery|vibrate/);
  });

  it("HSTS only where TLS is guaranteed", () => {
    const local = securityHeaders({ dev: false, https: false });
    expect(header(local, "/:path*", "Strict-Transport-Security")).toBeUndefined();
  });

  it("/admin comes LAST (Next applies the later rule for the same key) with its own CSP + X-Frame-Options", () => {
    expect(rules.at(-1)?.source).toBe("/admin/:path*");
    expect(header(rules, "/admin/:path*", "X-Frame-Options")).toBe("DENY");
    expect(header(rules, "/admin/:path*", "Content-Security-Policy")).toBe(
      contentSecurityPolicy({ dev: false, https: true, supabaseUrl: SUPABASE, area: "admin" })
    );
  });

  it("next.config.mjs serves exactly these rules", async () => {
    const config = (await import("@/next.config.mjs")).default as { headers: () => Promise<unknown> };
    const expected = securityHeaders({
      dev: process.env.NODE_ENV !== "production",
      https: process.env.VERCEL === "1",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      vercelPreview: process.env.VERCEL_ENV === "preview",
    });
    expect(await config.headers()).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// origin inventory
// ---------------------------------------------------------------------------

/** Origins the BROWSER loads, and the directive that must allow each. */
const BROWSER: Record<string, { directive: string; dev?: true; preview?: true; why: string }> = {
  "https://maps.google.com": { directive: "frame-src", why: "the map embed on /location" },
  "https://va.vercel-scripts.com": {
    directive: "script-src",
    dev: true,
    why: "@vercel/analytics + speed-insights debug scripts in development (same-origin /_vercel/* in production)",
  },
  "https://vercel.live": { directive: "script-src", preview: true, why: "Vercel toolbar on preview deployments" },
  "https://assets.vercel.com": { directive: "font-src", preview: true, why: "Vercel toolbar fonts (previews)" },
  "wss://ws-us3.pusher.com": { directive: "connect-src", preview: true, why: "Vercel toolbar comments (previews)" },
};

/** Origins written in the source that the browser never fetches as a subresource. */
const NOT_FETCHED: Record<string, string> = {
  "https://mykt.studio": "the site's own canonical origin (links, email bodies, the probe's User-Agent)",
  "https://schema.org": "JSON-LD @context — an identifier, never fetched",
  "http://www.w3.org": "the SVG XML namespace inside a data: URI",
  "https://github.com": "social / repository links (navigation)",
  "https://linkedin.com": "social link + admin placeholder (navigation)",
  "https://instagram.com": "social link (navigation)",
  "https://dribbble.com": "social link (navigation)",
  "https://supabase.com": "the admin setup notice's link (navigation)",
  "https://famecrm.app": "placeholder text in the admin Live URL field",
};

/**
 * Documentation-only hosts in comments/examples: reserved names (RFC 2606/6761),
 * single-label words and IP literals (the SSRF examples in lib/net).
 */
function isDocHost(host: string): boolean {
  return (
    !host.includes(".") ||
    /(^|\.)(example|test|invalid|localhost)$/.test(host) ||
    /^example\.(com|org|net)$/.test(host) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.startsWith("[")
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|mjs|js|css|html)$/.test(name) ? [full] : [];
  });
}

function originsInSource(): Map<string, string[]> {
  const files = [
    ...["app", "components", "lib", "public"].flatMap((d) => sourceFiles(path.join(ROOT, d))),
    path.join(ROOT, "middleware.ts"),
    path.join(ROOT, "next.config.mjs"),
  ];
  const found = new Map<string, string[]>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\b(?:https?|wss?):\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?/gi)) {
      const origin = m[0].toLowerCase();
      if (isDocHost(new URL(origin).hostname)) continue;
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      found.set(origin, [...(found.get(origin) ?? []), rel]);
    }
  }
  return found;
}

describe("origin inventory", () => {
  const found = originsInSource();

  it("finds origins (the scan itself is working)", () => {
    expect(found.has("https://maps.google.com")).toBe(true);
  });

  it("every origin in the source is classified — add new ones to BROWSER (with a directive) or NOT_FETCHED", () => {
    const unclassified = [...found.entries()]
      .filter(([o]) => !(o in BROWSER) && !(o in NOT_FETCHED))
      .map(([o, files]) => `${o}  (${[...new Set(files)].join(", ")})`);
    expect(unclassified).toEqual([]);
  });

  it("every browser-loaded origin is allowed by the CSP that serves it", () => {
    for (const [origin, { directive, dev, preview }] of Object.entries(BROWSER)) {
      const d = dev ? devPublic : preview ? previewPublic : prodPublic;
      expect(allows(d, directive, `${origin}/x`), `${origin} under ${directive}`).toBe(true);
    }
  });

  it("the env-driven origins are allowed too: Supabase REST + Realtime + Storage, same-origin Vercel insights", () => {
    expect(allows(prodPublic, "connect-src", `${SUPABASE}/rest/v1/site_revision`)).toBe(true);
    expect(allows(prodPublic, "connect-src", "wss://abcdefgh.supabase.co/realtime/v1/websocket")).toBe(true);
    expect(allows(prodAdmin, "connect-src", `${SUPABASE}/storage/v1/object/work/x.webp`)).toBe(true);
    expect(allows(prodPublic, "img-src", `${SUPABASE}/storage/v1/object/public/work/x.webp`)).toBe(true);
    expect(allows(prodPublic, "script-src", "/_vercel/insights/script.js")).toBe(true);
    expect(allows(prodPublic, "connect-src", "/_vercel/speed-insights/vitals")).toBe(true);
    expect(allows(prodPublic, "worker-src", "/sw.js")).toBe(true);
    expect(allows(prodPublic, "manifest-src", "/manifest.webmanifest")).toBe(true);
  });

  it("…and nothing else gets a socket: an arbitrary host is refused by connect-src", () => {
    expect(allows(prodPublic, "connect-src", "https://evil.example/collect")).toBe(false);
    expect(allows(prodPublic, "connect-src", "wss://evil.example/socket")).toBe(false);
    expect(allows(prodPublic, "script-src", "https://cdn.evil.example/x.js")).toBe(false);
  });
});
