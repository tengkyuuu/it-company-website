import type { LookupOptions } from "node:dns";
import { describe, expect, it } from "vitest";
import { classifyIp, isIpLiteral, parseIPv4, parseIPv6 } from "@/lib/net/ip";
import { frameAncestorLists, frameVerdict, type HeaderBag } from "@/lib/net/frame-policy";
import {
  checkUrl,
  fetchHead,
  guardedLookup,
  type HeadResponse,
  type Resolver,
  type Transport,
} from "@/lib/net/safe-fetch";
import { probeEmbed } from "@/lib/net/embed-probe";
import { EMBED_RECHECK_MS, planEmbedCheck } from "@/lib/net/embed-plan";

/**
 * The SSRF guard + embed probe behind "save a project's live URL" (lib/net/**).
 * An editor types a URL and the SERVER connects to it, so the guard is what
 * stands between that form field and the cloud metadata endpoint, the database
 * port or anything else on the private network. No real network here: the
 * resolver and transport are injected (the one test that uses the real
 * transport fails inside the lookup hook, before any socket opens).
 */

const SITE = "https://mykt.studio";

// ---------------------------------------------------------------------------
// IP classification
// ---------------------------------------------------------------------------

describe("classifyIp", () => {
  const blocked = [
    // IPv4
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "100.100.100.200", // Alibaba Cloud metadata
    "100.127.255.255",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254", // AWS / GCP / Azure metadata
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.8",
    "192.0.2.1",
    "192.88.99.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.19.255.255",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "239.255.255.250",
    "240.0.0.1",
    "255.255.255.255",
    // IPv6
    "::",
    "::1",
    "[::1]",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "[::ffff:7f00:1]",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "::127.0.0.1", // deprecated IPv4-compatible
    "64:ff9b::7f00:1", // NAT64 of 127.0.0.1
    "64:ff9b::a9fe:a9fe", // NAT64 of 169.254.169.254
    "64:ff9b:1::1",
    "100::1",
    "2001::1", // Teredo
    "2001:db8::1",
    "2002:7f00:1::1", // 6to4 of 127.0.0.1
    "3fff::1",
    "5f00::1",
    "fc00::1",
    "fd00:ec2::254", // AWS metadata over IPv6
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "4000::1", // outside 2000::/3
  ];
  it.each(blocked)("refuses %s", (ip) => {
    expect(classifyIp(ip).ok).toBe(false);
  });

  const allowed = [
    "1.1.1.1",
    "8.8.8.8",
    "76.76.21.21",
    "93.184.216.34",
    "100.63.255.255", // just below CGNAT
    "100.128.0.0", // just above CGNAT
    "172.15.255.255",
    "172.32.0.0",
    "192.167.255.255",
    "192.169.0.0",
    "198.17.255.255",
    "198.20.0.0",
    "223.255.255.255",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888", // 2001:4860 is outside 2001::/23
    "2a00:1450:4001:80b::200e",
    "[2606:4700:4700::1111]",
    "::ffff:8.8.8.8", // mapped → judged as 8.8.8.8
    "64:ff9b::808:808", // NAT64 of 8.8.8.8
  ];
  it.each(allowed)("allows %s", (ip) => {
    expect(classifyIp(ip)).toMatchObject({ ok: true });
  });

  it("fails closed on anything that isn't strictly an IP", () => {
    for (const s of ["", "localhost", "1.2.3", "1.2.3.4.5", "256.1.1.1", "01.2.3.4", "0x7f.0.0.1", "1::2::3", "12345::1", "fe80::1%eth0", "::ffff:1.2.3"]) {
      expect(classifyIp(s).ok, s).toBe(false);
    }
  });

  it("names the range in the reason", () => {
    expect(classifyIp("169.254.169.254")).toEqual({
      ok: false,
      reason: expect.stringContaining("metadata"),
    });
    expect(classifyIp("::ffff:127.0.0.1")).toEqual({
      ok: false,
      reason: expect.stringMatching(/IPv4-mapped 127\.0\.0\.1 is loopback/),
    });
  });

  it("parses the forms it accepts", () => {
    expect(parseIPv4("192.168.0.1")).toEqual([192, 168, 0, 1]);
    expect(parseIPv6("::ffff:127.0.0.1")).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 127, 0, 0, 1]);
    expect(parseIPv6("1:2:3:4:5:6:7:8")?.length).toBe(16);
    expect(parseIPv6("1:2:3:4:5:6:1.2.3.4")?.slice(12)).toEqual([1, 2, 3, 4]);
    expect(parseIPv6("1:2:3:4:5:6:7:8:9")).toBeNull();
    expect(parseIPv6("1:2:3:4:5:6:7::8")).toBeNull(); // "::" must stand for ≥1 group
    expect(isIpLiteral("[::1]")).toBe(true);
    expect(isIpLiteral("example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// URL rules
// ---------------------------------------------------------------------------

describe("checkUrl", () => {
  it("normalises exotic IPv4 spellings through the URL parser — then refuses them", () => {
    // the WHATWG parser does the normalising; the guard sees canonical quads
    expect(new URL("https://2130706433/").hostname).toBe("127.0.0.1");
    expect(new URL("https://0x7f.1/").hostname).toBe("127.0.0.1");
    expect(new URL("https://0177.0.0.1/").hostname).toBe("127.0.0.1");
    expect(new URL("https://127.1/").hostname).toBe("127.0.0.1");
    expect(new URL("https://[::ffff:127.0.0.1]/").hostname).toBe("[::ffff:7f00:1]");
    for (const u of [
      "https://2130706433/",
      "https://0x7f.1/",
      "https://0177.0.0.1/",
      "https://127.1/",
      "https://0.0.0.0/",
      "https://[::1]/",
      "https://[::ffff:127.0.0.1]/",
      "https://[::ffff:a9fe:a9fe]/latest/meta-data",
      "https://169.254.169.254/latest/meta-data/",
      "https://3232235777/", // 192.168.1.1
    ]) {
      const r = checkUrl(u);
      expect(r.ok, u).toBe(false);
      if (!r.ok) expect(r.reason, u).toMatch(/^Blocked/);
    }
  });

  it("https only, default port only, no credentials", () => {
    expect(checkUrl("http://example.com/").ok).toBe(false);
    expect(checkUrl("ftp://example.com/").ok).toBe(false);
    expect(checkUrl("javascript:alert(1)").ok).toBe(false);
    expect(checkUrl("not a url").ok).toBe(false);
    expect(checkUrl("https://user:pass@example.com/").ok).toBe(false);
    expect(checkUrl("https://user@example.com/").ok).toBe(false);
    expect(checkUrl("https://example.com:8443/").ok).toBe(false);
    expect(checkUrl("https://example.com:80/").ok).toBe(false);
    expect(checkUrl("https://example.com:443/").ok).toBe(true); // folded to the default
    expect(checkUrl("https://93.184.216.34/").ok).toBe(true);
    expect(checkUrl("https://[2606:4700:4700::1111]/").ok).toBe(true);
  });

  it("refuses localhost and single-label names (search-domain expansion)", () => {
    expect(checkUrl("https://localhost/").ok).toBe(false);
    expect(checkUrl("https://LOCALHOST./").ok).toBe(false);
    expect(checkUrl("https://admin.localhost/").ok).toBe(false);
    expect(checkUrl("https://metadata/computeMetadata/v1/").ok).toBe(false);
    expect(checkUrl("https://intranet/").ok).toBe(false);
    expect(checkUrl("https://famecrm.app/").ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// connect-time lookup
// ---------------------------------------------------------------------------

const answers =
  (map: Record<string, string[]>): Resolver =>
  async (host) => {
    const list = map[host];
    if (!list) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND" });
    return list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };

function lookupOnce(resolve: Resolver, host: string, options: LookupOptions) {
  return new Promise<{ err: unknown; address: unknown; family: unknown }>((done) =>
    guardedLookup(resolve)(host, options, (err, address, family) => done({ err, address, family }))
  );
}

describe("guardedLookup", () => {
  it("answers both shapes Node asks for (single, and { all: true } for happy-eyeballs)", async () => {
    const resolve = answers({ "site.example.com": ["93.184.216.34", "2606:4700:4700::1111"] });
    expect(await lookupOnce(resolve, "site.example.com", {})).toEqual({
      err: null,
      address: "93.184.216.34",
      family: 4,
    });
    const all = await lookupOnce(resolve, "site.example.com", { all: true });
    expect(all.err).toBeNull();
    expect(all.address).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    const v6 = await lookupOnce(resolve, "site.example.com", { family: 6 });
    expect(v6.address).toBe("2606:4700:4700::1111");
  });

  it("fails the whole lookup if ANY answer is non-public", async () => {
    const resolve = answers({ "mixed.example.com": ["93.184.216.34", "10.0.0.5"] });
    const r = await lookupOnce(resolve, "mixed.example.com", { all: true });
    expect((r.err as Error).name).toBe("BlockedAddressError");
  });

  it("passes resolver errors through", async () => {
    const r = await lookupOnce(answers({}), "nope.example.com", {});
    expect((r.err as { code?: string }).code).toBe("ENOTFOUND");
  });
});

// ---------------------------------------------------------------------------
// fetchHead
// ---------------------------------------------------------------------------

/** Pretends to connect: resolves the host through the guarded lookup first, like a socket would. */
function fakeTransport(routes: Record<string, HeadResponse | Error>): Transport & { seen: string[] } {
  const seen: string[] = [];
  const transport = (({ url, lookup }) =>
    new Promise<HeadResponse>((resolve, reject) => {
      const connect = () => {
        seen.push(url.href);
        const r = routes[url.href];
        if (!r) return reject(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
        return r instanceof Error ? reject(r) : resolve(r);
      };
      // Node skips the lookup for IP literals — so does this fake
      if (isIpLiteral(url.hostname)) return connect();
      lookup(url.hostname, { all: true }, (err) => (err ? reject(err) : connect()));
    })) as Transport & { seen: string[] };
  transport.seen = seen;
  return transport;
}

const ok = (headers: HeaderBag = {}): HeadResponse => ({ status: 200, headers });
const redirect = (location: string, status = 302): HeadResponse => ({ status, headers: { location } });

describe("fetchHead", () => {
  const resolve = answers({
    "site.example.com": ["93.184.216.34"],
    "www.site.example.com": ["93.184.216.35"],
    "evil.example.com": ["127.0.0.1"],
    "meta.example.com": ["169.254.169.254"],
  });

  it("returns status + headers for a public site", async () => {
    const transport = fakeTransport({ "https://site.example.com/": ok({ "x-frame-options": "DENY" }) });
    const out = await fetchHead("https://site.example.com/", { resolve, transport });
    expect(out).toEqual({
      ok: true,
      url: "https://site.example.com/",
      status: 200,
      headers: { "x-frame-options": "DENY" },
      redirects: 0,
    });
  });

  it("refuses a public-looking name that resolves to a private address — before connecting", async () => {
    const transport = fakeTransport({ "https://evil.example.com/": ok() });
    const out = await fetchHead("https://evil.example.com/", { resolve, transport });
    expect(out).toMatchObject({ ok: false, kind: "blocked" });
    expect(transport.seen).toEqual([]);
  });

  it("follows redirects by hand and re-checks every hop", async () => {
    const transport = fakeTransport({
      "https://site.example.com/": redirect("https://www.site.example.com/home"),
      "https://www.site.example.com/home": ok(),
    });
    const out = await fetchHead("https://site.example.com/", { resolve, transport });
    expect(out).toMatchObject({ ok: true, url: "https://www.site.example.com/home", redirects: 1 });
  });

  it("a redirect to a private address is blocked (literal, or via DNS)", async () => {
    for (const target of ["https://127.0.0.1/admin", "https://meta.example.com/latest", "https://[::1]/"]) {
      const transport = fakeTransport({ "https://site.example.com/": redirect(target) });
      const out = await fetchHead("https://site.example.com/", { resolve, transport });
      expect(out, target).toMatchObject({ ok: false, kind: "blocked" });
      expect(transport.seen).toEqual(["https://site.example.com/"]);
    }
  });

  it("a redirect to http:// or a non-default port is refused", async () => {
    for (const target of ["http://site.example.com/", "https://site.example.com:8443/"]) {
      const transport = fakeTransport({ "https://site.example.com/": redirect(target) });
      const out = await fetchHead("https://site.example.com/", { resolve, transport });
      expect(out.ok, target).toBe(false);
    }
  });

  it("DNS rebinding: the address checked is the address connected to, on every hop", async () => {
    // public on the first lookup, loopback on the next — the classic rebind
    let calls = 0;
    const rebinding: Resolver = async () => [{ address: calls++ === 0 ? "93.184.216.34" : "127.0.0.1", family: 4 }];
    const transport = fakeTransport({
      "https://rebind.example.com/": redirect("https://rebind.example.com/again"),
      "https://rebind.example.com/again": ok(),
    });
    const out = await fetchHead("https://rebind.example.com/", { resolve: rebinding, transport });
    expect(out).toMatchObject({ ok: false, kind: "blocked" });
    expect(transport.seen).toEqual(["https://rebind.example.com/"]);
  });

  it("stops after 3 redirects", async () => {
    const transport = fakeTransport({
      "https://site.example.com/1": redirect("/2"),
      "https://site.example.com/2": redirect("/3"),
      "https://site.example.com/3": redirect("/4"),
      "https://site.example.com/4": redirect("/5"),
      "https://site.example.com/5": ok(),
    });
    const out = await fetchHead("https://site.example.com/1", { resolve, transport });
    expect(out).toMatchObject({ ok: false, kind: "unreachable", reason: expect.stringContaining("3 redirects") });
    expect(transport.seen).toHaveLength(4);
  });

  it("times out", async () => {
    const hang: Transport = ({ signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
      );
    const out = await fetchHead("https://site.example.com/", { resolve, transport: hang, timeoutMs: 30 });
    expect(out).toMatchObject({ ok: false, kind: "unreachable", reason: expect.stringContaining("no answer") });
  });

  it("maps network failures to plain reasons", async () => {
    const out = await fetchHead("https://gone.example.com/", { resolve, transport: fakeTransport({}) });
    expect(out).toMatchObject({ ok: false, reason: "Unreachable — the domain doesn't resolve" });
    const tls = fakeTransport({
      "https://site.example.com/": Object.assign(new Error("bad cert"), { code: "CERT_HAS_EXPIRED" }),
    });
    expect(await fetchHead("https://site.example.com/", { resolve, transport: tls })).toMatchObject({
      reason: expect.stringContaining("TLS certificate"),
    });
  });

  it("the real https transport honours the guarded lookup (fails before any socket opens)", async () => {
    for (const address of ["127.0.0.1", "::1", "10.1.2.3"]) {
      const out = await fetchHead("https://rebind.example.com/", {
        resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
        timeoutMs: 2000,
      });
      expect(out, address).toMatchObject({ ok: false, kind: "blocked" });
    }
  });
});

// ---------------------------------------------------------------------------
// framing headers
// ---------------------------------------------------------------------------

const verdict = (headers: HeaderBag, embedder = SITE, framed = "https://client.example.com") =>
  frameVerdict(headers, embedder, framed);

describe("frameVerdict", () => {
  it("no restriction → embeddable", () => {
    expect(verdict({})).toEqual({ embeddable: true, reason: "" });
  });

  it("X-Frame-Options", () => {
    expect(verdict({ "x-frame-options": "DENY" })).toEqual({ embeddable: false, reason: "X-Frame-Options: DENY" });
    expect(verdict({ "x-frame-options": "deny" }).embeddable).toBe(false);
    expect(verdict({ "x-frame-options": "SAMEORIGIN" })).toEqual({
      embeddable: false,
      reason: "X-Frame-Options: SAMEORIGIN",
    });
    expect(verdict({ "x-frame-options": ["DENY", "DENY"] }).embeddable).toBe(false); // de-duplicated
    expect(verdict({ "x-frame-options": "SAMEORIGIN, DENY" }).reason).toMatch(/conflicting/);
    // browsers ignore these
    expect(verdict({ "x-frame-options": "ALLOW-FROM https://mykt.studio" }).embeddable).toBe(true);
    expect(verdict({ "x-frame-options": "ALLOWALL" }).embeddable).toBe(true);
    expect(verdict({ "X-Frame-Options": "DENY" }).embeddable).toBe(false); // any header-name case
  });

  it("CSP frame-ancestors decides, and then X-Frame-Options is ignored", () => {
    const csp = (v: string | string[], extra: HeaderBag = {}) =>
      verdict({ "content-security-policy": v, ...extra }).embeddable;
    expect(csp("frame-ancestors 'none'")).toBe(false);
    expect(csp("frame-ancestors")).toBe(false); // empty list = 'none'
    expect(csp("frame-ancestors 'self'")).toBe(false);
    expect(csp("frame-ancestors *")).toBe(true);
    expect(csp("frame-ancestors *", { "x-frame-options": "DENY" })).toBe(true);
    expect(csp("default-src 'self'", { "x-frame-options": "DENY" })).toBe(false); // no directive → XFO
    expect(csp("frame-ancestors https:")).toBe(true);
    expect(csp("frame-ancestors http:")).toBe(true); // CSP3: http: also matches https
    expect(csp("frame-ancestors https://mykt.studio")).toBe(true);
    expect(csp("frame-ancestors mykt.studio")).toBe(true);
    expect(csp("frame-ancestors https://MYKT.studio:443")).toBe(true);
    expect(csp("frame-ancestors https://mykt.studio:*")).toBe(true);
    expect(csp("frame-ancestors https://mykt.studio:8443")).toBe(false);
    expect(csp("frame-ancestors *.mykt.studio")).toBe(false); // subdomains only, not the apex
    expect(csp("frame-ancestors https://mykt.studio/projects/")).toBe(false); // an origin's path is "/"
    expect(csp("frame-ancestors https://other.example")).toBe(false);
    expect(csp("frame-ancestors 'self' https://other.example https://mykt.studio")).toBe(true);
    // every policy with the directive must allow it
    expect(csp("frame-ancestors *, frame-ancestors 'self'")).toBe(false);
    expect(csp(["frame-ancestors *", "frame-ancestors 'self'"])).toBe(false);
    // within a policy the first occurrence wins
    expect(csp("frame-ancestors 'none'; frame-ancestors *")).toBe(false);
  });

  it("wildcard subdomains match an embedder on a subdomain", () => {
    expect(
      frameVerdict(
        { "content-security-policy": "frame-ancestors https://*.mykt.studio" },
        "https://www.mykt.studio",
        "https://client.example.com"
      ).embeddable
    ).toBe(true);
  });

  it("Report-Only policies don't block", () => {
    expect(verdict({ "content-security-policy-report-only": "frame-ancestors 'none'" }).embeddable).toBe(true);
  });

  it("explains a refusal", () => {
    expect(verdict({ "content-security-policy": "frame-ancestors 'none'" }).reason).toMatch(/'none'/);
    expect(verdict({ "content-security-policy": "frame-ancestors 'self' https://a.example" }).reason).toMatch(
      /allows: 'self' https:\/\/a\.example/
    );
  });

  it("parses the source lists per policy", () => {
    expect(frameAncestorLists(["default-src 'self'; frame-ancestors a b, frame-ancestors c"])).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });
});

// ---------------------------------------------------------------------------
// the probe end to end (injected network)
// ---------------------------------------------------------------------------

describe("probeEmbed", () => {
  const resolve = answers({ "client.example.com": ["93.184.216.34"], "www.client.example.com": ["93.184.216.34"] });
  const now = () => new Date("2026-10-03T06:00:00.000Z");

  it("an unrestricted 200 is embeddable", async () => {
    const transport = fakeTransport({ "https://client.example.com/": ok() });
    expect(await probeEmbed("https://client.example.com/", { resolve, transport, now, embedderOrigin: SITE })).toEqual({
      embeddable: true,
      reason: "",
      checkedAt: "2026-10-03T06:00:00.000Z",
    });
  });

  it("judges the page the redirects END on", async () => {
    const transport = fakeTransport({
      "https://client.example.com/": redirect("https://www.client.example.com/", 301),
      "https://www.client.example.com/": ok({ "x-frame-options": "SAMEORIGIN" }),
    });
    expect(await probeEmbed("https://client.example.com/", { resolve, transport, now, embedderOrigin: SITE })).toMatchObject({
      embeddable: false,
      reason: "X-Frame-Options: SAMEORIGIN",
    });
  });

  it("non-2xx, unresolvable and blocked are all 'not embeddable', with the reason", async () => {
    const notFound = fakeTransport({ "https://client.example.com/": { status: 404, headers: {} } });
    expect(await probeEmbed("https://client.example.com/", { resolve, transport: notFound, now })).toMatchObject({
      embeddable: false,
      reason: "Unreachable — the site answered HTTP 404",
    });
    expect(await probeEmbed("https://nxdomain.example.com/", { resolve, transport: fakeTransport({}), now })).toMatchObject({
      embeddable: false,
      reason: expect.stringContaining("doesn't resolve"),
    });
    expect(await probeEmbed("https://169.254.169.254/", { resolve, transport: fakeTransport({}), now })).toMatchObject({
      embeddable: false,
      reason: expect.stringMatching(/^Blocked/),
    });
  });
});

// ---------------------------------------------------------------------------
// when a save (re)checks
// ---------------------------------------------------------------------------

describe("planEmbedCheck", () => {
  const NOW = Date.parse("2026-10-03T06:00:00Z");
  const row = (over: Record<string, unknown> = {}) => ({
    live_url: "https://a.example.com",
    embeddable: true,
    embed_reason: "",
    embed_checked_at: new Date(NOW - 60_000).toISOString(),
    ...over,
  });

  it("does nothing when live_url wasn't part of the save", () => {
    expect(planEmbedCheck(row(), { name: "x" }, { explicit: true, now: NOW })).toEqual({
      reset: false,
      probe: false,
      url: null,
    });
  });

  it("a changed URL resets the verdict in the same write and probes the new one", () => {
    expect(planEmbedCheck(row(), { live_url: "https://b.example.com" }, { explicit: false, now: NOW })).toEqual({
      reset: true,
      probe: true,
      url: "https://b.example.com",
    });
  });

  it("clearing the URL resets, nothing to probe", () => {
    expect(planEmbedCheck(row(), { live_url: null }, { explicit: true, now: NOW })).toEqual({
      reset: true,
      probe: false,
      url: null,
    });
  });

  it("an unchanged, never-checked URL is probed", () => {
    const r = planEmbedCheck(row({ embeddable: null, embed_checked_at: null }), { live_url: "https://a.example.com" }, {
      explicit: false,
      now: NOW,
    });
    expect(r).toEqual({ reset: false, probe: true, url: "https://a.example.com" });
  });

  it("an unchanged URL checked recently is left alone; a stale one is re-checked on an explicit Save only", () => {
    const same = { live_url: "https://a.example.com" };
    expect(planEmbedCheck(row(), same, { explicit: true, now: NOW }).probe).toBe(false);
    const stale = row({ embed_checked_at: new Date(NOW - EMBED_RECHECK_MS - 1000).toISOString() });
    expect(planEmbedCheck(stale, same, { explicit: true, now: NOW }).probe).toBe(true);
    expect(planEmbedCheck(stale, same, { explicit: false, now: NOW }).probe).toBe(false);
  });

  it("a new project with a URL is probed", () => {
    expect(planEmbedCheck(null, { live_url: "https://a.example.com" }, { explicit: true, now: NOW })).toEqual({
      reset: false,
      probe: true,
      url: "https://a.example.com",
    });
  });

  it("a database without the embed columns saves exactly as before", () => {
    expect(
      planEmbedCheck({ live_url: "https://a.example.com" }, { live_url: "https://b.example.com" }, {
        explicit: true,
        now: NOW,
      })
    ).toEqual({ reset: false, probe: false, url: null });
  });
});
