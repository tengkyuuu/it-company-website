import {
  SESSION_ID_RE,
  VISITOR_KEY_HEADER,
  VISITOR_KEY_RE,
  type PollResponse,
} from "@/lib/chat-protocol";
import { chatStoreConfigured, readChatSession } from "@/lib/chat-store";
import { clientIp, consumeLimit, hashKey } from "@/lib/security";

/**
 * GET /api/chat/messages?session=<uuid>&after=<id>   (header x-chat-key)
 *
 * The visitor's widget polling for a person's replies: messages with id >
 * `after` (oldest first, at most 50) plus the session's current mode. The key
 * travels in a header, not the query string, so it never lands in an access
 * log or a Referer. Without the right key a session is indistinguishable from
 * someone else's: 403.
 *
 * The widget only polls while its panel is open, the tab is visible and a
 * person could plausibly be writing (lib/chat-protocol.ts → nextPollDelay), so
 * this is cheap in practice; the limit is generous (an engaged chat polls
 * every 4 s at most — 150 per 10 minutes) and fails OPEN, like the chat
 * itself, so a paused database doesn't turn into a wall of 429s.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_IP = { limit: 240, windowSeconds: 10 * 60 };

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session") ?? "";
  const afterRaw = url.searchParams.get("after") ?? "0";
  const key = req.headers.get(VISITOR_KEY_HEADER) ?? "";
  const after = /^\d{1,15}$/.test(afterRaw) ? Number(afterRaw) : NaN;

  if (!SESSION_ID_RE.test(session) || !VISITOR_KEY_RE.test(key) || !Number.isSafeInteger(after)) {
    return json({ error: "Malformed request." }, 400);
  }

  const ip = clientIp(req.headers);
  if (!(await consumeLimit(hashKey("chat:poll:ip", ip ?? "unknown"), PER_IP.limit, PER_IP.windowSeconds))) {
    return json({ error: "Slow down a little." }, 429, { "Retry-After": "60" });
  }

  if (!chatStoreConfigured()) return json({ error: "Live chat isn’t set up." }, 503);

  const result = await readChatSession({ id: session, key }, after);
  switch (result.state) {
    case "ok":
      return json({
        mode: result.mode,
        wantsHuman: result.wantsHuman,
        messages: result.messages,
      } satisfies PollResponse);
    case "forbidden":
      return json({ error: "Not your conversation." }, 403);
    case "missing":
      return json({ error: "No such conversation." }, 404);
    default:
      return json({ error: "Live chat is unavailable right now." }, 503, { "Retry-After": "30" });
  }
}
