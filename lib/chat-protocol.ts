/**
 * The site chat's wire contract and the widget's polling rules — shared by the
 * browser (components/chat/ChatWidget.tsx) and the routes under app/api/chat/.
 *
 * Plain module on purpose: no "use client", no "server-only", no Node imports,
 * so both sides (and the tests) import the same constants and decisions.
 *
 * ── Session model ───────────────────────────────────────────────────────────
 * The widget mints TWO random values per browser tab and keeps them in
 * sessionStorage: a session id (a UUID — it names the conversation) and a
 * separate visitor key (256 bits — it proves you are that conversation's
 * visitor). The server stores only sha256(key) and requires the key on every
 * request for the session, so a session id that turns up in a log, a URL or a
 * screenshot is useless on its own: it can't read the transcript or post into
 * it.
 *
 * ── POST /api/chat (NDJSON, one object per line) ────────────────────────────
 *   {"session":{mode,stored,visitorMessageId}}   first, when a session was sent
 *   {"t":"…"}                                    an AI text delta
 *   {"error":"…"}                                a failure (can arrive mid-stream)
 *   {"done":true,"messageId"?:n}                 finished
 * In `human` mode (a person has taken the chat over) the server stores the
 * message, does NOT call the model, and answers with just the session line and
 * done — the widget then shows the message as delivered to the team.
 *
 * ── GET /api/chat/messages?session=…&after=n  (header x-chat-key) ──────────
 *   200 {mode, wantsHuman, messages: WireMessage[]}   messages with id > after
 *   403 wrong key · 404 no such session · 429 slow down · 503 store down
 *
 * ── POST /api/chat/human  {session:{id,key}} ────────────────────────────────
 *   200 {ok:true, mode, wantsHuman:true} — flags the chat for the console
 */

export type ChatMode = "ai" | "human";
export type WireRole = "visitor" | "ai" | "human";

/** The newest visitor message may be this long… */
export const MAX_CHARS = 2000;
/** …but earlier turns (an AI answer can run ~4k chars) get more room. */
export const MAX_HISTORY_CHARS = 8000;
/** Turns the widget sends / the model sees. */
export const MAX_TURNS = 24;
/** A staff reply in the console. */
export const MAX_REPLY_CHARS = 2000;

/** The request header that carries the visitor key on GETs. */
export const VISITOR_KEY_HEADER = "x-chat-key";
/** sessionStorage key — the `mykt-` prefix is a technical id, not the brand. */
export const SESSION_STORAGE_KEY = "mykt-chat-session";

export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** base64url, 32–128 chars (the widget mints 43: 32 random bytes). */
export const VISITOR_KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;

export type SessionCredentials = { id: string; key: string };

export function isSessionCredentials(v: unknown): v is SessionCredentials {
  if (!v || typeof v !== "object") return false;
  const { id, key } = v as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof key === "string" &&
    SESSION_ID_RE.test(id) &&
    VISITOR_KEY_RE.test(key)
  );
}

/** One stored message as the visitor's poll returns it. */
export type WireMessage = {
  id: number;
  role: WireRole;
  content: string;
  /** a staff member's FIRST name, for role 'human'; null otherwise (never an email) */
  author: string | null;
  at: string;
};

export type PollResponse = {
  mode: ChatMode;
  wantsHuman: boolean;
  messages: WireMessage[];
};

/** One NDJSON line from POST /api/chat. */
export type ChatEvent = {
  t?: string;
  error?: string;
  done?: boolean;
  /** id of the stored AI answer, on `done` */
  messageId?: number | null;
  session?: { mode: ChatMode; stored: boolean; visitorMessageId: number | null };
};

/**
 * NDJSON framing: append a decoded chunk to the carry-over buffer, return the
 * complete lines' events and the partial last line to carry forward. A torn or
 * non-JSON line is skipped rather than failing the whole reply.
 */
export function splitNdjson(buffer: string): { events: ChatEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    try {
      const evt = JSON.parse(raw);
      if (evt && typeof evt === "object") events.push(evt as ChatEvent);
    } catch {
      // skip
    }
  }
  return { events, rest };
}

// ---------------------------------------------------------------------------
// what the widget sends
// ---------------------------------------------------------------------------

