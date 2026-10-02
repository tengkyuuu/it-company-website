/**
 * Per-locale SEO helpers for generateMetadata and the sitemap.
 *
 * - `alternates`: canonical for the current locale + hreflang for both, with
 *   x-default → English (the unprefixed URL). Relative URLs; Next resolves them
 *   against `metadataBase`.
 * - `openGraph`: og:locale / og:locale:alternate, og:url, site name.
 *
 * ⚠️ Why `images` is set explicitly: app/opengraph-image.tsx and
 * twitter-image.tsx sit at the app ROOT, which no longer has a layout. Next
 * merges a file-based OG image into the segment that owns the file, and any
 * deeper segment that defines `openGraph` / `twitter` REPLACES the object
 * wholesale — so without these, every page would silently lose its og:image.
 */
import type { Metadata } from "next";
import { locales, ogLocales, type Locale } from "./config";
import { localizePath } from "./paths";
import { site } from "@/lib/site";

export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "R Ally's Tech — Software, designed with intent",
};
export const TWITTER_IMAGE = "/twitter-image";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** Absolute URL of `path` in `lang` (for the sitemap / JSON-LD). */
export function absoluteUrl(lang: Locale, path: string): string {
  const local = localizePath(lang, path);
  return `${site.url}${local === "/" ? "" : local}`;
}

/** hreflang map for `path`: { en, fil, x-default }. */
export function languageUrls(path: string, absolute = false): Record<string, string> {
  const at = (l: Locale) => (absolute ? absoluteUrl(l, path) : localizePath(l, path));
  const out: Record<string, string> = {};
  for (const l of locales) out[l] = at(l);
  out["x-default"] = at("en");
  return out;
}

export function alternatesFor(lang: Locale, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localizePath(lang, path),
    languages: languageUrls(path),
  };
}

export function openGraphFor(
  lang: Locale,
  path: string,
  extra: Partial<OpenGraph> = {}
): OpenGraph {
  return {
    type: "website",
    siteName: site.name,
    locale: ogLocales[lang],
    alternateLocale: locales.filter((l) => l !== lang).map((l) => ogLocales[l]),
    url: localizePath(lang, path),
    images: [OG_IMAGE],
    ...extra,
  } as OpenGraph;
}

/** The two locale-dependent fields every public page sets. */
export function localeMetadata(lang: Locale, path: string, og: Partial<OpenGraph> = {}) {
  return {
    alternates: alternatesFor(lang, path),
    openGraph: openGraphFor(lang, path, og),
  } satisfies Metadata;
}
