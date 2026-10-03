import { beforeAll, describe, expect, it } from "vitest";
import {
  deleteUploads,
  findUnusedUploads,
  publicUploadUrl,
  removeOrphanedUploads,
  urlsIn,
} from "@/app/admin/_lib/storage";

/**
 * The "unused images" sweep deletes in bulk, so its one job is to never call
 * an in-use file unused: a reference anywhere (any content row, any stored
 * revision, URL-encoded or not) keeps it; a source it couldn't read means it
 * lists nothing; the last day's uploads are left alone; and a read silently
 * capped by PostgREST's max-rows is re-read in full rather than trusted.
 */

const BASE = "https://abc.supabase.co";
const url = (name: string) => `${BASE}/storage/v1/object/public/work/${name}`;
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-02T12:00:00Z");
const old = new Date(NOW.getTime() - 3 * DAY).toISOString();
const fresh = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
});

type TableSpec = { rows?: unknown[]; error?: { code?: string; message?: string } };
type Obj = { name: string; id: string | null; metadata: { size: number } | null; created_at: string; updated_at: string };

const file = (name: string, size = 1000, at = old): Obj => ({
  name,
  id: `id-${name}`,
  metadata: { size },
  created_at: at,
  updated_at: at,
});
const folder = (name: string): Obj => ({ name, id: null, metadata: null, created_at: "", updated_at: "" });

/**
 * Just enough of the Supabase client: table reads (with PostgREST's silent
 * max-rows cap, `count: "exact"`, order/range paging) and Storage list/remove.
 */
function fakeClient(tables: Record<string, TableSpec>, bucket: Record<string, Obj[]>, { cap = 1000 } = {}) {
  const removed: string[][] = [];
  const client = {
    from(table: string) {
      const spec = tables[table] ?? { rows: [] };
      let withCount = false;
      let range: [number, number] | null = null;
      const builder = {
        select: (_cols?: string, opts?: { count?: string }) => {
          withCount = opts?.count === "exact";
          return builder;
        },
        order: () => builder,
        range: (a: number, b: number) => {
          range = [a, b];
          return builder;
        },
        abortSignal: () => builder,
        retry: () => {
          if (spec.error) return Promise.resolve({ data: null, error: spec.error, count: null });
          const rows = spec.rows ?? [];
          const slice = range ? rows.slice(range[0], Math.min(range[1] + 1, range[0] + cap)) : rows.slice(0, cap);
          return Promise.resolve({ data: slice, error: null, count: withCount ? rows.length : null });
        },
      };
      return builder;
    },
    storage: {
      from: () => ({
        list: async (prefix: string, opts: { limit: number; offset: number }) => ({
          data: (bucket[prefix] ?? []).slice(opts.offset, opts.offset + opts.limit),
          error: null,
        }),
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  return { client: client as unknown as Parameters<typeof findUnusedUploads>[0], removed };
}

describe("findUnusedUploads", () => {
  it("lists only files nothing references, skipping the last 24 hours, walking folders", async () => {
    const { client } = fakeClient(
      {
        projects: { rows: [{ img: url("in-project.webp"), img2: null, gallery: [] }] },
        posts: { rows: [{ cover_image: null, body: `![x](${url("my%20shot.png")})` }] },
        content_revisions: { rows: [{ snapshot: { gallery: [{ src: url("only-in-history.webp") }] } }] },
        jobs: { rows: [{ description: `see ${url("in-a-role.webp")}` }] },
      },
      {
        "": [
          file("in-project.webp"),
          file("my shot.png"), // referenced URL-encoded
          file("only-in-history.webp"),
          file("in-a-role.webp"),
          file("orphan.webp", 4096),
          file("just-uploaded.webp", 10, fresh),
          folder("old-folder"),
        ],
        "old-folder": [file("nested-orphan.jpg", 2048), file(".emptyFolderPlaceholder", 0)],
      }
    );
    const scan = await findUnusedUploads(client, { now: NOW });
    expect(scan.ok).toBe(true);
    if (!scan.ok) return;
    expect(scan.unused.map((u) => u.path).sort()).toEqual(["old-folder/nested-orphan.jpg", "orphan.webp"]);
    expect(scan.totalBytes).toBe(4096 + 2048);
    expect(scan.recent).toBe(1);
    expect(scan.scanned).toBe(7);
  });

  it("lists NOTHING when any reference source can't be read", async () => {
    const { client } = fakeClient(
      { content_revisions: { error: { code: "PGRST301", message: "JWT expired" } } },
      { "": [file("orphan.webp")] }
    );
    const scan = await findUnusedUploads(client, { now: NOW });
    expect(scan.ok).toBe(false);
  });

  it("treats a table that doesn't exist yet as referencing nothing", async () => {
    const { client } = fakeClient(
      { products: { error: { code: "42P01", message: 'relation "public.products" does not exist' } } },
      { "": [file("orphan.webp")] }
    );
    const scan = await findUnusedUploads(client, { now: NOW });
    expect(scan.ok && scan.unused.map((u) => u.path)).toEqual(["orphan.webp"]);
  });

  it("re-reads a source PostgREST silently capped, so a reference past row 1000 still counts", async () => {
    const revisions: { snapshot: Record<string, unknown> }[] = Array.from({ length: 1500 }, (_, i) => ({
      snapshot: { name: `rev ${i}` },
    }));
    revisions[1400] = { snapshot: { img: url("deep-in-history.webp") } };
    const { client } = fakeClient(
      { content_revisions: { rows: revisions } },
      { "": [file("deep-in-history.webp"), file("orphan.webp")] },
      { cap: 1000 }
    );
    const scan = await findUnusedUploads(client, { now: NOW });
    expect(scan.ok && scan.unused.map((u) => u.path)).toEqual(["orphan.webp"]);
  });
});

describe("removeOrphanedUploads (shares the capped-read fix)", () => {
  it("keeps a file referenced only beyond the max-rows cap", async () => {
    const revisions: { snapshot: Record<string, unknown> }[] = Array.from({ length: 1200 }, (_, i) => ({
      snapshot: { name: `rev ${i}` },
    }));
    revisions[1100] = { snapshot: { img: url("kept.webp") } };
    const { client, removed } = fakeClient({ content_revisions: { rows: revisions } }, {}, { cap: 1000 });
    await removeOrphanedUploads(client, [url("kept.webp"), url("gone.webp")]);
    expect(removed).toEqual([["gone.webp"]]);
  });
});

describe("deleteUploads / helpers", () => {
  it("deletes in batches of 100 and reports what Storage confirmed", async () => {
    const { client, removed } = fakeClient({}, {});
    const paths = Array.from({ length: 250 }, (_, i) => `f${i}.webp`);
    const deleted = await deleteUploads(client, paths);
    expect(removed.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(deleted).toHaveLength(250);
  });

  it("builds public URLs and finds URLs inside snapshots / markdown", () => {
    expect(publicUploadUrl("my shot.png")).toBe(url("my%20shot.png"));
    expect(urlsIn({ img: url("a.webp"), body: `![x](${url("b.webp")}) and https://elsewhere.test/c.png` })).toEqual([
      url("a.webp"),
      url("b.webp"),
      "https://elsewhere.test/c.png",
    ]);
  });
});
