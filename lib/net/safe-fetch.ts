import "server-only";

import dns from "node:dns";
import https from "node:https";
import type { LookupAddress, LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import { classifyIp, isIpLiteral } from "./ip";
import type { HeaderBag } from "./frame-policy";

/**
 * An SSRF-guarded "fetch the response headers of this URL" for the server.
 *
 * Today's only caller is the live-URL embed probe (lib/net/embed-probe.ts),
 * which runs on an editor's say-so against a URL they typed. Without a guard
 * that is a textbook SSRF: `https://169.254.169.254/` (cloud metadata),
 * `https://localhost:5432/`, or a public name that RESOLVES to 10.0.0.5.
 *
 * Rules, all enforced here:
 *  - https: only, on the default port, no user:pass@ in the URL;
 *  - an IP-literal host must be public (lib/net/ip.ts); `localhost`, `*.localhost`
 *    and single-label names (which a resolver may expand via search domains,
 *    e.g. `metadata` → metadata.google.internal) are refused outright;
 *  - every DNS answer must be public — and that check runs INSIDE the socket's
 *    own `lookup` hook, so the address validated is the address connected to.
 *    A rebinding DNS server can't pass a check with one answer and hand the
 *    connection another;
 *  - redirects are followed by hand, at most 3, each hop re-checked from
 *    scratch (a public URL may redirect to http://127.0.0.1/);
 *  - 5 s for the whole thing; headers only — the body is never read; a fixed
 *    User-Agent; a fresh agent per hop (no pooled socket skips the lookup).
 *
 * The resolver and the transport are injectable so tests never touch the
 * network.
 */

export const PROBE_TIMEOUT_MS = 5000;
export const MAX_REDIRECTS = 3;
export const PROBE_USER_AGENT = "RAllysTech-EmbedCheck/1.0 (+https://mykt.studio)";

export type ResolvedAddress = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type HeadResponse = { status: number; headers: HeaderBag };
export type Transport = (req: {
  url: URL;
  lookup: LookupFunction;
  signal: AbortSignal;
  headers: Record<string, string>;
}) => Promise<HeadResponse>;

export type FetchHeadOptions = {
  resolve?: Resolver;
  transport?: Transport;
  timeoutMs?: number;
  maxRedirects?: number;
};

export type FetchHeadOutcome =
  | { ok: true; url: string; status: number; headers: HeaderBag; redirects: number }
  | { ok: false; kind: "blocked" | "unreachable"; reason: string };

/** Thrown from the lookup hook; recognised by name so it survives Node's error plumbing. */
export class BlockedAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedAddressError";
  }
}

// ---------------------------------------------------------------------------
// URL rules
// ---------------------------------------------------------------------------

export function checkUrl(raw: string | URL): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = typeof raw === "string" ? new URL(raw) : new URL(raw.href);
  } catch {
    return { ok: false, reason: "That isn't a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Only https:// addresses are checked" };
  if (url.username || url.password) {
    return { ok: false, reason: "Addresses with a user name or password in them aren't checked" };
  }
  // the URL parser already folds an explicit :443 into "" — anything left is non-default
  if (url.port) return { ok: false, reason: "Only the default https port (443) is allowed" };

  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "That URL has no host" };
  if (isIpLiteral(host)) {
    const v = classifyIp(host);
    if (!v.ok) return { ok: false, reason: `Blocked — ${v.reason}` };
    return { ok: true, url };
  }
  const bare = host.replace(/\.$/, "");
  if (bare === "localhost" || bare.endsWith(".localhost")) {
    return { ok: false, reason: "Blocked — localhost isn't a public address" };
  }
  if (!bare.includes(".")) {
    return { ok: false, reason: `Blocked — “${bare}” isn't a public domain name` };
  }
  return { ok: true, url };
}

// ---------------------------------------------------------------------------
// connect-time address validation
// ---------------------------------------------------------------------------

export const systemResolver: Resolver = async (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true });

/**
 * A `lookup` for net/tls sockets that refuses to hand back a non-public
 * address. Node calls it with `{ all: true }` when happy-eyeballs
 * (autoSelectFamily) is on — the default since Node 20 — so both shapes are
 * answered. If ANY answer is non-public the whole lookup fails: a name that
 * resolves to a mix of public and private addresses is not one to trust.
 */
