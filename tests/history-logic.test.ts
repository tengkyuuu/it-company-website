import { describe, expect, it } from "vitest";
import {
  META_KEY,
  REVISION_KEEP,
  actionGroup,
  activityHref,
  buildHistoryEntries,
  buildPreview,
  describeActivity,
  diffRows,
  differingKeys,
  entityLabel,
  excerptPair,
  fieldLabel,
  formatBytes,
  formatManila,
  idsToPrune,
  insertableValues,
  isContentTable,
  isValidEntityId,
  latestRevisionPerMissingEntity,
  publishNote,
  relativeTime,
  restorableValues,
  revisionMeta,
  sentenceText,
  summarizeChanges,
  withRevisionMeta,
  type ActivityLite,
  type FieldChange,
} from "@/app/admin/_lib/history-logic";

/**
 * The pure rules behind History / restore / recently deleted / the activity
 * feed. The failures that matter here are silent ones: a restore that writes a
 * column the table no longer has (or overwrites id/created_at), a diff that
 * reports nothing changed when the body did, a "recently deleted" list that
 * offers to restore something that still exists, a feed line that says the
 * wrong thing happened.
 */

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

const byKey = (changes: FieldChange[], key: string) => changes.find((c) => c.key === key);

describe("allow-lists", () => {
  it("only the seven content tables are restorable", () => {
    for (const t of ["projects", "services", "team_members", "site_settings", "products", "jobs", "posts"]) {
      expect(isContentTable(t), t).toBe(true);
    }
    for (const t of ["profiles", "content_revisions", "activity_log", "leads", "auth_tokens", "", null, 1]) {
      expect(isContentTable(t), String(t)).toBe(false);
    }
  });

  it("entity ids: '1' for site_settings, a uuid for everything else", () => {
    expect(isValidEntityId("site_settings", "1")).toBe(true);
    expect(isValidEntityId("site_settings", UUID_A)).toBe(false);
    expect(isValidEntityId("projects", UUID_A)).toBe(true);
    expect(isValidEntityId("projects", "1")).toBe(false);
    expect(isValidEntityId("projects", "x'; drop table projects;--")).toBe(false);
  });
});

describe("snapshot column filtering (restore)", () => {
  const snapshot = {
    id: UUID_A,
    created_at: "2026-01-01T00:00:00+00:00",
    updated_at: "2026-01-02T00:00:00+00:00",
    name: "Old name",
    tags: ["a", "b"],
    legacy_column: "from a schema that no longer has it",
    [META_KEY]: { kind: "pre-restore", restoring_revision_id: 4 },
    "bad key": "x",
  };
  const current = ["id", "created_at", "updated_at", "name", "tags", "client"];

  it("keeps only CURRENT columns and never id / created_at / updated_at / the meta key", () => {
    expect(restorableValues(snapshot, current)).toEqual({ name: "Old name", tags: ["a", "b"] });
  });

  it("leaves a column added since the snapshot alone (absent, so the live value stays)", () => {
    expect(restorableValues(snapshot, current)).not.toHaveProperty("client");
  });

  it("re-insert keeps the original id but still drops timestamps and unknown keys", () => {
    expect(insertableValues(snapshot, current)).toEqual({ id: UUID_A, name: "Old name", tags: ["a", "b"] });
  });

  it("differingKeys compares by content (jsonb key order doesn't matter)", () => {
    const values = { name: "Same", results: [{ value: "3×", label: "faster" }] };
    const live = { name: "Same", results: [{ label: "faster", value: "3×" }], tags: [] };
    expect(differingKeys(values, live)).toEqual([]);
    expect(differingKeys({ ...values, name: "New" }, live)).toEqual(["name"]);
  });

  it("marks and recognises a pre-restore backup", () => {
    const backup = withRevisionMeta({ id: UUID_A, name: "x" }, { kind: "pre-restore", restoring_revision_id: 9 });
    expect(revisionMeta(backup)).toEqual({ kind: "pre-restore", restoring_revision_id: 9 });
    expect(revisionMeta({ id: UUID_A })).toBeNull();
    expect(revisionMeta({ [META_KEY]: { kind: "something-else" } })).toBeNull();
  });

  it("prunes exactly what the trigger prunes: everything past the newest 20", () => {
    const ids = Array.from({ length: 23 }, (_, i) => i + 1);
    expect(REVISION_KEEP).toBe(20);
    expect(idsToPrune(ids)).toEqual([3, 2, 1]);
    expect(idsToPrune(ids.slice(0, 20))).toEqual([]);
    expect(idsToPrune([5, 1, 9], 2)).toEqual([1]);
  });
});

