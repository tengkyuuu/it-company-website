import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import { Card, CardTitle, Notice, Pill } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import ChatAutoRefresh from "@/components/admin/ChatAutoRefresh";
import { describeDbError, isMissingTable } from "../_lib/server";
import { staffNames } from "../_lib/chat-console";
import {
  ATTENTION_FILTER,
  CHAT_SESSION_COLUMNS,
  chatLabel,
  chatStatus,
  formatChatTime,
  isUnread,
  mergeById,
  sortSessions,
  type ConsoleSessionRow,
} from "../_lib/chats";

export const metadata = { title: "Live chat", robots: { index: false } };

/**
 * Live chat — the site assistant's conversations, with human takeover.
 *
 * Chats waiting for a person (the visitor pressed "Talk to a person") are
 * listed first, then everything by newest message. The list is two queries —
 * the newest 100, plus every chat in the "needs a person" set however old —
 * merged, so a waiting visitor can't scroll off the bottom. Refreshes every
 * 15 s while the tab is visible (ChatAutoRefresh).
 *
 * Older chatbot transcripts (before takeover existed) stay in the Inbox.
 */
const LIMIT = 100;

const LAST_ROLE: Record<string, string> = { visitor: "Visitor", ai: "Assistant", human: "Team" };

export default async function AdminChatsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const db = await createClient();
  const [recent, attention] = await Promise.all([
    db
      .from("chat_sessions")
      .select(CHAT_SESSION_COLUMNS)
      .order("last_message_at", { ascending: false })
      .limit(LIMIT),
    db
      .from("chat_sessions")
      .select(CHAT_SESSION_COLUMNS)
      .or(ATTENTION_FILTER)
      .order("last_message_at", { ascending: false })
      .limit(LIMIT),
  ]);
  const error = recent.error ?? attention.error;

  const rows = error
    ? []
    : sortSessions(
        mergeById(
          (attention.data ?? []) as unknown as ConsoleSessionRow[],
          (recent.data ?? []) as unknown as ConsoleSessionRow[]
        )
      );
  const names = await staffNames(db, rows.map((r) => r.taken_over_by));

  return (
    <div className="space-y-6">
      <ChatAutoRefresh />
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Live chat</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/55">
          The site assistant’s conversations. Open one to read it, take it over and reply as
          yourself — the assistant stays quiet until you hand it back. Visitors see your first
          name, and only see replies while their chat window is open.
        </p>
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="Live chat isn’t set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> in the
            Supabase SQL editor (it’s safe to run twice). The assistant keeps answering in the
            meantime; its transcripts go to the Inbox.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load the chats">
            {describeDbError(error)}
          </Notice>
        ))}

      {!error && rows.length === 0 && (
        <Card>
          <CardTitle>No conversations yet</CardTitle>
          <p className="text-sm leading-relaxed text-ink/55">
            When a visitor talks to the site assistant, the conversation appears here. If they ask
            for a person, it jumps to the top.
          </p>
        </Card>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2.5">
          {rows.map((s) => {
            const status = chatStatus(s);
            const unread = isUnread(s);
            const taker = s.taken_over_by ? names.get(s.taken_over_by) : null;
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/chats/${s.id}`}
                  className={`block rounded-2xl border bg-surface p-5 transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 ${
                    status === "waiting" ? "border-amber-500/45" : "border-mist/70"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {status === "waiting" ? (
                      <Pill tone="draft">Wants a person</Pill>
                    ) : status === "human" ? (
                      <Pill tone="live">With {taker ?? "a teammate"}</Pill>
                    ) : (
                      <Pill>Assistant</Pill>
                    )}
                    {unread && (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink">
                        <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
                        Unread
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-ink/45">
                      {chatLabel(s.id)} · {formatChatTime(s.last_message_at)} PHT
                      {typeof s.message_count === "number" ? ` · ${s.message_count} messages` : ""}
                    </span>
                  </div>
                  <p
                    className={`mt-2.5 line-clamp-2 break-words text-sm leading-relaxed ${
                      unread ? "font-medium text-ink" : "text-ink/75"
                    }`}
                  >
                    {s.opening || "(no visitor message yet)"}
                  </p>
                  {s.last_preview && s.last_preview !== s.opening && (
                    <p className="mt-1 line-clamp-1 break-words text-xs text-ink/50">
                      <span className="font-medium text-ink/60">
                        {LAST_ROLE[s.last_role ?? ""] ?? "Last"}:
                      </span>{" "}
                      {s.last_preview}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-ink/45">
        Chatbot transcripts from before live chat are kept in the{" "}
        <Link href="/admin/inbox?kind=chat" className="underline decoration-mist underline-offset-2 hover:decoration-ink">
          Inbox
        </Link>
        .
      </p>
    </div>
  );
}