export function guardedLookup(resolve: Resolver): LookupFunction {
  return ((hostname: string, options: LookupOptions, callback: (...args: unknown[]) => void) => {
    resolve(hostname).then(
      (answers) => {
        if (!answers.length) {
          const err = Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
          return callback(err);
        }
        for (const a of answers) {
          const v = classifyIp(a.address);
          if (!v.ok) return callback(new BlockedAddressError(v.reason));
        }
        const family = typeof options === "object" && options ? options.family : undefined;
        const wanted = answers.filter(
          (a) => !family || family === 0 || a.family === family || (family as unknown) === `IPv${a.family}`
        );
        const list: LookupAddress[] = (wanted.length ? wanted : answers).map((a) => ({
          address: a.address,
          family: a.family,
        }));
        if (typeof options === "object" && options?.all) return callback(null, list);
        return callback(null, list[0].address, list[0].family);
      },
      (err) => callback(err)
    );
  }) as unknown as LookupFunction;
}

// ---------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------

/** GET, take the status line + headers, then drop the connection. */
export const httpsTransport: Transport = ({ url, lookup, signal, headers }) =>
  new Promise<HeadResponse>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers,
        lookup,
        signal,
        // a fresh agent: a pooled keep-alive socket would skip the lookup hook
        agent: false,
        // some servers send big CSP headers; still bounded
        maxHeaderSize: 32 * 1024,
      },
      (res) => {
        res.on("error", () => {}); // destroying mid-body may emit "aborted"
        resolve({ status: res.statusCode ?? 0, headers: res.headers as HeaderBag });
        res.destroy();
        req.destroy();
      }
    );
    req.on("error", reject);
    req.end();
  });

// ---------------------------------------------------------------------------
// the fetch
// ---------------------------------------------------------------------------

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function describeError(err: unknown, timeoutMs: number): { kind: "blocked" | "unreachable"; reason: string } {
  const e = err as { name?: string; code?: string; message?: string } | null;
  if (e?.name === "BlockedAddressError") return { kind: "blocked", reason: `Blocked — ${e.message}` };
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || e?.code === "ABORT_ERR") {
    return { kind: "unreachable", reason: `Unreachable — no answer within ${Math.round(timeoutMs / 1000)} s` };
  }
  const code = e?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") {
    return { kind: "unreachable", reason: "Unreachable — the domain doesn't resolve" };
  }
  if (code === "ECONNREFUSED") return { kind: "unreachable", reason: "Unreachable — connection refused" };
  if (code === "ECONNRESET") return { kind: "unreachable", reason: "Unreachable — the connection was reset" };
  if (code === "ETIMEDOUT") return { kind: "unreachable", reason: "Unreachable — the connection timed out" };
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) {
    return { kind: "unreachable", reason: "Unreachable — its TLS certificate isn't valid" };
  }
  if (code === "HPE_HEADER_OVERFLOW") {
    return { kind: "unreachable", reason: "Unreachable — its response headers are too large" };
  }
  return { kind: "unreachable", reason: `Unreachable — network error${code ? ` (${code})` : ""}` };
}

/**
 * Status + headers of `rawUrl`, following up to `maxRedirects` redirects, each
 * hop validated. Never throws.
 */
export async function fetchHead(rawUrl: string, options: FetchHeadOptions = {}): Promise<FetchHeadOutcome> {
  const {
    resolve = systemResolver,
    transport = httpsTransport,
    timeoutMs = PROBE_TIMEOUT_MS,
    maxRedirects = MAX_REDIRECTS,
  } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  const lookup = guardedLookup(resolve);
  const headers = {
    "User-Agent": PROBE_USER_AGENT,
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  };

  let current: string = rawUrl;
  for (let redirects = 0; ; redirects++) {
    const checked = checkUrl(current);
    if (!checked.ok) {
      return {
        ok: false,
        kind: checked.reason.startsWith("Blocked") ? "blocked" : "unreachable",
        reason: redirects ? `${checked.reason} (after a redirect to ${current.slice(0, 120)})` : checked.reason,
      };
    }

    let res: HeadResponse;
    try {
      if (signal.aborted) throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
      res = await transport({ url: checked.url, lookup, signal, headers });
    } catch (err) {
      return { ok: false, ...describeError(err, timeoutMs) };
    }

    const location = res.headers.location ?? res.headers.Location;
    const target = Array.isArray(location) ? location[0] : location;
    if (REDIRECTS.has(res.status) && target) {
      if (redirects >= maxRedirects) {
        return {
          ok: false,
          kind: "unreachable",
          reason: `Unreachable — more than ${maxRedirects} redirects`,
        };
      }
      try {
        current = new URL(target, checked.url).href;
      } catch {
        return { ok: false, kind: "unreachable", reason: "Unreachable — it redirects to an invalid URL" };
      }
      continue;
    }

    return { ok: true, url: checked.url.href, status: res.status, headers: res.headers, redirects };
  }
}
