/**
 * Site search — the pure half: the entry shape, scoring, grouping and match
 * highlighting. No React, no DOM, no server APIs, so the server index builder
 * (lib/search.ts), the client palette (components/search/SearchPalette.tsx) and
 * tests/search-score.test.ts all share exactly one implementation.
 *
 * NEUTRAL MODULE (no "use client"): the server builds `SearchEntry[]` and the
 * client scores it; a shared value must never live in a client module (see the
 * RSC-boundary note in CLAUDE.md, lib/theme.ts).
 *
 * Ranking (ported from the reference project's palette, slightly refined):
 *   - the query is split into tokens; EVERY token must match somewhere (AND);
 *   - per token: title starts with it (5) > a word in the title starts with it
 *     (4) > title contains it (3) > keywords (2) > snippet (1);
 *   - ties keep index order, which the builder makes meaningful (pages first,
 *     then content in the order the site itself lists it);
 *   - top 12.
 * Matching is case- AND accent-insensitive ("nino" finds "Niño") — Filipino
 * names carry ñ and the occasional accent, and nobody types them in a search box.
 */

export type SearchType = "page" | "project" | "service" | "product" | "job" | "post" | "team";

export type SearchEntry = {
  /** unique across the index — also the option's DOM id suffix */
  id: string;
  type: SearchType;
  title: string;
  /** one short line under the title (already truncated by the builder) */
  snippet: string;
  /** space-separated extra terms: tags, stack, synonyms — searched, never shown */
  keywords: string;
  /** a localized internal path, ready for router.push */
  href: string;
};

export const MAX_RESULTS = 12;

/** Group display order when there is no query (and the tie-break between groups). */
export const TYPE_ORDER: readonly SearchType[] = [
  "page",
  "project",
  "service",
  "product",
  "job",
  "post",
  "team",
];

/* ---------------------------------------------------------------------------
   Folding: lowercase + strip combining marks, keeping a map back to the
   original string so highlights land on the right characters even when folding
   changes the length (a decomposed "n" + "◌̃", or "İ" lowercasing to two code
   units).
--------------------------------------------------------------------------- */

const MARKS = /\p{M}/gu;

function foldChar(ch: string): string {
  return ch.normalize("NFD").replace(MARKS, "").toLowerCase();
}

/** Case- and accent-insensitive form of `s`, for comparisons. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(MARKS, "").toLowerCase();
}

/** `folded[i]` came from `text[map[i]]`. */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = foldChar(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  return { folded, map };
}

