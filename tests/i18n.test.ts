import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
// Next's own matcher compiler — exported at runtime, absent from its .d.ts
import * as pageStaticInfo from "next/dist/build/analysis/get-page-static-info";
import { config as middlewareConfig } from "@/middleware";
import { locales } from "@/lib/i18n/config";
import { getClientMessages, getDictionary } from "@/lib/i18n/dictionary";
import { CLIENT_NAMESPACES, namespaces } from "@/lib/i18n/messages";
import { navKeys } from "@/lib/i18n/nav";
import { localizePath, stripLocale, switchLocalePath } from "@/lib/i18n/paths";
import { resolveLocaleRoute } from "@/lib/i18n/route";
import { alternatesFor, absoluteUrl, languageUrls } from "@/lib/i18n/metadata";
import { createTranslator, interpolate, lookup, mergeMessages } from "@/lib/i18n/translate";
import { nav, site } from "@/lib/site";

/**
 * The i18n contract, without a build or a browser:
 *  - dictionaries: Filipino covers every English key (no gaps, no extras, same
 *    {placeholders}); namespaces don't collide when merged flat;
 *  - call sites: every t("…") key used in app/ and components/ exists in BOTH
 *    languages, and client components only use keys that are actually shipped
 *    to the client — a raw key like "nav.file" must never reach production;
 *  - routing: localizePath / switchLocalePath / resolveLocaleRoute, and the
 *    real middleware matcher compiled the way Next compiles it.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));

type Tree = { [k: string]: string | Tree };

function leaves(tree: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (!tree || typeof tree !== "object") return out;
  for (const [k, v] of Object.entries(tree as Tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// ---------------------------------------------------------------------------
// dictionaries
// ---------------------------------------------------------------------------

describe("dictionaries", () => {
  for (const [name, ns] of Object.entries(namespaces)) {
    describe(`namespace "${name}"`, () => {
      const en = leaves(ns.en);
      const fil = leaves(ns.fil);

      it("fil has every en key, each a non-empty string", () => {
        const missing = [...en.keys()].filter((k) => !fil.get(k)?.trim());
        expect(missing).toEqual([]);
      });

      it("fil has no keys en doesn't (typos would be silently ignored)", () => {
        const extra = [...fil.keys()].filter((k) => !en.has(k));
        expect(extra).toEqual([]);
      });

      it("every translation keeps the same {placeholders}", () => {
        const mismatched = [...en.entries()]
          .filter(([k, v]) => fil.has(k) && placeholders(v).join() !== placeholders(fil.get(k)!).join())
          .map(([k]) => k);
        expect(mismatched).toEqual([]);
      });
    });
  }

  it("top-level sections are unique across namespaces (they merge flat)", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, ns] of Object.entries(namespaces)) {
      for (const section of Object.keys(ns.en)) {
        if (seen.has(section)) clashes.push(`${section} (${seen.get(section)} + ${name})`);
        seen.set(section, name);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("the client receives only CLIENT_NAMESPACES, resolved", () => {
    const clientSections = new Set(
      CLIENT_NAMESPACES.flatMap((n) => Object.keys(namespaces[n].en))
    );
    for (const lang of locales) {
      expect(new Set(Object.keys(getClientMessages(lang)))).toEqual(clientSections);
    }
    // a server-only section must not leak into the client payload
    expect(getClientMessages("fil")).not.toHaveProperty("footer");
  });
});

describe("fallback chain: lang → en → key", () => {
  it("a missing or blank locale string falls back to English", () => {
    const en = { a: { b: "Hello", c: "World" }, d: "Bye" };
    const merged = mergeMessages(en, { a: { b: "Kumusta", c: "  " } });
    expect(merged).toEqual({ a: { b: "Kumusta", c: "World" }, d: "Bye" });
  });

  it("keys the locale invents are dropped (English owns the shape)", () => {
    expect(mergeMessages({ a: "x" }, { a: "y", rogue: "z" })).toEqual({ a: "y" });
  });

  it("an unknown key renders as the key itself", () => {
    const t = createTranslator<string>({ a: "x" });
    expect(t("a")).toBe("x");
    expect(t("nope.missing")).toBe("nope.missing");
  });

  it("interpolates {names}, leaving unknown ones intact", () => {
    expect(interpolate("{count} projects", { count: 5 })).toBe("5 projects");
    expect(interpolate("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(lookup({ x: { y: "z" } }, "x.y")).toBe("z");
    expect(lookup({ x: { y: "z" } }, "x")).toBeUndefined();
  });

  it("getDictionary resolves both locales", () => {
    expect(getDictionary("en").t("nav.services")).toBe("Services");
    expect(getDictionary("fil").t("nav.services")).not.toBe("Services");
    expect(getDictionary("fil").t("footer.copyright", { year: 2026, name: "X" })).toContain("2026");
  });
});

// ---------------------------------------------------------------------------
// call sites
// ---------------------------------------------------------------------------

/** Public source only — the admin panel is English-only and has no t(). */
const SCAN_DIRS = ["app", "components"];
const SKIP = [
  path.join("app", "admin"),
  path.join("app", "api"),
  path.join("components", "admin"),
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    if (SKIP.some((s) => rel === s || rel.startsWith(s + path.sep))) continue;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

type CallSite = { file: string; key: string | null; line: number; client: boolean };

function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of SCAN_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))) {
    const text = readFileSync(file, "utf8");
    if (!/\bt\(/.test(text)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    // the client t() is typed over `common` only; anything else would render raw
    const client = /^\s*["']use client["']/.test(text) || /\buseI18n\(/.test(text);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t"
      ) {
        const arg = node.arguments[0];
        const key =
          arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
            ? arg.text
            : null;
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        sites.push({ file: path.relative(ROOT, file), key, line, client });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return sites;
}

describe("t() call sites", () => {
  const sites = callSites();
  const allKeys = (lang: "en" | "fil") =>
    new Set(
      Object.values(namespaces).flatMap((ns) => [...leaves(lang === "en" ? ns.en : ns.fil).keys()])
    );
  const clientKeys = new Set(
    CLIENT_NAMESPACES.flatMap((n) => [...leaves(namespaces[n].en).keys()])
  );

  it("finds the call sites (the scan itself works)", () => {
    expect(sites.length).toBeGreaterThan(80);
  });

  it("every key is a string literal (dynamic keys can't be checked)", () => {
    const dynamic = sites.filter((s) => s.key === null).map((s) => `${s.file}:${s.line}`);
    expect(dynamic).toEqual([]);
  });

  for (const lang of ["en", "fil"] as const) {
    it(`every key used exists in ${lang}`, () => {
      const keys = allKeys(lang);
      const missing = sites
        .filter((s) => s.key && !keys.has(s.key))
        .map((s) => `${s.file}:${s.line} → ${s.key}`);
      expect(missing).toEqual([]);
    });
  }

  it("client components only use keys shipped to the client", () => {
    const leaked = sites
      .filter((s) => s.client && s.key && !clientKeys.has(s.key))
      .map((s) => `${s.file}:${s.line} → ${s.key}`);
    expect(leaked).toEqual([]);
  });

  it("every nav item has a translated label in both languages", () => {
    for (const item of nav) {
      const key = navKeys[item.href];
      expect(key, `navKeys is missing ${item.href}`).toBeDefined();
      expect(leaves(namespaces.common.en).has(key)).toBe(true);
      expect(leaves(namespaces.common.fil).has(key)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

describe("localizePath", () => {
  it.each([
    ["en", "/", "/"],
    ["en", "/projects", "/projects"],
    ["en", "/projects/famecrm", "/projects/famecrm"],
    ["fil", "/", "/fil"],
    ["fil", "/projects", "/fil/projects"],
    ["fil", "/projects/famecrm", "/fil/projects/famecrm"],
    ["fil", "/location#contact", "/fil/location#contact"],
    ["fil", "/?ref=x", "/fil?ref=x"],
    // idempotent
    ["fil", "/fil", "/fil"],
    ["fil", "/fil/about", "/fil/about"],
    // left alone
    ["fil", "#top", "#top"],
    ["fil", "mailto:hello@mykt.studio", "mailto:hello@mykt.studio"],
    ["fil", "tel:+63652123344", "tel:+63652123344"],
    ["fil", "https://linkedin.com", "https://linkedin.com"],
    ["fil", "//cdn.example.com/x", "//cdn.example.com/x"],
    ["fil", "/admin", "/admin"],
    ["fil", "/admin/projects", "/admin/projects"],
    ["fil", "/api/contact", "/api/contact"],
    ["fil", "/work/famecrm.webp", "/work/famecrm.webp"],
    ["fil", "/sitemap.xml", "/sitemap.xml"],
  ] as const)("(%s, %s) → %s", (lang, href, expected) => {
    expect(localizePath(lang, href)).toBe(expected);
  });
});

describe("stripLocale / switchLocalePath", () => {
  it.each([
    ["/", "en", "/"],
    ["/projects", "en", "/projects"],
    ["/en", "en", "/"], // the internal rewritten form usePathname() sees while prerendering
    ["/en/projects", "en", "/projects"],
    ["/fil", "fil", "/"],
    ["/fil/projects/famecrm", "fil", "/projects/famecrm"],
    ["/filipino", "en", "/filipino"], // a segment, not a prefix match
  ] as const)("stripLocale(%s) → %s %s", (input, lang, p) => {
    expect(stripLocale(input)).toEqual({ lang, path: p });
  });

  it.each([
    ["/", "fil", "/fil"],
    ["/projects", "fil", "/fil/projects"],
    ["/en/projects", "fil", "/fil/projects"],
    ["/fil", "en", "/"],
    ["/fil/about", "en", "/about"],
    ["/fil/about", "fil", "/fil/about"],
    ["/about", "en", "/about"],
  ] as const)("switchLocalePath(%s, %s) → %s", (pathname, target, expected) => {
    expect(switchLocalePath(pathname, target)).toBe(expected);
  });
});

describe("SEO helpers", () => {
  it("canonical per locale, hreflang for both, x-default → English", () => {
    expect(alternatesFor("fil", "/about")).toEqual({
      canonical: "/fil/about",
      languages: { en: "/about", fil: "/fil/about", "x-default": "/about" },
    });
    expect(alternatesFor("en", "/").canonical).toBe("/");
    expect(languageUrls("/", true)).toEqual({
      en: site.url,
      fil: `${site.url}/fil`,
      "x-default": site.url,
    });
    expect(absoluteUrl("fil", "/projects")).toBe(`${site.url}/fil/projects`);
  });
});

// ---------------------------------------------------------------------------
// middleware routing
// ---------------------------------------------------------------------------

describe("resolveLocaleRoute", () => {
  it.each([
    ["/", { action: "rewrite", to: "/en" }],
    ["/projects", { action: "rewrite", to: "/en/projects" }],
    ["/projects/famecrm", { action: "rewrite", to: "/en/projects/famecrm" }],
    ["/nope", { action: "rewrite", to: "/en/nope" }],
    ["/filipino", { action: "rewrite", to: "/en/filipino" }],
    ["/work", { action: "rewrite", to: "/en/work" }], // a bare folder name is a page URL
    ["/fil", { action: "next", lang: "fil" }],
    ["/fil/projects", { action: "next", lang: "fil" }],
    ["/en", { action: "redirect", to: "/" }],
    ["/en/x", { action: "redirect", to: "/x" }],
    ["/en/projects/famecrm", { action: "redirect", to: "/projects/famecrm" }],
    ["/admin", { action: "skip" }],
    ["/admin/projects", { action: "skip" }],
    ["/api/contact", { action: "skip" }],
    ["/api", { action: "skip" }],
    ["/_next/static/chunks/x.js", { action: "skip" }],
    ["/work/x.webp", { action: "skip" }],
    ["/brand/reel/frame-001.webp", { action: "skip" }],
    ["/robots.txt", { action: "skip" }],
    ["/sitemap.xml", { action: "skip" }],
    ["/icon.png", { action: "skip" }],
    ["/favicon.ico", { action: "skip" }],
    ["/opengraph-image", { action: "skip" }],
    ["/twitter-image", { action: "skip" }],
  ] as const)("%s → %o", (pathname, expected) => {
    expect(resolveLocaleRoute(pathname)).toEqual(expected);
  });
});

describe("middleware matcher (compiled as Next compiles it)", () => {
  const { getMiddlewareMatchers } = pageStaticInfo as unknown as {
    getMiddlewareMatchers: (matcher: unknown, nextConfig: object) => { regexp: string }[];
  };
  const regexps = getMiddlewareMatchers(middlewareConfig.matcher, {}).map(
    (m) => new RegExp(m.regexp)
  );
  const runs = (p: string) => regexps.some((r) => r.test(p));

  it.each(["/", "/projects", "/projects/famecrm", "/fil", "/fil/about", "/en/x", "/admin", "/admin/login", "/opengraph-image"])(
    "runs on %s",
    (p) => expect(runs(p)).toBe(true)
  );

  it.each(["/api/contact", "/api", "/_next/static/chunks/main.js", "/robots.txt", "/sitemap.xml", "/icon.png", "/work/x.webp", "/brand/logo.png"])(
    "does not run on %s",
    (p) => expect(runs(p)).toBe(false)
  );
});
