import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, type LeadReplyRow, type LeadRow } from "@/lib/supabase/types";
import { Card, CardTitle, Notice, Pill } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import LeadActions from "@/components/admin/LeadActions";
import LeadReply, { type ReplyView } from "@/components/admin/LeadReply";
import { describeDbError, isMissingTable, isUuid } from "../_lib/server";
import { LEAD_KIND_LABEL, threadLeads, type LeadLite } from "../_lib/inbox";

export const metadata = { title: "Inbox", robots: { index: false } };

/**
 * Contact-form submissions, job applications and chatbot conversations,
 * newest first.
 *
 * Contact enquiries are still emailed — this is a record, not a replacement, so
 * a paused database can never swallow an enquiry (lib/leads.ts no-ops instead of
 * throwing, and the email has already gone out by then).
 *
 * A chat conversation is written as several snapshot rows; they're threaded
 * back into one entry here (see ../_lib/inbox.ts), showing the newest — i.e.
 * fullest — transcript. Enquiries and applications are never threaded. Filters
 * are plain links, so they work without JS and survive a reload.
 *
 * Since Phase 4, new chats are stored as chat_sessions and handled in
 * /admin/chats (takeover, replies); the chat route writes a `leads` row only
 * when that store is unreachable or the visitor's tab predates it. The rows
 * here are therefore the archive plus that fallback — never lost, never
 * duplicated. Enquiries and applications get a Reply composer (LeadReply →
 * app/admin/inbox-actions.ts) with the history of what was sent from here.
 */
const LIMIT = 300;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });

type Kind = "all" | "contact" | "application" | "chat";
type Status = "open" | "handled" | "all";
type Row = LeadRow & LeadLite;

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