describe("diffRows", () => {
  it("labels fields like the editor and shows short before → after", () => {
    const changes = diffRows("projects", { name: "Old", category: "Web" }, { name: "New", category: "Web" });
    expect(changes).toEqual([{ key: "name", label: "Name", type: "text", before: "Old", after: "New" }]);
  });

  it("ignores id / timestamps / the meta key — a save that only moved updated_at is not a change", () => {
    const changes = diffRows(
      "projects",
      { id: UUID_A, name: "X", updated_at: "2026-01-01T00:00:00Z" },
      { id: UUID_B, name: "X", updated_at: "2026-02-01T00:00:00Z", [META_KEY]: { kind: "pre-restore" } }
    );
    expect(changes).toEqual([]);
  });

  it("excerpts long text around the first difference instead of showing the identical opening", () => {
    const intro = "Lorem ipsum dolor sit amet. ".repeat(20);
    const before = `${intro}The cafe opens in April. Thanks for reading.`;
    const after = `${intro}The cafe opens in May. Thanks for reading.`;
    const c = byKey(diffRows("posts", { body: before }, { body: after }), "body");
    expect(c).toMatchObject({ label: "Body", type: "text" });
    if (c?.type !== "text") throw new Error("expected text");
    expect(c.before).toContain("April");
    expect(c.after).toContain("May");
    expect(c.before.startsWith("…")).toBe(true);
    expect(c.after.length).toBeLessThan(200);
  });

  it("arrays become added / removed items; a pure reorder says so", () => {
    const c = byKey(diffRows("projects", { tags: ["web", "ios"] }, { tags: ["web", "android"] }), "tags");
    expect(c).toEqual({ key: "tags", label: "Tags", type: "list", added: ["android"], removed: ["ios"] });
    const r = byKey(diffRows("projects", { tags: ["a", "b"] }, { tags: ["b", "a"] }), "tags");
    expect(r).toMatchObject({ added: [], removed: [], note: "Reordered" });
  });

  it("images are before/after thumbnails; galleries are images added / removed", () => {
    const img = byKey(diffRows("projects", { img: "https://x/a.webp" }, { img: null }), "img");
    expect(img).toEqual({ key: "img", label: "Main screenshot", type: "image", before: "https://x/a.webp", after: null });

    const g = byKey(
      diffRows(
        "products",
        { gallery: [{ src: "https://x/1.webp", caption: "", kind: "desktop" }] },
        { gallery: [{ src: "https://x/2.webp", caption: "", kind: "mobile" }] }
      ),
      "gallery"
    );
    expect(g).toEqual({
      key: "gallery",
      label: "Gallery",
      type: "images",
      added: ["https://x/2.webp"],
      removed: ["https://x/1.webp"],
    });

    const captions = byKey(
      diffRows(
        "products",
        { gallery: [{ src: "https://x/1.webp", caption: "old" }] },
        { gallery: [{ src: "https://x/1.webp", caption: "new" }] }
      ),
      "gallery"
    );
    expect(captions).toMatchObject({ added: [], removed: [], note: "Captions edited" });
  });

  it("booleans read in the entity's own words", () => {
    expect(byKey(diffRows("projects", { published: false }, { published: true }), "published")).toMatchObject({
      label: "Status",
      before: "Draft",
      after: "Published",
    });
    expect(byKey(diffRows("services", { published: true }, { published: false }), "published")).toMatchObject({
      before: "Live",
      after: "Hidden",
    });
  });

  it("pairs (results, socials) diff as readable items", () => {
    const c = byKey(
      diffRows(
        "site_settings",
        { socials: [{ label: "LinkedIn", href: "https://linkedin.com/x" }] },
        { socials: [] }
      ),
      "socials"
    );
    expect(c).toEqual({
      key: "socials",
      label: "Social links",
      type: "list",
      added: [],
      removed: ["LinkedIn (https://linkedin.com/x)"],
    });
  });

  it("a column added to the schema later only counts once it holds a value", () => {
    expect(diffRows("projects", { name: "X" }, { name: "X", client: "" })).toEqual([]);
    expect(diffRows("projects", { name: "X" }, { name: "X", client: "Acme" })).toHaveLength(1);
  });

  it("unknown columns still diff, with a generated label", () => {
    const c = diffRows("projects", { new_thing: "a" }, { new_thing: "b" });
    expect(c[0]).toMatchObject({ label: "New thing", before: "a", after: "b" });
    expect(fieldLabel("products", "cta_url")).toBe("Button link");
    expect(fieldLabel("products", "brand_new_column")).toBe("Brand new column");
  });

  it("orders changes like the editor, and summarises them", () => {
    const changes = diffRows(
      "posts",
      { title: "A", body: "x", tags: [], excerpt: "e" },
      { title: "B", body: "y", tags: ["t"], excerpt: "f" }
    );
    expect(changes.map((c) => c.key)).toEqual(["title", "excerpt", "body", "tags"]);
    expect(summarizeChanges(changes)).toBe("Title, Excerpt and 2 more");
    expect(summarizeChanges(changes.slice(0, 2))).toBe("Title and Excerpt");
    expect(summarizeChanges([])).toBe("");
  });

  it("excerptPair handles an empty side and identical text", () => {
    expect(excerptPair("", "new")).toEqual({ before: "", after: "new" });
    expect(excerptPair("same", "same")).toEqual({ before: "same", after: "same" });
  });
});

