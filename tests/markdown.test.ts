import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Markdown,
  parseBlocks,
  readingMinutes,
  renderMarkdown,
  safeHref,
  safeImageSrc,
} from "@/lib/markdown";

/**
 * lib/markdown.tsx renders editor-written blog posts. What must never happen:
 *  - raw HTML reaching the page (there is no dangerouslySetInnerHTML; HTML in
 *    the source must come out as literal text);
 *  - a `javascript:` / `data:` / protocol-relative URL becoming an href or src;
 *  - a malformed body crashing (or hanging) the render.
 * Rendered with react-dom/server, so these are the exact bytes a visitor gets.
 */

const html = (src: string, lang?: "en" | "fil") =>
  renderToStaticMarkup(createElement(Fragment, null, ...renderMarkdown(src, { lang })));

describe("no raw HTML, ever", () => {
  it("renders HTML tags as literal text", () => {
    const out = html('Hello <script>alert("x")</script> and <img src=x onerror=alert(1)>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("block-level HTML is a paragraph of text, not markup", () => {
    const out = html('<div onclick="steal()">\n  <iframe src="https://evil.example"></iframe>\n</div>');
    expect(out).not.toMatch(/<div|<iframe/);
    expect(out).toContain("&lt;iframe");
  });

  it("HTML inside code stays escaped too", () => {
    expect(html("`<b>bold</b>`")).toBe("<p><code>&lt;b&gt;bold&lt;/b&gt;</code></p>");
    expect(html("```html\n<script>x()</script>\n```")).toContain("&lt;script&gt;x()&lt;/script&gt;");
  });

  it("the article wrapper has no innerHTML path either", () => {
    const out = renderToStaticMarkup(createElement(Markdown, { source: "<b>x</b>" }));
    expect(out).toBe('<div class="prose-rt"><p>&lt;b&gt;x&lt;/b&gt;</p></div>');
  });
});

describe("links", () => {
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "http://example.com",
    "//evil.example/x",
    "/\\evil.example/x",
    "ftp://example.com",
    "#section",
    "relative/path",
  ])("refuses %s — the words render, the anchor doesn't", (href) => {
    const out = html(`[click me](${href})`);
    expect(out).not.toContain("<a");
    expect(out).not.toMatch(/javascript:|data:|vbscript:/i);
    expect(out).toContain("click me");
  });

  it("an encoded scheme is just an unsafe string, not decoded into a link", () => {
    expect(html("[x](&#106;avascript:alert(1))")).not.toContain("<a");
    expect(html("[x](java\\script:alert(1))")).not.toContain("<a");
  });

  it("https links open in a new tab with noopener", () => {
    expect(html("[Docs](https://example.com/a?b=1 \"The docs\")")).toBe(
      '<p><a href="https://example.com/a?b=1" title="The docs" target="_blank" rel="noopener noreferrer">Docs</a></p>'
    );
  });

  it("mailto links stay in the tab", () => {
    expect(html("[Email us](mailto:hello@example.com)")).toBe(
      '<p><a href="mailto:hello@example.com">Email us</a></p>'
    );
  });

  it("internal paths are localized for the page's language", () => {
    expect(html("[Projects](/projects)", "fil")).toBe('<p><a href="/fil/projects">Projects</a></p>');
    expect(html("[Projects](/projects)", "en")).toBe('<p><a href="/projects">Projects</a></p>');
  });

  it("autolinks: https and mailto only", () => {
    expect(html("<https://example.com>")).toContain('href="https://example.com"');
    expect(html("<mailto:a@b.co>")).toContain('href="mailto:a@b.co"');
    expect(html("<javascript:alert(1)>")).not.toContain("<a");
  });

  it("no links inside links", () => {
    const out = html("[outer [inner](https://b.example)](https://a.example)");
    expect(out.match(/<a /g)?.length).toBe(1);
  });

  it("formatting inside a link label", () => {
    expect(html("[**bold** link](https://example.com)")).toContain("<strong>bold</strong> link</a>");
  });

  it("safeHref allow-list", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("/blog/x#y")).toBe("/blog/x#y");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeHref("https://")).toBeNull();
    expect(safeHref("https://exa\nmple.com")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
  });
});

