import type { ChatMessageRole, ChatMode, ChatSessionRow } from "@/lib/supabase/types";

/**
 * Live-chat console logic with no I/O — shared by /admin/chats, its session
 * view, the nav badge and the tests, so all of them agree on what "waiting",
 * "unread" and "needs attention" mean.
 *
 *   waiting          the visitor pressed "Talk to a person" and nobody has
 *                    taken the chat over yet (mode still 'ai')
 *   unread           a VISITOR message newer than admin_read_at
 *   needs attention  waiting, or taken over with an unread visitor message —
 *                    what the nav badge counts. An AI-only chat being unread
 *                    is not urgent (the assistant answered), so it doesn't
 *                    light the badge; it's still marked unread in the list.
 */

/** Columns the console reads — never visitor_key_hash. Checked against the schema in tests. */
export const CHAT_SESSION_COLUMNS =
  "id, mode, taken_over_by, taken_over_at, admin_read_at, wants_human_at, last_visitor_at, last_message_at, created_at, opening, last_preview, last_role, message_count";

/** PostgREST `or` filter for the (small) set that can need attention. */
export const ATTENTION_FILTER = "mode.eq.human,wants_human_at.not.is.null";

export type ConsoleSessionRow = Pick<
  ChatSessionRow,
  "id" | "mode" | "taken_over_by" | "admin_read_at" | "created_at" | "last_message_at"
> &
  Partial<
    Pick<
      ChatSessionRow,
      | "taken_over_at"
      | "wants_human_at"
      | "last_visitor_at"
      | "opening"
      | "last_preview"
      | "last_role"
      | "message_count"
    >
  >;

type AttentionFields = Pick<ConsoleSessionRow, "mode" | "admin_read_at"> &
  Partial<Pick<ConsoleSessionRow, "wants_human_at" | "last_visitor_at">>;

const ts = (iso: string | null | undefined) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(n) ? null : n;
};

export function isUnread(s: AttentionFields): boolean {
  const visitor = ts(s.last_visitor_at);
  if (visitor === null) return false;
  const read = ts(s.admin_read_at);
  return read === null || visitor > read;
}

export const isWaiting = (s: AttentionFields) => s.mode === "ai" && Boolean(s.wants_human_at);

export const needsAttention = (s: AttentionFields) =>
  isWaiting(s) || (s.mode === "human" && isUnread(s));

export type ChatStatus = "waiting" | "human" | "ai";

export const chatStatus = (s: AttentionFields): ChatStatus =>
  isWaiting(s) ? "waiting" : s.mode === "human" ? "human" : "ai";

/** Waiting for a person first, then everything by newest message. Stable, non-mutating. */
export function sortSessions<T extends ConsoleSessionRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const wa = isWaiting(a) ? 1 : 0;
    const wb = isWaiting(b) ? 1 : 0;
    if (wa !== wb) return wb - wa;
    return (ts(b.last_message_at) ?? 0) - (ts(a.last_message_at) ?? 0);
  });
}

/** Merge two fetches (recent + attention set) by id, keeping the first seen. */
export function mergeById<T extends { id: string }>(...lists: readonly (readonly T[])[]): T[] {
  const seen = new Map<string, T>();
  for (const list of lists) for (const r of list) if (!seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// the session view's wire shape (page → ChatConsole, and the poll route)
// ---------------------------------------------------------------------------

export type ConsoleMessage = {
  id: number;
  role: ChatMessageRole;
  content: string;
  /** staff display name for role 'human' */
  author: string | null;
  authorId: string | null;
  at: string;
};

export type ConsoleSession = {
  id: string;
  mode: ChatMode;
  status: ChatStatus;
  wantsHumanAt: string | null;
  takenOverBy: string | null;
  takenOverByName: string | null;
  takenOverAt: string | null;
  adminReadAt: string | null;
  lastVisitorAt: string | null;
  createdAt: string;
};

export type ConsolePoll =
  | { ok: true; session: ConsoleSession; messages: ConsoleMessage[] }
  | { ok: false; error: string; gone?: boolean };

export function toConsoleSession(
  row: ConsoleSessionRow,
  names: ReadonlyMap<string, string>
): ConsoleSession {
  return {
    id: row.id,
    mode: row.mode === "human" ? "human" : "ai",
    status: chatStatus(row),
    wantsHumanAt: row.wants_human_at ?? null,
    takenOverBy: row.taken_over_by,
    takenOverByName: row.taken_over_by ? (names.get(row.taken_over_by) ?? null) : null,
    takenOverAt: row.taken_over_at ?? null,
    adminReadAt: row.admin_read_at,
    lastVisitorAt: row.last_visitor_at ?? null,
    createdAt: row.created_at,
  };
}

/** Console poll cadence: 4 s → 8 s → 15 s as polls come back empty. */
export const CONSOLE_POLL_MS = [4_000, 8_000, 15_000] as const;

export function consolePollDelay(idle: number, visible: boolean): number | null {
  if (!visible) return null;
  return CONSOLE_POLL_MS[idle < 3 ? 0 : idle < 6 ? 1 : 2];
}

/** How a chat is named in the activity feed — no visitor words in the audit log. */
export const chatLabel = (sessionId: string) => `#${sessionId.slice(0, 8)}`;

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * "Oct 3, 10:02 AM" in Philippine time. Fixed locale + zone, so the server
 * render and the browser agree (no hydration mismatch) wherever staff are.
 */
export function formatChatTime(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? TIME_FMT.format(d) : "";
}
