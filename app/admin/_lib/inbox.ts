import type { LeadKind } from "@/lib/supabase/types";

/**
 * Inbox threading.
 *
 * The chat route writes one `leads` row per exchange, each holding the whole
 * visible transcript so far (lib/leads.ts). A six-message conversation is
 * therefore three rows, every one a prefix of the next — listing them raw made
 * the inbox read like spam and inflated the unread count.
 *
 * There's no conversation id on the row, so snapshots are chained back
 * together: same visitor (`ip_hash`), same opening message, strictly fewer
 * turns, and written within WINDOW of the next snapshot. ONLY chat rows are
 * ever grouped: a contact submission or a job application is one person's
 * single message, each its own entry — two applications from the same office
 * network must never fold into one (or into a chat), or someone's application
 * disappears behind another's. Shared by the inbox page, the overview and the
 * nav badge so all three always agree on what counts as one conversation.
 *
 * `ip_hash` is a keyed HMAC of the visitor's IP (lib/security's `hashIp`) — the
 * raw address is never stored. It's deterministic, so it groups exactly as the
 * raw IP did, but it is an opaque grouping key: never render it, and never
 * label it as an address.
 */

const WINDOW_MS = 2 * 60 * 60 * 1000;

/** How each kind is named in the panel (pills, filters, the overview). */
export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  contact: "Enquiry",
  application: "Application",
  chat: "Chat",
};

/** The columns grouping needs — cheap enough to fetch for the nav badge. */
export const LEAD_LITE_COLUMNS =
  "id, kind, ip_hash, turns, handled, created_at, first:transcript->0->>content";

export type LeadLite = {
  id: string;
  kind: LeadKind;
  /** opaque visitor key for grouping only — not an address, never displayed */
  ip_hash: string | null;
  turns: number | null;
  handled: boolean;
  created_at: string;
  /** content of transcript[0]; null for contact rows */
  first: string | null;
};

export type LeadThread<T> = {
  /** newest row — the fullest version of a conversation */
  head: T;
  /** every row in the thread, newest first; actions apply to all of them */
  ids: string[];
  /** a thread is open while any of its rows is unhandled */
  handled: boolean;
};

/** `rows` must be sorted newest first. */
export function threadLeads<T extends LeadLite>(rows: T[]): LeadThread<T>[] {
  const threads: LeadThread<T>[] = [];
  // per conversation key: the thread and the oldest snapshot chained so far
  const tails = new Map<string, { thread: LeadThread<T>; turns: number; at: number }>();

  for (const row of rows) {
    // an allow-list, not a deny-list: a kind added later (like 'application'
    // was) stays one-row-per-entry until someone decides otherwise
    if (row.kind !== "chat" || !row.ip_hash) {
      threads.push({ head: row, ids: [row.id], handled: row.handled });
      continue;
    }

    const key = `${row.ip_hash}\u0000${row.first ?? ""}`;
    const turns = row.turns ?? 0;
    const at = Date.parse(row.created_at);
    const tail = tails.get(key);

    if (tail && turns < tail.turns && tail.at - at <= WINDOW_MS) {
      tail.thread.ids.push(row.id);
      tail.thread.handled = tail.thread.handled && row.handled;
      tail.turns = turns;
      tail.at = at;
      continue;
    }

    const thread: LeadThread<T> = { head: row, ids: [row.id], handled: row.handled };
    threads.push(thread);
    tails.set(key, { thread, turns, at });
  }

  return threads;
}
