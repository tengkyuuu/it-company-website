import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid, requireStaffForRoute } from "@/app/admin/_lib/server";
import { loadConsole } from "@/app/admin/_lib/chat-console";
import type { ConsolePoll } from "@/app/admin/_lib/chats";

/**
 * GET /api/admin/chats?session=<uuid>&after=<id> — the console's transcript
 * poll (components/admin/ChatConsole.tsx), every 4–15 s while the tab is
 * visible.
 *
 * A Route Handler, not a Server Action: Next runs a client's server actions
 * one at a time, so a poll queued as an action would hold up the "Send" click
 * behind it. Guarded like every app/api/admin route (requireStaffForRoute —
 * tests/route-guards.test.ts), and it reads through the cookie client, so RLS
 * applies on top.
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const gate = await requireStaffForRoute();
  if ("response" in gate) return gate.response;

  const url = new URL(req.url);
  const session = url.searchParams.get("session") ?? "";
  const afterRaw = url.searchParams.get("after") ?? "0";
  const after = /^\d{1,15}$/.test(afterRaw) ? Number(afterRaw) : NaN;
  if (!isUuid(session) || !Number.isSafeInteger(after)) {
    return NextResponse.json({ ok: false, error: "Malformed request." } satisfies ConsolePoll, {
      status: 400,
      headers: NO_STORE,
    });
  }

  const db = await createClient();
  const load = await loadConsole(db, session, after);
  if (!load.ok) {
    return NextResponse.json({ ok: false, error: load.error, gone: load.gone } satisfies ConsolePoll, {
      status: load.gone ? 404 : 503,
      headers: NO_STORE,
    });
  }
  return NextResponse.json(
    { ok: true, session: load.session, messages: load.messages } satisfies ConsolePoll,
    { headers: NO_STORE }
  );
}
