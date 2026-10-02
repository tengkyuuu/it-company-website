import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public read layer for products, careers and the blog (lib/cms.ts).
 * What must never happen silently:
 *  - invented content: unlike projects/services there is no static list, so
 *    every failure path returns EMPTY;
 *  - a closed role still listed on /careers (or its stale link 404ing);
 *  - an unsafe CTA link or image reaching the page from a hand-edited row;
 *  - a nav link to a section with nothing behind it.
 * The Supabase client is faked with an in-memory table so the real query
 * chain (filters, order, limit) runs against known rows.
 */

type Row = Record<string, unknown>;
let tables: Record<string, Row[] | { error: { message: string } } | "throw"> = {};

function builder(table: string) {
  const filters: [string, unknown][] = [];
  const orders: { col: string; asc: boolean; nullsFirst: boolean }[] = [];
  let limit = Infinity;

  const run = () => {
    const t = tables[table];
    if (t === "throw") throw new Error("network down");
    if (!Array.isArray(t)) return { data: null, error: t?.error ?? null };
    let rows = t.filter((r) => filters.every(([k, v]) => r[k] === v));
    rows = [...rows].sort((a, b) => {
      for (const o of orders) {
        const x = a[o.col] as string | number | null;
        const y = b[o.col] as string | number | null;
        if (x === y) continue;
        if (x === null || x === undefined) return o.nullsFirst ? -1 : 1;
        if (y === null || y === undefined) return o.nullsFirst ? 1 : -1;
        return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
      }
      return 0;
    });
    return { data: rows.slice(0, limit), error: null };
  };

  const b = {
    select: () => b,
    eq: (k: string, v: unknown) => (filters.push([k, v]), b),
    order: (col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) => {
      const asc = o.ascending ?? true;
      orders.push({ col, asc, nullsFirst: o.nullsFirst ?? !asc });
      return b;
    },
    limit: (n: number) => ((limit = n), b),
    abortSignal: () => b,
    retry: () => b,
    maybeSingle: async () => {
      const r = run();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(run()).then(ok, bad);
      } catch (e) {
        return Promise.reject(e).then(ok, bad);
      }
    },
  };
  return b;
}

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: (t: string) => builder(t) }),
}));

const cms = await import("@/lib/cms");

const NOW = new Date("2026-10-02T04:00:00Z"); // 12:00 in Manila

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  tables = {};
});

afterEach(() => {
  vi.useRealTimers();
});

const job = (over: Row): Row => ({
  id: `id-${String(over.slug)}`,
  title: "Role",
  department: "",
  location: "",
  employment_type: "full-time",
  workplace: "onsite",
  summary: "",
  description: "",
  responsibilities: [],
  requirements: [],
  closes_at: null,
  published: true,
  sort_order: 0,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...over,
});

const product = (over: Row): Row => ({
  id: `id-${String(over.slug)}`,
  name: "Thing",
  tagline: "",
  summary: "",
  description: "",
  features: [],
  image: null,
  gallery: [],
  status: "",
  cta_label: "",
  cta_url: "",
  published: true,
  sort_order: 0,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...over,
});

describe("manilaToday / isJobClosed", () => {
  it("uses the studio's calendar, not UTC", () => {
    // 17:00 UTC on the 1st is 01:00 on the 2nd in Manila
    expect(cms.manilaToday(new Date("2026-10-01T17:00:00Z"))).toBe("2026-10-02");
    expect(cms.manilaToday(new Date("2026-10-01T15:59:00Z"))).toBe("2026-10-01");
  });

  it("closes the day AFTER the closing date (the date itself is inclusive)", () => {
    expect(cms.isJobClosed("2026-10-01", "2026-10-02")).toBe(true);
    expect(cms.isJobClosed("2026-10-02", "2026-10-02")).toBe(false);
    expect(cms.isJobClosed(null, "2026-10-02")).toBe(false);
    expect(cms.isJobClosed("not a date", "2026-10-02")).toBe(false);
  });
});

describe("fallbacks are EMPTY — never invented", () => {
  it("returns nothing without a database", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(await cms.getProducts()).toEqual([]);
    expect(await cms.getJobs()).toEqual([]);
    expect(await cms.getPosts()).toEqual([]);
    expect(await cms.getJobBySlug("x")).toBeUndefined();
    expect(await cms.getPostBySlug("x")).toBeUndefined();
    expect(await cms.getPublishedSections()).toEqual({ products: false, careers: false, blog: false });
  });

  it("returns nothing (and doesn't throw) when the database errors or is unreachable", async () => {
    tables = { products: { error: { message: "boom" } }, jobs: "throw", posts: "throw" };
    expect(await cms.getProducts()).toEqual([]);
    expect(await cms.getJobs()).toEqual([]);
    expect(await cms.getPosts()).toEqual([]);
    expect(await cms.getJobBySlug("x")).toBeUndefined();
    expect(await cms.getPublishedSections()).toEqual({ products: false, careers: false, blog: false });
  });

  it("only ever returns published rows", async () => {
    tables = { products: [product({ slug: "live" }), product({ slug: "draft", published: false })] };
    expect((await cms.getProducts()).map((p) => p.slug)).toEqual(["live"]);
    expect(await cms.getProductBySlug("draft")).toBeUndefined();
  });
});