/** Query → folded, de-duplicated tokens. Whitespace-separated; empty → []. */
export function tokenize(query: string): string[] {
  const out: string[] = [];
  for (const raw of fold(query).split(/\s+/)) {
    const tok = raw.trim();
    if (tok && !out.includes(tok)) out.push(tok);
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Scoring
--------------------------------------------------------------------------- */

const WORD_START = /[\s\-–—_/·.,:;()'"“”‘’&+]/;

function startsAWord(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    if (at === 0 || WORD_START.test(haystack[at - 1])) return true;
    from = at + 1;
  }
}

/**
 * The entry's score for these (already tokenized) tokens, or `null` when any
 * token matches nowhere.
 */
export function scoreEntry(entry: SearchEntry, tokens: readonly string[]): number | null {
  if (!tokens.length) return null;
  const title = fold(entry.title);
  const keywords = fold(entry.keywords);
  const snippet = fold(entry.snippet);
  let score = 0;
  for (const tok of tokens) {
    if (title.startsWith(tok)) score += 5;
    else if (startsAWord(title, tok)) score += 4;
    else if (title.includes(tok)) score += 3;
    else if (keywords.includes(tok)) score += 2;
    else if (snippet.includes(tok)) score += 1;
    else return null;
  }
  return score;
}

/**
 * Rank the index against a query: best first, ties in index order, at most
 * `limit`. An empty query returns [] — see `defaultResults` for the idle list.
 */
export function search(
  index: readonly SearchEntry[],
  query: string,
  limit: number = MAX_RESULTS
): SearchEntry[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const scored: { entry: SearchEntry; score: number; at: number }[] = [];
  index.forEach((entry, at) => {
    const score = scoreEntry(entry, tokens);
    if (score !== null) scored.push({ entry, score, at });
  });
  scored.sort((a, b) => b.score - a.score || a.at - b.at);
  return scored.slice(0, limit).map((s) => s.entry);
}

/** What the palette lists before anything is typed: the pages, as quick links. */
export function defaultResults(index: readonly SearchEntry[]): SearchEntry[] {
  return index.filter((e) => e.type === "page").slice(0, MAX_RESULTS);
}

/* ---------------------------------------------------------------------------
   Grouping
--------------------------------------------------------------------------- */

export type SearchGroup = { type: SearchType; items: SearchEntry[] };

/**
 * Bucket ranked results by type. Groups appear in the order of their BEST hit
 * (so the top result is always in the first group), items keep their rank
 * inside a group. Flatten the groups for keyboard order — that's what the
 * visitor sees top to bottom.
 */
export function groupResults(results: readonly SearchEntry[]): SearchGroup[] {
  const groups: SearchGroup[] = [];
  const byType = new Map<SearchType, SearchGroup>();
  for (const entry of results) {
    let g = byType.get(entry.type);
    if (!g) {
      g = { type: entry.type, items: [] };
      byType.set(entry.type, g);
      groups.push(g);
    }
    g.items.push(entry);
  }
  return groups;
}

/* ---------------------------------------------------------------------------
   Highlighting — returns plain parts; the palette wraps `match` parts in <mark>.
--------------------------------------------------------------------------- */

export type HighlightPart = { text: string; match: boolean };

/**
 * Split `text` into matched / unmatched runs for these tokens (case- and
 * accent-insensitive; overlapping matches merge). Concatenating the parts'
 * text always gives back `text` exactly.
 */
export function highlightParts(text: string, tokens: readonly string[]): HighlightPart[] {
  if (!text) return [];
  const live = tokens.filter(Boolean);
  if (!live.length) return [{ text, match: false }];

  const { folded, map } = foldWithMap(text);
  const ranges: [number, number][] = []; // [start, end) in ORIGINAL indices
  for (const tok of live) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(tok, from);
      if (at === -1) break;
      const lastFolded = at + tok.length - 1;
      const start = map[at];
      // end = just past the original character the last folded unit came from
      const lastOrig = map[lastFolded];
      const end = lastOrig + charLengthAt(text, lastOrig);
      ranges.push([start, Math.max(end, start + 1)]);
      from = at + 1;
    }
  }
  if (!ranges.length) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  // a combining mark right after a match belongs to the matched letter
  for (const r of merged) {
    while (r[1] < text.length && /\p{M}/u.test(text[r[1]])) r[1]++;
  }

  const parts: HighlightPart[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    // (a range can't start inside a mark run — marks fold to nothing, so no
    // match ever begins on one — but stay safe if that ever changes)
    if (e <= pos) continue;
    const start = Math.max(s, pos);
    if (start > pos) parts.push({ text: text.slice(pos, start), match: false });
    parts.push({ text: text.slice(start, e), match: true });
    pos = e;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), match: false });
  return parts;
}

/** UTF-16 length of the code point starting at `i` (2 for astral characters). */
function charLengthAt(text: string, i: number): number {
  const code = text.codePointAt(i);
  return code !== undefined && code > 0xffff ? 2 : 1;
}

/* ---------------------------------------------------------------------------
   Builder helpers (used server-side; pure, so they're tested here too)
--------------------------------------------------------------------------- */

/** Collapse whitespace and cut at a word boundary with an ellipsis. */
export function clip(text: string | undefined | null, max: number): string {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1); // leave room for the ellipsis
  const space = cut.lastIndexOf(" ");
  // keep the last word only if it ended exactly at the cut
  const body = s[max - 1] === " " ? cut : space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${body.replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** Join keyword sources into one de-duplicated, length-capped string. */
export function joinKeywords(parts: readonly (string | undefined | null | false)[], max = 220): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    for (const w of p.replace(/\s+/g, " ").trim().split(" ")) {
      const k = fold(w);
      if (!w || seen.has(k)) continue;
      seen.add(k);
      out.push(w);
    }
  }
  const s = out.join(" ");
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max);
  return s.slice(0, cut > 0 ? cut : max);
}
