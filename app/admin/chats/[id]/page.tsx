import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import { Notice } from "@/components/admin/ui";
import SetupNotice from "@/components/admin/SetupNotice";
import ChatConsole from "@/components/admin/ChatConsole";
import { isUuid, requireStaff } from "../../_lib/server";
import { loadConsole } from "../../_lib/chat-console";
import { chatLabel } from "../../_lib/chats";

export const metadata = { title: "Live chat", robots: { index: false } };

/**
 * One conversation: the transcript, Take over / Hand back, and a reply box.
 * Rendered once on the server; ChatConsole then polls
 * /api/admin/chats for new messages while the tab is visible.
 */
export default async function AdminChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const me = await requireStaff();
  const db = await createClient();
  const load = await loadConsole(db, id);

  if (!load.ok) {
    if (load.gone) notFound();
    return (
      <div className="space-y-6">
        <Link href="/admin/chats" className="text-sm text-ink/60 hover:text-ink">
          ← All chats
        </Link>
        <Notice tone={load.notSetUp ? "warn" : "error"} title="Couldn’t load this chat">
          {load.error}
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href="/admin/chats"
          className="rounded-lg text-sm text-ink/60 transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
        >
          ← All chats
        </Link>
        <span className="font-mono text-[11px] text-ink/45">{chatLabel(id)}</span>
      </div>
      <ChatConsole
        key={id}
        initialSession={load.session}
        initialMessages={load.messages}
        meId={me.id}
      />
    </div>
  );
}
