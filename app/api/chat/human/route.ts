import { z } from "zod";
import { SESSION_ID_RE, VISITOR_KEY_RE } from "@/lib/chat-protocol";
import { requestHuman } from "@/lib/chat-store";
import { clientIp, consumeLimit, hashIp, hashKey } from "@/lib/security";

/**
 * POST /api/chat/human  { session: { id, key } }
 *
 * The widget's "Talk to a person": stamps chat_sessions.wants_human_at so the
 * conversation jumps to the top of /admin/chats and lights the nav badge.
 * Nothing is promised to the visitor beyond that — the widget says plainly
 * that someone replies when they're available.
 *
 * Rate-limited per IP (it's a "get a human's attention" button, so a burst is
 * abuse, not use). Fails OPEN like the rest of the chat.
 */

export const runtime = "nodejs";

const PER_IP = { limit: 5, windowSeconds: 10 * 60 };

const Body = z.object({
  session: z.object({
    id: z.string().regex(SESSION_ID_RE),
    key: z.string().regex(VISITOR_KEY_RE),
  }),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400, headers: NO_STORE });
  }
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400, headers: NO_STORE });
  }

  const ip = clientIp(req.headers);
  if (!(await consumeLimit(hashKey("chat:human:ip", ip ?? "unknown"), PER_IP.limit, PER_IP.windowSeconds))) {
    return Response.json(
      { ok: false, error: "rate" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(PER_IP.windowSeconds) } }
    );
  }

  let ipHash: string | null = null;
  try {
    ipHash = hashIp(ip);
  } catch {
    // not worth failing the request over
  }

  const result = await requestHuman(parsed.data.session, ipHash);
  switch (result.state) {
    case "ok":
      return Response.json({ ok: true, mode: result.mode, wantsHuman: true }, { headers: NO_STORE });
    case "forbidden":
      return Response.json({ ok: false, error: "session" }, { status: 403, headers: NO_STORE });
    default:
      return Response.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
