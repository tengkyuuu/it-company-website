/**
 * IP address classification for the SSRF guard (lib/net/safe-fetch.ts).
 *
 * Pure — no Node APIs — so tests/safe-fetch.test.ts can pin every range. The
 * question is narrow: "may the server open a connection to this address on an
 * editor's behalf?" Anything that isn't plainly a public unicast address is
 * refused, including addresses that are technically routable but have no
 * business hosting a portfolio site (documentation, benchmarking, 6to4…).
 *
 * Input forms: a dotted-quad IPv4, or IPv6 with or without [brackets]. Other
 * IPv4 spellings (decimal "2130706433", octal "0177.0.0.1", hex "0x7f.1") never
 * reach this module as such — the WHATWG URL parser normalises them to dotted
 * quads, and DNS answers are always canonical — so anything that doesn't parse
 * strictly is refused, never guessed at.
 */

export type IpVerdict = { ok: true; family: 4 | 6 } | { ok: false; reason: string };

type V4 = [number, number, number, number];

/** Strict dotted-quad: four 0–255 decimal parts, no leading zeros. */
export function parseIPv4(s: string): V4 | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map((p) => (p.length > 1 && p.startsWith("0") ? NaN : Number(p)));
  if (parts.some((n) => !(n >= 0 && n <= 255))) return null;
  return parts as V4;
}

