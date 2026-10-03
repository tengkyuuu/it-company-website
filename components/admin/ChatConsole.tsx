"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  handBackChat,
  markChatRead,
  sendChatReply,
  takeOverChat,
} from "@/app/admin/chat-actions";
import { MAX_REPLY_CHARS } from "@/lib/chat-protocol";
import {
  consolePollDelay,
  formatChatTime,
  isUnread,
  type ConsoleMessage,
  type ConsolePoll,
  type ConsoleSession,
} from "@/app/admin/_lib/chats";
import { Banner, SubmitButton, Textarea, callAction, type FormResult } from "./ui";

/**
 * The session view of /admin/chats: transcript, Take over / Hand back, reply.
 *
 * Fresh by polling GET /api/admin/chats (a Route Handler — server actions run
 * one at a time per client, so a poll queued as an action would hold up Send)
 * every 4 s → 8 s → 15 s as polls come back empty, ONLY while the tab is
 * visible; becoming visible again polls at once. Realtime would save the
 * polls, but it needs a socket per open tab against the free plan's limit and
 * polling is what the visitor side does anyway.
 *
 * Marks the chat read (markChatRead) while you're looking at it and a visitor
 * message is newer than the last read — at most every 10 s.
 */

const maxId = (list: readonly ConsoleMessage[]) => list.reduce((m, x) => Math.max(m, x.id), 0);

const ROLE_LABEL = { visitor: "Visitor", ai: "Assistant", human: "Team" } as const;

