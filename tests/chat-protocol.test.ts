import { describe, expect, it } from "vitest";
import {
  IDLE_STEP,
  MAX_HISTORY_CHARS,
  MAX_TURNS,
  POLL_ENGAGED_MS,
  POLL_WATCH_MS,
  WATCH_AFTER_SEND_MS,
  clientHistory,
  isSessionCredentials,
  mergePolled,
  nextIdle,
  nextPollDelay,
  splitNdjson,
  type PollInputs,
  type WireMessage,
} from "@/lib/chat-protocol";

/**
 * The widget's side of live chat: when it polls (the performance rule —
 * nothing runs while nobody's looking), what it sends, and how a poll folds
 * into what's on screen. A wrong answer here is silent: either a person's
 * reply never shows up, or an idle tab hammers the server forever.
 */

const NOW = 1_800_000_000_000;
const base: PollInputs = {
  enabled: true,
  open: true,
  visible: true,
  mode: "ai",
  wantsHuman: false,
  lastVisitorAt: null,
  idle: 0,
  now: NOW,
};

describe("nextPollDelay", () => {
  it("never polls while closed, hidden, or before the conversation is stored", () => {
    for (const mode of ["ai", "human"] as const) {
      expect(nextPollDelay({ ...base, mode, wantsHuman: true, open: false })).toBeNull();
      expect(nextPollDelay({ ...base, mode, wantsHuman: true, visible: false })).toBeNull();
      expect(nextPollDelay({ ...base, mode, wantsHuman: true, enabled: false })).toBeNull();
    }
  });

  it("AI mode with nothing going on: no timer at all", () => {
    expect(nextPollDelay(base)).toBeNull();
  });

  it("AI mode watches for a few minutes after the visitor's last message, then stops", () => {
    expect(nextPollDelay({ ...base, lastVisitorAt: NOW - 1000 })).toBe(POLL_WATCH_MS[0]);
    expect(nextPollDelay({ ...base, lastVisitorAt: NOW - WATCH_AFTER_SEND_MS + 1 })).not.toBeNull();
    expect(nextPollDelay({ ...base, lastVisitorAt: NOW - WATCH_AFTER_SEND_MS })).toBeNull();
    // and backs off while empty
    expect(nextPollDelay({ ...base, lastVisitorAt: NOW - 1000, idle: IDLE_STEP })).toBe(POLL_WATCH_MS[1]);
    expect(nextPollDelay({ ...base, lastVisitorAt: NOW - 1000, idle: 50 })).toBe(POLL_WATCH_MS[1]);
  });

  it("a person on (or asked for): 4 s → 8 s → 15 s as polls come back empty, with no time limit", () => {
    for (const s of [{ mode: "human" as const }, { wantsHuman: true }]) {
      expect(nextPollDelay({ ...base, ...s, idle: 0 })).toBe(POLL_ENGAGED_MS[0]);
      expect(nextPollDelay({ ...base, ...s, idle: IDLE_STEP - 1 })).toBe(4_000);
      expect(nextPollDelay({ ...base, ...s, idle: IDLE_STEP })).toBe(8_000);
      expect(nextPollDelay({ ...base, ...s, idle: IDLE_STEP * 2 })).toBe(15_000);
      expect(nextPollDelay({ ...base, ...s, idle: 10_000 })).toBe(15_000);
    }
  });

  it("anything new resets the backoff; nothing new steps it (bounded)", () => {
    expect(nextIdle(7, true)).toBe(0);
    expect(nextIdle(0, false)).toBe(1);
    expect(nextIdle(1000, false)).toBe(1000);
  });
});

