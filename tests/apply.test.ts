import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/cms";

/**
 * The job-application endpoint (app/api/apply/route.ts) and its schema.
 * What must never happen silently:
 *  - an application recorded or emailed after the limiter said no;
 *  - an application accepted for a closed, unpublished or deleted role (the
 *    page that showed the form may be a day old);
 *  - a non-https link, or more than three, getting through;
 *  - a honeypot / too-fast submission costing a real visitor their allowance.
 * The database, Resend and the limiter are mocked; the route's own logic runs.
 */

const getJobById = vi.fn<(id: string) => Promise<Job | null | undefined>>();
const saveApplicationLead = vi.fn<(input: Record<string, unknown>) => Promise<boolean>>();
const sendApplicationEmail = vi.fn<(input: Record<string, unknown>) => Promise<boolean>>();
const consumeLimit = vi.fn<(key: string, limit: number, windowSeconds: number) => Promise<boolean>>();

vi.mock("@/lib/cms", () => ({ getJobById: (id: string) => getJobById(id) }));
vi.mock("@/lib/leads", () => ({
  saveApplicationLead: (i: Record<string, unknown>) => saveApplicationLead(i),
}));
vi.mock("@/lib/email", () => ({
  sendApplicationEmail: (i: Record<string, unknown>) => sendApplicationEmail(i),
}));
vi.mock("@/lib/security", () => ({
  clientIp: () => "203.0.113.7",
  hashKey: (...parts: string[]) => parts.join("|"),
  consumeLimit: (k: string, l: number, w: number) => consumeLimit(k, l, w),
}));

const { POST } = await import("@/app/api/apply/route");
const { applySchema, isApplyLink, MAX_APPLY_LINKS } = await import("@/lib/apply-schema");

const JOB_ID = "6f1c2a1e-1b2c-4d3e-8f90-0a1b2c3d4e5f";

const job = (over: Partial<Job> = {}): Job => ({
  id: JOB_ID,
  slug: "frontend-engineer",
  title: "Frontend Engineer",
  employmentType: "full-time",
  workplace: "hybrid",
  summary: "",
  description: "",
  responsibilities: [],
  requirements: [],
  closed: false,
  updatedAt: "2026-10-01T00:00:00Z",
  ...over,
});

const valid = (over: Record<string, unknown> = {}) => ({
  jobId: JOB_ID,
  name: "Maria Santos",
  email: "maria@example.com",
  phone: "+63 912 345 6789",
  links: "https://maria.dev\nhttps://www.linkedin.com/in/maria",
  message: "I've shipped design systems for three years and would love to help.",
  company: "",
  startedAt: Date.now() - 60_000,
  ...over,
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  getJobById.mockReset().mockResolvedValue(job());
  saveApplicationLead.mockReset().mockResolvedValue(true);
  sendApplicationEmail.mockReset().mockResolvedValue(true);
  consumeLimit.mockReset().mockResolvedValue(true);
});

