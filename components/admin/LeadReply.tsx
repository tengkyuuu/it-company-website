"use client";

import { useId, useState, useTransition } from "react";
import { replyToLead, type ReplyResult } from "@/app/admin/inbox-actions";
import { MAX_REPLY_BODY, greeting, mailtoHref } from "@/lib/lead-reply";
import { SubmitButton, Textarea } from "./ui";

/**
 * Reply-by-email for one inbox lead, plus the replies already sent from here.
 *
 * Sends through Resend (app/admin/inbox-actions.ts → replyToLead). When that
 * fails — most often Resend's sandbox, which only delivers to the account
 * owner — the real reason is shown, the reply is kept here as "Not sent", and
 * the composer offers Copy reply + "Open in your mail app" (a mailto: with the
 * subject and text prefilled). It never says "sent" unless Resend took it.
 */

export type ReplyView = {
  id: string;
  author: string;
  /** preformatted on the server (PHT), so nothing hydrates differently */
  when: string;
  status: "sent" | "failed";
  error: string;
  body: string;
};

export default function LeadReply({
  leadId,
  to,
  name,
  history,
}: {
  leadId: string;
  to: string;
  name: string | null;
  history: ReplyView[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => greeting(name));
  const [result, setResult] = useState<ReplyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const fieldId = useId();

  const submit = () => {
    setResult(null);
    setCopied(false);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("body", draft);
    start(async () => {
      let r: ReplyResult;
      try {
        r = await replyToLead(fd);
      } catch (e) {
        // Next's redirect (expired session) must still work
        if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_")) throw e;
        r = {
          ok: false,
          message: "Couldn't reach the server — check your connection. Nothing was sent.",
          fallback: undefined,
        };
      }
      setResult(r);
      if (r.ok) {
        setDraft(greeting(name));
        setOpen(false);
      }
    });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-mist/70 px-3.5 py-1.5 text-sm transition-colors hover:border-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-3 space-y-3">
      {history.length > 0 && (
        <ol className="space-y-2" aria-label="Replies from the panel">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border border-mist/60 bg-paper px-3.5 py-2.5">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-xs text-ink/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 [&::-webkit-details-marker]:hidden">
                  <span
                    className={`rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-widest ${
                      h.status === "sent"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {h.status === "sent" ? "Sent" : "Not sent"}
                  </span>
                  <span>
                    {h.author} · {h.when} PHT
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
                    <span className="group-open:hidden">Show</span>
                    <span className="hidden group-open:inline">Hide</span>
                  </span>
                </summary>
                {h.status === "failed" && h.error && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                    Why: {h.error}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/75">
                  {h.body}
                </p>
              </details>
            </li>
          ))}
        </ol>
      )}

      {result?.ok && (
        <p role="status" className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {result.message}
        </p>
      )}

      {!open ? (
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          Reply by email
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2"
        >
          <label htmlFor={fieldId} className="block font-mono text-[11px] uppercase tracking-widest text-slatey">
            Reply to {to}
          </label>
          <Textarea
            id={fieldId}
            rows={6}
            value={draft}
            maxLength={MAX_REPLY_BODY}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={result && !result.ok && result.fieldErrors?.body ? true : undefined}
          />
          <p className="text-xs leading-relaxed text-ink/50">
            Plain text, no attachments. Their original message is quoted underneath, and their
            answer goes to the studio inbox.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton pending={pending} pendingLabel="Sending…" disabled={!draft.trim()}>
              Send reply
            </SubmitButton>
            <button type="button" className={btn} disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {result && !result.ok && (
        <div role="alert" className="space-y-2 rounded-xl border border-red-500/35 bg-red-500/[0.06] px-4 py-3">
          <p className="text-sm leading-relaxed text-red-700 dark:text-red-300">{result.message}</p>
          {result.fallback && (
            <>
              <p className="text-xs leading-relaxed text-ink/60">
                {result.recorded ? "Your reply is kept above as “Not sent”. " : ""}Send it from your own
                mail instead — then mark this handled.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => copy(result.fallback!.body)}>
                  {copied ? "Copied" : "Copy reply"}
                </button>
                <a className={btn} href={mailtoHref(result.fallback)}>
                  Open in your mail app <span aria-hidden>↗</span>
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
