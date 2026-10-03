import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  NEVER_AUTOSAVE,
  RETRY_DELAYS_MS,
  SAVE_UNITS,
  autosaveLabel,
  classifyAutosave,
  completeUnits,
  conflictHeadline,
  dirtyNames,
  emptyDirty,
  expandToUnits,
  fieldsToFormData,
  formatClock,
  formToFields,
  isAutosaveInput,
  isDirty,
  leaveNeedsConfirm,
  markDirty,
  mergeFieldErrors,
  parkInvalid,
  parseAutosaveRequest,
  retryDelay,
  revertSaveOnly,
  sendableNames,
  settleDirty,
  snapshotDirty,
  timeAgo,
  unitForInput,
  unsavableNames,
  type AutosaveEntity,
} from "@/app/admin/_lib/autosave";

/**
 * The decisions behind the editors' autosave (components/admin/useAutosave.ts),
 * as pure functions. The reference project lost edits silently — it cleared
 * its pending set BEFORE the push returned, so a network blip dropped them —
 * and an earlier version of it overwrote other sections with a stale local
 * copy because it pushed everything. Both are pinned here.
 */

const ENTITIES = Object.keys(SAVE_UNITS) as AutosaveEntity[];

describe("what may be autosaved", () => {
  it("slug, published and sort_order are never autosaved, on any editor", () => {
    for (const entity of ENTITIES) {
      for (const name of NEVER_AUTOSAVE) {
        expect(isAutosaveInput(entity, name), `${entity}.${name}`).toBe(false);
        expect(unitForInput(entity, name)).toBeUndefined();
      }
      expect(expandToUnits(entity, [...NEVER_AUTOSAVE]).inputs).toEqual([]);
      expect(completeUnits(entity, [...NEVER_AUTOSAVE])).toEqual([]);
    }
  });

  it("nor the plumbing fields", () => {
    for (const entity of ENTITIES) {
      expect(isAutosaveInput(entity, "id")).toBe(false);
      expect(isAutosaveInput(entity, "updated_at")).toBe(false);
    }
  });

  it("no input belongs to two units (or a save could write it twice, inconsistently)", () => {
    for (const entity of ENTITIES) {
      const inputs = SAVE_UNITS[entity].flatMap((u) => [...u.inputs]);
      expect(new Set(inputs).size, entity).toBe(inputs.length);
    }
  });

  it("touching one input of a group sends the whole group", () => {
    expect(expandToUnits("projects", ["result_label"]).inputs).toEqual(["result_value", "result_label"]);
    expect(expandToUnits("projects", ["gallery_kind"]).inputs).toEqual([
      "gallery_src",
      "gallery_caption",
      "gallery_kind",
    ]);
    expect(expandToUnits("projects", ["testimonial_quote"]).inputs).toEqual([
      "testimonial_quote",
      "testimonial_author",
    ]);
    expect(expandToUnits("projects", ["dot2"]).inputs).toEqual(["dot1", "dot2", "dot3"]);
    expect(expandToUnits("products", ["cta_url"]).inputs).toEqual(["cta_label", "cta_url"]);
    expect(expandToUnits("site_settings", ["social_href"]).inputs).toEqual(["social_label", "social_href"]);
  });

  it("…and only the touched groups — never the whole form", () => {
    const { inputs } = expandToUnits("projects", ["name", "name", "slug", "tags"]);
    expect(inputs).toEqual(["name", "tags"]);
  });

  it("the server only accepts complete groups", () => {
    expect(completeUnits("projects", ["gallery_src", "gallery_caption"]).map((u) => u.columns)).toEqual([]);
    expect(
      completeUnits("projects", ["gallery_src", "gallery_caption", "gallery_kind", "name"]).map((u) => u.columns)
    ).toEqual([["name"], ["gallery"]]);
  });

  it("knows which dirty fields only the Save button can write", () => {
    let d = emptyDirty();
    d = markDirty(d, "name");
    d = markDirty(d, "slug");
    d = markDirty(d, "published");
    expect(unsavableNames("projects", d)).toEqual(["slug", "published"]);
  });
});

