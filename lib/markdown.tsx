/**
 * A small, server-safe Markdown renderer for blog posts — markdown in, React
 * elements out. No dependency, and NO raw HTML, ever:
 *
 *  - there is no `dangerouslySetInnerHTML` anywhere in this file. Every piece
 *    of text becomes a React text child, which React escapes, so `<script>` in
 *    a post renders as the literal characters `<script>`. HTML in the source is
 *    not a feature that is "filtered" — it simply has no code path;
 *  - links become anchors only for `https:`, `mailto:` and internal `/paths`
 *    (`safeHref`). `javascript:`, `data:`, plain `http:`, `//host` and `/\host`
 *    render as the link's words with no anchor. External links open in a new
 *    tab with `rel="noopener noreferrer"`; internal ones are localized;
 *  - images render only when the src passes the panel's own `imagePath` rule
 *    (app/admin/_lib/validators.ts — the same check every other <img> on the
 *    site goes through). Anything else is dropped.
 *
 * Supported: ATX (`##`) and setext headings — `#` and `##` both render as <h2>
 * because the page's <h1> is the post title — paragraphs, hard breaks (two
 * trailing spaces or a backslash), **bold** or __bold__, *italic* or _italic_
 * (nested and combined), `inline code`, fenced code blocks (``` or ~~~), blockquotes
 * (nestable), ordered/unordered lists (nestable, tight or loose), horizontal
 * rules, [links](https://… "title"), <https://autolinks>, ![images](/x.webp).
 * Not supported (renders as text): tables, reference-style links, footnotes,
 * raw HTML.
 *
 * Written with createElement rather than JSX ON PURPOSE: the test runner
 * transforms files with the project tsconfig's `jsx: "preserve"`, so a module
 * containing JSX can't be imported by tests/markdown.test.ts.
 *
 * Every scan is bounded (link labels, destinations, lookback for emphasis,
 * nesting depth), so even a pathological 60 000-character body renders in
 * linear-ish time — this runs inside a build / ISR render and must never hang.
 */
import { createElement as h, Fragment, type ReactNode } from "react";
import { imagePath } from "@/app/admin/_lib/validators";
import type { Locale } from "@/lib/i18n/config";
import { localizePath } from "@/lib/i18n/paths";

/* ===========================================================================
   AST
   =========================================================================== */

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "br" }
  | { t: "em"; c: Inline[] }
  | { t: "strong"; c: Inline[] }
  | { t: "link"; href: string; title?: string; c: Inline[] }
  | { t: "img"; src: string; alt: string; title?: string };

export type Block =
  | { t: "h"; level: 2 | 3 | 4; c: string }
  | { t: "p"; c: string }
  | { t: "code"; lang?: string; v: string }
  | { t: "quote"; c: Block[] }
  | { t: "list"; ordered: boolean; start?: number; loose: boolean; items: Block[][] }
  | { t: "hr" };

/** transient, only while emphasis is being resolved */
type Delim = { t: "delim"; ch: "*" | "_"; n: number; open: boolean; close: boolean };
type Node = Inline | Delim;

const MAX_BLOCK_DEPTH = 8;
const MAX_INLINE_DEPTH = 4;
const MAX_LABEL = 1000;
const MAX_DEST = 2000;
const MAX_TITLE = 500;
const MAX_LOOKBACK = 256;

/* ===========================================================================
   URL safety
   =========================================================================== */

const INTERNAL_PATH = /^\/(?![/\\])\S*$/;

/**
 * The href a link may have, or null. Allow-list, not deny-list: https URLs
 * that parse, `mailto:` addresses, and paths on this site (never `//host` or
 * `/\host`, which browsers read as another host).
 */
