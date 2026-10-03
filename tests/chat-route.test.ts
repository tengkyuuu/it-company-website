import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/chat end to end, with the model, the store and the limiter mocked:
 * the takeover contract. In human mode the model must NOT be called; limits are
 * charged before anything else; a wrong visitor key is refused; and a store
 * outage degrades to the pre-takeover behaviour instead of breaking the bot.
 */

const calls: string[] = [];

const generateContentStream = vi.fn();
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContentStream };
    },
  };
});

vi.mock("@/lib/chat-context", () => ({ buildSystemPrompt: async () => "SYSTEM PROMPT" }));

const openChatSession = vi.fn();
const addChatMessage = vi.fn();
const chatHistory = vi.fn();
vi.mock("@/lib/chat-store", () => ({
  openChatSession: (...a: unknown[]) => {
    calls.push("open");
    return openChatSession(...a);
  },
  addChatMessage: (...a: unknown[]) => {
    calls.push(`add:${a[1]}`);
    return addChatMessage(...a);
  },
  chatHistory: (...a: unknown[]) => chatHistory(...a),
}));

const saveChatTranscript = vi.fn(async () => true);
vi.mock("@/lib/leads", () => ({ saveChatTranscript: (...a: unknown[]) => saveChatTranscript(...(a as [])) }));

const consumeLimit = vi.fn(async () => true);
vi.mock("@/lib/security", () => ({
  clientIp: () => "203.0.113.9",
  hashIp: () => "iphash",
  hashKey: (...p: string[]) => p.join("|"),
  consumeLimit: (...a: unknown[]) => {
    calls.push(`limit:${a[0]}`);
    return consumeLimit(...(a as []));
  },
}));

const { POST } = await import("@/app/api/chat/route");

