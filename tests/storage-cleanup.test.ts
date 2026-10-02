import { beforeAll, describe, expect, it } from "vitest";
import { removeOrphanedUploads, storagePath } from "@/app/admin/_lib/storage";

/**
 * removeOrphanedUploads deletes files from the public bucket. The failure that
 * matters is the silent one: deleting an image something still uses — another
 * project's gallery, a product, a post body, or a stored revision a restore
 * would bring back (it would come back with a broken image). These pin that
 * "in use anywhere" means anywhere, and that "couldn't check" never means
 * "unused".
 */

const BASE = "https://abc.supabase.co";
const url = (name: string) => `${BASE}/storage/v1/object/public/work/${name}`;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
});

type TableResult = { data?: unknown[]; error?: { code?: string; message?: string } };

/** Just enough of the Supabase client for the cleanup's reads and its remove(). */
function fakeSupabase(tables: Record<string, TableResult>, opts: { removeThrows?: boolean } = {}) {
  const removed: string[] = [];
  const client = {
    from(table: string) {
      const res = tables[table] ?? { data: [] };
      const builder = {
        select: () => builder,
        abortSignal: () => builder,
        retry: () => Promise.resolve({ data: res.error ? null : (res.data ?? []), error: res.error ?? null }),
      };
      return builder;
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          if (opts.removeThrows) throw new Error("storage down");
          removed.push(...paths);
          return { data: [], error: null };
        },
      }),
    },
  };
  // the real type is the cookie client; the cleanup only touches these methods
  return { client: client as unknown as Parameters<typeof removeOrphanedUploads>[0], removed };
}

describe("storagePath", () => {
  it("maps our bucket URLs to object paths and ignores everything else", () => {
    expect(storagePath(url("shot-1a2b.webp"))).toBe("shot-1a2b.webp");
    expect(storagePath(url("shot%20x.png?v=2"))).toBe("shot x.png");
    expect(storagePath("/work/famecrm-landing.webp")).toBeNull();
    expect(storagePath("https://elsewhere.example/storage/v1/object/public/work/a.png")).toBeNull();
    expect(storagePath(null)).toBeNull();
  });
});

describe("removeOrphanedUploads", () => {
  it("deletes an upload nothing references any more", async () => {
    const { client, removed } = fakeSupabase({});
    await removeOrphanedUploads(client, [url("old.webp")]);
    expect(removed).toEqual(["old.webp"]);
  });

  it("keeps a file another project, product or post still uses (incl. inside a gallery)", async () => {
    const { client, removed } = fakeSupabase({
      projects: { data: [{ img: url("p.webp"), img2: null, gallery: [] }] },
      products: { data: [{ image: null, gallery: [{ src: url("g.webp"), kind: "desktop" }] }] },
      posts: { data: [{ cover_image: url("c.webp"), body: "" }] },
    });
    await removeOrphanedUploads(client, [url("p.webp"), url("g.webp"), url("c.webp"), url("x.webp")]);
    expect(removed).toEqual(["x.webp"]);
  });

  it("keeps a file only a stored revision references — a restore must not come back broken", async () => {
    const { client, removed } = fakeSupabase({
      content_revisions: {
        data: [{ snapshot: { id: "1", name: "Old", gallery: [{ src: url("history.webp") }] } }],
      },
    });
    await removeOrphanedUploads(client, [url("history.webp")]);
    expect(removed).toEqual([]);
  });

  it("keeps a file pasted into a post's markdown body", async () => {
    const { client, removed } = fakeSupabase({
      posts: { data: [{ cover_image: null, body: `Look:\n\n![shot](${url("inline.webp")})` }] },
    });
    await removeOrphanedUploads(client, [url("inline.webp")]);
    expect(removed).toEqual([]);
  });

  it("deletes NOTHING when a source can't be read — couldn't check is not unused", async () => {
    const { client, removed } = fakeSupabase({
      content_revisions: { error: { code: "PGRST301", message: "JWT expired" } },
    });
    await removeOrphanedUploads(client, [url("maybe.webp")]);
    expect(removed).toEqual([]);
  });

  it("treats a table that doesn't exist yet as referencing nothing (an older database)", async () => {
    const { client, removed } = fakeSupabase({
      products: { error: { code: "42P01", message: 'relation "public.products" does not exist' } },
      content_revisions: { error: { code: "PGRST205", message: "Could not find the table" } },
    });
    await removeOrphanedUploads(client, [url("gone.webp")]);
    expect(removed).toEqual(["gone.webp"]);
  });

  it("never touches files that aren't uploads to our bucket", async () => {
    const { client, removed } = fakeSupabase({});
    await removeOrphanedUploads(client, ["/work/famecrm-landing.webp", "https://cdn.example/x.png", null, undefined, ""]);
    expect(removed).toEqual([]);
  });

  it("never throws — a cleanup failure must not fail the save", async () => {
    const { client } = fakeSupabase({}, { removeThrows: true });
    await expect(removeOrphanedUploads(client, [url("a.webp")])).resolves.toBeUndefined();
  });
});
