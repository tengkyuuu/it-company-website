import { createHash, timingSafeEqual } from "node:crypto";
import { MAX_TURNS, VISITOR_KEY_RE, type HistoryTurn as ClientTurn } from "@/lib/chat-protocol";
import type { ChatMessageRole } from "@/lib/supabase/types";

/**
 * Server-side chat logic with no I/O: the visitor-key check and the mapping of
 * a stored conversation onto Gemini's `contents`. Plain module (node:crypto
 * only) so the tests exercise exactly what the routes run.
 */

// ---------------------------------------------------------------------------
// visitor key
// ---------------------------------------------------------------------------

/** What chat_sessions.visitor_key_hash stores: sha256 of the key, hex. */
export const hashVisitorKey = (key: string) => createHash("sha256").update(key).digest("hex");

/**
 * Does `key` belong to the session whose stored hash is `storedHash`?
 * Constant-time over the digests. A session with no stored hash matches
 * NOTHING — it can't be claimed by whoever asks first.
 */
export function visitorKeyMatches(storedHash: string | null | undefined, key: string): boolean {
  if (!storedHash || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  if (typeof key !== "string" || !VISITOR_KEY_RE.test(key)) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashVisitorKey(key), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// names
// ---------------------------------------------------------------------------

/**
 * A staff member's first name for the visitor's widget — the only thing about
 * them the public route ever returns. Never falls back to the email address.
 */
export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.slice(0, 40) : null;
}

// ---------------------------------------------------------------------------
// history → Gemini contents
// ---------------------------------------------------------------------------

export type StoredTurn = {
  id?: number;
  role: ChatMessageRole;
  content: string;
  /** first name, for role 'human' */
  author?: string | null;
};

export type GeminiTurn = { role: "user" | "model"; parts: { text: string }[] };

/**
 * How a team member's message is presented to the model. The words after the
 * name are referenced, verbatim, by a STATIC rule in lib/chat-context.ts — so
 * the system prompt stays byte-identical across requests (prompt caching)
 * while the model still knows which earlier replies it didn't write.
 */
export const HUMAN_MARKER_TAIL = "from the team, writing in person";
export const humanMarker = (name: string | null | undefined) =>
  `[${(name ?? "").trim() || "Someone"} ${HUMAN_MARKER_TAIL}]`;

/**
 * A conversation (oldest first) as Gemini `contents`:
 *   visitor → "user";  ai → "model";
 *   human   → "model", prefixed with humanMarker(name).
 * Why a model turn and not a user turn: the person spoke FOR the studio, to
 * the visitor — filing it under "user" would make the model read a staff
 * promise as something the visitor said. The marker (plus the static rule in
 * the system prompt) stops it taking credit for, or contradicting, the
 * person's words after a hand-back.
 *
 * Consecutive turns of the same role are merged into one (a visitor writing
 * twice while a person was on; a person replying twice), the newest
 * MAX_TURNS are kept, and leading model turns are dropped — Gemini expects a
 * conversation to open with the user.
 */
export function toGeminiContents(turns: readonly StoredTurn[], maxTurns = MAX_TURNS): GeminiTurn[] {
  const recent = turns.filter((t) => t.content.trim()).slice(-maxTurns);
  const out: GeminiTurn[] = [];
  for (const t of recent) {
    const role = t.role === "visitor" ? "user" : "model";
    const text = t.role === "human" ? `${humanMarker(t.author)} ${t.content}` : t.content;
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push({ text });
    else out.push({ role, parts: [{ text }] });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

/**
 * The conversation the model answers.
 *   - Stored history available (the session store answered): use it — it's
 *     authoritative and includes what a person said during a takeover. The
 *     message just written is dropped from it by id (the history read and the
 *     insert run in parallel, so it may or may not be in there) and appended
 *     once, last.
 *   - Otherwise (no session, or the database is down): the browser's own
 *     history, which only ever holds visitor and AI turns.
 */
export function buildTurnHistory(args: {
  stored: readonly StoredTurn[] | null;
  visitorMessageId: number | null;
  client: readonly ClientTurn[];
  message: string;
}): StoredTurn[] {
  if (args.stored) {
    const prior = args.stored.filter(
      (t) => args.visitorMessageId === null || t.id !== args.visitorMessageId
    );
    return [...prior, { role: "visitor", content: args.message }];
  }
  return args.client.map((m) => ({
    role: m.role === "assistant" ? "ai" : "visitor",
    content: m.content,
  }));
}
