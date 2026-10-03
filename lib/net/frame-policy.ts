/**
 * "Will a browser let THIS site show that page in an <iframe>?" — decided from
 * the framed page's response headers, the way the HTML and CSP specs do it.
 *
 * Pure (no Node APIs), so tests/safe-fetch.test.ts can pin the parsing. Used by
 * lib/net/embed-probe.ts on the headers the SSRF-guarded probe brought back.
 *
 *  1. If any ENFORCED Content-Security-Policy carries `frame-ancestors`, that
 *     decides, and X-Frame-Options is ignored (CSP3 §6.4.2 / HTML "check a
 *     navigation response's adherence to its embedder policy"). Every policy
 *     that has the directive must allow us. Report-Only policies don't count.
 *  2. Otherwise X-Frame-Options: DENY → no; SAMEORIGIN → no (we're never the
 *     same origin as the project); conflicting values → no; anything else
 *     (ALLOWALL, the obsolete ALLOW-FROM, junk) is ignored by browsers → yes.
 *  3. No restriction at all → yes.
 */

export type HeaderBag = Record<string, string | string[] | undefined>;
export type FrameVerdict = { embeddable: boolean; reason: string };

const MAX_REASON = 280;
const clip = (s: string) => (s.length > MAX_REASON ? `${s.slice(0, MAX_REASON - 1)}…` : s);

/** Every value of a header, case-insensitively (Node lowercases; fakes may not). */
export function headerValues(headers: HeaderBag, name: string): string[] {
  const want = name.toLowerCase();
  const out: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== want || v === undefined) continue;
    out.push(...(Array.isArray(v) ? v : [v]));
  }
  return out;
}

/**
 * The `frame-ancestors` source list of each policy that has one. A header value
 * may hold several comma-separated policies (and Node joins repeated CSP
 * headers with ", "); within a policy the FIRST occurrence of a directive wins.
 */
export function frameAncestorLists(cspHeaderValues: string[]): string[][] {
  const lists: string[][] = [];
  for (const value of cspHeaderValues) {
    for (const policy of value.split(",")) {
      const seen = new Set<string>();
      for (const directive of policy.split(";")) {
        const tokens = directive.trim().split(/[\t\n\f\r ]+/).filter(Boolean);
        if (!tokens.length) continue;
        const name = tokens[0].toLowerCase();
        if (seen.has(name)) continue;
        seen.add(name);
        if (name === "frame-ancestors") lists.push(tokens.slice(1));
      }
    }
  }
  return lists;
}

const DEFAULT_PORT: Record<string, string> = { "http:": "80", "https:": "443" };

/** Does one source expression allow `embedder` (an origin URL) to frame a page from `framed`? */
function sourceAllows(token: string, embedder: URL, framed: URL): boolean {
  const t = token.toLowerCase();
  const networkScheme = embedder.protocol === "https:" || embedder.protocol === "http:";

  if (t === "*") return networkScheme;
  if (t === "'self'") return embedder.origin === framed.origin;
  if (t.startsWith("'")) return false; // other keywords mean nothing here

  // scheme-source: "https:" (and "http:", which CSP3 lets match https too)
  const scheme = /^([a-z][a-z0-9+.-]*):$/.exec(t);
  if (scheme) {
    const s = `${scheme[1]}:`;
    return s === embedder.protocol || (s === "http:" && embedder.protocol === "https:");
  }

  // host-source: [scheme://]host[:port][/path]
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.?)(?::(\d+|\*))?(\/.*)?$/.exec(t);
  if (!m) return false;
  const [, srcScheme, rawHost, port, path] = m;
  if (srcScheme) {
    const s = `${srcScheme}:`;
    if (!(s === embedder.protocol || (s === "http:" && embedder.protocol === "https:"))) return false;
  } else if (!networkScheme) {
    return false;
  }

  const host = rawHost.replace(/\.$/, "");
  const target = embedder.hostname.toLowerCase();
  if (host === "*") {
    // any host
  } else if (host.startsWith("*.")) {
    if (!target.endsWith(host.slice(1))) return false; // subdomains only, not the apex
  } else if (host !== target) {
    return false;
  }

  if (port && port !== "*") {
    const want = embedder.port || DEFAULT_PORT[embedder.protocol];
    // a source with an explicit :80 also matches https on :443 (CSP3 upgrade)
    const upgraded = port === "80" && want === "443";
    if (port !== want && !upgraded) return false;
  }

  // frame-ancestors matches the ancestor's ORIGIN serialised as a URL, whose
  // path is "/": any longer path can never match
  if (path && path !== "/") return false;
  return true;
}

/** Does this frame-ancestors source list allow `embedder`? An empty list = 'none'. */
export function sourceListAllows(sources: string[], embedder: URL, framed: URL): boolean {
  const list = sources.filter((s) => s.toLowerCase() !== "'none'" || sources.length === 1);
  if (!list.length || (list.length === 1 && list[0].toLowerCase() === "'none'")) return false;
  return list.some((s) => sourceAllows(s, embedder, framed));
}

/**
 * The verdict for a framed page at `framedOrigin` (the final URL after
 * redirects — that's what the iframe ends up showing), embedded by this site's
 * public origin `embedderOrigin`.
 */
export function frameVerdict(headers: HeaderBag, embedderOrigin: string, framedOrigin: string): FrameVerdict {
  const embedder = new URL(embedderOrigin);
  const framed = new URL(framedOrigin);

  const lists = frameAncestorLists(headerValues(headers, "content-security-policy"));
  if (lists.length) {
    for (const list of lists) {
      if (sourceListAllows(list, embedder, framed)) continue;
      const shown = list.length ? list.join(" ") : "'none'";
      return {
        embeddable: false,
        reason: clip(
          /^'none'$/i.test(shown)
            ? "Its Content-Security-Policy says frame-ancestors 'none'"
            : `Its Content-Security-Policy frame-ancestors doesn't include this site (allows: ${shown})`
        ),
      };
    }
    return { embeddable: true, reason: "" };
  }

  const xfo = new Set(
    headerValues(headers, "x-frame-options")
      .flatMap((v) => v.split(","))
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
  const known = ["deny", "sameorigin", "allowall"];
  if (xfo.size > 1) {
    if ([...xfo].some((v) => known.includes(v))) {
      return {
        embeddable: false,
        reason: clip(`X-Frame-Options has conflicting values (${[...xfo].join(", ").toUpperCase()})`),
      };
    }
    return { embeddable: true, reason: "" }; // all invalid → ignored
  }
  const [only] = [...xfo];
  if (only === "deny") return { embeddable: false, reason: "X-Frame-Options: DENY" };
  if (only === "sameorigin" && embedder.origin !== framed.origin) {
    return { embeddable: false, reason: "X-Frame-Options: SAMEORIGIN" };
  }
  return { embeddable: true, reason: "" };
}