describe("buildPreview", () => {
  it("lists every field in editor order, skipping bookkeeping and the meta key", () => {
    const fields = buildPreview("projects", {
      id: UUID_A,
      created_at: "x",
      updated_at: "y",
      slug: "famecrm",
      name: "FameCRM",
      gallery: [{ src: "https://x/1.webp", caption: "Home" }],
      [META_KEY]: { kind: "pre-restore", restoring_revision_id: 1 },
    });
    expect(fields.map((f) => f.key)).toEqual(["name", "slug", "gallery"]);
    expect(fields[2]).toEqual({
      key: "gallery",
      label: "Gallery",
      type: "images",
      items: [{ src: "https://x/1.webp", caption: "Home" }],
    });
  });
});

describe("buildHistoryEntries", () => {
  const names = new Map([[UUID_B, "James Calunsag"]]);
  const at = (min: number) => new Date(Date.UTC(2026, 9, 2, 2, min)).toISOString();

  it("diffs each snapshot against the NEXT newer version, the newest against the live row", () => {
    const entries = buildHistoryEntries(
      "projects",
      [
        { id: 1, snapshot: { name: "v1" }, actor_id: UUID_B, created_at: at(0) },
        { id: 2, snapshot: { name: "v2" }, actor_id: null, created_at: at(10) },
      ],
      { name: "v3" },
      { names, now: new Date(Date.UTC(2026, 9, 2, 3, 0)) }
    );
    expect(entries.map((e) => e.id)).toEqual([2, 1]); // newest first
    expect(entries[0]).toMatchObject({ actor: "System", kind: "edit", summary: "Name" });
    expect(entries[0].changes[0]).toMatchObject({ before: "v2", after: "v3" });
    expect(entries[1]).toMatchObject({ actor: "James Calunsag" });
    expect(entries[1].changes[0]).toMatchObject({ before: "v1", after: "v2" });
    expect(entries[1].ago).toBe("an hour ago");
  });

  it("recognises a pre-restore backup and a DELETE snapshot (same instant as the delete log line)", () => {
    const entries = buildHistoryEntries(
      "projects",
      [
        { id: 7, snapshot: { name: "gone" }, actor_id: UUID_B, created_at: "2026-10-02T02:00:00.123456+00:00" },
        {
          id: 8,
          snapshot: withRevisionMeta({ name: "before restore" }, { kind: "pre-restore", restoring_revision_id: 3 }),
          actor_id: UUID_B,
          created_at: "2026-10-02T03:00:00+00:00",
        },
      ],
      { name: "restored" },
      { names, deleteTimes: ["2026-10-02T02:00:00.123456+00:00"] }
    );
    expect(entries.find((e) => e.id === 8)?.kind).toBe("backup");
    expect(entries.find((e) => e.id === 7)?.kind).toBe("delete");
  });

  it("warns when restoring would flip visibility", () => {
    const [entry] = buildHistoryEntries(
      "posts",
      [{ id: 1, snapshot: { title: "t", published: false }, actor_id: null, created_at: at(0) }],
      { title: "t", published: true },
      { names }
    );
    expect(entry.publishNote).toMatch(/unpublishes/);
    expect(publishNote("team_members", true, false)).toMatch(/roster/);
    expect(publishNote("projects", true, true)).toBeUndefined();
  });

  it("names someone no longer on the panel without leaking their id", () => {
    const [entry] = buildHistoryEntries(
      "services",
      [{ id: 1, snapshot: { title: "x" }, actor_id: UUID_C, created_at: at(0) }],
      { title: "y" },
      { names }
    );
    expect(entry.actor).toBe("A former teammate");
  });
});