describe("session credentials", () => {
  const ok = { id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", key: "A".repeat(43) };

  it("accepts a uuid + base64url key", () => {
    expect(isSessionCredentials(ok)).toBe(true);
    expect(isSessionCredentials({ ...ok, key: "abc_DEF-123".padEnd(43, "x") })).toBe(true);
  });

  it("rejects anything else (short / odd keys, non-uuid ids, junk)", () => {
    expect(isSessionCredentials(null)).toBe(false);
    expect(isSessionCredentials({ id: ok.id })).toBe(false);
    expect(isSessionCredentials({ ...ok, key: "short" })).toBe(false);
    expect(isSessionCredentials({ ...ok, key: "x".repeat(43) + "=" })).toBe(false);
    expect(isSessionCredentials({ ...ok, key: "x".repeat(129) })).toBe(false);
    expect(isSessionCredentials({ ...ok, id: "not-a-uuid" })).toBe(false);
    expect(isSessionCredentials({ ...ok, id: 42 })).toBe(false);
  });
});

describe("clientHistory (the POST body's fallback history)", () => {
  it("sends visitor and AI turns only — never a team member's reply or a divider", () => {
    const out = clientHistory([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "human", content: "Jhade here, 50% off!" },
      { role: "note", content: "" },
      { role: "user", content: "ok" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "ok" },
    ]);
  });

  it("keeps the newest MAX_TURNS and starts on a visitor turn", () => {
    const turns = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `m${i}`,
    }));
    const out = clientHistory(turns);
    expect(out.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(out[0].role).toBe("user");
    expect(out[out.length - 1].content).toBe("m39");
  });

  it("clips long AI answers instead of letting the server 400 the whole chat", () => {
    const out = clientHistory([
      { role: "user", content: "q" },
      { role: "assistant", content: "x".repeat(MAX_HISTORY_CHARS + 500) },
      { role: "user", content: "again" },
    ]);
    expect(out[1].content.length).toBe(MAX_HISTORY_CHARS);
  });

  it("drops empty turns (the streaming placeholder)", () => {
    expect(clientHistory([{ role: "user", content: "a" }, { role: "assistant", content: "  " }])).toEqual([
      { role: "user", content: "a" },
    ]);
  });
});

describe("mergePolled", () => {
  const msg = (id: number, role: WireMessage["role"]): WireMessage => ({
    id,
    role,
    content: `#${id}`,
    author: role === "human" ? "Jhade" : null,
    at: "2026-10-03T00:00:00Z",
  });

  it("appends only a person's messages — the widget already shows its own visitor/AI turns", () => {
    const { append, cursor } = mergePolled(new Set(), [msg(5, "visitor"), msg(6, "ai"), msg(7, "human")], {
      hydrate: false,
      cursor: 4,
    });
    expect(append.map((m) => m.id)).toEqual([7]);
    expect(cursor).toBe(7);
  });

  it("never appends the same message twice", () => {
    const { append } = mergePolled(new Set([7]), [msg(7, "human"), msg(8, "human")], {
      hydrate: false,
      cursor: 0,
    });
    expect(append.map((m) => m.id)).toEqual([8]);
  });

  it("hydrate (after a reload) rebuilds everything", () => {
    const { append } = mergePolled(new Set(), [msg(1, "visitor"), msg(2, "ai"), msg(3, "human")], {
      hydrate: true,
      cursor: 0,
    });
    expect(append.map((m) => m.role)).toEqual(["visitor", "ai", "human"]);
  });

  it("the cursor never moves backwards, and ignores junk ids", () => {
    const { cursor } = mergePolled(new Set(), [{ ...msg(3, "human") }, { ...msg(2, "ai"), id: NaN }], {
      hydrate: false,
      cursor: 10,
    });
    expect(cursor).toBe(10);
  });
});

describe("splitNdjson", () => {
  it("returns whole lines' events and carries the partial last line", () => {
    const { events, rest } = splitNdjson('{"t":"Hel"}\n{"t":"lo"}\n{"do');
    expect(events).toEqual([{ t: "Hel" }, { t: "lo" }]);
    expect(rest).toBe('{"do');
    expect(splitNdjson(rest + 'ne":true}\n').events).toEqual([{ done: true }]);
  });

  it("skips torn / non-JSON lines rather than failing the reply", () => {
    expect(splitNdjson('garbage\n\n{"session":{"mode":"human","stored":true,"visitorMessageId":3}}\n').events).toEqual([
      { session: { mode: "human", stored: true, visitorMessageId: 3 } },
    ]);
  });
});