export function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v || /[\u0000-\u001f\u007f]/.test(v)) return null;
  if (INTERNAL_PATH.test(v)) return v;
  if (/^mailto:[^\s]+$/i.test(v)) return v;
  if (/^https:\/\/\S+$/i.test(v)) {
    try {
      return new URL(v).hostname ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** An <img src> we're willing to render — the panel's rule, '' excluded. */
export function safeImageSrc(raw: string): string | null {
  const v = raw.trim();
  return v && imagePath.safeParse(v).success ? v : null;
}

/* ===========================================================================
   Block parsing
   =========================================================================== */

const isBlank = (l: string) => /^[ \t]*$/.test(l);
const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>/;
const LIST_ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;

/** Does `line` open a block that interrupts a paragraph? */
function interruptsParagraph(line: string): boolean {
  if (FENCE.test(line) || ATX.test(line) || HR.test(line) || QUOTE.test(line)) return true;
  const m = LIST_ITEM.exec(line);
  // CommonMark: an empty item, or an ordered list not starting at 1, can't
  // interrupt a paragraph ("In 2024. we…" mid-paragraph stays text)
  if (!m || !m[4]?.trim()) return false;
  return /^[-*+]$/.test(m[2]) || /^1[.)]$/.test(m[2]);
}

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  return blocks(lines, 0);
}

