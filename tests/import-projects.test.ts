import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, createTestDb, one } from "./helpers/db";
import { staticProjectRows } from "@/app/admin/_lib/import-projects";
import { projects as staticProjects } from "@/lib/work";

/**
 * The admin's "Import" (importStaticProjects) inserts staticProjectRows() in
 * one bulk request. PostgREST builds that insert like jsonb_populate_recordset:
 * a key one row has and another lacks becomes NULL in the second, NOT the
 * column default. The case-study columns are NOT NULL, so rows with different
 * optional fields once failed the whole import with 23502. Inserting the same
 * rows the same way here, into the real schema, catches that before a deploy.
 */
describe("importing the built-in projects", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db?.close();
  });

  const bulkInsert = (rows: object[]) =>
    asService(db, () =>
      db.query(
        `insert into public.projects (${Object.keys(rows[0]).join(", ")})
         select ${Object.keys(rows[0]).join(", ")}
           from jsonb_populate_recordset(null::public.projects, $1::jsonb)`,
        [JSON.stringify(rows)]
      )
    );

  it("gives every row the same keys, so no column is ever sent as NULL by omission", () => {
    const rows = staticProjectRows([]);
    const keys = JSON.stringify(Object.keys(rows[0]).sort());
    for (const r of rows) expect(JSON.stringify(Object.keys(r).sort())).toBe(keys);
  });

  it("inserts every built-in project in one bulk request", async () => {
    const rows = staticProjectRows([]);
    expect(rows).toHaveLength(staticProjects.length);
    await bulkInsert(rows);
    const { n } = await one<{ n: number }>(db, "select count(*)::int as n from public.projects");
    expect(n).toBe(staticProjects.length);
  });

  it("only adds the missing ones, after the existing order", async () => {
    const existing = [
      { slug: staticProjects[0].slug, sort_order: 0 },
      { slug: staticProjects[1].slug, sort_order: 4 },
    ];
    const rows = staticProjectRows(existing);
    expect(rows.map((r) => r.slug)).not.toContain(staticProjects[0].slug);
    expect(rows).toHaveLength(staticProjects.length - 2);
    expect(rows[0].sort_order).toBe(5);
  });

  it("carries the case-study fields when a project has them", () => {
    const flux = staticProjectRows([]).find((r) => r.slug === "flux");
    expect(flux?.challenge).not.toBe("");
    expect(flux?.results.length).toBeGreaterThan(0);
  });
});