export type HistoryTurn = { role: "user" | "assistant"; content: string };

/**
 * The visible conversation as the POST body's `messages`: visitor and AI
 * turns only (a team member's replies are NOT sent — the server reads those
 * from the database, where they can't be forged), clipped, the newest
 * MAX_TURNS, and starting on a visitor turn (the model expects that).
 */
export function clientHistory(
  turns: readonly { role: string; content: string }[],
  max = MAX_TURNS
): HistoryTurn[] {
  let out: HistoryTurn[] = turns
    .filter((t) => (t.role === "user" || t.role === "assistant") && t.content.trim())
    .map((t) => ({
      role: t.role as HistoryTurn["role"],
      content: t.content.trim().slice(0, MAX_HISTORY_CHARS),
    }))
    .slice(-max);
  while (out.length && out[0].role !== "user") out = out.slice(1);
  return out;
}

// ---------------------------------------------------------------------------
// polling — "nothing may run while the visitor is doing nothing"
// ---------------------------------------------------------------------------

/** Engaged cadence (a person is on, or was asked for): 4 s → 8 s → 15 s as polls come back empty. */
export const POLL_ENGAGED_MS = [4_000, 8_000, 15_000] as const;
/** AI mode, shortly after the visitor wrote: a takeover is plausible but rare. */
export const POLL_WATCH_MS = [10_000, 20_000] as const;
/** How long after the visitor's last message an AI-mode chat keeps watching. */
export const WATCH_AFTER_SEND_MS = 3 * 60_000;
/** Empty polls before each backoff step. */
export const IDLE_STEP = 3;

export type PollInputs = {
  /** the server has confirmed the conversation is stored (else there is nothing to poll) */
  enabled: boolean;
  /** the panel is open */
  open: boolean;
  /** document.visibilityState === "visible" */
  visible: boolean;
  mode: ChatMode;
  wantsHuman: boolean;
  /** ms timestamp of the visitor's last send, or null */
  lastVisitorAt: number | null;
  /** consecutive polls that brought nothing new */
  idle: number;
  now: number;
};

/**
 * How long until the next poll — or null for "don't poll at all" (no timer is
 * left running). Polls only while the panel is open AND the tab is visible
 * AND a person could plausibly be writing: the chat is taken over, the visitor
 * asked for a person, or (AI mode) it's within a few minutes of their last
 * message. Backs off while polls keep coming back empty.
 */
export function nextPollDelay(s: PollInputs): number | null {
  if (!s.enabled || !s.open || !s.visible) return null;
  const step = s.idle < IDLE_STEP ? 0 : s.idle < IDLE_STEP * 2 ? 1 : 2;
  if (s.mode === "human" || s.wantsHuman) return POLL_ENGAGED_MS[step];
  if (s.lastVisitorAt !== null && s.now - s.lastVisitorAt < WATCH_AFTER_SEND_MS) {
    return POLL_WATCH_MS[Math.min(step, POLL_WATCH_MS.length - 1)];
  }
  return null;
}

/** Idle counter after a poll: reset by anything new, else one more step toward the slow cadence. */
export const nextIdle = (idle: number, sawSomethingNew: boolean) =>
  sawSomethingNew ? 0 : Math.min(idle + 1, 1000);

/**
 * Fold a poll's messages into what the widget already shows.
 *
 * The widget renders its own visitor and AI messages as they're sent and
 * streamed, before they have database ids, so a poll returning them must not
 * add them again: outside of `hydrate` (the first load after a page reload,
 * when the panel is empty) only `human` messages are appended. `known` holds
 * ids the widget already has (from the POST acks and earlier polls).
 * `cursor` is the highest id seen — the next poll's `after`.
 */
export function mergePolled(
  known: ReadonlySet<number>,
  incoming: readonly WireMessage[],
  opts: { hydrate: boolean; cursor: number }
): { append: WireMessage[]; cursor: number } {
  const append: WireMessage[] = [];
  let cursor = opts.cursor;
  for (const m of incoming) {
    if (!Number.isSafeInteger(m.id)) continue;
    cursor = Math.max(cursor, m.id);
    if (known.has(m.id)) continue;
    if (opts.hydrate || m.role === "human") append.push(m);
  }
  return { append, cursor };
}
