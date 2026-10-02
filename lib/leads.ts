import "server-only";

import { hashIp } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/types";

/**
 * Persistence for the two things a visitor can send us: a contact-form
 * submission and a chat conversation. Both land in the same `leads` table so
 * /admin/inbox is one list rather than two.
 *
 * Everything here is **best-effort and non-throwing by design**. The contact
 * form's job is to email the studio and the chatbot's job is to answer; neither
 * should fail because a database is unreachable. With no Supabase env vars (or
 * a paused project) these functions no-op and return false, and the caller
 * carries on exactly as it did before the CMS existed.
 *
 * Writes go through the SERVICE-ROLE client on purpose: `leads` has no public
 * insert policy, so an anon key can't write to it and a leaked anon key can't
 * be used to spam or read the inbox.
 *
 * Visitor IPs are NEVER stored raw. Callers pass the raw address and it is
 * reduced to `ip_hash` (a keyed HMAC, lib/security's `hashIp`) right here, at
 * the single write point, so no caller can forget. The hash is deterministic,
 * which is all the inbox needs to thread a visitor's chat snapshots together.
 */

export type LeadKind = "contact" | "chat" | "application";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Trim a value to something a text column and a human reviewer can live with. */
const clip = (s: string | null | undefined, max: number) =>
  s ? s.slice(0, max) : null;

/** hashIp, but non-throwing like everything else here — a lead is worth more than its hash. */
function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip ?? null);
  } catch {
    return null;
  }
}

async function insertLead(row: Record<string, unknown>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("leads").insert(row);
    if (error) {
      console.warn("[leads] insert failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[leads] insert threw:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Called by app/api/contact/route.ts after the email is away. */
export async function saveContactLead(input: {
  name: string;
  email: string;
  service?: string | null;
  message: string;
  /** raw client IP — hashed before storage, never written as-is */
  ip?: string | null;
}): Promise<boolean> {
  return insertLead({
    kind: "contact" satisfies LeadKind,
    name: clip(input.name, 200),
    email: clip(input.email, 320),
    service: clip(input.service, 120),
    message: clip(input.message, 8000),
    ip_hash: safeHashIp(input.ip),
  });
}

/**
 * Called by app/api/apply/route.ts once the role has been re-checked (exists,
 * published, still open). One row per application — never threaded.
 *
 * `job_id` links it to the role (the inbox shows "Applied for …" and filters
 * by it). The role's title is ALSO written into the message, because the FK is
 * `ON DELETE SET NULL`: once a closed role is deleted, the id is gone and the
 * text is the only record of what the person applied for. Phone and links go
 * in the message too — the inbox renders it verbatim (pre-wrap), and `leads`
 * has no columns for them.
 */
export async function saveApplicationLead(input: {
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone?: string | null;
  links?: string[];
  message: string;
  /** raw client IP — hashed before storage, never written as-is */
  ip?: string | null;
}): Promise<boolean> {
  const details = [
    `Role: ${input.jobTitle}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.links?.length ? `Links:\n${input.links.join("\n")}` : null,
  ].filter(Boolean);

  return insertLead({
    kind: "application" satisfies LeadKind,
    job_id: input.jobId,
    name: clip(input.name, 200),
    email: clip(input.email, 320),
    message: clip(`${input.message.trim()}\n\n—\n${details.join("\n")}`, 8000),
    ip_hash: safeHashIp(input.ip),
  });
}

/**
 * Called by app/api/chat/route.ts once a reply is complete.
 *
 * One row per exchange, holding the whole visible transcript so far, so the
 * inbox shows a readable conversation instead of orphaned fragments. That does
 * mean a long chat writes overlapping rows; there is no conversation id, so
 * app/admin/_lib/inbox.ts (`threadLeads`) folds them back into one thread by
 * `ip_hash` + opening message + turn count + time window, and the inbox shows
 * only the newest (fullest) snapshot.
 */
export async function saveChatTranscript(input: {
  /** raw client IP — hashed before storage, never written as-is */
  ip?: string | null;
  messages: ChatTurn[];
  answer: string;
}): Promise<boolean> {
  // `as const` on the role: without it the array literal widens to
  // { role: string }[] and the .map() can't produce a ChatTurn.
  const transcript: ChatTurn[] = [
    ...input.messages,
    { role: "assistant" as const, content: input.answer },
  ].map((t): ChatTurn => ({ role: t.role, content: t.content.slice(0, 4000) }));

  const firstUser = transcript.find((t) => t.role === "user")?.content ?? "";

  return insertLead({
    kind: "chat" satisfies LeadKind,
    // no name/email — the bot never asks for them, and inventing a field the
    // visitor didn't fill in would make the inbox lie
    message: clip(firstUser, 8000),
    transcript,
    turns: transcript.length,
    ip_hash: safeHashIp(input.ip),
  });
}
