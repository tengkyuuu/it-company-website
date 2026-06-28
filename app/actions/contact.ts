"use server";

import { contactSchema, type ContactState } from "@/lib/contact-schema";
import { sendContactEmail } from "@/lib/email";
import { site } from "@/lib/site";

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    // Friendly fallbacks (zod's generic "Invalid input" → clear copy).
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
    if (fieldErrors.company) return { status: "success" };
    return { status: "invalid", fieldErrors };
  }

  const data = parsed.data;

  // anti-spam: filled honeypot or submitted suspiciously fast → silently drop
  if (data.company) return { status: "success" };
  if (data.startedAt && Date.now() - data.startedAt < 3000) {
    return { status: "success" };
  }

  try {
    await sendContactEmail(data);
    return { status: "success" };
  } catch {
    const to = process.env.CONTACT_TO_EMAIL || site.email;
    return {
      status: "error",
      message: `Something went wrong sending your message. Please email us directly at ${to}.`,
    };
  }
}
