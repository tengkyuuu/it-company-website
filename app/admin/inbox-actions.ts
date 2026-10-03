"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/lib/site";
import { consumeLimit, hashKey } from "@/lib/security";
import { emailConfigured, sendLeadReplyEmail } from "@/lib/admin-email";
import {
  buildReplyHtml,
  buildReplyText,
  replySubject,
  sendFailureMessage,
  validateReplyBody,
} from "@/lib/lead-reply";
import {
  NOTHING_CHANGED,
  dbFail,
  fail,
  isUuid,
  logActivity,
  ok,
  requireStaff,
  str,
  type Result,
} from "./_lib/server";

/**
 * Replying to an inbox lead by email (contact enquiries and job applications;
 * chats are answered in Live chat).
 *
 * A separate "use server" module from content-actions.ts (where mark-handled
 * and delete live) only to keep that file's scope — and its concurrent
 * editors — undisturbed; tests/action-guards.test.ts scans every module.
 *
 * Honesty rules, because Resend's sandbox only delivers to the account owner
 * until a domain is verified:
 *   - every attempt is recorded in lead_replies, `failed` with the reason when
 *     Resend didn't take it — never marked sent when it wasn't;
 *   - leads.replied_at / replied_by move only on a real send;
 *   - a failure hands the composer a fallback (copy / mailto) instead of a
 *     dead end.
 * Recording uses the SERVICE ROLE (lead_replies has no insert policy), after
 * the send, so a staff session can't write a "sent" row for an email that
 * never left.
 * Limits: 30 replies per staff member per hour (durable, fails open — it's a
 * signed-in teammate, the limit is a brake on a runaway, not a lock).
 * Logged as inbox.reply on a real send — never the body.
 */

const PER_STAFF = { limit: 30, windowSeconds: 60 * 60 };

export type ReplyResult = Result & {
  sent?: boolean;
  /** the attempt made it into lead_replies */
  recorded?: boolean;
  /** the send failed: what the composer offers instead */
  fallback?: { to: string; subject: string; body: string };
};

type LeadForReply = {
  id: string;
  kind: "contact" | "application" | "chat";
  name: string | null;
  email: string | null;
  message: string | null;
  job_id: string | null;
  created_at: string;
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
});

export async function replyToLead(formData: FormData): Promise<ReplyResult> {
  const me = await requireStaff();
  const leadId = str(formData, "id");
  if (!isUuid(leadId)) return fail("Invalid request.");
  const checked = validateReplyBody(formData.get("body"));
  if (!checked.ok) return fail(checked.message, { body: checked.message });

  if (!(await consumeLimit(hashKey("inbox:reply", me.id), PER_STAFF.limit, PER_STAFF.windowSeconds))) {
    return fail("You’ve sent a lot of replies in the last hour — give it a little while.");
  }

  const db = await createClient();
  const { data, error } = await db
    .from("leads")
    .select("id, kind, name, email, message, job_id, created_at")
    .eq("id", leadId)
    .maybeSingle();
  if (error) return dbFail(error);
  const lead = data as LeadForReply | null;
  if (!lead) return fail(NOTHING_CHANGED);
  if (lead.kind === "chat") return fail("Chats are answered in Live chat, not by email.");
  if (!lead.email) return fail("This entry has no email address to reply to.");

  let jobTitle: string | null = null;
  if (lead.kind === "application" && lead.job_id) {
    const { data: job } = await db.from("jobs").select("title").eq("id", lead.job_id).maybeSingle();
    jobTitle = (job as { title?: string } | null)?.title ?? null;
  }

  const staffName = me.full_name || me.email || "The team";
  const subject = replySubject(lead.kind, { siteName: site.name, jobTitle });
  const content = {
    body: checked.body,
    staffName,
    siteName: site.name,
    recipientName: lead.name,
    original: lead.message,
    originalDate: DATE_FMT.format(new Date(lead.created_at)),
  };
  const text = buildReplyText(content);
  const html = buildReplyHtml(content);

  const sent = await sendLeadReplyEmail({ to: lead.email, subject, text, html });
  const now = new Date().toISOString();

  // the record — best-effort, and honest either way
  let recorded = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error: insErr } = await createAdminClient()
        .from("lead_replies")
        .insert({
          lead_id: lead.id,
          author_id: me.id,
          author_name: staffName,
          to_email: lead.email,
          subject,
          body: checked.body,
          status: sent.ok ? "sent" : "failed",
          provider_id: sent.ok ? (sent.id ?? null) : null,
          error: sent.ok ? "" : sent.message.slice(0, 500),
          sent_at: sent.ok ? now : null,
        });
      recorded = !insErr;
      if (insErr) console.warn("[inbox] reply not recorded:", insErr.message);
    } catch (e) {
      console.warn("[inbox] reply not recorded:", e instanceof Error ? e.message : e);
    }
  }

  if (!sent.ok) {
    revalidatePath("/admin/inbox");
    return {
      ...fail(
        sendFailureMessage({ message: sent.message, sandbox: sent.sandbox, configured: emailConfigured() })
      ),
      sent: false,
      recorded,
      fallback: { to: lead.email, subject, body: text },
    };
  }

  // sent — mark the lead replied (cookie client: staff may update leads)
  const { error: upErr } = await db
    .from("leads")
    .update({ replied_at: now, replied_by: me.id })
    .eq("id", lead.id);
  if (upErr) console.warn("[inbox] replied_at not set:", upErr.message);

  await logActivity({
    actor: { id: me.id, name: me.full_name || me.email || null },
    action: "inbox.reply",
    entityType: "lead",
    entityId: lead.id,
    detail: { label: lead.name || "a visitor", kind: lead.kind },
  });

  revalidatePath("/admin/inbox");
  return {
    ...ok(
      recorded
        ? `Sent to ${lead.email}. Their answer will arrive in the studio inbox.`
        : `Sent to ${lead.email} — but it couldn’t be saved to the reply history here.`
    ),
    sent: true,
  };
}
