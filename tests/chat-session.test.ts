import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HUMAN_MARKER_TAIL,
  buildTurnHistory,
  firstName,
  hashVisitorKey,
  humanMarker,
  toGeminiContents,
  visitorKeyMatches,
} from "@/lib/chat-session";
import { DEFAULT_GEMINI_MODEL, geminiModel } from "@/lib/chat-config";

/**
 * Server-side chat rules: the visitor key (a session id alone must never be
 * enough), how a takeover reads to the model after a hand-back, and the
 * GEMINI_MODEL switch.
 */

const KEY = "k".repeat(20) + "_-AbC123".repeat(3);

describe("visitor key", () => {
  it("stores a sha256 hex digest, not the key", () => {
    const h = hashVisitorKey(KEY);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(KEY);
  });

  it("matches only the key that made the hash", () => {
    const h = hashVisitorKey(KEY);
    expect(visitorKeyMatches(h, KEY)).toBe(true);
    expect(visitorKeyMatches(h, KEY.slice(0, -1) + "Z")).toBe(false);
  });

  it("a session with no stored hash can't be claimed by whoever asks first", () => {
    expect(visitorKeyMatches(null, KEY)).toBe(false);
    expect(visitorKeyMatches(undefined, KEY)).toBe(false);
    expect(visitorKeyMatches("", KEY)).toBe(false);
  });

  it("rejects malformed stored hashes and malformed keys without throwing", () => {
    expect(visitorKeyMatches("abc", KEY)).toBe(false);
    expect(visitorKeyMatches(hashVisitorKey(KEY).toUpperCase(), KEY)).toBe(false);
    expect(visitorKeyMatches(hashVisitorKey("short"), "short")).toBe(false);
  });
});

describe("firstName", () => {
  it("is the only thing about a staff member the public route returns", () => {
    expect(firstName("Jhade Banquiao")).toBe("Jhade");
    expect(firstName("  Sean  ")).toBe("Sean");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});

describe("toGeminiContents — how a takeover reads to the model", () => {
  it("maps visitor → user, ai → model, and a person → a MARKED model turn", () => {
    const out = toGeminiContents([
      { role: "visitor", content: "Can you do 50% off?" },
      { role: "ai", content: "Pricing depends on scope." },
      { role: "visitor", content: "Can I talk to someone?" },
      { role: "human", content: "Hi, Jhade here — happy to help.", author: "Jhade" },
      { role: "visitor", content: "Thanks! What stack do you use?" },
    ]);
    expect(out.map((c) => c.role)).toEqual(["user", "model", "user", "model", "user"]);
    expect(out[3].parts[0].text).toBe(`[Jhade ${HUMAN_MARKER_TAIL}] Hi, Jhade here — happy to help.`);
  });

  it("the marker wording is the one the static system-prompt rule names", async () => {
    expect(humanMarker("Ralph")).toBe("[Ralph from the team, writing in person]");
    expect(humanMarker(null)).toBe("[Someone from the team, writing in person]");
  });

  it("merges consecutive same-role turns (a visitor writing twice while a person was on)", () => {
    const out = toGeminiContents([
      { role: "visitor", content: "a" },
      { role: "visitor", content: "b" },
      { role: "human", content: "c", author: "J" },
      { role: "ai", content: "d" },
      { role: "visitor", content: "e" },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].parts.map((p) => p.text)).toEqual(["a", "b"]);
    expect(out[1].parts.map((p) => p.text)).toEqual(["[J from the team, writing in person] c", "d"]);
  });

  it("opens on a user turn and keeps the newest turns", () => {
    const turns = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 ? "ai" : "visitor") as "ai" | "visitor",
      content: `m${i}`,
    }));
    const out = toGeminiContents([{ role: "human", content: "hello", author: "J" }, ...turns], 24);
    expect(out[0].role).toBe("user");
    expect(out.flatMap((c) => c.parts).length).toBeLessThanOrEqual(24);
    expect(out[out.length - 1].parts.at(-1)?.text).toBe("m29");
  });
});

describe("buildTurnHistory", () => {
  const stored = [
    { id: 1, role: "visitor" as const, content: "hi" },
    { id: 2, role: "ai" as const, content: "hello" },
    { id: 3, role: "human" as const, content: "Jhade here", author: "Jhade" },
  ];

  it("prefers the stored conversation (it has the person's turns, unforgeable) and appends the new message once", () => {
    const withNew = [...stored, { id: 4, role: "visitor" as const, content: "next" }];
    for (const s of [stored, withNew]) {
      const out = buildTurnHistory({ stored: s, visitorMessageId: 4, client: [], message: "next" });
      expect(out.map((t) => t.content)).toEqual(["hi", "hello", "Jhade here", "next"]);
    }
  });

  it("without the store, uses the browser's visitor/AI history as-is", () => {
    const out = buildTurnHistory({
      stored: null,
      visitorMessageId: null,
      client: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "next" },
      ],
      message: "next",
    });
    expect(out).toEqual([
      { role: "visitor", content: "hi" },
      { role: "ai", content: "hello" },
      { role: "visitor", content: "next" },
    ]);
  });
});

describe("GEMINI_MODEL", () => {
  afterEach(() => vi.restoreAllMocks());

  it("defaults to the stable gemini-3.6-flash", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.6-flash");
    expect(geminiModel({})).toBe("gemini-3.6-flash");
    expect(geminiModel({ GEMINI_MODEL: "   " })).toBe("gemini-3.6-flash");
  });

  it("takes an override", () => {
    expect(geminiModel({ GEMINI_MODEL: "gemini-2.5-flash-lite" })).toBe("gemini-2.5-flash-lite");
    expect(geminiModel({ GEMINI_MODEL: " models/gemini-3.6-pro " })).toBe("models/gemini-3.6-pro");
  });

  it("ignores something that isn't a model id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(geminiModel({ GEMINI_MODEL: "gemini 3.6; drop table" })).toBe("gemini-3.6-flash");
    expect(geminiModel({ GEMINI_MODEL: "../../etc/passwd" })).toBe("gemini-3.6-flash");
    expect(warn).toHaveBeenCalled();
  });

  it("accepts a -preview id but warns about it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(geminiModel({ GEMINI_MODEL: "gemini-3.7-flash-preview" })).toBe("gemini-3.7-flash-preview");
    expect(warn.mock.calls.flat().join(" ")).toMatch(/preview/);
  });
});
