"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { whenReady } from "@/components/fx/ready";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  MAX_CHARS,
  SESSION_STORAGE_KEY,
  VISITOR_KEY_HEADER,
  clientHistory,
  isSessionCredentials,
  mergePolled,
  nextIdle,
  nextPollDelay,
  splitNdjson,
  type ChatMode,
  type PollResponse,
  type SessionCredentials,
  type WireMessage,
} from "@/lib/chat-protocol";

/**
 * The site assistant, as a launcher + panel pinned bottom-right — and, since
 * Phase 4, the visitor's side of a live chat with the team.
 *
 * Talks to app/api/chat/route.ts, which streams NDJSON (contract in
 * lib/chat-protocol.ts): {session} first, then {t} text deltas, {error} (possibly
 * mid-stream), {done}. Deltas are appended to the last assistant message.
 *
 * Takeover: the tab holds a session id + a separate visitor key in
 * sessionStorage (only the key's hash is stored server-side). When staff take
 * the chat over, /api/chat answers {session:{mode:"human"}} instead of
 * streaming, and the widget polls GET /api/chat/messages for the person's
 * replies — only while the panel is open, the tab is visible, and someone
 * could plausibly be writing (nextPollDelay), backing off 4 s → 8 s → 15 s.
 * When nothing qualifies, no timer is left running.
 *
 * Placement notes: the launcher sits at z-45, i.e. under the nav (z-50) and the
 * preloader (z-100). It is hidden until `mykt:ready` so it can't appear over
 * the opening sequence.
 */

type MsgTurn = {
  kind: "msg";
  role: "user" | "assistant" | "human";
  content: string;
  /** database id, once the server has acknowledged it */
  id?: number;
  /** role 'human': the staff member's first name */
  author?: string | null;
  /** role 'user' in human mode: the server stored it for the team */
  delivered?: boolean;
};
type NoteTurn = { kind: "note"; note: "joined" | "left" | "requested" };
type Turn = MsgTurn | NoteTurn;

// ---------------------------------------------------------------------------
// session credentials (per tab)
// ---------------------------------------------------------------------------

function base64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // v4 by hand for older browsers / non-secure contexts
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readStoredSession(): SessionCredentials | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isSessionCredentials(parsed) ? parsed : null;
  } catch {
    return null; // private mode / storage blocked: the chat still works, per page
  }
}

function writeStoredSession(s: SessionCredentials | null) {
  try {
    if (s) window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const isMsg = (t: Turn): t is MsgTurn => t.kind === "msg";

/** Index of the newest message turn (dividers skipped), or -1. */
function lastMsgIndex(turns: readonly Turn[]) {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].kind === "msg") return i;
  return -1;
}

/**
 * The AI bubble being streamed into: the newest message, if it's the
 * assistant's. A divider may sit after it (the chat was handed back while the
 * visitor was away), so "the very last turn" isn't good enough.
 */
function streamingIndex(turns: readonly Turn[]) {
  const i = lastMsgIndex(turns);
  const m = turns[i];
  return m && isMsg(m) && m.role === "assistant" ? i : -1;
}

function fromWire(m: WireMessage): MsgTurn {
  return {
    kind: "msg",
    id: m.id,
    role: m.role === "visitor" ? "user" : m.role === "ai" ? "assistant" : "human",
    content: m.content,
    author: m.author,
  };
}