function blocks(lines: string[], depth: number): Block[] {
  // past the nesting cap, everything is a paragraph — no further recursion
  if (depth > MAX_BLOCK_DEPTH) {
    const text = lines.filter((l) => !isBlank(l)).join("\n").trim();
    return text ? [{ t: "p", c: text }] : [];
  }

  const out: Block[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    // fenced code — an unterminated fence runs to the end (as CommonMark)
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const close = new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}[ \\t]*$`);
      const indent = line.length - line.trimStart().length;
      const body: string[] = [];
      i++;
      while (i < n && !close.test(lines[i])) {
        // strip up to the fence's own indentation, like CommonMark
        const l = lines[i];
        const lead = l.length - l.trimStart().length;
        body.push(l.slice(Math.min(lead, indent)));
        i++;
      }
      i++; // the closing fence (or past the end)
      out.push({ t: "code", lang: fence[2] || undefined, v: body.join("\n") });
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      const level = atx[1].length;
      out.push({ t: "h", level: level <= 2 ? 2 : level === 3 ? 3 : 4, c: (atx[2] ?? "").trim() });
      i++;
      continue;
    }

    if (HR.test(line)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < n) {
        const l = lines[i];
        if (QUOTE.test(l)) inner.push(l.replace(/^ {0,3}> ?/, ""));
        // lazy continuation: a plain line right after quoted text stays in it
        else if (!isBlank(l) && inner.length && !isBlank(inner[inner.length - 1]) && !interruptsParagraph(l))
          inner.push(l);
        else break;
        i++;
      }
      out.push({ t: "quote", c: blocks(inner, depth + 1) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const parsed = list(lines, i, depth);
      if (parsed) {
        out.push(parsed.block);
        i = parsed.next;
        continue;
      }
    }

    // paragraph (possibly a setext heading)
    const para: string[] = [line.trimStart()];
    i++;
    let setext: Block | null = null;
    while (i < n && !isBlank(lines[i])) {
      const l = lines[i];
      if (SETEXT.test(l)) {
        setext = { t: "h", level: 2, c: para.join("\n").trim() };
        i++;
        break;
      }
      if (interruptsParagraph(l)) break;
      para.push(l.trimStart());
      i++;
    }
    out.push(setext ?? { t: "p", c: para.join("\n").replace(/[ \t]+$/, "") });
  }
  return out;
}

function list(
  lines: string[],
  start: number,
  depth: number
): { block: Block; next: number } | null {
  const first = LIST_ITEM.exec(lines[start]);
  if (!first) return null;
  const ordered = /\d/.test(first[2]);
  // a list continues only with the same kind of marker: "-" vs "*", "." vs ")"
  const kind = ordered ? first[2].slice(-1) : first[2];
  const sameKind = (m: RegExpExecArray) =>
    ordered ? /\d/.test(m[2]) && m[2].slice(-1) === kind : m[2] === kind;

  const items: Block[][] = [];
  let loose = false;
  let i = start;
  const n = lines.length;

  while (i < n) {
    const m = LIST_ITEM.exec(lines[i]);
    if (!m || !sameKind(m)) break;
    const gap = m[3]?.length ?? 1;
    // content indentation: marker width + its spaces (≥5 spaces = 1, as CommonMark)
    const contentIndent = m[1].length + m[2].length + (gap > 4 ? 1 : gap);
    const itemLines: string[] = [m[4] ?? ""];
    i++;

    while (i < n) {
      const l = lines[i];
      if (isBlank(l)) {
        // a blank line continues the item only if indented content follows
        let k = i;
        while (k < n && isBlank(lines[k])) k++;
        if (k < n && lead(lines[k]) >= contentIndent) {
          for (let b = i; b < k; b++) itemLines.push("");
          i = k;
          loose = true;
          continue;
        }
        break;
      }
      const ld = lead(l);
      if (ld >= contentIndent) {
        itemLines.push(l.slice(contentIndent));
      } else if (LIST_ITEM.test(l) || interruptsParagraph(l)) {
        break;
      } else if (!isBlank(itemLines[itemLines.length - 1] ?? "")) {
        itemLines.push(l.trimStart()); // lazy paragraph continuation
      } else {
        break;
      }
      i++;
    }

    items.push(blocks(itemLines, depth + 1));

    // blank lines between two items of the same list make it loose
    let k = i;
    while (k < n && isBlank(lines[k])) k++;
    const nextItem = k < n ? LIST_ITEM.exec(lines[k]) : null;
    if (nextItem && sameKind(nextItem) && lead(lines[k]) < contentIndent) {
      if (k > i) loose = true;
      i = k;
      continue;
    }
    break;
  }

  const startNo = ordered ? Number.parseInt(first[2], 10) : undefined;
  return {
    block: {
      t: "list",
      ordered,
      start: ordered && startNo !== 1 ? startNo : undefined,
      loose,
      items,
    },
    next: i,
  };
}

const lead = (l: string) => l.length - l.trimStart().length;

/* ===========================================================================
   Inline parsing
   =========================================================================== */

const ASCII_PUNCT = /[!-/:-@[-`{-~]/;
const PUNCT = /[!-/:-@[-`{-~\p{P}\p{S}]/u;
const isWs = (c: string | undefined) => c === undefined || /\s/.test(c);
const isPunct = (c: string | undefined) => c !== undefined && PUNCT.test(c);

/** Undo backslash escapes in a link destination / title. */
const unescape = (s: string) => s.replace(/\\([!-/:-@[-`{-~])/g, "$1");

type Ctx = { depth: number; inLink: boolean };

export function parseInline(src: string, ctx: Ctx = { depth: 0, inLink: false }): Inline[] {
  if (ctx.depth > MAX_INLINE_DEPTH) return src ? [{ t: "text", v: src }] : [];

  const nodes: Node[] = [];
  let buf = "";
  const flush = () => {
    if (buf) nodes.push({ t: "text", v: buf });
    buf = "";
  };
  // backtick run length → position from which no closer of that length exists
  const noCloser = new Map<number, number>();

  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];

    if (c === "\\") {
      const next = src[i + 1];
      if (next === "\n") {
        flush();
        nodes.push({ t: "br" });
        i += 2;
        while (src[i] === " ") i++;
        continue;
      }
      if (next !== undefined && ASCII_PUNCT.test(next)) {
        buf += next;
        i += 2;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (c === "`") {
      let run = 1;
      while (src[i + run] === "`") run++;
      const close = findBacktickCloser(src, i + run, run, noCloser);
      if (close >= 0) {
        flush();
        let v = src.slice(i + run, close).replace(/\n/g, " ");
        if (v.length > 2 && v.startsWith(" ") && v.endsWith(" ") && v.trim()) v = v.slice(1, -1);
        nodes.push({ t: "code", v });
        i = close + run;
        continue;
      }
      buf += src.slice(i, i + run);
      i += run;
      continue;
    }

    if (c === "!" && src[i + 1] === "[") {
      const r = parseLinkAt(src, i + 1);
      if (r) {
        flush();
        const s = safeImageSrc(r.dest);
        // an unsafe image is dropped entirely — not even its alt text
        if (s) {
          nodes.push({
            t: "img",
            src: s,
            alt: plainText(parseInline(r.label, { depth: ctx.depth + 1, inLink: true })),
            title: r.title,
          });
        }
        i = r.end;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (c === "[") {
      const r = ctx.inLink ? null : parseLinkAt(src, i);
      if (r) {
        flush();
        const children = parseInline(r.label, { depth: ctx.depth + 1, inLink: true });
        const href = safeHref(r.dest);
        // unsafe → the link's words as plain content, no anchor
        if (href) nodes.push({ t: "link", href, title: r.title, c: children });
        else nodes.push(...children);
        i = r.end;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (c === "<" && !ctx.inLink) {
      const m = /^<((?:https:\/\/|mailto:)[^\s<>]{1,2000})>/i.exec(src.slice(i, i + MAX_DEST + 12));
      const href = m ? safeHref(m[1]) : null;
      if (m && href) {
        flush();
        nodes.push({ t: "link", href, c: [{ t: "text", v: m[1].replace(/^mailto:/i, "") }] });
        i += m[0].length;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (c === "*" || c === "_") {
      let run = 1;
      while (src[i + run] === c) run++;
      const before = i > 0 ? src[i - 1] : undefined;
      const after = src[i + run];
      const leftFlanking = !isWs(after) && (!isPunct(after) || isWs(before) || isPunct(before));
      const rightFlanking = !isWs(before) && (!isPunct(before) || isWs(after) || isPunct(after));
      // underscores never open/close inside a word (snake_case stays text)
      const open = c === "*" ? leftFlanking : leftFlanking && (!rightFlanking || isPunct(before));
      const close = c === "*" ? rightFlanking : rightFlanking && (!leftFlanking || isPunct(after));
      flush();
      nodes.push({ t: "delim", ch: c, n: run, open, close });
      i += run;
      continue;
    }

    if (c === "\n") {
      if (/ {2,}$/.test(buf)) {
        buf = buf.replace(/ +$/, "");
        flush();
        nodes.push({ t: "br" });
      } else {
        buf = buf.replace(/ +$/, "") + " ";
      }
      i++;
      while (src[i] === " ") i++;
      continue;
    }

    buf += c;
    i++;
  }
  flush();
  return mergeText(resolveEmphasis(nodes));
}

function findBacktickCloser(src: string, from: number, run: number, memo: Map<number, number>) {
  const failedFrom = memo.get(run);
  if (failedFrom !== undefined && from >= failedFrom) return -1;
  let j = src.indexOf("`", from);
  while (j >= 0) {
    let r = 1;
    while (src[j + r] === "`") r++;
    if (r === run) return j;
    j = src.indexOf("`", j + r);
  }
  memo.set(run, Math.min(from, failedFrom ?? from));
  return -1;
}

/** `[label](dest "title")` starting at src[i] === "[". Bounded scans throughout. */
function parseLinkAt(
  src: string,
  i: number
): { label: string; dest: string; title?: string; end: number } | null {
  const n = src.length;
  let depth = 0;
  let j = i;
  const limit = Math.min(n, i + MAX_LABEL);
  for (; j < limit; j++) {
    const ch = src[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) break;
  }
  if (j >= limit || src[j] !== "]" || src[j + 1] !== "(") return null;
  const label = src.slice(i + 1, j);

  let k = j + 2;
  while (k < n && /[ \t\n]/.test(src[k])) k++;

  let dest: string;
  if (src[k] === "<") {
    const end = src.indexOf(">", k);
    if (end < 0 || end - k > MAX_DEST) return null;
    dest = src.slice(k + 1, end);
    if (dest.includes("\n")) return null;
    k = end + 1;
  } else {
    const start = k;
    const lim = Math.min(n, k + MAX_DEST);
    let parens = 0;
    while (k < lim) {
      const ch = src[k];
      if (ch === "\\" && k + 1 < n) {
        k += 2;
        continue;
      }
      if (/\s/.test(ch)) break;
      if (ch === "(") parens++;
      else if (ch === ")") {
        if (parens === 0) break;
        parens--;
      }
      k++;
    }
    if (k >= lim && lim < n) return null;
    dest = src.slice(start, k);
  }

  let title: string | undefined;
  const wsStart = k;
  while (k < n && /[ \t\n]/.test(src[k])) k++;
  if (k > wsStart && (src[k] === '"' || src[k] === "'" || src[k] === "(")) {
    const closeCh = src[k] === "(" ? ")" : src[k];
    let e = k + 1;
    const lim = Math.min(n, e + MAX_TITLE);
    for (; e < lim; e++) {
      if (src[e] === "\\") {
        e++;
        continue;
      }
      if (src[e] === closeCh) break;
    }
    if (e >= lim || src[e] !== closeCh) return null;
    title = unescape(src.slice(k + 1, e));
    k = e + 1;
    while (k < n && /[ \t\n]/.test(src[k])) k++;
  }
  if (src[k] !== ")") return null;
  return { label, dest: unescape(dest), title, end: k + 1 };
}

/**
 * CommonMark's delimiter matching, simplified: each closer pairs with the
 * nearest compatible opener before it (bounded lookback), `**` beats `*` when
 * both sides have two, and whatever never pairs is literal text. Nested and
 * combined emphasis (`***x***`, `**a *b* c**`) fall out of the repetition.
 */
function resolveEmphasis(nodes: Node[]): Inline[] {
  let i = 0;
  while (i < nodes.length) {
    const closer = nodes[i];
    if (closer.t !== "delim" || !closer.close || closer.n === 0) {
      i++;
      continue;
    }
    let found = -1;
    for (let j = i - 1; j >= 0 && i - j <= MAX_LOOKBACK; j--) {
      const o = nodes[j];
      if (o.t === "delim" && o.ch === closer.ch && o.open && o.n > 0) {
        found = j;
        break;
      }
    }
    if (found < 0) {
      i++;
      continue;
    }
    const opener = nodes[found] as Delim;
    const use = opener.n >= 2 && closer.n >= 2 ? 2 : 1;
    const inner = nodes.slice(found + 1, i).map(delimToText);
    opener.n -= use;
    closer.n -= use;
    const el: Inline = use === 2 ? { t: "strong", c: mergeText(inner) } : { t: "em", c: mergeText(inner) };
    nodes.splice(found + 1, i - found - 1, el);
    i = found + 2; // the closer's new index
    if (opener.n === 0) {
      nodes.splice(found, 1);
      i--;
    }
    if (closer.n === 0) nodes.splice(i, 1);
    // otherwise the same closer tries again with what it has left
  }
  return nodes.map(delimToText);
}

function delimToText(n: Node): Inline {
  return n.t === "delim" ? { t: "text", v: n.ch.repeat(n.n) } : n;
}

function mergeText(nodes: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    if (n.t === "text" && !n.v) continue;
    const last = out[out.length - 1];
    if (n.t === "text" && last?.t === "text") last.v += n.v;
    else out.push(n.t === "text" ? { ...n } : n);
  }
  return out;
}

/** The visible words of some inline nodes (image alt text, reading time). */
export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) =>
      n.t === "text" || n.t === "code"
        ? n.v
        : n.t === "br"
          ? " "
          : n.t === "img"
            ? n.alt
            : plainText(n.c)
    )
    .join("");
}

/* ===========================================================================
   Rendering
   =========================================================================== */

export type MarkdownOptions = {
  /** internal /paths are localized for this language (e.g. /fil/projects) */
  lang?: Locale;
};

function renderInline(nodes: Inline[], opts: MarkdownOptions, key: string): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    switch (n.t) {
      case "text":
        return n.v;
      case "code":
        return h("code", { key: k }, n.v);
      case "br":
        return h("br", { key: k });
      case "em":
        return h("em", { key: k }, ...renderInline(n.c, opts, k));
      case "strong":
        return h("strong", { key: k }, ...renderInline(n.c, opts, k));
      case "img":
        return h("img", {
          key: k,
          src: n.src,
          alt: n.alt,
          title: n.title,
          loading: "lazy",
          decoding: "async",
        });
      case "link": {
        const internal = n.href.startsWith("/");
        const external = /^https:/i.test(n.href);
        return h(
          "a",
          {
            key: k,
            href: internal && opts.lang ? localizePath(opts.lang, n.href) : n.href,
            title: n.title,
            ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          },
          ...renderInline(n.c, opts, k)
        );
      }
    }
  });
}

