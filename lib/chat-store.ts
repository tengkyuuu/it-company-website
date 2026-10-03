import "server-only";

import type { ChatMode, SessionCredentials, WireMessage } from "@/lib/chat-protocol";
import { firstName, hashVisitorKey, visitorKeyMatches, type StoredTurn } from "@/lib/chat-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessageRole } from "@/lib/supabase/types";

/**
 * Persistence for the live chat (chat_sessions / chat_messages), used by the
 * PUBLIC routes under app/api/chat/. The panel reads and writes the same
 * tables through the cookie client instead, so RLS applies to staff.
 *
 * SERVICE ROLE on purpose: neither table has an anon policy, so a leaked anon
 * key can't read anyone's conversation or post into one. The visitor proves
 * they own a session with its key (see lib/chat-protocol.ts); only the key's
 * sha256 is stored.
 *
 * Everything here is NON-THROWING and fast to give up, same posture as
 * lib/leads.ts: the bot's job is to answer, and a paused or unreachable
 * database must never stop it. Every call has a hard timeout and no retries
 * (postgrest-js retries GETs 1s/2s/4s by default), and after a failure a
 * 15-second per-instance circuit breaker skips the database entirely — so an
 * outage costs one timeout, not one per message. "unavailable" makes the
 * chat route fall back to the old behaviour (client-held history, the
 * transcript saved to `leads`).
 */

const TIMEOUT_MS = 2500;
const BREAKER_MS = 15_000;
let downUntil = 0;
let lastWarn = 0;

export const chatStoreConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function failed(where: string, detail: unknown) {
  const now = Date.now();
  downUntil = now + BREAKER_MS;
  if (now - lastWarn < 60_000) return;
  lastWarn = now;
  const msg =
    detail && typeof detail === "object" && "message" in detail
      ? String((detail as { message: unknown }).message)
      : String(detail);
  console.warn(`[chat-store] ${where} failed (${msg}) — chat continues without the store for a bit.`);
}

function db() {
  if (!chatStoreConfigured() || Date.now() < downUntil) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

const signal = () => AbortSignal.timeout(TIMEOUT_MS);

export type OpenResult =
  | { state: "ok"; mode: ChatMode; wantsHuman: boolean; created: boolean }
  /** the session exists and the key doesn't match it */
  | { state: "forbidden" }
  /** no such session (and `create` was false) */
  | { state: "missing" }
  /** no store, or it failed — carry on without it */
  | { state: "unavailable" };

type SessionLookup = {
  mode: string;
  wants_human_at: string | null;
  visitor_key_hash: string | null;
};

/**
 * Find the visitor's session and check their key; with `create`, start it
 * if it doesn't exist yet (the first message of a conversation).
 *
 * Insert-then-reread rather than upsert: an upsert would overwrite `mode` (and
 * silently hand a taken-over chat back to the AI) or the key hash (letting
 * whoever guessed an id claim the conversation). A lost insert race — the
 * same visitor double-sending — lands on 23505 and simply re-reads.
 */
export async function openChatSession(
  creds: SessionCredentials,
  opts: { create: boolean; ipHash?: string | null }
): Promise<OpenResult> {
  const supabase = db();
  if (!supabase) return { state: "unavailable" };

  const read = () =>
    supabase
      .from("chat_sessions")
      .select("mode, wants_human_at, visitor_key_hash")
      .eq("id", creds.id)
      .abortSignal(signal())
      .retry(false)
      .maybeSingle();

  const verdict = (row: SessionLookup, created: boolean): OpenResult =>
    visitorKeyMatches(row.visitor_key_hash, creds.key)
      ? {
          state: "ok",
          mode: row.mode === "human" ? "human" : "ai",
          wantsHuman: Boolean(row.wants_human_at),
          created,
        }
      : { state: "forbidden" };

  try {
    const first = await read();
    if (first.error) {
      failed("session read", first.error);
      return { state: "unavailable" };
    }
    if (first.data) return verdict(first.data as SessionLookup, false);
    if (!opts.create) return { state: "missing" };

    const ins = await supabase
      .from("chat_sessions")
      .insert({
        id: creds.id,
        visitor_key_hash: hashVisitorKey(creds.key),
        ip_hash: opts.ipHash ?? null,
      })
      .abortSignal(signal());
    if (!ins.error) return { state: "ok", mode: "ai", wantsHuman: false, created: true };

    if (ins.error.code === "23505") {
      const again = await read();
      if (!again.error && again.data) return verdict(again.data as SessionLookup, false);
    }
    failed("session create", ins.error);
    return { state: "unavailable" };
  } catch (e) {
    failed("session", e);
    return { state: "unavailable" };
  }
}

/** Store a visitor or AI message. Returns its id, or null if it wasn't stored. */
export async function addChatMessage(
  sessionId: string,
  role: Extract<ChatMessageRole, "visitor" | "ai">,
  content: string
): Promise<number | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role, content: content.slice(0, 8000) })
      .select("id")
      .abortSignal(signal())
      .single();
    if (error || !data) {
      if (error) failed("message insert", error);
      return null;
    }
    const id = Number((data as { id: unknown }).id);
    return Number.isSafeInteger(id) ? id : null;
  } catch (e) {
    failed("message insert", e);
    return null;
  }
}

