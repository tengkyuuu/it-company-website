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