function renderBlocks(list: Block[], opts: MarkdownOptions, key: string, tight = false): ReactNode[] {
  const out: ReactNode[] = [];
  list.forEach((b, i) => {
    const k = `${key}-${i}`;
    switch (b.t) {
      case "h": {
        const kids = renderInline(parseInline(b.c), opts, k);
        if (kids.length) out.push(h(`h${b.level}`, { key: k }, ...kids));
        return;
      }
      case "p": {
        const inl = parseInline(b.c);
        if (!inl.length) return;
        // a paragraph that is only an image becomes a figure (title = caption)
        const meaningful = inl.filter((x) => !(x.t === "text" && !x.v.trim()));
        if (meaningful.length === 1 && meaningful[0].t === "img") {
          const img = meaningful[0];
          out.push(
            h(
              "figure",
              { key: k },
              ...renderInline([img], opts, k),
              img.title ? h("figcaption", { key: `${k}.cap` }, img.title) : null
            )
          );
          return;
        }
        const kids = renderInline(inl, opts, k);
        out.push(tight ? h(Fragment, { key: k }, ...kids) : h("p", { key: k }, ...kids));
        return;
      }
      case "code":
        out.push(
          h(
            "pre",
            { key: k, tabIndex: 0, "data-lang": b.lang || undefined },
            h("code", null, b.v)
          )
        );
        return;
      case "quote":
        out.push(h("blockquote", { key: k }, ...renderBlocks(b.c, opts, k)));
        return;
      case "hr":
        out.push(h("hr", { key: k }));
        return;
      case "list": {
        const items = b.items.map((item, j) => {
          // tight list: a lone paragraph renders straight into the <li>
          const unwrap = !b.loose && item.length >= 1 && item[0].t === "p";
          const kids = unwrap
            ? [
                ...renderBlocks([item[0]], opts, `${k}.${j}`, true),
                ...renderBlocks(item.slice(1), opts, `${k}.${j}r`),
              ]
            : renderBlocks(item, opts, `${k}.${j}`);
          return h("li", { key: `${k}.${j}` }, ...kids);
        });
        out.push(
          b.ordered
            ? h("ol", { key: k, start: b.start }, ...items)
            : h("ul", { key: k }, ...items)
        );
        return;
      }
    }
  });
  return out;
}

/** Markdown → React elements (no wrapper). */
export function renderMarkdown(src: string, opts: MarkdownOptions = {}): ReactNode[] {
  return renderBlocks(parseBlocks(src ?? ""), opts, "md");
}

/**
 * The article body, wrapped in the `.prose-rt` typography scope
 * (app/globals.css). Server component — no client JS.
 */
export function Markdown({
  source,
  lang,
  className = "",
}: {
  source: string;
  lang?: Locale;
  className?: string;
}) {
  return h("div", { className: `prose-rt ${className}`.trim() }, ...renderMarkdown(source, { lang }));
}

/**
 * Minutes to read a markdown body at ~220 words a minute (never less than
 * one). Counts words of text, not markup — code counts, URLs don't.
 */
export function readingMinutes(src: string): number {
  const text = (src ?? "")
    .replace(/\]\([^)]*\)/g, "]") // link/image destinations
    .replace(/[#>*_`~\-[\]()!|]/g, " ");
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / 220));
}
