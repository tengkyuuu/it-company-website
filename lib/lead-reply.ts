/**
 * Replies to inbox leads (contact enquiries, job applications), with no I/O:
 * the subject line, the plain-text + escaped-HTML email, validation, and the
 * `mailto:` fallback for when Resend can't deliver (its sandbox only emails
 * the account owner until a domain is verified).
 *
 * Plain module — shared by the server action (app/admin/inbox-actions.ts), the
 * reply composer (components/admin/LeadReply.tsx) and tests/lead-reply.test.ts.
 */

export const MAX_REPLY_BODY = 5000;

/**
 * Keep a mailto: URL under ~2,000 characters — past that, some mail clients
 * (and Windows' URL handler) silently truncate or refuse it.
 */
export const MAILTO_MAX = 1900;

export type ReplyLeadKind = "contact" | "application";

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/** Lone surrogates → U+FFFD (encodeURIComponent throws on them). A loop, not a lookbehind regex: tsconfig targets ES2017. */
export function wellFormed(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      } else out += "�";
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out += "�";
    } else out += s[i];
  }
  return out;
}

/** One line, no control characters (a header can't carry a newline), bounded. */
export function cleanSubject(s: string): string {
  const one = s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  // the cut mustn't leave half an emoji behind
  return wellFormed(/[\uD800-\uDBFF]$/.test(one) ? one.slice(0, -1) : one);
}

/** "Re: your enquiry to R Ally's Tech" / "Re: your application — Frontend Developer". */
export function replySubject(
  kind: ReplyLeadKind,
  opts: { siteName: string; jobTitle?: string | null }
): string {
  if (kind === "application") {
    const role = opts.jobTitle ? cleanSubject(opts.jobTitle).slice(0, 120) : "";
    return cleanSubject(role ? `Re: your application — ${role}` : `Re: your application to ${opts.siteName}`);
  }
  return cleanSubject(`Re: your enquiry to ${opts.siteName}`);
}

export type BodyCheck = { ok: true; body: string } | { ok: false; message: string };

/** Trimmed, control characters out (newlines and tabs kept), 1..MAX_REPLY_BODY. */
export function validateReplyBody(raw: unknown): BodyCheck {
  const body = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").replace(CONTROL, "").trim() : "";
  if (!body) return { ok: false, message: "Write a reply first." };
  if (body.length > MAX_REPLY_BODY) {
    return { ok: false, message: `Keep it under ${MAX_REPLY_BODY.toLocaleString("en-US")} characters.` };
  }
  return { ok: true, body };
}

/** "Hi Maria," — the composer's starting text. */
export function greeting(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `Hi ${first},\n\n` : "Hi,\n\n";
}

/** The first `maxLines` lines of their message, "> "-quoted. */
export function quoteOriginal(message: string | null | undefined, maxLines = 12): string {
  const lines = (message ?? "").replace(/\r\n?/g, "\n").trim().split("\n");
  if (!lines[0]) return "";
  const shown = lines.slice(0, maxLines).map((l) => `> ${l}`);
  if (lines.length > maxLines) shown.push("> …");
  return shown.join("\n");
}

export type ReplyEmailInput = {
  body: string;
  /** who's writing (signs the email) */
  staffName: string;
  siteName: string;
  /** the lead's name, for the "… wrote:" line */
  recipientName?: string | null;
  /** their original message, quoted under the reply */
  original?: string | null;
  /** preformatted date of the original, e.g. "Oct 3, 2026" */
  originalDate?: string | null;
};

function signature(staffName: string) {
  return (staffName.trim().split(/\s+/)[0] || "The team").slice(0, 60);
}

/** Plain text — what most of the email's readers' clients will show first. */
export function buildReplyText(i: ReplyEmailInput): string {
  const quote = quoteOriginal(i.original);
  const who = i.recipientName?.trim() || "you";
  return [
    i.body.trim(),
    "",
    `— ${signature(i.staffName)}`,
    i.siteName,
    ...(quote ? ["", `${i.originalDate ? `On ${i.originalDate}, ` : ""}${who} wrote:`, quote] : []),
  ].join("\n");
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * Escaped HTML: every value that came from a person (the reply, their name,
 * their message) goes through escapeHtml; paragraphs on blank lines, <br> on
 * single newlines. Deliberately plain — a personal reply, not a newsletter —
 * and light only (mail clients' dark-mode handling is too uneven to style for).
 */
export function buildReplyHtml(i: ReplyEmailInput): string {
  const paras = i.body
    .trim()
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");
  const quote = quoteOriginal(i.original);
  const who = escapeHtml(i.recipientName?.trim() || "you");
  const quoted = quote
    ? `<blockquote style="margin:28px 0 0;padding:0 0 0 14px;border-left:3px solid #CBD5E1;color:#64748B;font-size:13px;line-height:1.6">${
        i.originalDate ? `On ${escapeHtml(i.originalDate)}, ` : ""
      }${who} wrote:<br>${escapeHtml(
        quote
          .split("\n")
          .map((l) => l.replace(/^> ?/, ""))
          .join("\n")
      ).replace(/\n/g, "<br>")}</blockquote>`
    : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:24px 16px;background:#FFFFFF">
<div style="max-width:560px;font:15px/1.65 ${FONT};color:#1E293B">
${paras}
<p style="margin:24px 0 0;color:#475569">— ${escapeHtml(signature(i.staffName))}<br>${escapeHtml(i.siteName)}</p>
${quoted}
</div>
</body>
</html>`;
}

/**
 * mailto: with subject and body prefilled — the fallback when the send
 * failed. Everything is percent-encoded (encodeURIComponent, so "&", "?",
 * "#" and newlines in the text can't break out of their parameter). If the
 * result is too long for mail clients, the body is shortened with a marker
 * rather than letting the client cut it mid-word without saying so.
 */
export function mailtoHref(input: { to: string; subject: string; body: string }, max = MAILTO_MAX): string {
  const args = { ...input, body: wellFormed(input.body) };
  const to = args.to.trim();
  // an address is all the "path" can be; anything odd → no recipient prefilled
  const recipient = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+$/.test(to) ? encodeURIComponent(to).replace(/%40/g, "@") : "";
  const head = `mailto:${recipient}?subject=${encodeURIComponent(cleanSubject(args.subject))}&body=`;
  const full = head + encodeURIComponent(args.body);
  if (full.length <= max) return full;

  const marker = "\n\n[…shortened — paste the rest from “Copy reply”]";
  // a prefix that never ends on half a surrogate pair (encodeURIComponent
  // throws on a lone one — an emoji cut in two)
  const prefix = (n: number) => {
    const s = args.body.slice(0, n);
    return /[\uD800-\uDBFF]$/.test(s) ? s.slice(0, -1) : s;
  };
  let lo = 0;
  let hi = args.body.length;
  // longest prefix that fits (binary search over characters)
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((head + encodeURIComponent(prefix(mid) + marker)).length <= max) lo = mid;
    else hi = mid - 1;
  }
  return head + encodeURIComponent(prefix(lo) + marker);
}

/** What the panel tells staff when Resend didn't deliver — the real reason, plainly. */
export function sendFailureMessage(f: { message: string; sandbox: boolean; configured: boolean }): string {
  if (!f.configured) {
    return "Email isn’t set up on this site yet (RESEND_API_KEY is missing), so nothing was sent.";
  }
  if (f.sandbox) {
    return "Not sent: Resend is still in test mode, which only delivers to the Resend account owner’s own address. Verify a domain in Resend and set ADMIN_FROM_EMAIL to email visitors.";
  }
  return `Not sent — Resend said: ${f.message}`;
}