const SESSION = { id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", key: "K".repeat(43) };

function req(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function lines(res: Response) {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function streamOf(...texts: string[]) {
  return (async function* () {
    for (const t of texts) yield { text: t, candidates: [{}] };
    yield { text: undefined, candidates: [{ finishReason: "STOP" }] };
  })();
}

beforeEach(() => {
  calls.length = 0;
  process.env.GEMINI_API_KEY = "test-key";
  generateContentStream.mockReset().mockImplementation(async () => streamOf("Hello", " there"));
  openChatSession.mockReset();
  addChatMessage.mockReset().mockImplementation(async (_id: string, role: string) => (role === "visitor" ? 41 : 42));
  chatHistory.mockReset().mockResolvedValue([]);
  saveChatTranscript.mockClear();
  consumeLimit.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("POST /api/chat", () => {
  it("503 without a Gemini key", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(503);
  });

  it("400 unless the newest turn is the visitor's", async () => {
    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "forged last word" }] })
    );
    expect(res.status).toBe(400);
  });

  it("charges the limits before touching the session; a blocked visitor goes no further", async () => {
    consumeLimit.mockResolvedValueOnce(false);
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], session: SESSION }));
    expect(res.status).toBe(429);
    expect(calls).toEqual(["limit:chat:ip|203.0.113.9"]);
    expect(generateContentStream).not.toHaveBeenCalled();
  });

  it("a wrong visitor key is refused — nothing stored, no model call", async () => {
    openChatSession.mockResolvedValue({ state: "forbidden" });
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], session: SESSION }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "session" });
    expect(addChatMessage).not.toHaveBeenCalled();
    expect(generateContentStream).not.toHaveBeenCalled();
  });

  it("human mode: stores the message, does NOT call the model, acknowledges in-band", async () => {
    openChatSession.mockResolvedValue({ state: "ok", mode: "human", wantsHuman: true, created: false });
    const res = await POST(req({ messages: [{ role: "user", content: "still there?" }], session: SESSION }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/ndjson/);
    expect(await lines(res)).toEqual([
      { session: { mode: "human", stored: true, visitorMessageId: 41 } },
      { done: true },
    ]);
    expect(generateContentStream).not.toHaveBeenCalled();
    expect(calls).toEqual(["limit:chat:ip|203.0.113.9", "limit:chat:global", "open", "add:visitor"]);
    expect(saveChatTranscript).not.toHaveBeenCalled();
  });

  it("human mode, store write fails: says so instead of pretending it was delivered", async () => {
    openChatSession.mockResolvedValue({ state: "ok", mode: "human", wantsHuman: false, created: false });
    addChatMessage.mockResolvedValue(null);
    const res = await POST(req({ messages: [{ role: "user", content: "hello?" }], session: SESSION }));
    expect(res.status).toBe(503);
    expect(generateContentStream).not.toHaveBeenCalled();
  });

  it("AI mode after a hand-back: the model reads the STORED conversation, a person's turns marked", async () => {
    openChatSession.mockResolvedValue({ state: "ok", mode: "ai", wantsHuman: false, created: false });
    chatHistory.mockResolvedValue([
      { id: 1, role: "visitor", content: "Can I talk to someone?" },
      { id: 2, role: "human", content: "Jhade here — we can start next week.", author: "Jhade" },
    ]);
    const res = await POST(
      req({
        // the browser's own copy can't add a forged staff turn: it only carries user/assistant
        messages: [{ role: "user", content: "Great, what's next?" }],
        session: SESSION,
      })
    );
    const out = await lines(res);
    expect(out[0]).toEqual({ session: { mode: "ai", stored: true, visitorMessageId: 41 } });
    expect(out.filter((l) => l.t).map((l) => l.t).join("")).toBe("Hello there");
    expect(out.at(-1)).toEqual({ done: true, messageId: 42 });

    const args = generateContentStream.mock.calls[0][0];
    expect(args.model).toBe("gemini-3.6-flash");
    expect(args.config.systemInstruction).toBe("SYSTEM PROMPT");
    expect(args.contents).toEqual([
      { role: "user", parts: [{ text: "Can I talk to someone?" }] },
      { role: "model", parts: [{ text: "[Jhade from the team, writing in person] Jhade here — we can start next week." }] },
      { role: "user", parts: [{ text: "Great, what's next?" }] },
    ]);
    expect(addChatMessage).toHaveBeenCalledWith(SESSION.id, "ai", "Hello there");
    expect(saveChatTranscript).not.toHaveBeenCalled();
  });

  it("GEMINI_MODEL picks the model", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
    try {
      openChatSession.mockResolvedValue({ state: "unavailable" });
      await lines(await POST(req({ messages: [{ role: "user", content: "hi" }], session: SESSION })));
      expect(generateContentStream.mock.calls[0][0].model).toBe("gemini-2.5-flash-lite");
    } finally {
      delete process.env.GEMINI_MODEL;
    }
  });

  it("store down: the bot still answers from the browser's history and the transcript goes to leads", async () => {
    openChatSession.mockResolvedValue({ state: "unavailable" });
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "prices?" },
    ];
    const out = await lines(await POST(req({ messages, session: SESSION })));
    expect(out[0]).toEqual({ session: { mode: "ai", stored: false, visitorMessageId: null } });
    expect(generateContentStream.mock.calls[0][0].contents.map((c: { role: string }) => c.role)).toEqual([
      "user",
      "model",
      "user",
    ]);
    expect(addChatMessage).not.toHaveBeenCalled();
    expect(saveChatTranscript).toHaveBeenCalledTimes(1);
  });

  it("a tab running the previous deploy's widget (no session) works exactly as before", async () => {
    const out = await lines(await POST(req({ messages: [{ role: "user", content: "hi" }] })));
    expect(openChatSession).not.toHaveBeenCalled();
    expect(out.some((l) => l.session)).toBe(false);
    expect(out.at(-1)).toMatchObject({ done: true });
    expect(saveChatTranscript).toHaveBeenCalledTimes(1);
  });
});