describe("recently deleted", () => {
  it("returns each MISSING item once, with its newest revision (the delete snapshot), newest first", () => {
    const revs = [
      { id: 1, entity_id: UUID_A, created_at: "t1", actor_id: null },
      { id: 4, entity_id: UUID_A, created_at: "t4", actor_id: UUID_B },
      { id: 2, entity_id: UUID_B, created_at: "t2", actor_id: null },
      { id: 3, entity_id: UUID_C, created_at: "t3", actor_id: UUID_B },
    ];
    const gone = latestRevisionPerMissingEntity(revs, new Set([UUID_B]));
    expect(gone.map((r) => [r.entity_id, r.id])).toEqual([
      [UUID_A, 4],
      [UUID_C, 3],
    ]);
  });

  it("an item restored since (it exists again) is not offered", () => {
    const revs = [{ id: 9, entity_id: UUID_A, created_at: "t", actor_id: null }];
    expect(latestRevisionPerMissingEntity(revs, new Set([UUID_A]))).toEqual([]);
  });
});

describe("activity sentences", () => {
  const row = (over: Partial<ActivityLite>): ActivityLite => ({
    id: 1,
    actor_id: UUID_B,
    actor_name: "Jhade Banquiao",
    action: "update",
    entity_type: "projects",
    entity_id: UUID_A,
    detail: { label: "FameCRM" },
    created_at: "2026-10-02T02:00:00Z",
    ...over,
  });
  const text = (r: ActivityLite) => sentenceText(describeActivity(r, { formatTime: () => "Sep 28, 10:02 AM" }));

  it("content changes name the actor, the kind of item and the item", () => {
    expect(text(row({ action: "publish", entity_type: "products", detail: { label: "Ledger" } }))).toBe(
      "Jhade Banquiao published the product “Ledger”"
    );
    expect(text(row({ action: "delete", entity_type: "jobs", detail: { label: "Designer" } }))).toBe(
      "Jhade Banquiao deleted the role “Designer”"
    );
    expect(text(row({ action: "unpublish", entity_type: "services", detail: { label: "Cloud" } }))).toBe(
      "Jhade Banquiao hid the service “Cloud”"
    );
    expect(text(row({ action: "update", entity_type: "site_settings", entity_id: "1", detail: { label: "Site settings" } }))).toBe(
      "Jhade Banquiao updated the site settings"
    );
  });

  it("restores say what they went back to", () => {
    expect(
      text(row({ action: "content.restore", actor_name: "James", detail: { label: "FameCRM", restored_from: "2026-09-28T02:02:00Z" } }))
    ).toBe("James restored the project “FameCRM” to Sep 28, 10:02 AM");
    expect(text(row({ action: "content.restore", actor_name: "James", detail: { label: "FameCRM", deleted: true } }))).toBe(
      "James restored the deleted project “FameCRM”"
    );
  });

  it("no actor (service-role writes) reads in the passive voice", () => {
    expect(text(row({ actor_id: null, actor_name: "", entity_type: "site_settings", entity_id: "1" }))).toBe(
      "Site settings were updated"
    );
    expect(text(row({ actor_id: null, actor_name: "", action: "create" }))).toBe("The project “FameCRM” was created");
  });

  it("team / auth / storage events", () => {
    expect(
      text(row({ action: "team.invite", actor_name: "Owner", entity_type: "invitation", entity_id: "jhade@x.test", detail: { email: "jhade@x.test" } }))
    ).toBe("Owner invited jhade@x.test");
    expect(text(row({ action: "storage.cleanup", entity_type: "storage", detail: { count: 3 } }))).toBe(
      "Jhade Banquiao cleaned up 3 unused images"
    );
    expect(text(row({ action: "auth.password_reset", entity_type: "team_member", detail: { label: "Jhade" } }))).toBe(
      "Jhade Banquiao reset their password"
    );
  });

  it("an action newer than this code still reads as something", () => {
    expect(text(row({ action: "inbox.archive", entity_type: "lead", detail: {} }))).toContain("inbox archive");
  });

  it("falls back to the profile name when the row has none", () => {
    const s = describeActivity(row({ actor_name: "" }), { actorName: "Haron Diniay" });
    expect(s.actor).toBe("Haron Diniay");
  });

  it("groups actions for the feed filter", () => {
    expect(actionGroup("publish")).toBe("content");
    expect(actionGroup("content.restore")).toBe("content");
    expect(actionGroup("storage.cleanup")).toBe("content");
    expect(actionGroup("team.invite")).toBe("team");
    expect(actionGroup("auth.password_reset")).toBe("auth");
    expect(actionGroup("chat.takeover")).toBe("other");
  });

  it("links to the editor only while the item exists", () => {
    const exists = (_t: string, id: string) => id === UUID_A;
    expect(activityHref({ action: "update", entity_type: "projects", entity_id: UUID_A }, exists)).toBe(
      `/admin/projects/${UUID_A}`
    );
    expect(activityHref({ action: "update", entity_type: "posts", entity_id: UUID_B }, exists)).toBeNull();
    expect(activityHref({ action: "update", entity_type: "jobs", entity_id: UUID_A }, exists)).toBe(
      `/admin/careers/${UUID_A}`
    );
    expect(activityHref({ action: "update", entity_type: "services", entity_id: UUID_A }, exists)).toBe(
      "/admin/services"
    );
    expect(activityHref({ action: "update", entity_type: "site_settings", entity_id: "1" }, () => false)).toBe(
      "/admin/settings"
    );
    expect(activityHref({ action: "team.invite", entity_type: "invitation", entity_id: "a@b" }, exists)).toBe(
      "/admin/team"
    );
  });
});

