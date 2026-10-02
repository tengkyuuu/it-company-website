import { describe, expect, it } from "vitest";
import { threadLeads, type LeadLite } from "@/app/admin/_lib/inbox";

/**
 * The chat route writes one row per exchange, each a longer prefix of the same
 * conversation. threadLeads stitches them back together for the inbox page,
 * the overview and the nav badge — get it wrong and either a visitor's chat
 * shows up three times (inflated unread count) or two strangers' chats merge
 * into one (an admin replies to the wrong person).
 */

const T0 = Date.parse("2026-10-01T12:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();

let seq = 0;
function lead(over: Partial<LeadLite> & Pick<LeadLite, "kind">): LeadLite {
  seq += 1;
  return {
    id: `lead-${seq}`,
    ip_hash: "hash-a",
    turns: over.kind === "chat" ? 1 : null,
    handled: false,
    created_at: at(0),
    first: over.kind === "chat" ? "Hi, do you build mobile apps?" : null,
    ...over,
  };
}

const chat = (over: Partial<LeadLite> = {}) => lead({ kind: "chat", ...over });
const contact = (over: Partial<LeadLite> = {}) => lead({ kind: "contact", ...over });

/** newest first, as the contract requires */
const newestFirst = (rows: LeadLite[]) =>
  [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

describe("threadLeads", () => {
  it("groups one visitor's snapshots (same hash + opener, fewer turns, in window) into one thread", () => {
    const s1 = chat({ turns: 1, created_at: at(0) });
    const s2 = chat({ turns: 2, created_at: at(3) });
    const s3 = chat({ turns: 3, created_at: at(6) });
    const threads = threadLeads(newestFirst([s1, s2, s3]));

    expect(threads).toHaveLength(1);
    expect(threads[0].head.id).toBe(s3.id); // the fullest transcript
    expect(threads[0].ids).toEqual([s3.id, s2.id, s1.id]);
  });

  it("never merges contact submissions, even from the same visitor", () => {
    const rows = newestFirst([
      contact({ created_at: at(0) }),
      contact({ created_at: at(1) }),
      contact({ created_at: at(2) }),
    ]);
    const threads = threadLeads(rows);
    expect(threads).toHaveLength(3);
    for (const t of threads) expect(t.ids).toHaveLength(1);
  });

  it("never merges a contact row into a chat thread with the same hash", () => {
    const threads = threadLeads(
      newestFirst([chat({ turns: 2, created_at: at(5) }), contact({ created_at: at(4) })])
    );
    expect(threads).toHaveLength(2);
  });

  it("keeps different visitors apart even when they open with the same words", () => {
    const a1 = chat({ ip_hash: "hash-a", turns: 1, created_at: at(0) });
    const b1 = chat({ ip_hash: "hash-b", turns: 1, created_at: at(1) });
    const a2 = chat({ ip_hash: "hash-a", turns: 2, created_at: at(2) });
    const b2 = chat({ ip_hash: "hash-b", turns: 2, created_at: at(3) });
    const threads = threadLeads(newestFirst([a1, b1, a2, b2]));

    expect(threads).toHaveLength(2);
    const byHead = new Map(threads.map((t) => [t.head.id, t.ids]));
    expect(byHead.get(b2.id)).toEqual([b2.id, b1.id]);
    expect(byHead.get(a2.id)).toEqual([a2.id, a1.id]);
  });

  it("splits the same visitor's separate conversations (different opener)", () => {
    const threads = threadLeads(
      newestFirst([
        chat({ first: "What do you charge?", turns: 1, created_at: at(0) }),
        chat({ first: "Where are you based?", turns: 2, created_at: at(1) }),
      ])
    );
    expect(threads).toHaveLength(2);
  });

  it("splits snapshots further apart than the window", () => {
    const threads = threadLeads(
      newestFirst([chat({ turns: 1, created_at: at(0) }), chat({ turns: 2, created_at: at(3 * 60) })])
    );
    expect(threads).toHaveLength(2);
  });

  it("starts a new thread when the turn count doesn't strictly decrease (a restarted chat)", () => {
    const threads = threadLeads(
      newestFirst([chat({ turns: 1, created_at: at(0) }), chat({ turns: 1, created_at: at(2) })])
    );
    expect(threads).toHaveLength(2);
  });

  it("never groups chat rows with no visitor hash — they can't be attributed", () => {
    const threads = threadLeads(
      newestFirst([
        chat({ ip_hash: null, turns: 1, created_at: at(0) }),
        chat({ ip_hash: null, turns: 2, created_at: at(1) }),
      ])
    );
    expect(threads).toHaveLength(2);
  });

  it("a thread stays open while any of its rows is unhandled", () => {
    const open = threadLeads(
      newestFirst([
        chat({ turns: 1, created_at: at(0), handled: false }),
        chat({ turns: 2, created_at: at(1), handled: true }),
      ])
    );
    expect(open).toHaveLength(1);
    expect(open[0].handled).toBe(false);

    const done = threadLeads(
      newestFirst([
        chat({ ip_hash: "hash-z", turns: 1, created_at: at(0), handled: true }),
        chat({ ip_hash: "hash-z", turns: 2, created_at: at(1), handled: true }),
      ])
    );
    expect(done[0].handled).toBe(true);
  });

  it("never merges non-chat kinds (e.g. job applications)", () => {
    const application = (m: number) => lead({ kind: "application", created_at: at(m) });
    expect(threadLeads(newestFirst([application(0), application(1)]))).toHaveLength(2);
  });

  it("an application never joins a chat thread, nor breaks one, from the same visitor", () => {
    // same office network (same hash), even shaped like a chat snapshot — an
    // application must stay its own entry, and the chat must still thread
    const s1 = chat({ turns: 1, created_at: at(0) });
    const app = lead({
      kind: "application",
      turns: 0,
      first: "Hi, do you build mobile apps?",
      created_at: at(1),
    });
    const s2 = chat({ turns: 2, created_at: at(2) });
    const threads = threadLeads(newestFirst([s1, app, s2]));

    expect(threads).toHaveLength(2);
    const byHead = new Map(threads.map((t) => [t.head.id, t.ids]));
    expect(byHead.get(s2.id)).toEqual([s2.id, s1.id]);
    expect(byHead.get(app.id)).toEqual([app.id]);
  });
});
