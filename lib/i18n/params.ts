/**
 * Route-param helpers for pages under app/[lang]/ (server components).
 *
 * middleware.ts guarantees `[lang]` is "en" or "fil" for every real page URL,
 * but paths it skips (anything with a file extension, e.g. /foo.png/bar) still
 * reach the app router with junk in `[lang]`. Pages call `pageLocale()` so those
 * 404 instead of rendering English under a bogus locale; layouts and
 * generateMetadata use `toLocale()` and fall back to English (a layout calling
 * notFound() would bypass the branded 404, which lives inside it).
 */
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";

export type LangParams = { params: Promise<{ lang: string }> };

export async function pageLocale(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return lang;
}

export { toLocale } from "./config";