/** Name, email, the message, and the reply composer — what enquiries and applications share. */
function PersonLead({
  lead,
  detail,
  replies,
}: {
  lead: LeadRow;
  /** the line under the email: the service asked about, the role applied for */
  detail?: React.ReactNode;
  /** replies already sent (or attempted) from the panel, oldest first */
  replies: ReplyView[];
}) {
  return (
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
      </p>
      {detail && <p className="text-sm text-ink/60">{detail}</p>}
      <p className="whitespace-pre-wrap break-words pt-2 text-sm leading-relaxed text-ink/75">
        {lead.message}
      </p>
      {lead.email && (
        <LeadReply leadId={lead.id} to={lead.email} name={lead.name} history={replies} />
      )}
    </div>
  );
}

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; job?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const sp = await searchParams;
  const kind = pick<Kind>(sp.kind, ["all", "contact", "application", "chat"], "all");
  const status = pick<Status>(sp.status, ["open", "handled", "all"], "open");
  // "applications for this role" — linked from a role's edit page
  const jobFilter = kind === "application" && isUuid(sp.job ?? "") ? sp.job! : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, first:transcript->0->>content")
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  const rows = (data ?? []) as Row[];

  // Which role each application was for. A separate lookup rather than an
  // embedded join, so the inbox still loads on a database where `jobs` (or
  // the FK) doesn't exist yet — it just can't name the role.
  const jobIds = [
    ...new Set(
      [
        ...rows.filter((r) => r.kind === "application" && r.job_id).map((r) => r.job_id!),
        ...(jobFilter ? [jobFilter] : []),
      ].filter(isUuid)
    ),
  ];
  const jobTitles = new Map<string, string>();
  let jobsFailed = false;
  if (jobIds.length) {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title")
      .in("id", jobIds);
    if (jobsError) jobsFailed = true;
    for (const j of jobs ?? []) jobTitles.set(j.id as string, j.title as string);
  }

  // Replies sent (or attempted) from the panel, grouped per lead. The newest
  // 1000 overall rather than an `in (…300 ids)` filter, which would blow past
  // URL limits. Best-effort: before schema.sql is re-run the table doesn't
  // exist, and the inbox simply shows no history (a send then explains).
  const repliesByLead = new Map<string, ReplyView[]>();
  {
    const { data: replies } = await supabase
      .from("lead_replies")
      .select("id, lead_id, author_name, status, error, body, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    for (const r of ((replies ?? []) as LeadReplyRow[]).reverse()) {
      const list = repliesByLead.get(r.lead_id) ?? [];
      list.push({
        id: r.id,
        author: r.author_name || "A teammate",
        when: fmt(r.created_at),
        status: r.status,
        error: r.error,
        body: r.body,
      });
      repliesByLead.set(r.lead_id, list);
    }
  }

  const threads = threadLeads(rows);
  const ofKind = threads.filter(
    (t) =>
      (kind === "all" || t.head.kind === kind) && (!jobFilter || t.head.job_id === jobFilter)
  );
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
    // a status change keeps the role filter; picking another type drops it
    if (jobFilter && k === "application" && !next.kind) q.set("job", jobFilter);
    const qs = q.toString();
    return `/admin/inbox${qs ? `?${qs}` : ""}`;
  };

  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 ${
      active ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
    }`;

  /** "Applied for: Frontend Developer" — or why the role can't be named. */
  const appliedFor = (lead: LeadRow) => {
    const title = lead.job_id ? jobTitles.get(lead.job_id) : undefined;
    if (title) {
      return (
        <>
          Applied for{" "}
          <Link
            href={`/admin/careers/${lead.job_id}`}
            className="font-medium text-ink underline decoration-mist underline-offset-2 hover:decoration-ink"
          >
            {title}
          </Link>
        </>
      );
    }
    if (lead.job_id && jobsFailed) return "Applied for a role (its title couldn’t be loaded)";
    return "Applied for a role that has since been deleted";
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-ink/55">
          Contact submissions and job applications, newest first — reply to them from here.
          Enquiries are emailed too; this is the record.
        </p>
      </header>

      {(kind === "all" || kind === "chat") && (
        <p className="text-sm text-ink/60">
          Chat conversations now live in{" "}
          <Link
            href="/admin/chats"
            className="font-medium text-ink underline decoration-mist underline-offset-2 hover:decoration-ink"
          >
            Live chat
          </Link>
          , where you can take one over and reply. Transcripts from before that are kept here.
        </p>
      )}

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
                ["application", "Applications"],
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

      {!error && jobFilter && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink/60">
          Applications for{" "}
          <span className="font-medium text-ink">
            {jobTitles.get(jobFilter) ?? "one role"}
          </span>
          <Link
            href={href({ kind: "application" })}
            className="rounded-full border border-mist/70 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
          >
            All roles
          </Link>
        </p>
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
              ? "Contact-form submissions, job applications and chatbot conversations will appear here. Contact enquiries are emailed as well, so nothing depends on this page."
              : status === "open"
                ? "Everything here has been handled."
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
                    <Pill tone={lead.kind === "chat" ? "muted" : "live"}>
                      {LEAD_KIND_LABEL[lead.kind] ?? lead.kind}
                    </Pill>
                    <Pill tone={handled ? "muted" : "draft"}>{handled ? "Handled" : "Open"}</Pill>
                    {lead.replied_at && <Pill tone="live">Replied</Pill>}
                    <time dateTime={lead.created_at} className="font-mono text-[11px] text-ink/45">
                      {fmt(lead.created_at)} PHT
                      {lead.kind === "chat" && lead.turns ? ` · ${lead.turns} messages` : ""}
                    </time>
                  </div>

                  {lead.kind === "contact" ? (
                    <PersonLead
                      lead={lead}
                      detail={lead.service ? `About: ${lead.service}` : undefined}
                      replies={repliesByLead.get(lead.id) ?? []}
                    />
                  ) : lead.kind === "application" ? (
                    <PersonLead
                      lead={lead}
                      detail={appliedFor(lead)}
                      replies={repliesByLead.get(lead.id) ?? []}
                    />
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
                  label={
                    lead.kind === "contact"
                      ? "enquiry"
                      : lead.kind === "application"
                        ? "application"
                        : "conversation"
                  }
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
