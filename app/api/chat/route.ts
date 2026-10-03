import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type Content,
} from "@google/genai";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/chat-context";
import { geminiModel } from "@/lib/chat-config";
import {
  MAX_CHARS,
  MAX_HISTORY_CHARS,
  MAX_TURNS,
  SESSION_ID_RE,
  VISITOR_KEY_RE,
  type ChatEvent,
  type ChatMode,
} from "@/lib/chat-protocol";
import { buildTurnHistory, toGeminiContents, type StoredTurn } from "@/lib/chat-session";
import { addChatMessage, chatHistory, openChatSession } from "@/lib/chat-store";
import { saveChatTranscript } from "@/lib/leads";
import { clientIp, consumeLimit, hashIp, hashKey } from "@/lib/security";

/**
 * The site assistant, on the Gemini API (`@google/genai`), with human takeover.
 *
 * A Route Handler rather than a Server Action for the same reason
 * app/api/contact/route.ts is one: a stable URL survives redeploys, where a
 * Server Action id does not ("Failed to find Server Action" after a deploy).
 *
 * Streams NDJSON — one JSON object per line (full contract in
 * lib/chat-protocol.ts):
 *   {"session":{…}}     mode + whether the conversation is stored
 *   {"t":"..."}         a text delta
 *   {"error":"..."}     something went wrong (can arrive mid-stream)
 *   {"done":true}       finished cleanly
 * Errors are in-band because by the time the model starts producing text the
 * HTTP status is already 200, so a status code can't carry the failure.
 *
 * Conversations (Phase 4): the widget sends a session id + visitor key. The
 * session and every visitor / AI message are stored in chat_sessions /
 * chat_messages (service role, lib/chat-store.ts). When staff have taken the
 * chat over (`mode = 'human'`), the message is stored and Gemini is NOT
 * called — the reply comes from a person, through /admin/chats. In AI mode
 * the model reads the STORED conversation, so after a hand-back it sees what
 * the person said (lib/chat-session.ts → toGeminiContents).
 * If the store is unreachable the bot answers anyway from the browser's own
 * history and the transcript goes to `leads`, as it did before takeover
 * existed. A request with no session at all (a tab still running the
 * previous deploy's widget) takes that same path.
 *
 * With no GEMINI_API_KEY the endpoint returns a friendly 503 and the widget
 * shows "chat isn't configured yet" — the same graceful-degradation posture the
 * contact form and the whole Supabase layer take.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        // our own storage vocabulary; mapped to Gemini's below
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_HISTORY_CHARS),
      })
    )
    .min(1)
    .max(MAX_TURNS)
    // the newest turn is what the visitor just typed
    .refine((m) => m[m.length - 1].role === "user" && m[m.length - 1].content.length <= MAX_CHARS),
  session: z
    .object({
      id: z.string().regex(SESSION_ID_RE),
      key: z.string().regex(VISITOR_KEY_RE),
    })
    .optional(),
});

/**
 * Rate limits — durable and shared across instances via lib/security's
 * consumeLimit (the `consume_security_limit` RPC). It fails OPEN to a
 * per-instance in-memory limiter, so a paused database degrades the limit
 * rather than taking the assistant down.
 *   - 15 messages per 10 minutes per visitor (keyed on an HMAC of the IP)
 *   - 300 per day across the whole site — a hard ceiling on Gemini spend if
 *     the per-IP limit is dodged by rotating addresses
 * Charged after the body validates (junk gets a 400 without a database round
 * trip) and before Gemini is called or anything is stored — in human mode too.
 */
const PER_IP = { limit: 15, windowSeconds: 10 * 60 };
const GLOBAL = { limit: 300, windowSeconds: 24 * 60 * 60 };

const encoder = new TextEncoder();
const line = (obj: ChatEvent) => encoder.encode(JSON.stringify(obj) + "\n");

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no", // don't let a proxy buffer the stream
};