describe("applySchema", () => {
  it("accepts a complete application and splits the links textarea", () => {
    const r = applySchema.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.links).toEqual(["https://maria.dev", "https://www.linkedin.com/in/maria"]);
  });

  it("phone and links are optional", () => {
    const r = applySchema.safeParse(valid({ phone: undefined, links: undefined }));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("");
      expect(r.data.links).toEqual([]);
    }
  });

  it.each([
    "http://maria.dev",
    "javascript:alert(1)",
    "data:text/html,hi",
    "//maria.dev",
    "maria.dev",
    "https://localhost",
    "ftp://maria.dev/cv.pdf",
  ])("refuses the link %s", (link) => {
    expect(isApplyLink(link)).toBe(false);
    const r = applySchema.safeParse(valid({ links: link }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe("links");
  });

  it(`allows at most ${MAX_APPLY_LINKS} links (duplicates collapse first)`, () => {
    const four = ["https://a.dev", "https://b.dev", "https://c.dev", "https://d.dev"];
    expect(applySchema.safeParse(valid({ links: four.join("\n") })).success).toBe(false);
    expect(applySchema.safeParse(valid({ links: four.slice(0, 3) })).success).toBe(true);
    expect(applySchema.safeParse(valid({ links: "https://a.dev https://a.dev, https://a.dev" })).success).toBe(true);
  });

  it.each([
    ["jobId", { jobId: "not-a-uuid" }],
    ["name", { name: "M" }],
    ["email", { email: "maria@" }],
    ["phone", { phone: "call me maybe" }],
    ["message", { message: "hi" }],
    ["message", { message: "x".repeat(4001) }],
    ["company", { company: "Acme" }],
  ])("refuses a bad %s", (field, over) => {
    const r = applySchema.safeParse(valid(over));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe("POST /api/apply", () => {
  it("records, emails and succeeds for an open role", async () => {
    const res = await post(valid());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
    expect(saveApplicationLead).toHaveBeenCalledTimes(1);
    expect(saveApplicationLead.mock.calls[0][0]).toMatchObject({
      jobId: JOB_ID,
      jobTitle: "Frontend Engineer",
      email: "maria@example.com",
      links: ["https://maria.dev", "https://www.linkedin.com/in/maria"],
      ip: "203.0.113.7", // hashed inside lib/leads, never stored raw
    });
    expect(sendApplicationEmail).toHaveBeenCalledTimes(1);
    expect(sendApplicationEmail.mock.calls[0][0]).toMatchObject({ jobTitle: "Frontend Engineer" });
  });

  it("charges 3 / 10 min per IP, then 100 / day globally", async () => {
    await post(valid());
    expect(consumeLimit.mock.calls).toEqual([
      ["apply:ip|203.0.113.7", 3, 600],
      ["apply:global", 100, 86400],
    ]);
  });

  it("per-IP limit refused → 429, no lookup, no lead, no email", async () => {
    consumeLimit.mockResolvedValueOnce(false);
    const res = await post(valid());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ status: "error", code: "rate" });
    expect(consumeLimit).toHaveBeenCalledTimes(1); // the global budget isn't spent
    expect(getJobById).not.toHaveBeenCalled();
    expect(saveApplicationLead).not.toHaveBeenCalled();
    expect(sendApplicationEmail).not.toHaveBeenCalled();
  });

  it("global limit refused → 429 busy, no lead, no email", async () => {
    consumeLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await post(valid());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ status: "error", code: "busy" });
    expect(saveApplicationLead).not.toHaveBeenCalled();
    expect(sendApplicationEmail).not.toHaveBeenCalled();
  });

  it("closed role → refused, nothing recorded or sent", async () => {
    getJobById.mockResolvedValue(job({ closed: true, closesAt: "2026-09-30" }));
    const res = await post(valid());
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ status: "error", code: "closed" });
    expect(saveApplicationLead).not.toHaveBeenCalled();
    expect(sendApplicationEmail).not.toHaveBeenCalled();
  });

  it("unpublished / deleted role → refused as closed", async () => {
    getJobById.mockResolvedValue(null);
    const res = await post(valid());
    expect(await res.json()).toEqual({ status: "error", code: "closed" });
    expect(saveApplicationLead).not.toHaveBeenCalled();
    expect(sendApplicationEmail).not.toHaveBeenCalled();
  });

  it("can't check the role (database down) → server error, nothing recorded", async () => {
    getJobById.mockResolvedValue(undefined);
    const res = await post(valid());
    expect(await res.json()).toEqual({ status: "error", code: "server" });
    expect(saveApplicationLead).not.toHaveBeenCalled();
    expect(sendApplicationEmail).not.toHaveBeenCalled();
  });

  it("honeypot → silent success, no limit charged, nothing recorded", async () => {
    const res = await post(valid({ company: "Acme Bots" }));
    expect(await res.json()).toEqual({ status: "success" });
    expect(consumeLimit).not.toHaveBeenCalled();
    expect(saveApplicationLead).not.toHaveBeenCalled();
    expect(sendApplicationEmail).not.toHaveBeenCalled();
  });

  it("submitted in under 3 s → silent success, nothing charged or recorded", async () => {
    const res = await post(valid({ startedAt: Date.now() - 500 }));
    expect(await res.json()).toEqual({ status: "success" });
    expect(consumeLimit).not.toHaveBeenCalled();
    expect(saveApplicationLead).not.toHaveBeenCalled();
  });

  it("invalid fields → names them (no limit charged, nothing recorded)", async () => {
    const res = await post(valid({ email: "nope", links: "http://insecure.dev" }));
    expect(await res.json()).toEqual({ status: "invalid", fields: ["email", "links"] });
    expect(consumeLimit).not.toHaveBeenCalled();
    expect(saveApplicationLead).not.toHaveBeenCalled();
  });

  it("malformed JSON or a tampered job id → request error", async () => {
    expect(await (await post("{not json")).json()).toEqual({ status: "error", code: "request" });
    expect(await (await post(valid({ jobId: "x" }))).json()).toEqual({ status: "error", code: "request" });
    expect(getJobById).not.toHaveBeenCalled();
  });

  it("Resend not configured: recorded in the inbox → still a success", async () => {
    sendApplicationEmail.mockResolvedValue(false);
    expect(await (await post(valid())).json()).toEqual({ status: "success" });
  });

  it("email fails but the inbox write landed → success", async () => {
    sendApplicationEmail.mockRejectedValue(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await post(valid())).json()).toEqual({ status: "success" });
  });

  it("neither recorded nor emailed → server error (the form says: email us)", async () => {
    saveApplicationLead.mockResolvedValue(false);
    sendApplicationEmail.mockResolvedValue(false);
    const res = await post(valid());
    expect(await res.json()).toEqual({ status: "error", code: "server" });
  });
});
