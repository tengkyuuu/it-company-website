import "server-only";

import { createHmac, createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Request-security primitives shared by the public endpoints (contact, chat)
 * and the admin auth flows: client-IP extraction, keyed IP hashing, and a
 * durable rate limiter.
 *
 * Node-only (`node:crypto`). Don't import this from middleware.ts — that runs
 * on the Edge runtime.
 *
 * ── IP hashing ──────────────────────────────────────────────────────────────
 * A visitor's IP is never stored raw. `hashIp` is HMAC-SHA256 keyed with
 * IP_HASH_SECRET, so the stored value is deterministic (the inbox can still
 * thread a visitor's messages together) but can't be reversed by anyone who
 * reads the database without also holding the secret. A plain unkeyed SHA-256
 * would NOT do that: the whole IPv4 space is only 2^32 values, a few seconds
 * of brute force.
 *
 * IP_HASH_SECRET missing → a FIXED fallback string is used (with one warning
 * in production). Fixed, not random-per-process, because a hash that changes
 * on every cold start would break inbox threading and every limiter key. The
 * fallback is in this public source file, so until a real secret is set the
 * hashes are pseudonymous, not private — set the env var.
 * It is deliberately NOT derived from another secret (the service-role key,
 * a session secret, …): reusing one secret for two jobs means leaking either
 * leaks both, and rotating one silently changes the other.
 *
 * ── Rate limiting: `consumeLimit` ───────────────────────────────────────────
 * Charges one hit against `key` and returns true while the caller is within
 * `limit` hits per `windowSeconds`, false once over. Backed by the atomic
 * `public.consume_security_limit` RPC (supabase/schema.sql), service-role
 * only, so the count is shared across every serverless instance and survives
 * cold starts. Callers pass an ALREADY-HMAC'd key (`hashKey(...)`) so no raw
 * IP reaches the limiter table either.
 *
 * Failure policy — Supabase not configured, or the RPC errors / times out:
 *   - `failClosed: true`  → return false (deny). For auth endpoints, where an
 *                            unmetered fallback would hand a brute-forcer a
 *                            free window whenever the database blips.
 *   - default (fail open) → fall back to an in-memory limiter with the same
 *                            fixed-window semantics, per warm instance. A
 *                            paused free-tier project must never block the
 *                            contact form or the chat; the fallback still
 *                            stops a single instance being hammered.
 * The RPC gets a hard 2s timeout and NO retries: postgrest-js retries with
 * 1s/2s/4s backoff, and a visitor's submit shouldn't hang ~7s on a database
 * that is down when the fallback can answer immediately. After any failure a
 * 15s circuit breaker (per instance) skips the RPC and applies the same
 * policy at once, so a down database costs one timeout, not one per call.
 */

// ── secret ───────────────────────────────────────────────────────────────────

const FALLBACK_SECRET = "mykt-ip-hash-fallback-v1::set-IP_HASH_SECRET";
let warnedSecret = false;

function secret(): string {
  const s = process.env.IP_HASH_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production" && !warnedSecret) {
    warnedSecret = true;
    console.warn(
      "[security] IP_HASH_SECRET is not set — using the built-in fallback. " +
        "IP hashes are stable but NOT private until a real secret is configured."
    );
  }
  return FALLBACK_SECRET;
}

const hmacHex = (data: string) =>
  createHmac("sha256", secret()).update(data).digest("hex");

// ── IP ───────────────────────────────────────────────────────────────────────

/**
 * The visitor's IP: first `x-forwarded-for` hop (the client, as set by the
 * platform proxy — Vercel overwrites this header, so it isn't spoofable
 * there), else `x-real-ip`. Trimmed; null when neither is present.
 */
export function clientIp(h: Headers): string | null {
  const first = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  const real = h.get("x-real-ip")?.trim();
  return real || null;
}

/**
 * HMAC-SHA256(IP_HASH_SECRET, ip) as hex, truncated to 32 chars (128 bits —
 * plenty to stay collision-free across an inbox). Null in → null out.
 * Lower-cased first so the same IPv6 address can't hash two ways.
 */
export function hashIp(ip: string | null): string | null {
  const v = ip?.trim().toLowerCase();
  if (!v) return null;
  return hmacHex(v).slice(0, 32);
}

/** HMAC-SHA256(IP_HASH_SECRET, parts.join("|")) as hex — for limiter keys. */
export function hashKey(...parts: string[]): string {
  return hmacHex(parts.join("|"));
}

// ── misc crypto ──────────────────────────────────────────────────────────────

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** 256 bits of randomness, URL-safe. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

// ── rate limiting ────────────────────────────────────────────────────────────

const RPC_TIMEOUT_MS = 2000;

/** In-memory fallback: fixed window per key, same semantics as the RPC. */
const MEMORY = new Map<string, { count: number; resetAt: number }>();
const MEMORY_CAP = 5000;

function memoryConsume(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  let entry = MEMORY.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    MEMORY.set(key, entry);
  }
  entry.count += 1;

  if (MEMORY.size > MEMORY_CAP) {
    for (const [k, v] of MEMORY) if (v.resetAt <= now) MEMORY.delete(k);
    // still over (a flood of distinct keys): drop the oldest. Losing a few
    // live counters beats unbounded memory on a long-lived instance.
    for (const k of MEMORY.keys()) {
      if (MEMORY.size <= MEMORY_CAP) break;
      if (k !== key) MEMORY.delete(k);
    }
  }

  return entry.count <= limit;
}

let admin: ReturnType<typeof createAdminClient> | null = null;
let lastRpcWarn = 0;

/**
 * Circuit breaker: after a failure, skip the RPC for BREAKER_MS and apply the
 * fallback policy straight away. Without it every request to a down database
 * pays the full 2s timeout — twice, on routes that check a per-IP and a
 * global limit.
 */
const BREAKER_MS = 15_000;
let rpcDownUntil = 0;

function rpcFailed(detail: string) {
  const now = Date.now();
  rpcDownUntil = now + BREAKER_MS;
  // a down database would otherwise log once per request
  if (now - lastRpcWarn < 60_000) return;
  lastRpcWarn = now;
  console.warn(`[security] rate-limit RPC unavailable (${detail}) — using fallback policy.`);
}

/**
 * Charge one hit against `key` (already HMAC'd — see `hashKey`). True = allowed.
 * Never throws. See the header comment for the failure policy.
 */
export async function consumeLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  opts: { failClosed?: boolean } = {}
): Promise<boolean> {
  const fallback = () =>
    opts.failClosed ? false : memoryConsume(key, limit, windowSeconds);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallback();
  }
  if (Date.now() < rpcDownUntil) return fallback();

  try {
    admin ??= createAdminClient();
    const { data, error } = await admin
      .rpc("consume_security_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
      .abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS))
      .retry(false);

    if (error) {
      rpcFailed(error.message);
      return fallback();
    }
    if (typeof data !== "boolean") {
      rpcFailed(`unexpected result: ${JSON.stringify(data)}`);
      return fallback();
    }
    return data;
  } catch (e) {
    rpcFailed(e instanceof Error ? e.message : String(e));
    return fallback();
  }
}
