"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { whenReady } from "@/components/fx/ready";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * The site assistant, as a launcher + panel pinned bottom-right.
 *
 * Talks to app/api/chat/route.ts, which streams NDJSON — one JSON object per
 * line: {t} a text delta, {error} a failure (possibly mid-stream), {done}.
 * Deltas are appended to the last assistant message as they arrive.
 *
 * Placement notes: the launcher sits at z-45, i.e. under the nav (z-50) and the
 * preloader (z-100). It is hidden until `mykt:ready` so it can't appear over
 * the opening sequence.
 */

type Turn = { role: "user" | "assistant"; content: string };

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

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

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

  // keep the transcript pinned to the newest message
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending]);

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

  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setError(null);
    setDraft("");
    // history the server sees: everything so far plus this message. The greeting
    // is UI-only and deliberately NOT sent — it isn't something the model said.
    const history: Turn[] = [...turns, { role: "user", content: message }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setPending(true);

    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? t("chat.unavailable"));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // NDJSON: accumulate and split on newlines, keeping any partial last line
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          let evt: { t?: string; error?: string; done?: boolean };
          try {
            evt = JSON.parse(raw);
          } catch {
            continue; // a torn line is not worth failing the whole reply over
          }
          if (evt.error) setError(evt.error);
          if (evt.t) {
            setTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + evt.t,
                };
              }
              return next;
            });
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || t("chat.genericError"));
    } finally {
      setPending(false);
      // drop the empty assistant bubble if nothing ever arrived
      setTurns((prev) =>
        prev.length && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content
          ? prev.slice(0, -1)
          : prev
      );
    }
  }

  if (!ready) return null;

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
                {t("chat.badge")}
              </span>
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <Bubble role="assistant">{greeting}</Bubble>

              {turns.map((t, i) => (
                <Bubble key={i} role={t.role}>
                  {t.content}
                </Bubble>
              ))}

              {pending && !turns[turns.length - 1]?.content && (
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
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter makes a newline
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  placeholder={t("chat.placeholder")}
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
                {t("chat.disclaimer")}
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
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          mine
            ? "bg-ink text-paper"
            : "border border-mist/60 bg-paper text-ink"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
