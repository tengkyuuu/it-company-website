import { createClient } from "@/lib/supabase/server";
import { LEAD_LITE_COLUMNS, threadLeads, type LeadLite } from "@/app/admin/_lib/inbox";
import AdminNavLinks from "./AdminNavLinks";

/**
 * Server half of the admin nav: works out the open-inbox count, then hands the
 * links to the client half (which needs usePathname for the active state).
 *
 * Counts conversations, not rows — a chat writes one snapshot row per exchange,
 * and threadLeads() folds those back together exactly as the inbox page does.
 * Best-effort: a missing `leads` table or a failed query just means no badge.
 */
export default async function AdminNav() {
  let open = 0;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_LITE_COLUMNS)
      .eq("handled", false)
      .order("created_at", { ascending: false })
      .limit(300);
    if (!error && data) open = threadLeads(data as unknown as LeadLite[]).length;
  } catch {
    // no badge
  }

  return <AdminNavLinks badges={{ "/admin/inbox": open }} />;
}