export default function ChatWidget() {
  // Only the widget's own UI is localized — the greeting and suggestion chips
  // included. The model's replies are whatever the model writes (it tends to
  // mirror the visitor's language); server error strings arrive in English.
  const { t } = useI18n();
  const greeting = t("chat.greeting");
  const suggestions = [t("chat.suggestion1"), t("chat.suggestion2"), t("chat.suggestion3")];
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // live chat state
  const [mode, setMode] = useState<ChatMode>("ai");
  const [wantsHuman, setWantsHuman] = useState(false);
  const [storeOk, setStoreOk] = useState(false);
  const [lastVisitorAt, setLastVisitorAt] = useState<number | null>(null);
  const [idle, setIdle] = useState(0);
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(true);
  const [asking, setAsking] = useState(false);
  const [announce, setAnnounce] = useState("");

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const pollAbort = useRef<AbortController | null>(null);
  const session = useRef<SessionCredentials | null>(null);
  const known = useRef(new Set<number>());
  const cursor = useRef(0);
  const modeRef = useRef<ChatMode>("ai");
  const hydrated = useRef(false);
  const polling = useRef(false);

  // don't compete with the opening sequence
  useEffect(() => {
    const show = () => setReady(true);
    const off = whenReady(show);
    const backstop = window.setTimeout(show, 4000);
    return () => {
      off();
      window.clearTimeout(backstop);
    };
  }, []);

  // this tab's conversation, if it already has one (survives full reloads)
  useEffect(() => {
    session.current = readStoredSession();
  }, []);

  // keep the transcript pinned to the newest message
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending, wantsHuman]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Esc closes; abort any in-flight request when the widget unmounts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(
    () => () => {
      abort.current?.abort();
      pollAbort.current?.abort();
    },
    []
  );

  // no polling from a hidden tab; coming back restarts the fast cadence
  useEffect(() => {
    const onVis = () => {
      const v = document.visibilityState === "visible";
      setVisible(v);
      if (v) setIdle(0);
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /** Forget the conversation (the server refused its key) and start clean next send. */
  const resetSession = useCallback(() => {
    session.current = null;
    writeStoredSession(null);
    known.current = new Set();
    cursor.current = 0;
    modeRef.current = "ai";
    setMode("ai");
    setWantsHuman(false);
    setStoreOk(false);
  }, []);

  const ensureSession = useCallback((): SessionCredentials => {
    if (session.current) return session.current;
    const s = { id: uuid(), key: base64url(crypto.getRandomValues(new Uint8Array(32))) };
    session.current = s;
    writeStoredSession(s);
    return s;
  }, []);

  /** Switch mode, dropping a divider into the transcript when it actually changes. */
  const applyMode = useCallback(
    (next: ChatMode) => {
      if (next === modeRef.current) return false;
      modeRef.current = next;
      setMode(next);
      setTurns((prev) => [...prev, { kind: "note", note: next === "human" ? "joined" : "left" }]);
      setAnnounce(next === "human" ? t("chat.joined") : t("chat.left"));
      if (next === "ai") setWantsHuman(false);
      return true;
    },
    [t]
  );

  const poll = useCallback(
    async (hydrate: boolean) => {
      const s = session.current;
      if (!s || polling.current) return;
      polling.current = true;
      const ac = new AbortController();
      pollAbort.current = ac;
      let sawNew = false;
      try {
        const res = await fetch(
          `/api/chat/messages?session=${encodeURIComponent(s.id)}&after=${cursor.current}`,
          { headers: { [VISITOR_KEY_HEADER]: s.key }, cache: "no-store", signal: ac.signal }
        );
        if (res.status === 403 || res.status === 404) {
          // not stored (yet), or not ours any more: nothing to poll
          setStoreOk(false);
          if (res.status === 403) resetSession();
          return;
        }
        if (res.status === 429) {
          setIdle(1000); // slowest cadence
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as PollResponse;
        setStoreOk(true);
        const { append, cursor: next } = mergePolled(known.current, data.messages ?? [], {
          hydrate,
          cursor: cursor.current,
        });
        cursor.current = next;
        for (const m of append) known.current.add(m.id);

        const fresh = append.map(fromWire);
        if (hydrate) {
          // a reload: rebuild the transcript, with one divider where a person came in
          const firstHuman = fresh.findIndex((m) => m.role === "human");
          const rebuilt: Turn[] = [...fresh];
          if (firstHuman >= 0) rebuilt.splice(firstHuman, 0, { kind: "note", note: "joined" });
          // …unless the visitor already started typing a new conversation
          if (rebuilt.length) setTurns((prev) => (prev.length ? prev : rebuilt));
          modeRef.current = data.mode;
          setMode(data.mode);
          setWantsHuman(Boolean(data.wantsHuman));
          return;
        }

        // a person joining reads above their first message; leaving, below the last
        let changed = false;
        if (data.mode === "human") changed = applyMode("human");
        if (fresh.length) {
          setTurns((prev) => [...prev, ...fresh]);
          const lastHuman = [...fresh].reverse().find((m) => m.role === "human");
          if (lastHuman) {
            setAnnounce(
              `${lastHuman.author ? t("chat.humanAuthor", { name: lastHuman.author }) : t("chat.teamMember")}: ${lastHuman.content}`
            );
          }
        }
        if (data.mode === "ai") changed = applyMode("ai") || changed;
        if (data.mode === "ai") setWantsHuman(Boolean(data.wantsHuman));
        sawNew = fresh.length > 0 || changed;
      } catch {
        // network blip / abort: back off
      } finally {
        polling.current = false;
        if (!hydrate) setIdle((i) => nextIdle(i, sawNew));
        // always re-arm the scheduler: a timer that fired while this poll was
        // in flight returned early and scheduled nothing
        setTick((n) => n + 1);
      }
    },
    [applyMode, resetSession, t]
  );

  // first open after a reload: bring the conversation back
  useEffect(() => {
    if (!open || hydrated.current) return;
    hydrated.current = true;
    if (session.current && turns.length === 0) void poll(true);
  }, [open, poll, turns.length]);

  // the poll scheduler — one timeout at a time, none when nothing qualifies
  useEffect(() => {
    if (pending) return; // the POST in flight will report the mode itself
    const delay = nextPollDelay({
      enabled: storeOk && Boolean(session.current),
      open,
      visible,
      mode,
      wantsHuman,
      lastVisitorAt,
      idle,
      now: Date.now(),
    });
    if (delay === null) return;
    const id = window.setTimeout(() => void poll(false), delay);
    return () => window.clearTimeout(id);
  }, [storeOk, open, visible, mode, wantsHuman, lastVisitorAt, idle, tick, pending, poll]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setError(null);
    setDraft("");
    const creds = ensureSession();
    // history the server sees when it can't read the stored conversation:
    // visitor + AI turns so far plus this message. The greeting is UI-only and
    // deliberately NOT sent — it isn't something the model said.
    const history = clientHistory([...turns.filter(isMsg), { role: "user", content: message }]);
    const humanNow = modeRef.current === "human";
    setTurns((prev) => [
      ...prev,
      { kind: "msg", role: "user", content: message },
      ...(humanNow ? [] : [{ kind: "msg", role: "assistant", content: "" } as MsgTurn]),
    ]);
    setPending(true);
    setLastVisitorAt(Date.now());
    setIdle(0);

    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, session: creds }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        if (res.status === 403 && body?.code === "session") resetSession();
        throw new Error(body?.error ?? t("chat.unavailable"));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = splitNdjson(buffer);
        buffer = rest;
        for (const evt of events) {
          if (evt.session) {
            const { mode: m, stored, visitorMessageId } = evt.session;
            if (stored) setStoreOk(true);
            if (typeof visitorMessageId === "number") known.current.add(visitorMessageId);
            if (m === "human") {
              // a person has the chat: no AI bubble, mark the message delivered
              setTurns((prev) => {
                const s = streamingIndex(prev);
                const next =
                  s >= 0 && !(prev[s] as MsgTurn).content ? prev.filter((_, i) => i !== s) : [...prev];
                for (let i = next.length - 1; i >= 0; i--) {
                  const x = next[i];
                  if (isMsg(x) && x.role === "user") {
                    next[i] = { ...x, delivered: true, id: visitorMessageId ?? undefined };
                    break;
                  }
                }
                return next;
              });
            }
            applyMode(m);
            if (m === "ai") {
              // handed back while we thought a person had it: the answer needs a bubble
              setTurns((prev) =>
                streamingIndex(prev) >= 0
                  ? prev
                  : [...prev, { kind: "msg", role: "assistant", content: "" }]
              );
            }
          }
          if (evt.error) setError(evt.error);
          if (evt.t) {
            const delta = evt.t;
            setTurns((prev) => {
              const s = streamingIndex(prev);
              if (s < 0) return prev;
              const next = [...prev];
              const cur = next[s] as MsgTurn;
              next[s] = { ...cur, content: cur.content + delta };
              return next;
            });
          }
          if (evt.done) {
            setPending(false);
            if (typeof evt.messageId === "number") known.current.add(evt.messageId);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || t("chat.genericError"));
    } finally {
      setPending(false);
      // drop the empty assistant bubble if nothing ever arrived
      setTurns((prev) => {
        const s = streamingIndex(prev);
        return s >= 0 && !(prev[s] as MsgTurn).content ? prev.filter((_, i) => i !== s) : prev;
      });
    }
  }

  async function askForPerson() {
    if (asking) return;
    setAsking(true);
    setError(null);
    const creds = ensureSession();
    try {
      const res = await fetch("/api/chat/human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: creds }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        setStoreOk(true);
        setWantsHuman(true);
        setIdle(0);
        setTurns((prev) => [...prev, { kind: "note", note: "requested" }]);
        setAnnounce(t("chat.requested"));
        if (body.mode === "human") applyMode("human");
      } else if (res.status === 429) {
        setError(t("chat.requestLimited"));
      } else {
        if (res.status === 403) resetSession();
        setError(t("chat.requestFailed"));
      }
    } catch {
      setError(t("chat.requestFailed"));
    } finally {
      setAsking(false);
    }
  }

  if (!ready) return null;

  const human = mode === "human";
  const hasVisitorTurn = turns.some((x) => isMsg(x) && x.role === "user");
  const streaming = streamingIndex(turns);
  const thinking = pending && !human && streaming >= 0 && !(turns[streaming] as MsgTurn).content;

  return (
    <>
      {/* launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("chat.close") : t("chat.open")}
        className="fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper shadow-[0_12px_32px_-8px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to md:bottom-8 md:right-8"
      >
        <span aria-hidden className="text-xl leading-none">
          {open ? "✕" : "✦"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("chat.dialogLabel")}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-4 z-[45] flex max-h-[min(560px,70svh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-mist/70 bg-surface shadow-[0_28px_70px_-24px_rgba(15,23,42,0.4)] md:bottom-28 md:right-8"
          >
            <header className="flex items-center gap-2.5 border-b border-mist/70 px-5 py-4">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              <p className="text-sm font-medium text-ink">{t("chat.title")}</p>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-slatey">
                {human ? t("chat.badgeHuman") : t("chat.badge")}
              </span>
            </header>

            {/* announces a person joining / replying without reading out every streamed AI token */}
            <p className="sr-only" aria-live="polite">
              {announce}
            </p>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <Bubble role="assistant">{greeting}</Bubble>

              {turns.map((turn, i) =>
                turn.kind === "note" ? (
                  <Note key={`n${i}`} kind={turn.note}>
                    {turn.note === "joined"
                      ? t("chat.joined")
                      : turn.note === "left"
                        ? t("chat.left")
                        : t("chat.requested")}
                  </Note>
                ) : !turn.content ? null : ( // the streaming placeholder shows as the dots below
                  <Bubble
                    key={turn.id ? `m${turn.id}` : `l${i}`}
                    role={turn.role}
                    label={
                      turn.role === "human"
                        ? turn.author
                          ? t("chat.humanAuthor", { name: turn.author })
                          : t("chat.teamMember")
                        : undefined
                    }
                    status={turn.role === "user" && turn.delivered ? t("chat.delivered") : undefined}
                  >
                    {turn.content}
                  </Bubble>
                )
              )}

              {thinking && (
                <Bubble role="assistant">
                  <span className="inline-flex gap-1" aria-label={t("chat.thinking")}>
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-slatey motion-reduce:animate-none"
                        style={{ animationDelay: `${d * 160}ms` }}
                      />
                    ))}
                  </span>
                </Bubble>
              )}

              {error && (
                <p
                  role="status"
                  className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-700 dark:text-red-300"
                >
                  {error}
                </p>
              )}

              {!turns.length && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-mist/70 px-3 py-1.5 text-xs text-ink/70 transition-colors hover:border-mist hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* "Talk to a person": after the first exchange, while the AI is answering */}
              {hasVisitorTurn && !human && !wantsHuman && !pending && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={askForPerson}
                    disabled={asking}
                    aria-describedby="chat-person-hint"
                    className="rounded-full border border-mist/70 px-3 py-1.5 text-xs text-ink/75 transition-colors hover:border-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-wait disabled:opacity-60"
                  >
                    {t("chat.talkToPerson")}
                  </button>
                  <span id="chat-person-hint" className="sr-only">
                    {t("chat.talkToPersonHint")}
                  </span>
                </div>
              )}

              {wantsHuman && !human && (
                <p role="status" className="text-center text-[11px] leading-relaxed text-slatey">
                  {t("chat.waiting")}
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="border-t border-mist/70 p-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={input}
                  rows={1}
                  value={draft}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter makes a newline
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  placeholder={human ? t("chat.humanPlaceholder") : t("chat.placeholder")}
                  aria-label={t("chat.inputLabel")}
                  className="max-h-28 flex-1 resize-none rounded-xl border border-mist/70 bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-accent-to focus:outline-none focus:ring-2 focus:ring-accent-to/25"
                />
                <button
                  type="submit"
                  disabled={pending || !draft.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t("chat.send")}
                >
                  <span aria-hidden>↑</span>
                </button>
              </div>
              <p className="mt-2 px-1 text-[10px] leading-relaxed text-slatey">
                {human ? t("chat.humanDisclaimer") : t("chat.disclaimer")}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({
  role,
  label,
  status,
  children,
}: {
  role: "user" | "assistant" | "human";
  /** shown above a team member's message */
  label?: string;
  /** shown under a visitor message ("Sent to the team") */
  status?: string;
  children: React.ReactNode;
}) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex flex-col items-end" : "flex flex-col items-start"}>
      {label && (
        <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-widest text-slatey">
          {label}
        </span>
      )}
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          mine
            ? "bg-ink text-paper"
            : role === "human"
              ? "border border-ink/25 bg-surface text-ink"
              : "border border-mist/60 bg-paper text-ink"
        }`}
      >
        {children}
      </div>
      {status && <span className="mt-1 px-1 text-[10px] text-slatey">{status}</span>}
    </div>
  );
}

/** A quiet divider ("A person from the team joined") or, for the request, a short note. */
function Note({ kind, children }: { kind: NoteTurn["note"]; children: React.ReactNode }) {
  if (kind === "requested") {
    return (
      <p className="rounded-2xl border border-mist/60 bg-paper px-3.5 py-2.5 text-xs leading-relaxed text-ink/70">
        {children}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] text-slatey" role="note">
      <span className="h-px flex-1 bg-mist/70" aria-hidden />
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-mist/70" aria-hidden />
    </div>
  );
}