describe("dirty bookkeeping", () => {
  it("a Save-only field typed back to its loaded value stops asking for Save", () => {
    let d = markDirty(markDirty(emptyDirty(), "slug"), "summary");
    expect(unsavableNames("products", d)).toEqual(["slug"]);
    d = revertSaveOnly(d, "slug");
    expect(unsavableNames("products", d)).toEqual([]);
    expect(dirtyNames(d)).toEqual(["summary"]);
  });

  it("an autosaved field is never reverted that way (the server may hold the edit)", () => {
    const d = markDirty(emptyDirty(), "summary");
    expect(revertSaveOnly(d, "summary")).toBe(d);
  });

  it("a successful save clears exactly the fields it carried", () => {
    let d = markDirty(markDirty(emptyDirty(), "name"), "summary");
    const snap = snapshotDirty(d, ["name"]);
    d = settleDirty(d, snap, ["name"]);
    expect(dirtyNames(d)).toEqual(["summary"]);
  });

  it("a failed save keeps the field dirty (nothing settles it)", () => {
    let d = markDirty(emptyDirty(), "name");
    const snap = snapshotDirty(d);
    // the request fails: the hook never calls settleDirty — and the field is
    // still there to be retried. (The reference cleared it up front.)
    expect(snap).toEqual({ name: 1 });
    expect(isDirty(d)).toBe(true);
    // a later success with a FRESH snapshot clears it
    d = settleDirty(d, snapshotDirty(d), ["name"]);
    expect(isDirty(d)).toBe(false);
  });

  it("an edit made while the save was in flight stays dirty for the next one", () => {
    let d = markDirty(emptyDirty(), "name");
    const snap = snapshotDirty(d); // values read, request sent
    d = markDirty(d, "name"); // typed again before the reply
    d = settleDirty(d, snap, ["name"]);
    expect(dirtyNames(d)).toEqual(["name"]);
  });

  it("a field first edited during the flight isn't cleared by a group it happened to ride in", () => {
    let d = markDirty(emptyDirty(), "result_value");
    const snap = snapshotDirty(d, ["result_value", "result_label"]); // label wasn't dirty yet
    d = markDirty(d, "result_label");
    d = settleDirty(d, snap, ["result_value", "result_label"]);
    expect(dirtyNames(d)).toEqual(["result_label"]);
  });

  it("settling only what the server says it saved — the refused fields stay", () => {
    let d = markDirty(markDirty(emptyDirty(), "name"), "live_url");
    d = settleDirty(d, snapshotDirty(d), ["name"]);
    expect(dirtyNames(d)).toEqual(["live_url"]);
  });

  it("a refused field is parked until it's edited again — no resend loop", () => {
    const units = expandToUnits("projects", ["live_url", "name"]).units;
    let d = markDirty(markDirty(emptyDirty(), "live_url"), "name");
    const snap = snapshotDirty(d);
    d = settleDirty(d, snap, ["name"]);
    let parked = parkInvalid({}, snap, units, { live_url: "Live URL must be a full https:// address" });

    expect(sendableNames("projects", d, parked)).toEqual([]);
    d = markDirty(d, "live_url"); // the person fixes it
    expect(sendableNames("projects", d, parked)).toEqual(["live_url"]);

    // and a clean result for that unit unparks it
    parked = parkInvalid(parked, snapshotDirty(d), expandToUnits("projects", ["live_url"]).units, {});
    expect(parked).toEqual({});
  });

  it("ineligible fields are never 'sendable'", () => {
    const d = markDirty(markDirty(emptyDirty(), "slug"), "title");
    expect(sendableNames("services", d, {})).toEqual(["title"]);
  });
});

describe("leaving the form inside the panel", () => {
  const base = { enabled: true, dirty: true, needsSave: false, phase: "idle" as const };
  it("doesn't nag when the pending edits will autosave on the way out", () => {
    expect(leaveNeedsConfirm(base)).toBe(false);
    expect(leaveNeedsConfirm({ ...base, phase: "saving" })).toBe(false);
    expect(leaveNeedsConfirm({ ...base, dirty: false })).toBe(false);
  });
  it("asks when something would really be lost", () => {
    expect(leaveNeedsConfirm({ ...base, needsSave: true })).toBe(true); // slug / publish / order
    expect(leaveNeedsConfirm({ ...base, enabled: false })).toBe(true); // a new item
    for (const phase of ["conflict", "gone", "offline", "retrying", "auth", "error", "invalid"] as const) {
      expect(leaveNeedsConfirm({ ...base, phase }), phase).toBe(true);
    }
  });
});

