import { createClient } from "@/lib/supabase/server";
import { LEAD_LITE_COLUMNS, threadLeads, type LeadLite } from "@/app/admin/_lib/inbox";
import { ATTENTION_FILTER, needsAttention, type ConsoleSessionRow } from "@/app/admin/_lib/chats";
import AdminNavLinks from "./AdminNavLinks";

/**
 * Server half of the admin nav: works out the badge counts, then hands the
 * links to the client half (which needs usePathname for the active state).
 *
 * Inbox: counts conversations, not rows — a legacy chat wrote one snapshot row
 * per exchange, and threadLeads() folds those back together exactly as the
 * inbox page does.
 * Live chat: chats that need a person — waiting after "Talk to a person", or
 * taken over with an unread visitor message (app/admin/_lib/chats.ts). An
 * AI-only chat doesn't light it: the assistant already answered.
 * Both best-effort: a missing table or a failed query just means no badge.
 * The two queries run in parallel and neither can fail the other.
 */
export default async function AdminNav() {
  let open = 0;
  let chats = 0;
  try {
    const supabase = await createClient();
    const [leads, sessions] = await Promise.all([
      supabase
        .from("leads")
        .select(LEAD_LITE_COLUMNS)
        .eq("handled", false)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("chat_sessions")
        .select("id, mode, wants_human_at, last_visitor_at, admin_read_at")
        .or(ATTENTION_FILTER)
        .order("last_message_at", { ascending: false })
        .limit(200),
    ]);
    if (!leads.error && leads.data) open = threadLeads(leads.data as unknown as LeadLite[]).length;
    if (!sessions.error && sessions.data) {
      chats = (sessions.data as unknown as ConsoleSessionRow[]).filter(needsAttention).length;
    }
  } catch {
    // no badges
  }

  return <AdminNavLinks badges={{ "/admin/inbox": open, "/admin/chats": chats }} />;
}
