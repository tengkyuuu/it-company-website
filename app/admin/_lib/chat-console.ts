import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { ChatMessageRole } from "@/lib/supabase/types";
import {
  CHAT_SESSION_COLUMNS,
  toConsoleSession,
  type ConsoleMessage,
  type ConsoleSession,
  type ConsoleSessionRow,
} from "./chats";
import { describeDbError, isMissingTable } from "./server";

/**
 * Reads for /admin/chats/[id] and its poll route (app/api/admin/chats). Both
 * go through the COOKIE client, so RLS decides — a disabled or revoked
 * account reads nothing, exactly as on every other panel page.
 */

type Db = Awaited<ReturnType<typeof createClient>>;

/** Display names for staff ids: full name, else email. Best-effort. */
export async function staffNames(db: Db, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", unique);
  for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    names.set(p.id, p.full_name || p.email || "A teammate");
  }
  return names;
}

type MessageRow = {
  id: number | string;
  role: ChatMessageRole;
  content: string;
  author_id: string | null;
  created_at: string;
};

export type ConsoleLoad =
  | { ok: true; session: ConsoleSession; row: ConsoleSessionRow; messages: ConsoleMessage[] }
  | { ok: false; error: string; gone: boolean; notSetUp: boolean };

/** How many messages the session view shows / one poll returns. */
const PAGE = 500;

/**
 * The session and its messages with id > `after` (all of them for 0; the
 * newest PAGE when there are more). Names resolved for staff authors and the
 * current taker.
 */
export async function loadConsole(db: Db, sessionId: string, after = 0): Promise<ConsoleLoad> {
  const [s, m] = await Promise.all([
    db.from("chat_sessions").select(CHAT_SESSION_COLUMNS).eq("id", sessionId).maybeSingle(),
    after > 0
      ? db
          .from("chat_messages")
          .select("id, role, content, author_id, created_at")
          .eq("session_id", sessionId)
          .gt("id", after)
          .order("id", { ascending: true })
          .limit(PAGE)
      : db
          .from("chat_messages")
          .select("id, role, content, author_id, created_at")
          .eq("session_id", sessionId)
          .order("id", { ascending: false })
          .limit(PAGE),
  ]);

  const error = s.error ?? m.error;
  if (error) {
    return { ok: false, error: describeDbError(error), gone: false, notSetUp: isMissingTable(error) };
  }
  if (!s.data) {
    return { ok: false, error: "This conversation doesn't exist any more.", gone: true, notSetUp: false };
  }

  const row = s.data as unknown as ConsoleSessionRow;
  const rows = (m.data ?? []) as MessageRow[];
  if (after <= 0) rows.reverse();

  const names = await staffNames(db, [row.taken_over_by, ...rows.map((r) => r.author_id)]);
  return {
    ok: true,
    row,
    session: toConsoleSession(row, names),
    messages: rows.map((r) => ({
      id: Number(r.id),
      role: r.role,
      content: r.content,
      author: r.role === "human" && r.author_id ? (names.get(r.author_id) ?? "A teammate") : null,
      authorId: r.author_id,
      at: r.created_at,
    })),
  };
}
