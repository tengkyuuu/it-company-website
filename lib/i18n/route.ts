/**
 * The middleware's locale-routing decision, as a pure function of the pathname.
 *
 * EDGE-SAFE: middleware.ts runs on the Edge runtime, so this module (and what it
 * imports) must never touch `node:*`, the database, cookies or headers. It's a
 * path-only decision on purpose — no Accept-Language sniffing: an auto-redirect
 * keyed on a request header can't be cached and lets crawlers miss the other
 * language. Visitors switch with the EN / FIL control instead.
 *
 *   /fil, /fil/*        → "next"      Filipino, served as-is
 *   /en, /en/*          → "redirect"  308 to the unprefixed URL — English has ONE
 *                                     canonical address
 *   /admin/**, /api/**,
 *   Next internals,
 *   static files        → "skip"      not a localized page; untouched
 *   everything else     → "rewrite"   to /en + path (the URL bar keeps /projects)
 */
import { defaultLocale } from "./config";

export type LocaleRoute =
  | { action: "skip" }
  | { action: "next"; lang: "fil" }
  | { action: "redirect"; to: string }
  | { action: "rewrite"; to: string };

/** First path segments that are never a localized page. */
const BYPASS_SEGMENTS = new Set([
  "admin", // the CMS — English-only, has its own middleware branch
  "api", // route handlers
  "_next",
  "_vercel",
  ".well-known",
  // root metadata routes (app/opengraph-image.tsx etc.) — no file extension,
  // so the extension rule below doesn't catch them
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
]);

/** True when a pathname is not a localizable page (asset, API, admin, …). */
export function isBypassPath(pathname: string): boolean {
  const first = pathname.split("/")[1] ?? "";
  if (BYPASS_SEGMENTS.has(first)) return true;
  // Next's own dev endpoints (/__nextjs_original-stack-frames, …)
  if (first.startsWith("__next")) return true;
  // public asset folders (public/brand/**, public/work/**). Only BELOW them —
  // a bare /work is a typo'd page URL and should get the branded 404.
  if (pathname.startsWith("/brand/") || pathname.startsWith("/work/")) return true;
  // anything whose last segment has an extension: /robots.txt, /sitemap.xml,
  // /icon.png, /favicon.ico, /brand/logo.png …
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return last.includes(".");
}

/** Does `pathname` sit under the `/<lang>` prefix (exact segment match)? */
function hasPrefix(pathname: string, lang: string): boolean {
  return pathname === `/${lang}` || pathname.startsWith(`/${lang}/`);
}

export function resolveLocaleRoute(pathname: string): LocaleRoute {
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  if (isBypassPath(pathname)) return { action: "skip" };

  if (hasPrefix(pathname, "fil")) return { action: "next", lang: "fil" };

  if (hasPrefix(pathname, defaultLocale)) {
    const rest = pathname.slice(defaultLocale.length + 1);
    return { action: "redirect", to: rest || "/" };
  }

  return {
    action: "rewrite",
    to: pathname === "/" ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`,
  };
}