describe("formatting", () => {
  it("entity labels follow the trigger's precedence", () => {
    expect(entityLabel("projects", { name: "N", title: "T", slug: "s" })).toBe("N");
    expect(entityLabel("posts", { title: "T", slug: "s" })).toBe("T");
    expect(entityLabel("posts", { slug: "s" })).toBe("s");
    expect(entityLabel("site_settings", {})).toBe("Site settings");
  });

  it("times are Manila time, year only when it isn't this year", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    // 02:02 UTC = 10:02 Manila (UTC+8, no DST)
    expect(formatManila("2026-09-28T02:02:00Z", now)).toBe("Sep 28, 10:02 AM");
    // still 2025 in UTC, already 2026 in Manila — the Manila year decides
    expect(formatManila("2025-12-31T17:00:00Z", now)).toBe("Jan 1, 1:00 AM");
    expect(formatManila("2025-12-31T15:00:00Z", now)).toBe("Dec 31, 2025, 11:00 PM");
    expect(formatManila("2024-05-01T00:00:00Z", now)).toBe("May 1, 2024, 8:00 AM");
  });

  it("relative times", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const ago = (s: number) => relativeTime(new Date(now.getTime() - s * 1000).toISOString(), now);
    expect(ago(10)).toBe("just now");
    expect(ago(5 * 60)).toBe("5 minutes ago");
    expect(ago(3 * 3600)).toBe("3 hours ago");
    expect(ago(26 * 3600)).toBe("yesterday");
    expect(ago(3 * 86400)).toBe("3 days ago");
    expect(ago(15 * 86400)).toBe("2 weeks ago");
  });

  it("byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
  });
});
