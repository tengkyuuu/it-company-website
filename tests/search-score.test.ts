import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clip,
  defaultResults,
  fold,
  groupResults,
  highlightParts,
  joinKeywords,
  MAX_RESULTS,
  scoreEntry,
  search,
  tokenize,
  type SearchEntry,
} from "@/lib/search-score";

/**
 * Site search. The pure scorer (lib/search-score.ts) and the server index
 * builder (lib/search.ts). Silent failures this guards against:
 *  - a ranking that buries the obvious hit (title prefix must beat a keyword);
 *  - a highlight that eats or duplicates characters (the parts must always
 *    re-join to the exact original string — accents, emoji and all);
 *  - an index that bloats — it rides in the RSC payload of EVERY public page;
 *  - Filipino pages linking to English URLs (every href must be localized);
 *  - invented catalog entries, or a closed role still findable.
 */

const e = (over: Partial<SearchEntry> & Pick<SearchEntry, "id" | "title">): SearchEntry => ({
  type: "project",
  snippet: "",
  keywords: "",
  href: `/x/${over.id}`,
  ...over,
});

describe("tokenize / fold", () => {
  it("lowercases, strips accents, splits on whitespace and de-duplicates", () => {
    expect(tokenize("  Niño   ESPAÑOL niño ")).toEqual(["nino", "espanol"]);
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
  it("fold handles decomposed input the same as precomposed", () => {
    expect(fold("Niño")).toBe(fold("Niño"));
  });
});

describe("scoreEntry — title prefix > title word > title substring > keywords > snippet", () => {
  const entry = e({
    id: "a",
    title: "Coffee Shop Platform",
    keywords: "ordering pos",
    snippet: "A loyalty app for a café",
  });
  it.each([
    ["coffee", 5],
    ["shop", 4],
    ["latf", 3], // inside "Platform"
    ["pos", 2],
    ["loyalty", 1],
    ["cafe", 1], // accent-insensitive
  ])("%s → %i", (q, score) => {
    expect(scoreEntry(entry, tokenize(q))).toBe(score);
  });
  it("every token must match (AND) — one miss and the entry is out", () => {
    expect(scoreEntry(entry, tokenize("coffee shop"))).toBe(9);
    expect(scoreEntry(entry, tokenize("coffee kubernetes"))).toBeNull();
  });
  it("no tokens → no score", () => {
    expect(scoreEntry(entry, [])).toBeNull();
  });
});

describe("search", () => {
  const index: SearchEntry[] = [
    e({ id: "1", title: "App Development", type: "service", keywords: "mobile ios android" }),
    e({ id: "2", title: "FameCRM", keywords: "crm dashboard", snippet: "A CRM for talent agencies" }),
    e({ id: "3", title: "Web Development", type: "service", keywords: "next.js react" }),
    e({ id: "4", title: "PhysioPano", keywords: "mobile health" }),
    e({ id: "5", title: "Mobile Developer", type: "team", snippet: "Ralph" }),
  ];

  it("ranks the title hit above keyword hits, ties keep index order", () => {
    expect(search(index, "mobile").map((r) => r.id)).toEqual(["5", "1", "4"]);
  });
  it("matches across fields with AND", () => {
    expect(search(index, "development react").map((r) => r.id)).toEqual(["3"]);
  });
  it("empty query → nothing (the idle list is defaultResults)", () => {
    expect(search(index, "   ")).toEqual([]);
  });
  it("caps at MAX_RESULTS", () => {
    const many = Array.from({ length: 40 }, (_, i) => e({ id: String(i), title: `Thing ${i}` }));
    expect(search(many, "thing")).toHaveLength(MAX_RESULTS);
    expect(search(many, "thing", 3)).toHaveLength(3);
  });
  it("defaultResults lists only pages", () => {
    const withPages = [e({ id: "p", title: "Home", type: "page" }), ...index];
    expect(defaultResults(withPages).map((r) => r.id)).toEqual(["p"]);
  });
});

describe("groupResults", () => {
  it("orders groups by their best hit and keeps rank inside a group", () => {
    const ranked = [
      e({ id: "a", title: "a", type: "team" }),
      e({ id: "b", title: "b", type: "project" }),
      e({ id: "c", title: "c", type: "team" }),
      e({ id: "d", title: "d", type: "page" }),
    ];
    const groups = groupResults(ranked);
    expect(groups.map((g) => g.type)).toEqual(["team", "project", "page"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "c"]);
    // flattened = what the keyboard walks
    expect(groups.flatMap((g) => g.items).map((i) => i.id)).toEqual(["a", "c", "b", "d"]);
  });
});

describe("highlightParts", () => {
  const rejoin = (text: string, q: string) =>
    highlightParts(text, tokenize(q))
      .map((p) => p.text)
      .join("");
  const marked = (text: string, q: string) =>
    highlightParts(text, tokenize(q))
      .filter((p) => p.match)
      .map((p) => p.text);

  it("marks case-insensitive matches", () => {
    expect(highlightParts("FameCRM dashboard", ["crm"])).toEqual([
      { text: "Fame", match: false },
      { text: "CRM", match: true },
      { text: " dashboard", match: false },
    ]);
  });
  it("merges overlapping tokens into one mark", () => {
    expect(marked("Development", "dev velo")).toEqual(["Develo"]);
  });
  it("marks every occurrence", () => {
    expect(marked("app to app", "app")).toEqual(["app", "app"]);
  });
  it("is accent-insensitive and marks the ORIGINAL characters", () => {
    expect(marked("Café Niño", "cafe nino")).toEqual(["Café", "Niño"]);
    // decomposed ñ: the combining tilde stays with its letter
    expect(marked("Niño", "nin")).toEqual(["Niñ"]);
  });
  it.each([
    ["Café Niño — Dipolog", "nino"],
    ["Niño", "o"],
    ["Rocket 🚀 launch", "launch"],
    ["🚀🚀 go", "go"],
    ["İstanbul", "istanbul"],
    ["plain text", "zzz"],
    ["", "x"],
  ])("parts re-join to the exact original: %s / %s", (text, q) => {
    expect(rejoin(text, q)).toBe(text);
  });
  it("no tokens → one unmarked part", () => {
    expect(highlightParts("Hello", [])).toEqual([{ text: "Hello", match: false }]);
  });
});

describe("builder helpers", () => {
  it("clip keeps short text, collapses whitespace, cuts long text at a word", () => {
    expect(clip("  a   b  ", 10)).toBe("a b");
    expect(clip(undefined, 10)).toBe("");
    const out = clip("The quick brown fox jumps over the lazy dog", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toBe("The quick brown fox…");
  });
  it("joinKeywords de-duplicates case-insensitively and caps length at a word", () => {
    expect(joinKeywords(["React react", null, "Next.js", false, undefined, "REACT"])).toBe(
      "React Next.js"
    );
    const long = joinKeywords([Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ")], 50);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.endsWith(" ")).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
   The server index (lib/search.ts). The Supabase client is faked; static
   projects / services / team come from lib/work.ts etc. exactly as in prod.
--------------------------------------------------------------------------- */

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};

function builder(table: string) {
  const filters: [string, unknown][] = [];
  const run = () => ({
    data: (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v)),
    error: null,
  });
  const b = {
    select: () => b,
    eq: (k: string, v: unknown) => (filters.push([k, v]), b),
    order: () => b,
    limit: () => b,
    abortSignal: () => b,
    retry: () => b,
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    single: async () => ({ data: run().data[0] ?? null, error: run().data[0] ? null : { message: "none" } }),
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(ok, bad),
  };
  return b;
}

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: (t: string) => builder(t) }),
}));

const { buildSearchIndex } = await import("@/lib/search");

describe("buildSearchIndex", () => {
  const env = { ...process.env };
  beforeEach(() => {
    tables = {};
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.useRealTimers();
  });

  const size = (idx: SearchEntry[]) => new TextEncoder().encode(JSON.stringify(idx)).length;

  it("static mode: pages + projects + services + team, nothing invented", async () => {
    const idx = await buildSearchIndex("en");
    const byType = (t: SearchEntry["type"]) => idx.filter((x) => x.type === t);
    expect(byType("page").map((p) => p.href)).toEqual([
      "/",
      "/services",
      "/projects",
      "/about",
      "/location",
      "/status",
    ]);
    expect(byType("project").length).toBe(5);
    expect(byType("service").length).toBe(6);
    expect(byType("team").length).toBeGreaterThan(0);
    // no database → no products, roles or posts (and no section pages for them)
    expect(byType("product").concat(byType("job"), byType("post"))).toEqual([]);
  });

  it("ids are unique and every entry is well-formed and clipped", async () => {
    for (const lang of ["en", "fil"] as const) {
      const idx = await buildSearchIndex(lang);
      expect(new Set(idx.map((x) => x.id)).size).toBe(idx.length);
      for (const x of idx) {
        expect(x.title.trim()).not.toBe("");
        expect(x.href.startsWith("/")).toBe(true);
        expect(x.snippet.length).toBeLessThanOrEqual(110);
        expect(x.keywords.length).toBeLessThanOrEqual(160);
        expect(x.id).toMatch(/^[a-z]+-[\w-]+$/); // safe inside a DOM id
      }
    }
  });

  it("Filipino index links to /fil URLs and uses Filipino labels", async () => {
    const fil = await buildSearchIndex("fil");
    for (const x of fil) expect(x.href === "/fil" || x.href.startsWith("/fil/")).toBe(true);
    const services = fil.find((x) => x.id === "page-services")!;
    expect(services.title).not.toBe("Services");
    // …but the English word still finds it
    expect(search(fil, "services")[0].id).toBe("page-services");
  });

  it("finds real content by the obvious words", async () => {
    const idx = await buildSearchIndex("en");
    expect(search(idx, "famecrm")[0]?.id).toBe("project-famecrm");
    expect(search(idx, "contact")[0]?.id).toBe("page-location");
    expect(search(idx, "mobile").length).toBeGreaterThan(0);
  });

  it("stays small — it rides in every page's RSC payload", async () => {
    const en = size(await buildSearchIndex("en"));
    const fil = size(await buildSearchIndex("fil"));
    console.info(`[search index] static content: en ${en} B, fil ${fil} B`);
    // ~4.7 / ~5.0 KB today (2026-10-02) — 2x headroom before this trips
    expect(en).toBeLessThan(10_000);
    expect(fil).toBeLessThan(10_000);
  });

  it("with a database: catalog entries + section pages, closed roles left out", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-02T04:00:00Z"), toFake: ["Date"] });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const base = { published: true, sort_order: 0, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
    tables = {
      products: [
        { ...base, id: "p1", slug: "ledger", name: "Ledger", tagline: "Books for small shops", summary: "", description: "", features: ["Invoices", "Reports"], image: null, gallery: [], status: "Beta", cta_label: "", cta_url: "" },
      ],
      jobs: [
        { ...base, id: "j1", slug: "frontend-dev", title: "Frontend Developer", department: "Engineering", location: "Dipolog", employment_type: "full-time", workplace: "hybrid", summary: "Build interfaces.", description: "", responsibilities: [], requirements: [], closes_at: null },
        { ...base, id: "j2", slug: "old-role", title: "Closed Role", department: "", location: "", employment_type: "contract", workplace: "remote", summary: "", description: "", responsibilities: [], requirements: [], closes_at: "2026-09-30" },
      ],
      posts: [
        { ...base, id: "b1", slug: "hello", title: "Hello, Dipolog", excerpt: "Why we started.", cover_image: null, tags: ["kwento", "news"], author_name: "James", published_at: "2026-09-10T00:00:00Z", body: "x".repeat(50_000) },
      ],
    };

    const fil = await buildSearchIndex("fil");
    const ids = fil.map((x) => x.id);
    expect(ids).toEqual(
      expect.arrayContaining(["page-products", "page-careers", "page-blog", "product-ledger", "job-frontend-dev", "post-hello"])
    );
    expect(ids).not.toContain("job-old-role");
    expect(fil.find((x) => x.id === "product-ledger")!.href).toBe("/fil/products/ledger");
    expect(fil.find((x) => x.id === "job-frontend-dev")!.href).toBe("/fil/careers/frontend-dev");
    expect(fil.find((x) => x.id === "post-hello")!.href).toBe("/fil/blog/hello");
    // bodies never ride along
    expect(JSON.stringify(fil)).not.toContain("xxxxxxxxxx");
    expect(search(fil, "kwento")[0]?.id).toBe("post-hello");
    expect(search(fil, "hybrid engineering")[0]?.id).toBe("job-frontend-dev");
  });
});
