import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/contact-schema";
import { sendContactEmail } from "@/lib/email";
import { site } from "@/lib/site";

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

  try {
    await sendContactEmail(data);
    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("[contact] send failed:", err);
    return NextResponse.json({
      status: "error",
      message: `Something went wrong on our end. Please email us directly at ${site.email}.`,
    });
  }
}
