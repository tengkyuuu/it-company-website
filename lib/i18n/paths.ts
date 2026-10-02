/**
 * Locale-aware URL helpers. NEUTRAL MODULE (no "use client") — safe in server
 * components, client components and Edge middleware.
 *
 * English lives at the unprefixed URLs, Filipino under /fil:
 *   localizePath("en",  "/projects")  → "/projects"
 *   localizePath("fil", "/projects")  → "/fil/projects"
 *   localizePath("fil", "/")          → "/fil"
 */
import { defaultLocale, locales, type Locale } from "./config";
import { isBypassPath } from "./route";

/**
 * Prefix an internal href for `lang`. Leaves alone anything that isn't a
 * localizable page: `#hash`, `mailto:` / `tel:`, absolute and protocol-relative
 * URLs, `/admin` and `/api`, static files — and hrefs that already carry a
 * locale prefix, so applying it twice is harmless.
 */
export function localizePath(lang: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  // split off ?query / #hash so the prefix goes on the path part only
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const tail = cut === -1 ? "" : href.slice(cut);

  if (isBypassPath(path)) return href;
  if (lang === defaultLocale) return href;
  if (localeOf(path)) return href; // already prefixed

  return `${path === "/" ? `/${lang}` : `/${lang}${path}`}${tail}`;
}

/** The locale a pathname is explicitly prefixed with, if any. */
function localeOf(pathname: string): Locale | null {
  for (const l of locales) {
    if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return l;
  }
  return null;
}

/**
 * Split a pathname into its locale and the locale-free path.
 *
 * Accepts both the public form (`/projects`, `/fil/projects`) and the internal
 * rewritten form (`/en/projects`) — `usePathname()` returns the latter while a
 * page is prerendered and the former in the browser, so anything rendered from
 * it must normalise through here or it won't hydrate cleanly.
 */
export function stripLocale(pathname: string): { lang: Locale; path: string } {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const lang = localeOf(p);
  if (!lang) return { lang: defaultLocale, path: p };
  const rest = p.slice(lang.length + 1);
  return { lang, path: rest || "/" };
}

/** The same page in `target` — what the EN / FIL switcher links to. */
export function switchLocalePath(pathname: string, target: Locale): string {
  return localizePath(target, stripLocale(pathname).path);
}
