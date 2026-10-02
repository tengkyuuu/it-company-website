/**
 * Locale configuration — the single source of truth for which languages the
 * public site speaks.
 *
 * NEUTRAL MODULE: no "use client", no Node APIs. It's imported by server
 * components, client components and middleware.ts (Edge runtime) alike — see
 * the RSC-boundary note in CLAUDE.md (`lib/theme.ts`) for why a shared value must
 * never live in a client module.
 *
 * Routing: English is served at the unprefixed URLs (`/`, `/projects`), Filipino
 * under `/fil`. Internally both live under `app/[lang]/`; middleware.ts rewrites
 * the unprefixed English URLs to `/en/...` (see `lib/i18n/route.ts`).
 */
export type Locale = "en" | "fil";

export const locales = ["en", "fil"] as const satisfies readonly Locale[];

export const defaultLocale: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Coerce an untrusted route param to a locale, falling back to English. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Each language's name in ITSELF (endonym) — what the switcher shows. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  fil: "Filipino",
};

/** Short codes for the EN / FIL pill. */
export const localeShort: Record<Locale, string> = {
  en: "EN",
  fil: "FIL",
};

/** `og:locale` values (territory-qualified, Facebook/OG style). */
export const ogLocales: Record<Locale, string> = {
  en: "en_PH",
  fil: "fil_PH",
};