/**
 * A public brand-facing bot shouldn't be the thing that says something ugly, so
 * block at MEDIUM rather than leaving Gemini's defaults. The four categories
 * below are the text-relevant ones; the IMAGE_* categories don't apply here
 * because the widget only ever sends text.
 */
const SAFETY = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({
  category,
  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
}));

/** Why a turn ended, when it wasn't a clean stop. */
function finishMessage(reason: FinishReason | undefined): string | null {
  switch (reason) {
    case undefined:
    case FinishReason.STOP:
      return null;
    case FinishReason.MAX_TOKENS:
      return "I ran out of room there — ask me for a shorter piece of that?";
    case FinishReason.SAFETY:
    case FinishReason.PROHIBITED_CONTENT:
    case FinishReason.BLOCKLIST:
      return "I can’t help with that one. Try asking about our services, or email us.";
    case FinishReason.RECITATION:
      return "I stopped that answer short. Could you rephrase the question?";
    default:
      return "That answer stopped unexpectedly — try rephrasing?";
  }
}

/** hashIp, non-throwing — a session is worth more than its abuse-tracking hash. */
function safeHashIp(ip: string | null) {
  try {
    return hashIp(ip);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chat isn’t configured yet. Please use the contact form." },
      { status: 503 }
    );
  }

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "Message too long or malformed." }, { status: 400 });
  }
  const { messages, session } = parsed.data;
  const message = messages[messages.length - 1].content;

  // Per-visitor first, so a blocked visitor doesn't also spend the site-wide
  // budget. Same {error} JSON shape as every other pre-stream failure.
  const ip = clientIp(req.headers);
  if (!(await consumeLimit(hashKey("chat:ip", ip ?? "unknown"), PER_IP.limit, PER_IP.windowSeconds))) {
    return Response.json(
      { error: "That’s a lot of questions at once — give it a few minutes." },
      { status: 429, headers: { "Retry-After": String(PER_IP.windowSeconds) } }
    );
  }
  if (!(await consumeLimit(hashKey("chat:global"), GLOBAL.limit, GLOBAL.windowSeconds))) {
    return Response.json(
      { error: "The assistant has reached its limit for today. Please use the contact form." },
      { status: 429 }
    );
  }

  // ── the conversation's stored state ─────────────────────────────────────
  let stored = false;
  let mode: ChatMode = "ai";
  if (session) {
    const opened = await openChatSession(session, { create: true, ipHash: safeHashIp(ip) });
    if (opened.state === "forbidden") {
      // the id is someone else's conversation (or a stale tab's) — the widget
      // starts a fresh session on `code: "session"`
      return Response.json(
        { error: "This chat can’t be continued — starting a new one.", code: "session" },
        { status: 403 }
      );
    }
    if (opened.state === "ok") {
      stored = true;
      mode = opened.mode;
    }
  }

  // ── a person has taken over: store it, don't call the model ─────────────
  if (session && stored && mode === "human") {
    const visitorMessageId = await addChatMessage(session.id, "visitor", message);
    if (visitorMessageId === null) {
      return Response.json(
        { error: "Your message didn’t reach the team — try again, or email us." },
        { status: 503 }
      );
    }
    const body =
      JSON.stringify({ session: { mode, stored: true, visitorMessageId } } satisfies ChatEvent) +
      "\n" +
      JSON.stringify({ done: true } satisfies ChatEvent) +
      "\n";
    return new Response(body, { headers: NDJSON_HEADERS });
  }

  // ── AI mode ──────────────────────────────────────────────────────────────
  let visitorMessageId: number | null = null;
  let storedHistory: StoredTurn[] | null = null;
  if (session && stored) {
    // in parallel; buildTurnHistory de-duplicates the new message by id
    [visitorMessageId, storedHistory] = await Promise.all([
      addChatMessage(session.id, "visitor", message),
      chatHistory(session.id, MAX_TURNS),
    ]);
  }
  // Only a conversation whose visitor message landed is "in the store"; any
  // other path keeps the pre-takeover record (a transcript row in leads).
  const persisted = Boolean(session && stored && visitorMessageId !== null);

  // Gemini calls the assistant turn "model", not "assistant" — mapping it wrong
  // makes the model read its own past replies as if the visitor said them.
  // A team member's turns are model turns with a marker (toGeminiContents).
  const contents: Content[] = toGeminiContents(
    buildTurnHistory({
      stored: persisted ? storedHistory : null,
      visitorMessageId,
      client: messages,
      message,
    })
  );

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = await buildSystemPrompt();
  const model = geminiModel();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      if (session) {
        controller.enqueue(line({ session: { mode: "ai", stored: persisted, visitorMessageId } }));
      }
      try {
        const result = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            // The grounding prompt belongs here, NOT as a leading `contents`
            // entry — a system instruction isn't part of the conversation and
            // shouldn't be something the model can be argued out of.
            systemInstruction,
            maxOutputTokens: 1024, // deliberately short: this is a chat bubble
            // low, not zero: the answers are factual lookups over the grounding
            // block, so creativity is a liability here
            temperature: 0.4,
            // a FAQ turn doesn't need deep reasoning, and latency is visible to
            // the visitor in a chat bubble
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            safetySettings: SAFETY,
          },
        });

        let finish: FinishReason | undefined;
        let blocked: string | undefined;

        for await (const chunk of result) {
          // the input itself can be rejected, in which case nothing generates
          blocked ??= chunk.promptFeedback?.blockReason
            ? String(chunk.promptFeedback.blockReason)
            : undefined;

          const candidate = chunk.candidates?.[0];
          if (candidate?.finishReason) finish = candidate.finishReason;

          // `.text` is a getter and is undefined on chunks that carry only
          // metadata (usage, finish reason), so this can't be assumed present
          const delta = chunk.text;
          if (delta) {
            answer += delta;
            controller.enqueue(line({ t: delta }));
          }
        }

        if (blocked && !answer) {
          controller.enqueue(
            line({
              error:
                "I can’t help with that one. Try asking about our services, or email us.",
            })
          );
        } else {
          const note = finishMessage(finish);
          if (note) controller.enqueue(line({ error: note }));
          if (!answer && !note) {
            controller.enqueue(
              line({ error: "I didn’t catch that — could you rephrase?" })
            );
          }
        }

        // Record the answer BEFORE closing: once the response ends, a
        // serverless instance may be frozen and a fire-and-forget write lost.
        // Both writes are bounded (2.5 s timeout / non-throwing) and the
        // visitor already has the whole answer on screen.
        let messageId: number | null = null;
        if (answer) {
          if (persisted && session) {
            messageId = await addChatMessage(session.id, "ai", answer);
          } else {
            // the pre-takeover record. The IP is hashed inside lib/leads.ts.
            await saveChatTranscript({ ip, messages, answer }).catch(() => false);
          }
        }

        controller.enqueue(line({ done: true, messageId }));
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        // Gemini reports a malformed key as 400 INVALID_ARGUMENT, not 401, so a
        // status check alone files "you pasted a bad key" under "bad message"
        // and sends whoever is debugging in the wrong direction. Sniff the text.
        const raw = err instanceof Error ? err.message : String(err);
        const keyProblem = /api[\s_-]?key|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/i.test(
          raw
        );
        const msg =
          status === 429
            ? "We’re a bit busy — try again shortly."
            : keyProblem || status === 401 || status === 403
              ? "Chat isn’t configured correctly."
              : status === 404
                ? "Chat isn’t configured correctly." // usually a GEMINI_MODEL typo
                : status && status >= 400 && status < 500
                  ? "I couldn’t process that message."
                  : "Something went wrong on our side.";
        console.error("[chat] generate failed:", err);
        controller.enqueue(line({ error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: NDJSON_HEADERS });
}