type MessageRow = {
  id: number | string;
  role: ChatMessageRole;
  content: string;
  author_id: string | null;
  created_at: string;
};

/** First names for staff authors — never an email. Best-effort. */
async function authorNames(
  supabase: ReturnType<typeof createAdminClient>,
  rows: MessageRow[]
): Promise<Map<string, string | null>> {
  const ids = [...new Set(rows.filter((r) => r.role === "human" && r.author_id).map((r) => r.author_id!))];
  const names = new Map<string, string | null>();
  if (!ids.length) return names;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids)
    .abortSignal(signal())
    .retry(false);
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    names.set(p.id, firstName(p.full_name));
  }
  return names;
}

/** The newest `limit` messages, oldest first — what the model sees. Null = unavailable. */
export async function chatHistory(sessionId: string, limit: number): Promise<StoredTurn[] | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, author_id, created_at")
      .eq("session_id", sessionId)
      .order("id", { ascending: false })
      .limit(limit)
      .abortSignal(signal())
      .retry(false);
    if (error) {
      failed("history read", error);
      return null;
    }
    const rows = ((data ?? []) as MessageRow[]).reverse();
    const names = await authorNames(supabase, rows).catch(() => new Map<string, string | null>());
    return rows.map((r) => ({
      id: Number(r.id),
      role: r.role,
      content: r.content,
      author: r.author_id ? (names.get(r.author_id) ?? null) : null,
    }));
  } catch (e) {
    failed("history read", e);
    return null;
  }
}

export type ReadResult =
  | { state: "ok"; mode: ChatMode; wantsHuman: boolean; messages: WireMessage[] }
  | { state: "forbidden" }
  | { state: "missing" }
  | { state: "unavailable" };

/** The visitor's poll: messages after `after` (max `limit`), with the session's mode. */
export async function readChatSession(
  creds: SessionCredentials,
  after: number,
  limit = 50
): Promise<ReadResult> {
  const opened = await openChatSession(creds, { create: false });
  if (opened.state !== "ok") return opened;

  const supabase = db();
  if (!supabase) return { state: "unavailable" };
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, author_id, created_at")
      .eq("session_id", creds.id)
      .gt("id", after)
      .order("id", { ascending: true })
      .limit(limit)
      .abortSignal(signal())
      .retry(false);
    if (error) {
      failed("poll read", error);
      return { state: "unavailable" };
    }
    const rows = (data ?? []) as MessageRow[];
    const names = await authorNames(supabase, rows).catch(() => new Map<string, string | null>());
    return {
      state: "ok",
      mode: opened.mode,
      wantsHuman: opened.wantsHuman,
      messages: rows.map((r) => ({
        id: Number(r.id),
        role: r.role,
        content: r.content,
        author: r.role === "human" && r.author_id ? (names.get(r.author_id) ?? null) : null,
        at: r.created_at,
      })),
    };
  } catch (e) {
    failed("poll read", e);
    return { state: "unavailable" };
  }
}

/**
 * "Talk to a person": stamp wants_human_at (first request wins — pressing it
 * again doesn't jump the queue). Creates the session if the visitor somehow
 * hasn't got one stored yet. Returns the session's mode, or why not.
 */
export async function requestHuman(
  creds: SessionCredentials,
  ipHash: string | null
): Promise<OpenResult> {
  const opened = await openChatSession(creds, { create: true, ipHash });
  if (opened.state !== "ok") return opened;
  if (opened.mode === "human" || opened.wantsHuman) return { ...opened, wantsHuman: true };

  const supabase = db();
  if (!supabase) return { state: "unavailable" };
  try {
    const { error } = await supabase
      .from("chat_sessions")
      .update({ wants_human_at: new Date().toISOString() })
      .eq("id", creds.id)
      .is("wants_human_at", null)
      .abortSignal(signal());
    if (error) {
      failed("wants-human", error);
      return { state: "unavailable" };
    }
    return { ...opened, wantsHuman: true };
  } catch (e) {
    failed("wants-human", e);
    return { state: "unavailable" };
  }
}