describe("careers", () => {
  it("lists open roles only, and keeps a closed role reachable by slug, flagged", async () => {
    tables = {
      jobs: [
        job({ slug: "open-ended", sort_order: 0 }),
        job({ slug: "closes-today", closes_at: "2026-10-02", sort_order: 1 }),
        job({ slug: "closed", closes_at: "2026-10-01", sort_order: 2 }),
        job({ slug: "draft", published: false }),
      ],
    };
    expect((await cms.getJobs()).map((j) => j.slug)).toEqual(["open-ended", "closes-today"]);

    const stale = await cms.getJobBySlug("closed");
    expect(stale).toMatchObject({ slug: "closed", closed: true, closesAt: "2026-10-01" });
    expect(stale?.id).toBe("id-closed"); // applications need the id
    expect(await cms.getJobBySlug("draft")).toBeUndefined();
  });
});

describe("products", () => {
  it("renders a CTA only with both a label and a safe link", async () => {
    tables = {
      products: [
        product({ slug: "a", cta_label: "Try it", cta_url: "https://app.example.com", sort_order: 0 }),
        product({ slug: "b", cta_label: "Contact", cta_url: "/contact", sort_order: 1 }),
        product({ slug: "c", cta_label: "Click", cta_url: "javascript:alert(1)", sort_order: 2 }),
        product({ slug: "d", cta_label: "", cta_url: "https://app.example.com", sort_order: 3 }),
      ],
    };
    const [a, b, c, d] = await cms.getProducts();
    expect(a.cta).toEqual({ label: "Try it", href: "https://app.example.com", external: true });
    expect(b.cta).toEqual({ label: "Contact", href: "/contact", external: false });
    expect(c.cta).toBeUndefined();
    expect(d.cta).toBeUndefined();
  });

  it("drops an image or gallery entry that isn't a safe src", async () => {
    tables = {
      products: [
        product({
          slug: "a",
          image: "data:image/png;base64,AAAA",
          gallery: [{ src: "//evil.example/x.png" }, { src: "/work/ok.webp", kind: "mobile" }, null],
          status: "  Beta ",
        }),
      ],
    };
    const [a] = await cms.getProducts();
    expect(a.image).toBeUndefined();
    expect(a.gallery).toEqual([{ src: "/work/ok.webp", kind: "mobile" }]);
    expect(a.status).toBe("Beta");
  });
});

describe("blog", () => {
  it("orders newest published first and returns the body only by slug", async () => {
    tables = {
      posts: [
        { slug: "old", title: "Old", excerpt: "", body: "# old", cover_image: null, tags: [], author_name: "", published: true, published_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
        { slug: "new", title: "New", excerpt: "", body: "# new", cover_image: null, tags: ["a"], author_name: " Jhade ", published: true, published_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
        { slug: "draft", title: "Draft", excerpt: "", body: "", cover_image: null, tags: [], author_name: "", published: false, published_at: null, created_at: "2026-09-02T00:00:00Z", updated_at: "2026-09-02T00:00:00Z" },
      ],
    };
    const list = await cms.getPosts();
    expect(list.map((p) => p.slug)).toEqual(["new", "old"]);
    expect(list[0].author).toBe("Jhade");

    const post = await cms.getPostBySlug("new");
    expect(post?.body).toBe("# new");
    expect(await cms.getPostBySlug("draft")).toBeUndefined();
  });
});

describe("getPublishedSections", () => {
  it("shows a link only when something is published (and, for careers, still open)", async () => {
    tables = {
      products: [product({ slug: "p", published: false })],
      jobs: [job({ slug: "closed", closes_at: "2026-09-30" })],
      posts: [{ id: "1", slug: "x", published: true, published_at: null }],
    };
    expect(await cms.getPublishedSections()).toEqual({ products: false, careers: false, blog: true });
  });

  it("counts careers as open when ANY published role is open — open-ended or a later date", async () => {
    tables = {
      jobs: [job({ slug: "closed", closes_at: "2026-09-30" }), job({ slug: "open", closes_at: null })],
    };
    expect((await cms.getPublishedSections()).careers).toBe(true);

    tables = {
      jobs: [job({ slug: "closed", closes_at: "2026-09-30" }), job({ slug: "later", closes_at: "2026-12-31" })],
    };
    expect((await cms.getPublishedSections()).careers).toBe(true);
  });

  it("one failing table hides only its own link", async () => {
    tables = { products: "throw", jobs: [job({ slug: "open" })], posts: { error: { message: "x" } } };
    expect(await cms.getPublishedSections()).toEqual({ products: false, careers: true, blog: false });
  });
});
