import { NextResponse } from "next/server";
import { APPLY_FIELDS, applySchema, type ApplyField, type ApplyState } from "@/lib/apply-schema";
import { getJobById } from "@/lib/cms";
import { sendApplicationEmail } from "@/lib/email";
import { saveApplicationLead } from "@/lib/leads";
import { clientIp, consumeLimit, hashKey } from "@/lib/security";

export const runtime = "nodejs"; // lib/security uses node:crypto

/**
 * Job applications from /careers/[slug].
 *
 * A Route Handler, not a Server Action, for the same reason as /api/contact: a
 * stable URL survives redeploys (no per-build action ids, so no "Failed to find
 * Server Action" for someone who opened the page before a deploy).
 *
 * Order matters — each step only runs once the cheaper ones have passed:
 *   1. parse + validate (lib/apply-schema.ts). Honeypot / time-trap trips are
 *      SILENT successes: no limit charged, nothing written, nothing sent — a bot
 *      learns nothing and a real visitor's allowance isn't burnt.
 *   2. durable rate limits (lib/security consumeLimit — fails OPEN to the
 *      per-instance limiter, so a paused database can't block an applicant):
 *        3 per 10 minutes per visitor (HMAC of the IP), then
 *        100 per day across the site (a ceiling on inbox/Resend abuse when
 *        the per-IP limit is dodged by rotating addresses).
 *      Charged BEFORE the role lookup, the write and the email, so a flood
 *      can't use this endpoint to hammer the database either.
 *   3. the role is re-checked HERE, not trusted from the page: it must exist,
 *      be published and not be closed (closing is decided at request time in
 *      Asia/Manila — a page prerendered yesterday may still show the form).
 *   4. record the lead (service role, never throws) and email the studio, in
 *      parallel. Success if EITHER landed — with Resend unconfigured the inbox
 *      is the record; with the database down the email is. Neither → an error
 *      that tells the applicant to email us instead.
 *
 * Responses carry codes / field names, never sentences: the form turns them
 * into the visitor's language from the dictionary.
 */
const PER_IP = { limit: 3, windowSeconds: 10 * 60 };
const GLOBAL = { limit: 100, windowSeconds: 24 * 60 * 60 };

const reply = (body: ApplyState, init?: ResponseInit) => NextResponse.json(body, init);
const isField = (k: unknown): k is ApplyField =>
  typeof k === "string" && (APPLY_FIELDS as readonly string[]).includes(k);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ status: "error", code: "request" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    const keys = new Set(parsed.error.issues.map((i) => i.path[0]));
    // honeypot tripped → look like success, give bots no signal
    if (keys.has("company")) return reply({ status: "success" });
    // a missing / malformed role id is a tampered or broken form, not a typo
    if (keys.has("jobId")) return reply({ status: "error", code: "request" }, { status: 400 });
    const fields = [...keys].filter(isField);
    if (!fields.length) return reply({ status: "error", code: "request" }, { status: 400 });
    return reply({ status: "invalid", fields });
  }

  const data = parsed.data;

  // anti-spam: filled honeypot or submitted suspiciously fast → silently drop
  if (data.company) return reply({ status: "success" });
  if (data.startedAt && Date.now() - data.startedAt < 3000) return reply({ status: "success" });

  // per-visitor first, so a blocked visitor doesn't also spend the site-wide budget
  const ip = clientIp(req.headers);
  if (!(await consumeLimit(hashKey("apply:ip", ip ?? "unknown"), PER_IP.limit, PER_IP.windowSeconds))) {
    return reply(
      { status: "error", code: "rate" },
      { status: 429, headers: { "Retry-After": String(PER_IP.windowSeconds) } }
    );
  }
  if (!(await consumeLimit(hashKey("apply:global"), GLOBAL.limit, GLOBAL.windowSeconds))) {
    return reply({ status: "error", code: "busy" }, { status: 429 });
  }

  const job = await getJobById(data.jobId);
  // couldn't ask (no database / it's down): we can't vouch for the role, so
  // don't take the application — the applicant is told to email instead
  if (job === undefined) return reply({ status: "error", code: "server" }, { status: 503 });
  if (job === null || job.closed) return reply({ status: "error", code: "closed" }, { status: 410 });

  const application = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    links: data.links,
    message: data.message,
  };

  const [saved, emailed] = await Promise.all([
    // never throws; false with no database
    saveApplicationLead({ jobId: job.id, jobTitle: job.title, ...application, ip }),
    sendApplicationEmail({ jobTitle: job.title, application }).catch((err) => {
      console.error("[apply] email failed:", err instanceof Error ? err.message : err);
      return false;
    }),
  ]);

  if (!saved && !emailed) {
    return reply({ status: "error", code: "server" }, { status: 502 });
  }
  return reply({ status: "success" });
}
