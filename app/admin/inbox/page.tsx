import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type LeadRow } from "@/lib/supabase/types";
import { site } from "@/lib/site";
import { Card, CardTitle, Notice, Pill } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import LeadActions from "@/components/admin/LeadActions";
import { describeDbError, isMissingTable } from "../_lib/server";
import { threadLeads, type LeadLite } from "../_lib/inbox";

export const metadata = { title: "Inbox", robots: { index: false } };

/**
 * Contact-form submissions and chatbot conversations, newest first.
 *
 * Contact enquiries are still emailed — this is a record, not a replacement, so
 * a paused database can never swallow an enquiry (lib/leads.ts no-ops instead of
 * throwing, and the email has already gone out by then).
 *
 * A chat conversation is written as several snapshot rows; they're threaded
 * back into one entry here (see ../_lib/inbox.ts), showing the newest — i.e.
 * fullest — transcript. Filters are plain links, so they work without JS and
 * survive a reload.
 */
const LIMIT = 300;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });

type Kind = "all" | "contact" | "chat";
type Status = "open" | "handled" | "all";
type Row = LeadRow & LeadLite;

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

function replyHref(lead: LeadRow) {
  const subject = `Re: your enquiry to ${site.name}`;
  const quoted = (lead.message ?? "")
    .split("\n")
    .slice(0, 12)
    .map((l) => `> ${l}`)
    .join("\n");
  const body = `Hi ${lead.name?.split(" ")[0] ?? "there"},\n\n\n\n${quoted}`;
  return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const sp = await searchParams;
  const kind = pick<Kind>(sp.kind, ["all", "contact", "chat"], "all");
  const status = pick<Status>(sp.status, ["open", "handled", "all"], "open");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, first:transcript->0->>content")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  const rows = (data ?? []) as Row[];
  const threads = threadLeads(rows);
  const ofKind = threads.filter((t) => kind === "all" || t.head.kind === kind);
  const counts = {
    open: ofKind.filter((t) => !t.handled).length,
    handled: ofKind.filter((t) => t.handled).length,
    all: ofKind.length,
  };
  const shown = ofKind.filter(
    (t) => status === "all" || (status === "open" ? !t.handled : t.handled)
  );

  const href = (next: { kind?: Kind; status?: Status }) => {
    const k = next.kind ?? kind;
    const s = next.status ?? status;
    const q = new URLSearchParams();
    if (k !== "all") q.set("kind", k);
    if (s !== "open") q.set("status", s);
    const qs = q.toString();
    return `/admin/inbox${qs ? `?${qs}` : ""}`;
  };

  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 ${
      active ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
    }`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-ink/55">
          Contact submissions and chat conversations, newest first. Enquiries are
          emailed too — this is the record.
        </p>
      </header>

      {error &&
        (isMissingTable(error) ? (
          <Notice tone="warn" title="The inbox table isn't set up yet">
            Re-run <code className="font-mono text-[13px]">supabase/schema.sql</code> —
            the leads table was added with the chatbot. Contact enquiries are still
            being emailed in the meantime.
          </Notice>
        ) : (
          <Notice tone="error" title="Couldn’t load the inbox">
            {describeDbError(error)} Contact enquiries are still emailed, so nothing
            is lost.
          </Notice>
        ))}

      {!error && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
            {(
              [
                ["open", "Open"],
                ["handled", "Handled"],
                ["all", "All"],
              ] as const
            ).map(([s, label]) => (
              <Link
                key={s}
                href={href({ status: s })}
                aria-current={status === s ? "page" : undefined}
                className={tab(status === s)}
              >
                {label}
                <span className="ml-1.5 font-mono text-[11px] tabular-nums text-ink/45">
                  {counts[s]}
                </span>
              </Link>
            ))}
          </nav>
          <nav aria-label="Filter by type" className="flex flex-wrap gap-1">
            {(
              [
                ["all", "Everything"],
                ["contact", "Enquiries"],
                ["chat", "Chats"],
              ] as const
            ).map(([k, label]) => (
              <Link
                key={k}
                href={href({ kind: k })}
                aria-current={kind === k ? "page" : undefined}
                className={tab(kind === k)}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {!error && shown.length === 0 && (
        <Card>
          <CardTitle>
            {rows.length === 0
              ? "Nothing yet"
              : status === "open"
                ? "All caught up"
                : "Nothing matches this filter"}
          </CardTitle>
          <p className="text-sm leading-relaxed text-ink/55">
            {rows.length === 0
              ? "Contact-form submissions and chatbot conversations will appear here. Contact enquiries are emailed as well, so nothing depends on this page."
              : status === "open"
                ? "Every enquiry and conversation has been handled."
                : "Try another filter."}
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {shown.map(({ head: lead, ids, handled }) => (
          <li key={lead.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={lead.kind === "contact" ? "live" : "muted"}>
                      {lead.kind === "contact" ? "Enquiry" : "Chat"}
                    </Pill>
                    <Pill tone={handled ? "muted" : "draft"}>{handled ? "Handled" : "Open"}</Pill>
                    <time dateTime={lead.created_at} className="font-mono text-[11px] text-ink/45">
                      {fmt(lead.created_at)} PHT
                      {lead.kind === "chat" && lead.turns ? ` · ${lead.turns} messages` : ""}
                    </time>
                  </div>

                  {lead.kind === "contact" ? (
                    <div className="mt-3 space-y-1">
                      <h2 className="font-display text-lg font-semibold tracking-tight">
                        {lead.name || "(no name)"}
                      </h2>
                      <p className="break-words text-sm text-ink/60">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="underline decoration-mist underline-offset-2 hover:decoration-ink"
                          >
                            {lead.email}
                          </a>
                        ) : (
                          "(no email)"
                        )}
                        {lead.service ? ` · ${lead.service}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap break-words pt-2 text-sm leading-relaxed text-ink/75">
                        {lead.message}
                      </p>
                      {lead.email && (
                        <a
                          href={replyHref(lead)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-mist/70 px-3.5 py-1.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
                        >
                          Reply by email <span aria-hidden>↗</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none rounded-lg text-sm text-ink/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 [&::-webkit-details-marker]:hidden">
                        <span className="font-medium text-ink">Opened with:</span>{" "}
                        <span className="break-words">{lead.message || "(empty)"}</span>
                        <span className="ml-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-ink/45">
                          <span className="group-open:hidden">Show conversation</span>
                          <span className="hidden group-open:inline">Hide conversation</span>
                        </span>
                      </summary>
                      <ol className="mt-4 space-y-2.5" aria-label="Conversation">
                        {(lead.transcript ?? []).map((t, i) => {
                          const visitor = t.role === "user";
                          return (
                            <li
                              key={i}
                              className={`flex flex-col ${visitor ? "items-start" : "items-end"}`}
                            >
                              <span className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink/40">
                                {visitor ? "Visitor" : "Assistant"}
                              </span>
                              <p
                                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                  visitor
                                    ? "rounded-tl-md border border-mist/70 bg-paper text-ink/80"
                                    : "rounded-tr-md bg-ink/[0.06] text-ink/75"
                                }`}
                              >
                                {t.content}
                              </p>
                            </li>
                          );
                        })}
                      </ol>
                    </details>
                  )}
                </div>

                <LeadActions
                  ids={ids}
                  handled={handled}
                  label={lead.kind === "contact" ? "enquiry" : "conversation"}
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {rows.length >= LIMIT && (
        <p className="text-center text-xs text-ink/45">
          Showing the latest {LIMIT} entries. Delete old ones to see further back.
        </p>
      )}
    </div>
  );
}