export default function ChatConsole({
  initialSession,
  initialMessages,
  meId,
}: {
  initialSession: ConsoleSession;
  initialMessages: ConsoleMessage[];
  meId: string;
}) {
  const [session, setSession] = useState(initialSession);
  const [messages, setMessages] = useState(initialMessages);
  const [visible, setVisible] = useState(true);
  const [idle, setIdle] = useState(0);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<FormResult | null>(null);
  const [stopped, setStopped] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sessionRef = useRef(initialSession);
  const cursor = useRef(maxId(initialMessages));
  const polling = useRef(false);
  const lastMarked = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const id = initialSession.id;

  const merge = useCallback((incoming: readonly ConsoleMessage[]) => {
    if (!incoming.length) return;
    cursor.current = Math.max(cursor.current, maxId(incoming));
    setMessages((prev) => {
      const have = new Set(prev.map((m) => m.id));
      const add = incoming.filter((m) => !have.has(m.id));
      return add.length ? [...prev, ...add].sort((a, b) => a.id - b.id) : prev;
    });
  }, []);

  const applySession = useCallback((next: ConsoleSession) => {
    const prev = sessionRef.current;
    const changed =
      prev.mode !== next.mode || prev.status !== next.status || prev.takenOverBy !== next.takenOverBy;
    sessionRef.current = next;
    setSession(next);
    return changed;
  }, []);

  // a server action's revalidation re-renders the page with fresh props
  useEffect(() => {
    merge(initialMessages);
    applySession(initialSession);
  }, [initialMessages, initialSession, merge, applySession]);

  const poll = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    let sawNew = false;
    try {
      const res = await fetch(
        `/api/admin/chats?session=${encodeURIComponent(id)}&after=${cursor.current}`,
        { cache: "no-store" }
      );
      const body = (await res.json().catch(() => null)) as ConsolePoll | null;
      if (res.status === 401 || res.status === 403) {
        setStopped(body && !body.ok ? body.error : "Your session has ended — sign in again.");
        return;
      }
      if (res.status === 404) {
        setStopped("This conversation no longer exists.");
        return;
      }
      if (!res.ok || !body?.ok) return;
      if (body.messages.length) {
        merge(body.messages);
        sawNew = true;
      }
      if (applySession(body.session)) sawNew = true;
    } catch {
      // offline for a moment: back off
    } finally {
      polling.current = false;
      setIdle((i) => (sawNew ? 0 : Math.min(i + 1, 1000)));
      setTick((n) => n + 1);
    }
  }, [id, merge, applySession]);

  // visibility: no timers while hidden; coming back polls straight away
  useEffect(() => {
    const onVis = () => {
      const v = document.visibilityState === "visible";
      setVisible(v);
      if (v) {
        setIdle(0);
        void poll();
      }
    };
    setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [poll]);

  // the scheduler: one timeout at a time
  useEffect(() => {
    if (stopped) return;
    const delay = consolePollDelay(idle, visible);
    if (delay === null) return;
    const t = window.setTimeout(() => void poll(), delay);
    return () => window.clearTimeout(t);
  }, [idle, tick, visible, poll, stopped]);

  // mark read while you're looking
  useEffect(() => {
    if (!visible || stopped) return;
    const unread = isUnread({
      mode: session.mode,
      admin_read_at: session.adminReadAt,
      last_visitor_at: session.lastVisitorAt,
    });
    if (!unread || Date.now() - lastMarked.current < 10_000) return;
    lastMarked.current = Date.now();
    const fd = new FormData();
    fd.set("id", id);
    void callAction(() => markChatRead(fd)).then((r) => {
      if (r?.ok) {
        const now = new Date().toISOString();
        sessionRef.current = { ...sessionRef.current, adminReadAt: now };
        setSession((s) => ({ ...s, adminReadAt: now }));
      }
    });
  }, [visible, stopped, session.mode, session.adminReadAt, session.lastVisitorAt, id]);

  // keep the newest message in view
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function run(
    action: (fd: FormData) => Promise<FormResult>,
    extra: Record<string, string> = {},
    opts: { quietSuccess?: boolean; onOk?: () => void } = {}
  ) {
    setResult(null);
    const fd = new FormData();
    fd.set("id", id);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    start(async () => {
      const r = await callAction(() => action(fd));
      if (r && (!r.ok || !opts.quietSuccess)) setResult(r);
      if (r?.ok) {
        opts.onOk?.();
        setIdle(0);
        await poll();
      }
    });
  }

  const mine = session.mode === "human" && session.takenOverBy === meId;
  const takerName = mine ? "you" : (session.takenOverByName ?? "a teammate");

  const send = () => {
    const content = draft.trim();
    if (!content || pending) return;
    run(sendChatReply, { content }, { quietSuccess: true, onOk: () => setDraft("") });
  };

  const btn =
    "rounded-full border border-mist/70 px-3.5 py-1.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4">
      {/* status + controls */}
      <section
        aria-label="Chat status"
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface p-5 ${
          session.status === "waiting" ? "border-amber-500/45" : "border-mist/70"
        }`}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {session.status === "waiting"
              ? "The visitor asked for a person"
              : session.mode === "human"
                ? `With ${takerName}`
                : "The assistant is answering"}
          </p>
          <p className="mt-0.5 text-xs text-ink/50">
            {session.status === "waiting" && session.wantsHumanAt
              ? `Since ${formatChatTime(session.wantsHumanAt)} PHT · nobody has taken it over yet`
              : session.mode === "human" && session.takenOverAt
                ? `Since ${formatChatTime(session.takenOverAt)} PHT · the assistant stays quiet until it’s handed back`
                : `Started ${formatChatTime(session.createdAt)} PHT`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-busy={pending || undefined}>
          {session.mode === "ai" && (
            <button type="button" className={btn} disabled={pending || Boolean(stopped)} onClick={() => run(takeOverChat)}>
              Take over
            </button>
          )}
          {session.mode === "human" && !mine && (
            <button
              type="button"
              className={btn}
              disabled={pending || Boolean(stopped)}
              onClick={() => {
                if (!window.confirm(`${takerName} is handling this chat. Take it over from them?`)) return;
                run(takeOverChat);
              }}
            >
              Take over from {takerName}
            </button>
          )}
          {session.mode === "human" && (
            <button type="button" className={btn} disabled={pending || Boolean(stopped)} onClick={() => run(handBackChat)}>
              Hand back to the assistant
            </button>
          )}
          {session.status === "waiting" && (
            <button type="button" className={btn} disabled={pending || Boolean(stopped)} onClick={() => run(handBackChat)}>
              Dismiss request
            </button>
          )}
        </div>
      </section>

      {stopped && (
        <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/[0.07] px-4 py-3 text-sm text-ink/75">
          {stopped} Updates have stopped — reload the page to continue.
        </p>
      )}
      <Banner result={result} />

      {/* transcript */}
      <div
        ref={scroller}
        className="max-h-[min(62vh,680px)] overflow-y-auto rounded-2xl border border-mist/70 bg-surface p-5"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-ink/55">No messages yet.</p>
        ) : (
          <ol className="space-y-3" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
            {messages.map((m) => {
              const visitor = m.role === "visitor";
              const label =
                m.role === "human"
                  ? m.authorId === meId
                    ? "You"
                    : (m.author ?? ROLE_LABEL.human)
                  : ROLE_LABEL[m.role];
              return (
                <li key={m.id} className={`flex flex-col ${visitor ? "items-start" : "items-end"}`}>
                  <span className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink/40">
                    {label} · {formatChatTime(m.at)}
                  </span>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      visitor
                        ? "rounded-tl-md border border-mist/70 bg-paper text-ink/85"
                        : m.role === "human"
                          ? "rounded-tr-md bg-ink text-paper"
                          : "rounded-tr-md bg-ink/[0.06] text-ink/75"
                    }`}
                  >
                    {m.content}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* reply */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="space-y-2"
      >
        <label htmlFor="chat-reply" className="sr-only">
          Reply to the visitor
        </label>
        <Textarea
          id="chat-reply"
          rows={3}
          value={draft}
          maxLength={MAX_REPLY_CHARS}
          disabled={Boolean(stopped)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a reply…"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-ink/50">
            {session.mode === "ai"
              ? "Sending takes the chat over from the assistant. "
              : ""}
            Enter sends · Shift+Enter for a new line · the visitor sees your first name.
          </p>
          <SubmitButton pending={pending} pendingLabel="Sending…" disabled={!draft.trim() || Boolean(stopped)}>
            Send
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