/** 16 bytes, or null. Accepts `::` compression and a trailing dotted IPv4; refuses zone ids. */
export function parseIPv6(input: string): number[] | null {
  let s = input;
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  if (!s || s.includes("%") || !/^[0-9a-fA-F:.]+$/.test(s)) return null;

  // a trailing dotted IPv4 becomes the last two groups
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  if (s.includes(".")) {
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    s = s.slice(0, lastColon + 1);
    // "::1.2.3.4" leaves "::", "::ffff:1.2.3.4" leaves "::ffff:"
    if (s.endsWith(":") && !s.endsWith("::")) s = s.slice(0, -1);
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groups = (h: string) => (h === "" ? [] : h.split(":"));
  const head = groups(halves[0]);
  const rest = halves.length === 2 ? groups(halves[1]) : [];
  const valid = (g: string) => /^[0-9a-fA-F]{1,4}$/.test(g);
  if (![...head, ...rest].every(valid)) return null;

  const explicit = head.length + rest.length + tail.length;
  let words: number[];
  if (halves.length === 2) {
    if (explicit > 7) return null; // "::" must stand for at least one group
    words = [
      ...head.map((g) => parseInt(g, 16)),
      ...new Array(8 - explicit).fill(0),
      ...rest.map((g) => parseInt(g, 16)),
      ...tail,
    ];
  } else {
    if (explicit !== 8) return null;
    words = [...head.map((g) => parseInt(g, 16)), ...tail];
  }
  return words.flatMap((w) => [w >> 8, w & 0xff]);
}

/** Does `bytes` start with the first `bits` bits of `prefix`? */
function inPrefix(bytes: readonly number[], prefix: readonly number[], bits: number): boolean {
  for (let i = 0; i < bits; i++) {
    const byte = i >> 3;
    const mask = 0x80 >> (i & 7);
    if ((bytes[byte] & mask) !== ((prefix[byte] ?? 0) & mask)) return false;
  }
  return true;
}

const V4_BLOCKED: [V4, number, string][] = [
  [[0, 0, 0, 0], 8, "“this network” (0.0.0.0/8)"],
  [[10, 0, 0, 0], 8, "a private network (10.0.0.0/8)"],
  [[100, 64, 0, 0], 10, "carrier-grade NAT space (100.64.0.0/10)"],
  [[127, 0, 0, 0], 8, "loopback (127.0.0.0/8)"],
  [[169, 254, 0, 0], 16, "link-local / cloud metadata (169.254.0.0/16)"],
  [[172, 16, 0, 0], 12, "a private network (172.16.0.0/12)"],
  [[192, 0, 0, 0], 24, "IETF protocol assignments (192.0.0.0/24)"],
  [[192, 0, 2, 0], 24, "documentation space (192.0.2.0/24)"],
  [[192, 88, 99, 0], 24, "the deprecated 6to4 relay (192.88.99.0/24)"],
  [[192, 168, 0, 0], 16, "a private network (192.168.0.0/16)"],
  [[198, 18, 0, 0], 15, "benchmarking space (198.18.0.0/15)"],
  [[198, 51, 100, 0], 24, "documentation space (198.51.100.0/24)"],
  [[203, 0, 113, 0], 24, "documentation space (203.0.113.0/24)"],
  [[224, 0, 0, 0], 4, "multicast (224.0.0.0/4)"],
  [[240, 0, 0, 0], 4, "reserved space (240.0.0.0/4)"],
];

function classifyV4(b: V4, prefix = ""): IpVerdict {
  for (const [net, bits, what] of V4_BLOCKED) {
    if (inPrefix(b, net, bits)) return { ok: false, reason: `${prefix}${b.join(".")} is ${what}` };
  }
  return { ok: true, family: 4 };
}

const hex = (...words: number[]) => words.flatMap((w) => [w >> 8, w & 0xff]);

const V6_BLOCKED: [number[], number, string][] = [
  [hex(0x0064, 0xff9b, 0x0001), 48, "local-use NAT64 (64:ff9b:1::/48)"],
  [hex(0x0100), 64, "the discard prefix (100::/64)"],
  [hex(0x2001, 0x0db8), 32, "documentation space (2001:db8::/32)"],
  // Teredo, ORCHID, benchmarking, AMT… — nothing a website lives on
  [hex(0x2001), 23, "IETF special-purpose space (2001::/23)"],
  [hex(0x2002), 16, "the deprecated 6to4 prefix (2002::/16)"],
  [hex(0x3fff), 20, "documentation space (3fff::/20)"],
  [hex(0x5f00), 16, "SRv6 SID space (5f00::/16)"],
  [hex(0xfc00), 7, "a unique-local network (fc00::/7)"],
  [hex(0xfe80), 10, "link-local (fe80::/10)"],
  [hex(0xfec0), 10, "deprecated site-local space (fec0::/10)"],
  [hex(0xff00), 8, "multicast (ff00::/8)"],
];

function classifyV6(b: number[], shown: string): IpVerdict {
  const zeros = (n: number) => b.slice(0, n).every((x) => x === 0);
  if (zeros(16)) return { ok: false, reason: `${shown} is the unspecified address` };
  if (zeros(15) && b[15] === 1) return { ok: false, reason: `${shown} is loopback (::1)` };

  const v4 = b.slice(12, 16) as V4;
  // ::ffff:a.b.c.d — the IPv4 address it maps to is what gets connected to
  if (zeros(10) && b[10] === 0xff && b[11] === 0xff) return classifyV4(v4, "IPv4-mapped ");
  // ::a.b.c.d (deprecated IPv4-compatible form)
  if (zeros(12)) return { ok: false, reason: `${shown} is a deprecated IPv4-compatible address (::/96)` };
  // 64:ff9b::a.b.c.d — NAT64 translates it to that IPv4 address
  if (inPrefix(b, hex(0x0064, 0xff9b), 96)) return classifyV4(v4, "NAT64 ");

  for (const [net, bits, what] of V6_BLOCKED) {
    if (inPrefix(b, net, bits)) return { ok: false, reason: `${shown} is ${what}` };
  }
  // global unicast is 2000::/3; everything else is unallocated or special
  if (!inPrefix(b, hex(0x2000), 3)) {
    return { ok: false, reason: `${shown} is outside global unicast space (2000::/3)` };
  }
  return { ok: true, family: 6 };
}

/** Is `s` an IP literal (v4 dotted quad, or v6 with or without brackets)? */
export function isIpLiteral(s: string): boolean {
  return parseIPv4(s) !== null || parseIPv6(s) !== null;
}

/**
 * May the server connect to this address? Refuses anything that doesn't parse
 * strictly (fail closed).
 */
export function classifyIp(ip: string): IpVerdict {
  const v4 = parseIPv4(ip);
  if (v4) return classifyV4(v4);
  const v6 = parseIPv6(ip);
  if (v6) return classifyV6(v6, ip.replace(/^\[|\]$/g, ""));
  return { ok: false, reason: `“${ip}” isn't an IP address` };
}

export const isPublicIp = (ip: string) => classifyIp(ip).ok;
