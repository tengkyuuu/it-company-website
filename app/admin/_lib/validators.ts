import { z } from "zod";

/**
 * Input validators shared by the panel's server actions.
 *
 * They live here, not in actions.ts, because a `"use server"` module may only
 * export async functions — and these need to be importable on their own so
 * tests/image-validation.test.ts can pin exactly what an <img src> may be.
 * Plain module on purpose: pure functions, no secrets, safe anywhere.
 */

/** True when `v` matches `protocols` AND parses as a URL. */
export function isUrl(v: string, protocols: RegExp) {
  if (!protocols.test(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/**
 * A screenshot is either a path under public/ ("/work/x.webp") or an absolute
 * http(s) URL (a Storage upload). Anything else — javascript:, data:, a
 * protocol-relative "//host" — is refused before it can reach an <img>.
 *
 * "/\host" is refused too: the URL parser treats "\" as "/" in http(s) URLs,
 * so "/\evil.example/x.png" resolves to https://evil.example/x.png — the same
 * protocol-relative escape as "//", just spelled with a backslash.
 */
export const imagePath = z
  .string()
  .max(500)
  .refine(
    (v) => v === "" || /^\/(?![/\\])\S*$/.test(v) || isUrl(v, /^https?:\/\//i),
    "Use a /path or a full https:// URL"
  );

/** An internal path ("/contact", "/blog/x#y") — never "//host" or "/\host". */
const internalPath = /^\/(?![/\\])\S*$/;

/**
 * True for a link a call-to-action button may point at: a full https:// address
 * or a path on this site. Everything else is refused — `javascript:` and
 * `data:` would run in our origin when clicked, `//host` / `/\host` leave the
 * site while looking internal, and plain http:// is a downgrade we don't want
 * to put our name on. Exported separately so lib/cms.ts can re-check a row on
 * the way OUT (the database has no CHECK on cta_url, so anything written with
 * the SQL editor would otherwise reach an <a href>).
 */
export function isCtaUrl(v: string) {
  return internalPath.test(v) || isUrl(v, /^https:\/\/\S+$/i);
}

/** Form validator for a product's CTA link: '' (no button) or a safe link. */
export const ctaUrl = z
  .string()
  .max(500, "Keep the link under 500 characters")
  .refine((v) => v === "" || isCtaUrl(v), "Use a full https:// address or a /path on this site");
