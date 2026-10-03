import { describe, expect, it } from "vitest";
import {
  CHAT_SESSION_COLUMNS,
  chatLabel,
  chatStatus,
  consolePollDelay,
  formatChatTime,
  isUnread,
  isWaiting,
  mergeById,
  needsAttention,
  sortSessions,
  toConsoleSession,
  type ConsoleSessionRow,
} from "@/app/admin/_lib/chats";
import {
  NOISY_ACTION_PREFIXES,
  activityHref,
  describeActivity,
  sentenceText,
} from "@/app/admin/_lib/history-logic";

/**
 * /admin/chats: what counts as waiting / unread / needing a person (the list
 * order and the nav badge both hang on it), and how takeovers read in the
 * activity feed.
 */

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const row = (over: Partial<ConsoleSessionRow> = {}): ConsoleSessionRow => ({
  id: ID,
  mode: "ai",
  taken_over_by: null,
  admin_read_at: null,
  created_at: "2026-10-03T01:00:00Z",
  last_message_at: "2026-10-03T01:05:00Z",
  wants_human_at: null,
  last_visitor_at: "2026-10-03T01:04:00Z",
  ...over,
});

describe("unread / waiting / needs attention", () => {
  it("unread = a visitor message newer than the last read", () => {
    expect(isUnread(row())).toBe(true);
    expect(isUnread(row({ admin_read_at: "2026-10-03T01:04:30Z" }))).toBe(false);
    expect(isUnread(row({ admin_read_at: "2026-10-03T01:03:00Z" }))).toBe(true);
    // a staff or AI message moving last_message_at doesn't make it unread
    expect(isUnread(row({ admin_read_at: "2026-10-03T01:04:30Z", last_message_at: "2026-10-03T02:00:00Z" }))).toBe(false);
    expect(isUnread(row({ last_visitor_at: null }))).toBe(false);
  });

  it("waiting = asked for a person, nobody took it", () => {
    expect(isWaiting(row({ wants_human_at: "2026-10-03T01:04:10Z" }))).toBe(true);
    expect(isWaiting(row({ wants_human_at: "2026-10-03T01:04:10Z", mode: "human" }))).toBe(false);
    expect(isWaiting(row())).toBe(false);
  });

  it("the badge: waiting, or taken over with an unread visitor message — not an AI-only chat", () => {
    expect(needsAttention(row())).toBe(false); // unread, but the assistant answered
    expect(needsAttention(row({ wants_human_at: "2026-10-03T01:04:10Z" }))).toBe(true);
    expect(needsAttention(row({ mode: "human" }))).toBe(true);
    expect(needsAttention(row({ mode: "human", admin_read_at: "2026-10-03T01:10:00Z" }))).toBe(false);
  });

  it("status pill", () => {
    expect(chatStatus(row())).toBe("ai");
    expect(chatStatus(row({ mode: "human" }))).toBe("human");
    expect(chatStatus(row({ wants_human_at: "2026-10-03T01:04:10Z" }))).toBe("waiting");
  });
});

describe("list order", () => {
  it("waiting first, then newest message first; doesn't mutate", () => {
    const a = row({ id: "a", last_message_at: "2026-10-03T03:00:00Z" });
    const b = row({ id: "b", last_message_at: "2026-10-03T01:00:00Z", wants_human_at: "2026-10-03T01:00:00Z" });
    const c = row({ id: "c", last_message_at: "2026-10-03T02:00:00Z", mode: "human" });
    const input = [a, b, c];
    expect(sortSessions(input).map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(input.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("merging the recent and attention queries keeps one copy of each", () => {
    expect(mergeById([{ id: "x" }, { id: "y" }], [{ id: "y" }, { id: "z" }]).map((r) => r.id)).toEqual([
      "x",
      "y",
      "z",
    ]);
  });
});

describe("console wire shape", () => {
  it("never selects the visitor key hash", () => {
    expect(CHAT_SESSION_COLUMNS).not.toMatch(/visitor_key_hash/);
  });

  it("names the taker", () => {
    const s = toConsoleSession(row({ mode: "human", taken_over_by: "u1" }), new Map([["u1", "Jhade Banquiao"]]));
    expect(s).toMatchObject({ mode: "human", status: "human", takenOverByName: "Jhade Banquiao" });
  });

  it("polls only while visible, backing off 4 → 8 → 15 s", () => {
    expect(consolePollDelay(0, false)).toBeNull();
    expect(consolePollDelay(0, true)).toBe(4_000);
    expect(consolePollDelay(3, true)).toBe(8_000);
    expect(consolePollDelay(99, true)).toBe(15_000);
  });

  it("formats in Philippine time regardless of the machine's zone", () => {
    expect(formatChatTime("2026-10-03T01:05:00Z")).toBe("Oct 3, 9:05 AM");
    expect(formatChatTime(null)).toBe("");
    expect(formatChatTime("nope")).toBe("");
  });
});

describe("activity feed", () => {
  const base = {
    id: 1,
    actor_id: "u1",
    actor_name: "Jhade",
    entity_type: "chat_session",
    entity_id: ID,
    created_at: "2026-10-03T02:00:00Z",
  };
  const fmt = () => "Oct 3, 9:00 AM";

  it("a takeover names the chat by its short id and when it started — no visitor words", () => {
    const s = describeActivity(
      { ...base, action: "chat.takeover", detail: { label: chatLabel(ID), started_at: "2026-10-03T01:00:00Z" } },
      { formatTime: fmt }
    );
    expect(sentenceText(s)).toBe("Jhade took over the chat “#6f1c2a3b” (started Oct 3, 9:00 AM)");
  });

  it("taking over from a colleague says so", () => {
    const s = describeActivity(
      { ...base, action: "chat.takeover", detail: { label: chatLabel(ID), from: "Haron" } },
      { formatTime: fmt }
    );
    expect(sentenceText(s)).toBe("Jhade took over the chat “#6f1c2a3b” from Haron");
  });

  it("hand-back and dismiss read differently", () => {
    const back = describeActivity({ ...base, action: "chat.handback", detail: { label: "#6f1c2a3b" } });
    expect(sentenceText(back)).toBe("Jhade handed the chat “#6f1c2a3b” back to the assistant");
    const dismissed = describeActivity({
      ...base,
      action: "chat.handback",
      detail: { label: "#6f1c2a3b", dismissed: true },
    });
    expect(sentenceText(dismissed)).toBe("Jhade dismissed the request for a person in the chat “#6f1c2a3b”");
  });

  it("links to the conversation; inbox replies link to the inbox", () => {
    expect(activityHref({ action: "chat.takeover", entity_type: "chat_session", entity_id: ID }, () => false)).toBe(
      `/admin/chats/${ID}`
    );
    expect(activityHref({ action: "inbox.reply", entity_type: "lead", entity_id: ID }, () => false)).toBe(
      "/admin/inbox"
    );
  });

  it("takeover / hand-back are not filtered as per-message noise", () => {
    for (const a of ["chat.takeover", "chat.handback"]) {
      expect(NOISY_ACTION_PREFIXES.some((p) => a.startsWith(p))).toBe(false);
    }
  });
});