describe("field errors", () => {
  it("a response replaces the errors of the units it checked, and only those", () => {
    const sent = expandToUnits("site_settings", ["social_label", "email"]).units;
    const merged = mergeFieldErrors(
      { social_2: "old social error", email: "old email error", tagline: "untouched" },
      sent,
      { email: "Enter a valid email address" }
    );
    expect(merged).toEqual({ tagline: "untouched", email: "Enter a valid email address" });
  });
});

describe("retry schedule", () => {
  it("backs off 2 s, 5 s, 15 s, then holds at 30 s", () => {
    expect(RETRY_DELAYS_MS).toEqual([2000, 5000, 15000, 30000]);
    expect([0, 1, 2, 3, 4, 50].map(retryDelay)).toEqual([2000, 5000, 15000, 30000, 30000, 30000]);
    expect(retryDelay(-1)).toBe(2000);
  });

  it("debounces about a second", () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBe(1000);
  });
});

describe("wire format", () => {
  it("form values → fields → FormData round-trips repeated inputs and empty groups", () => {
    const fd = new FormData();
    fd.append("name", "FameCRM");
    fd.append("services", "Web");
    fd.append("services", "Design");
    const fields = formToFields(fd, ["name", "services", "team"]);
    expect(fields).toEqual({ name: "FameCRM", services: ["Web", "Design"], team: [] });

    const back = fieldsToFormData(fields);
    expect(back.get("name")).toBe("FameCRM");
    expect(back.getAll("services")).toEqual(["Web", "Design"]);
    expect(back.getAll("team")).toEqual([]);
  });

  it("validates requests before anything is parsed", () => {
    const ok = {
      entity: "projects",
      id: "7f1d3c2a-1111-4222-8333-944455556666",
      expectedUpdatedAt: "2026-10-02T06:41:07.123456+00:00",
      fields: { name: "x", services: ["a", "b"] },
    };
    expect(parseAutosaveRequest(ok)).toMatchObject({ entity: "projects", fields: ok.fields });
    expect(parseAutosaveRequest({ ...ok, entity: "profiles" })).toHaveProperty("error");
    expect(parseAutosaveRequest({ ...ok, id: "1" })).toHaveProperty("error");
    expect(parseAutosaveRequest({ ...ok, expectedUpdatedAt: "" })).toHaveProperty("error");
    expect(parseAutosaveRequest({ ...ok, fields: { name: 5 } })).toHaveProperty("error");
    expect(parseAutosaveRequest({ ...ok, fields: { body: "x".repeat(70_001) } })).toHaveProperty("error");
    expect(parseAutosaveRequest(null)).toHaveProperty("error");
    expect(parseAutosaveRequest({ ...ok, entity: "site_settings", id: 1 })).toMatchObject({ id: 1 });
    expect(parseAutosaveRequest({ ...ok, entity: "site_settings", id: "1" })).toMatchObject({ id: 1 });
    expect(parseAutosaveRequest({ ...ok, entity: "site_settings", id: 2 })).toHaveProperty("error");
  });
});

