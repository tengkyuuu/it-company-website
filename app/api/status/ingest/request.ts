import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Request helpers for the CI status ingest (route.ts). In their own module
 * because a route.ts may only export HTTP handlers + route config, and so the
 * token check can be unit-tested without a request.
 */

/** Shorter than this and the endpoint stays disabled — 32 hex is 128 bits. */
export const MIN_TOKEN_LENGTH = 32;
/** Any real `Bearer <64 hex>` header is ~70 chars; refuse to hash megabytes. */
const MAX_HEADER_LENGTH = 1024;

export type IngestAuth = "ok" | "denied" | "unconfigured";

let warned = false;

/**
 * Compare `Authorization: Bearer <token>` with STATUS_INGEST_TOKEN.
 *
 * Timing-safe: both sides are hashed with SHA-256 first, so `timingSafeEqual`
 * always compares two 32-byte digests — it throws on unequal lengths, and a
 * plain length check before it would leak the secret's length. `===` on the
 * raw strings would leak the matching prefix through early exit.
 *
 * STATUS_INGEST_TOKEN is its OWN secret: never the session secret, the
 * service-role key or IP_HASH_SECRET. The reference project reused its
 * session secret as this CI bearer, so a leaked GitHub secret could mint
 * owner sessions. Here a leak lets someone post a status report — and only
 * 30 an hour (route.ts).
 */
export function checkIngestToken(
  header: string | null | undefined,
  expected: string | undefined
): IngestAuth {
  const secret = expected?.trim() ?? "";
  if (secret.length < MIN_TOKEN_LENGTH) {
    if (!warned && process.env.NODE_ENV === "production") {
      warned = true;
      console.warn(
        "[status] STATUS_INGEST_TOKEN is unset or shorter than 32 characters — /api/status/ingest is disabled."
      );
    }
    return "unconfigured";
  }
  if (!header || header.length > MAX_HEADER_LENGTH) return "denied";

  // auth-scheme is case-insensitive (RFC 9110 §11.1)
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header);
  if (!match) return "denied";

  const got = createHash("sha256").update(match[1], "utf8").digest();
  const want = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(got, want) ? "ok" : "denied";
}

export type BodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "encoding" };

/**
 * Read the body as UTF-8, giving up as soon as it passes `max` bytes —
 * Content-Length is checked first but not trusted (it can be absent or wrong
 * with chunked encoding), so the stream itself is counted.
 */
export async function readCappedText(req: Request, max: number): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return { ok: false, reason: "too_large" };
  if (!req.body) return { ok: true, text: "" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: "encoding" };
  }
}
