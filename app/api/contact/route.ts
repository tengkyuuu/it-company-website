import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/contact-schema";
import { sendContactEmail } from "@/lib/email";
import { saveContactLead } from "@/lib/leads";
import { clientIp, consumeLimit, hashKey } from "@/lib/security";
import { site } from "@/lib/site";

export const runtime = "nodejs"; // lib/security uses node:crypto

/**
 * Rate limits (durable, via lib/security's consumeLimit — fails OPEN to a
 * per-instance in-memory limiter, so a paused database never blocks a lead):
 *   - 5 submissions per 10 minutes per visitor (keyed on an HMAC of the IP)
 *   - 200 per day across the whole site, a ceiling on Resend spend if the
 *     per-IP limit is dodged by rotating addresses
 * Charged only once a submission is valid and has passed the anti-spam traps:
 * a silent drop must stay silent (no 429 to tell a bot it was seen) and must
 * not burn a real visitor's allowance.
 */
const PER_IP = { limit: 5, windowSeconds: 10 * 60 };
const GLOBAL = { limit: 200, windowSeconds: 24 * 60 * 60 };

/** " … or email us at x" — only when the studio has a public email (lib/site.ts
 *  ships none until there's a domain). */
const orEmail = (lead: string) =>
  site.email ? `${lead}, or email us directly at ${site.email}.` : `${lead}.`;

// Stable endpoint (no per-build hashed IDs → immune to deployment-skew errors).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const FRIENDLY: Record<string, string> = {
      name: "Please enter your name.",
      email: "Enter a valid email address.",
      service: "Please pick a service.",
      message: "Tell us a little more (10+ characters).",
    };
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] =
          issue.message && issue.message !== "Invalid input"
            ? issue.message
            : FRIENDLY[key] ?? issue.message;
      }
    }
    // honeypot tripped → look like success, give bots no signal
    if (fieldErrors.company) return NextResponse.json({ status: "success" });
    return NextResponse.json({ status: "invalid", fieldErrors });
  }

  const data = parsed.data;

  // anti-spam: filled honeypot or submitted suspiciously fast → silently drop
  if (data.company) return NextResponse.json({ status: "success" });
  if (data.startedAt && Date.now() - data.startedAt < 3000) {
    return NextResponse.json({ status: "success" });
  }

  // Charged BEFORE the email and the lead write. Per-visitor first, so a
  // blocked visitor doesn't also spend the site-wide budget.
  const ip = clientIp(req.headers);
  if (!(await consumeLimit(hashKey("contact:ip", ip ?? "unknown"), PER_IP.limit, PER_IP.windowSeconds))) {
    return NextResponse.json(
      {
        status: "error",
        message: `You’ve sent a few messages in a short time. ${orEmail("Please wait a few minutes and try again")}`,
      },
      { status: 429, headers: { "Retry-After": String(PER_IP.windowSeconds) } }
    );
  }
  if (!(await consumeLimit(hashKey("contact:global"), GLOBAL.limit, GLOBAL.windowSeconds))) {
    return NextResponse.json(
      {
        status: "error",
        message: `We’re receiving an unusual number of messages right now. ${orEmail("Please try again later")}`,
      },
      { status: 429 }
    );
  }

  // Two independent deliveries, in parallel: the studio's email and the inbox
  // record (/admin/inbox). The enquiry has arrived if EITHER worked — the same
  // rule as /api/apply. Until there's a domain, email can only reach the Resend
  // account's owner, and the CMS may be switched off, so neither one alone can
  // be the thing a visitor's success depends on. saveContactLead never throws
  // (false = no DB / write failed); the IP is hashed inside lib/leads.ts.
  const [mailed, filed] = await Promise.all([
    sendContactEmail(data).then(
      () => true,
      (err) => {
        console.error("[contact] email failed:", err);
        return false;
      }
    ),
    saveContactLead({
      name: data.name,
      email: data.email,
      service: data.service,
      message: data.message,
      ip,
    }).catch(() => false),
  ]);

  if (mailed || filed) return NextResponse.json({ status: "success" });

  // Neither: say so plainly. The enquiry is lost, and a success banner here
  // would be a lie the visitor only discovers when nobody replies.
  console.error("[contact] enquiry not delivered: email and inbox both unavailable");
  return NextResponse.json({
    status: "error",
    message: `Something went wrong on our end and your message wasn’t sent. ${orEmail(
      "Please try again in a little while"
    )}`,
  });
}