describe("images", () => {
  it("renders a safe image lazily, with alt text, as a figure when alone", () => {
    expect(html('![A diagram](/work/x.webp "How it fits")')).toBe(
      '<figure><img src="/work/x.webp" alt="A diagram" title="How it fits" loading="lazy" decoding="async"/><figcaption>How it fits</figcaption></figure>'
    );
  });

  it("a Storage URL passes", () => {
    expect(html("![x](https://abc.supabase.co/storage/v1/object/public/work/a.png)")).toContain(
      'src="https://abc.supabase.co/storage/v1/object/public/work/a.png"'
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/png;base64,iVBORw0KGgo=",
    "//evil.example/x.png",
    "/\\evil.example/x.png",
  ])("drops %s entirely", (src) => {
    const out = html(`Before ![alt text](${src}) after`);
    expect(out).not.toContain("<img");
    expect(out).not.toMatch(/javascript:|data:|evil/);
    expect(out).toBe("<p>Before  after</p>");
  });

  it("alt text is plain text, even when the label has markup", () => {
    expect(html("![*nice* <b>shot</b>](/a.png)")).toContain('alt="nice &lt;b&gt;shot&lt;/b&gt;"');
  });

  it("safeImageSrc mirrors the panel's rule", () => {
    expect(safeImageSrc("/work/a.webp")).toBe("/work/a.webp");
    expect(safeImageSrc("")).toBeNull();
    expect(safeImageSrc("javascript:x")).toBeNull();
  });
});

describe("emphasis", () => {
  it("bold, italic, both", () => {
    expect(html("**bold** and *italic* and __b__ and _i_")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <strong>b</strong> and <em>i</em></p>"
    );
    expect(html("***both***")).toBe("<p><em><strong>both</strong></em></p>");
  });

  it("nests", () => {
    expect(html("**bold *italic* bold**")).toBe(
      "<p><strong>bold <em>italic</em> bold</strong></p>"
    );
    expect(html("*italic **bold** italic*")).toBe(
      "<p><em>italic <strong>bold</strong> italic</em></p>"
    );
  });

  it("unterminated markers are literal text", () => {
    expect(html("**not closed")).toBe("<p>**not closed</p>");
    expect(html("*a")).toBe("<p>*a</p>");
    expect(html("`not code")).toBe("<p>`not code</p>");
    expect(html("[not a link](https://x.example")).toBe("<p>[not a link](https://x.example</p>");
    expect(html("2 * 3 * 4")).toBe("<p>2 * 3 * 4</p>");
  });

  it("underscores inside words are not emphasis", () => {
    expect(html("snake_case_name stays")).toBe("<p>snake_case_name stays</p>");
  });

  it("backslash escapes", () => {
    expect(html("\\*not italic\\*")).toBe("<p>*not italic*</p>");
  });

  it("emphasis never crosses into code", () => {
    expect(html("*a `*` b*")).toBe("<p><em>a <code>*</code> b</em></p>");
  });
});

describe("blocks", () => {
  it("headings: # and ## are both h2 (the page's h1 is the title), #### and below are h4", () => {
    expect(html("# One\n\n## Two\n\n### Three\n\n#### Four\n\n###### Six")).toBe(
      "<h2>One</h2><h2>Two</h2><h3>Three</h3><h4>Four</h4><h4>Six</h4>"
    );
    expect(html("#hashtag")).toBe("<p>#hashtag</p>");
    expect(html("Title\n=====")).toBe("<h2>Title</h2>");
  });

  it("paragraphs, soft and hard breaks", () => {
    expect(html("one\ntwo\n\nthree")).toBe("<p>one two</p><p>three</p>");
    expect(html("line  \nbreak")).toBe("<p>line<br/>break</p>");
    expect(html("line\\\nbreak")).toBe("<p>line<br/>break</p>");
  });

  it("fenced code keeps content verbatim (and an unterminated fence runs to the end)", () => {
    expect(html("```ts\nconst a = **1**;\n  indented\n```")).toBe(
      '<pre tabindex="0" data-lang="ts"><code>const a = **1**;\n  indented</code></pre>'
    );
    expect(html("~~~\nopen")).toBe('<pre tabindex="0"><code>open</code></pre>');
  });

  it("blockquotes, nested", () => {
    expect(html("> quoted **text**\n> > deeper")).toBe(
      "<blockquote><p>quoted <strong>text</strong></p><blockquote><p>deeper</p></blockquote></blockquote>"
    );
  });

  it("lists: unordered, ordered with a start, nested, tight", () => {
    expect(html("- a\n- b\n  - c")).toBe("<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul>");
    expect(html("3. three\n4. four")).toBe('<ol start="3"><li>three</li><li>four</li></ol>');
    expect(html("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("loose lists wrap items in paragraphs", () => {
    expect(html("- a\n\n- b")).toBe("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
  });

  it("a different marker starts a new list", () => {
    expect(html("- a\n* b")).toBe("<ul><li>a</li></ul><ul><li>b</li></ul>");
  });

  it("horizontal rules", () => {
    expect(html("a\n\n---\n\nb")).toBe("<p>a</p><hr/><p>b</p>");
    expect(html("* * *")).toBe("<hr/>");
  });

  it("a mid-paragraph year isn't an ordered list", () => {
    expect(html("We started\n2024. Then grew.")).toBe("<p>We started 2024. Then grew.</p>");
  });
});

describe("robustness", () => {
  it("empty and whitespace input render nothing", () => {
    expect(html("")).toBe("");
    expect(html("   \n\n  ")).toBe("");
  });

  it("deep nesting is capped instead of recursing without limit", () => {
    expect(() => html(">".repeat(5000) + " deep")).not.toThrow();
    expect(() => html("[".repeat(5000) + "x" + "]".repeat(5000) + "(https://a.example)")).not.toThrow();
  });

  it("pathological delimiter runs stay fast", () => {
    const evil = "*a ".repeat(20000) + "_b ".repeat(20000) + "`".repeat(3000) + "[".repeat(20000);
    const t0 = Date.now();
    html(evil);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("CRLF line endings", () => {
    expect(html("# T\r\n\r\npara")).toBe("<h2>T</h2><p>para</p>");
  });

  it("parseBlocks gives a plain AST", () => {
    expect(parseBlocks("## Hi\n\ntext")).toEqual([
      { t: "h", level: 2, c: "Hi" },
      { t: "p", c: "text" },
    ]);
  });
});

describe("readingMinutes", () => {
  it("counts words, not markup, with a floor of one minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("word ".repeat(440))).toBe(2);
    expect(readingMinutes("[link text](https://a.example/very/long/url) **bold**")).toBe(1);
  });
});
