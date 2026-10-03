"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_REPLY_CHARS } from "@/lib/chat-protocol";
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
import { chatLabel } from "./_lib/chats";
import { staffNames } from "./_lib/chat-console";

/**
 * Live chat (/admin/chats): take over, reply, hand back, mark read.
 *
 * Every write goes through the COOKIE client, so RLS applies: staff may update
 * only the takeover / read-state columns of chat_sessions (column grants in
 * schema.sql) and may insert a chat message only as role 'human' signed with
 * their own id. Every UPDATE asks for the affected rows back — RLS filtering
 * a write is a silent zero-row "success".
 *
 * Logged: chat.takeover and chat.handback only (via logActivity, service
 * role). Never a line per message — the activity feed must stay readable, and
 * the visitor's words don't belong in the audit log (the label is the chat's
 * short id).
 */

export type ChatActionResult = Result;

const actorOf = (me: { id: string; full_name: string | null; email: string | null }) => ({
  id: me.id,
  name: me.full_name || me.email || null,
});

function revalidateChats(id?: string) {
  // the layout too: it renders the "Live chat" badge
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/chats");
  if (id) revalidatePath(`/admin/chats/${id}`);
}

type SessionState = {
  mode: "ai" | "human";
  taken_over_by: string | null;
  wants_human_at: string | null;
  created_at: string;
};

async function readState(db: Awaited<ReturnType<typeof createClient>>, id: string) {
  return db
    .from("chat_sessions")
    .select("mode, taken_over_by, wants_human_at, created_at")
    .eq("id", id)
    .maybeSingle<SessionState>();
}

/**
 * Put `me` in charge of the chat. From AI mode it's a plain takeover; from a
 * colleague it moves it to `me` (the UI asks first). Already mine → no-op.
 */
async function takeOver(
  db: Awaited<ReturnType<typeof createClient>>,
  me: { id: string; full_name: string | null; email: string | null },
  id: string
): Promise<Result> {
  const { data: cur, error } = await readState(db, id);
  if (error) return dbFail(error);
  if (!cur) return fail(NOTHING_CHANGED);
  if (cur.mode === "human" && cur.taken_over_by === me.id) return ok("You’re already handling this chat.");

  const now = new Date().toISOString();
  const { data, error: upErr } = await db
    .from("chat_sessions")
    .update({ mode: "human", taken_over_by: me.id, taken_over_at: now, admin_read_at: now })
    .eq("id", id)
    // optimistic: only from the state we just read, so two people clicking at
    // once can't both "win" silently
    .eq("mode", cur.mode)
    .select("id");
  if (upErr) return dbFail(upErr);
  if (!data?.length) return fail("Someone else changed this chat just now — refresh and try again.");

  const from =
    cur.mode === "human" && cur.taken_over_by
      ? (await staffNames(db, [cur.taken_over_by])).get(cur.taken_over_by) ?? null
      : null;
  await logActivity({
    actor: actorOf(me),
    action: "chat.takeover",
    entityType: "chat_session",
    entityId: id,
    detail: { label: chatLabel(id), started_at: cur.created_at, ...(from ? { from } : {}) },
  });
  return ok(
    from
      ? `You’ve taken this chat over from ${from}.`
      : "You’ve taken this chat over — the assistant won’t answer until you hand it back."
  );
}

export async function takeOverChat(formData: FormData): Promise<ChatActionResult> {
  const me = await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Invalid request.");
  const db = await createClient();
  const r = await takeOver(db, me, id);
  if (r.ok) revalidateChats(id);
  return r;
}

/**
 * Give the chat back to the assistant — or, for a chat that's only waiting
 * (nobody took it over), dismiss the "Talk to a person" request. Either way
 * the request flag is cleared so it stops lighting the badge.
 */
export async function handBackChat(formData: FormData): Promise<ChatActionResult> {
  const me = await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Invalid request.");

  const db = await createClient();
  const { data: cur, error } = await readState(db, id);
  if (error) return dbFail(error);
  if (!cur) return fail(NOTHING_CHANGED);
  if (cur.mode === "ai" && !cur.wants_human_at) return ok("The assistant already has this chat.");

  const { data, error: upErr } = await db
    .from("chat_sessions")
    .update({ mode: "ai", taken_over_by: null, taken_over_at: null, wants_human_at: null })
    .eq("id", id)
    .eq("mode", cur.mode)
    .select("id");
  if (upErr) return dbFail(upErr);
  if (!data?.length) return fail("Someone else changed this chat just now — refresh and try again.");

  const dismissed = cur.mode === "ai";
  await logActivity({
    actor: actorOf(me),
    action: "chat.handback",
    entityType: "chat_session",
    entityId: id,
    detail: { label: chatLabel(id), started_at: cur.created_at, ...(dismissed ? { dismissed: true } : {}) },
  });
  revalidateChats(id);
  return ok(dismissed ? "Request dismissed." : "Handed back — the assistant answers from the next message.");
}

/**
 * Reply as yourself. Replying to a chat the assistant still has takes it over
 * first (otherwise the AI would answer the visitor's next message over you).
 */
export async function sendChatReply(formData: FormData): Promise<ChatActionResult> {
  const me = await requireStaff();
  const id = str(formData, "id");
  const content = str(formData, "content").trim();
  if (!isUuid(id)) return fail("Invalid request.");
  if (!content) return fail("Write a reply first.", { content: "Write a reply first." });
  if (content.length > MAX_REPLY_CHARS) {
    const msg = `Keep it under ${MAX_REPLY_CHARS} characters — it’s a chat bubble.`;
    return fail(msg, { content: msg });
  }

  const db = await createClient();
  const { data: cur, error } = await readState(db, id);
  if (error) return dbFail(error);
  if (!cur) return fail(NOTHING_CHANGED);

  if (cur.mode === "ai") {
    const taken = await takeOver(db, me, id);
    if (!taken.ok) return taken;
  }

  const { data, error: insErr } = await db
    .from("chat_messages")
    .insert({ session_id: id, role: "human", content, author_id: me.id })
    .select("id")
    .single();
  if (insErr) return dbFail(insErr);

  // you've seen everything up to your own reply
  await db.from("chat_sessions").update({ admin_read_at: new Date().toISOString() }).eq("id", id);

  revalidateChats(id);
  return ok("Sent.", { id: String((data as { id: number }).id) });
}

/** Mark everything up to now as read (the console calls this when you're looking). */
export async function markChatRead(formData: FormData): Promise<ChatActionResult> {
  await requireStaff();
  const id = str(formData, "id");
  if (!isUuid(id)) return fail("Invalid request.");

  const db = await createClient();
  const { data, error } = await db
    .from("chat_sessions")
    .update({ admin_read_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return dbFail(error);
  if (!data?.length) return fail(NOTHING_CHANGED);

  revalidatePath("/admin", "layout");
  return ok("Marked read.");
}