describe("what the hook does with a response", () => {
  it("success", () => {
    expect(classifyAutosave(200, { ok: true, updatedAt: "t2", saved: ["name"] })).toEqual({
      kind: "saved",
      updatedAt: "t2",
      saved: ["name"],
      fieldErrors: {},
    });
  });

  it("conflict carries who and when", () => {
    const c = classifyAutosave(409, {
      ok: false,
      conflict: { updatedAt: "t3", by: "Bob Builder", at: "t3", self: false },
    });
    expect(c).toEqual({ kind: "conflict", conflict: { updatedAt: "t3", by: "Bob Builder", at: "t3", self: false } });
  });

  it("offline, timeouts, 5xx and rate limits retry; refusals don't loop", () => {
    expect(classifyAutosave(0, null)).toMatchObject({ kind: "retry", offline: true });
    expect(classifyAutosave(503, { ok: false, error: "x", retry: true })).toMatchObject({ kind: "retry" });
    expect(classifyAutosave(502, null)).toMatchObject({ kind: "retry" });
    expect(classifyAutosave(429, null)).toMatchObject({ kind: "retry" });
    expect(classifyAutosave(503, { ok: false, error: "x", retry: false })).toMatchObject({ kind: "fatal" });
    expect(classifyAutosave(422, { ok: false, error: "schema" })).toMatchObject({ kind: "fatal" });
    expect(classifyAutosave(400, { ok: false, error: "bad" })).toMatchObject({ kind: "fatal" });
  });

  it("signed out keeps everything and retries; deleted stops", () => {
    expect(classifyAutosave(401, { ok: false, error: "expired" })).toMatchObject({ kind: "auth" });
    expect(classifyAutosave(403, null)).toMatchObject({ kind: "auth" });
    expect(classifyAutosave(410, { ok: false, gone: true, error: "gone" })).toMatchObject({ kind: "gone" });
  });

  it("a 200 that isn't our JSON (a proxy page, a login redirect) is not a success", () => {
    expect(classifyAutosave(200, null)).toMatchObject({ kind: "retry" });
    expect(classifyAutosave(200, { ok: true })).toMatchObject({ kind: "retry" });
  });
});

describe("wording", () => {
  it("formats the clock like '2:41 pm'", () => {
    expect(formatClock(new Date(2026, 9, 2, 14, 41))).toBe("2:41 pm");
    expect(formatClock(new Date(2026, 9, 2, 0, 5))).toBe("12:05 am");
    expect(formatClock(new Date(2026, 9, 2, 12, 0))).toBe("12:00 pm");
  });

  it("says how long ago", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    expect(timeAgo("2026-10-02T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-10-02T11:57:00Z", now)).toBe("3 minutes ago");
    expect(timeAgo("2026-10-02T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("not a date", now)).toBe("recently");
  });

  it("names the other editor — or you, in another tab", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const base = { updatedAt: "2026-10-02T11:58:00.123456+00:00", at: "2026-10-02T11:58:00.123456+00:00" };
    expect(conflictHeadline({ ...base, by: "Bob Builder", self: false }, now)).toBe(
      "Bob Builder saved a newer version 2 minutes ago."
    );
    expect(conflictHeadline({ ...base, by: null, self: false }, now)).toBe(
      "Someone saved a newer version 2 minutes ago."
    );
    expect(conflictHeadline({ ...base, by: "Me", self: true }, now)).toBe(
      "You saved a newer version in another tab 2 minutes ago."
    );
  });

  it("status line: outcomes are announced, typing and saving are not", () => {
    const base = {
      enabled: true,
      phase: "idle" as const,
      message: null,
      savedAt: null,
      waiting: false,
      needsSave: false,
      dirty: false,
    };
    expect(autosaveLabel({ ...base, phase: "saving" })).toMatchObject({ text: "Saving…", announce: false });
    // only the resting state tells the live region to drop a stale warning
    expect(autosaveLabel({ ...base, phase: "idle" })).toMatchObject({ rest: true, announce: false });
    expect(autosaveLabel({ ...base, needsSave: true, dirty: true })?.rest).toBeUndefined();
    expect(
      autosaveLabel({ ...base, phase: "saved", savedAt: new Date(2026, 9, 2, 14, 41) })
    ).toMatchObject({ text: "Saved · 2:41 pm", tone: "ok", announce: true });
    expect(autosaveLabel({ ...base, phase: "offline" })).toMatchObject({ text: "Offline — will retry" });
    expect(autosaveLabel({ ...base, phase: "invalid" })).toMatchObject({ text: "Couldn't save some fields" });
    expect(autosaveLabel({ ...base, phase: "conflict" })?.text).toMatch(/^Conflict/);
    expect(autosaveLabel({ ...base, waiting: true, dirty: true })).toMatchObject({
      text: "Unsaved changes",
      announce: false,
    });
    expect(autosaveLabel({ ...base, needsSave: true, dirty: true })?.text).toMatch(/need Save/);
    // a new item doesn't autosave: just the old "unsaved" hint
    expect(autosaveLabel({ ...base, enabled: false, dirty: true })?.text).toBe("Unsaved changes");
    expect(autosaveLabel({ ...base, enabled: false })).toBeNull();
  });
});
