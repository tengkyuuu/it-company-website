import { Resend } from "resend";
import { site } from "@/lib/site";
import type { ContactInput } from "@/lib/contact-schema";
import type { ApplyInput } from "@/lib/apply-schema";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!
  );

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 16px 6px 0;color:#94a3b8;font:13px/1.5 -apple-system,sans-serif;vertical-align:top">${label}</td><td style="padding:6px 0;color:#1e293b;font:14px/1.6 -apple-system,sans-serif">${value}</td></tr>`;

/** Sends the studio notification + a best-effort auto-reply to the sender. */
export async function sendContactEmail(data: ContactInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const to = process.env.CONTACT_TO_EMAIL || site.email;
  // Unquoted is correct here. The old mykTech() name HAD to be quoted, because
  // "()" are RFC 5322 comment delimiters. "R Ally's Tech" has no parens, and an
  // apostrophe is valid atext, so each word is a legal atom — quoting it would
  // only add noise. (Don't "fix" this by wrapping it in single quotes either:
  // see the .env.example note about the apostrophe closing a dotenv literal.)
  const from =
    process.env.CONTACT_FROM_EMAIL || `R Ally's Tech <onboarding@resend.dev>`;
  const resend = new Resend(apiKey);

  const name = esc(data.name);
  const email = esc(data.email);
  const service = esc(data.service);
  const message = esc(data.message).replace(/\n/g, "<br>");

  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: data.email,
    subject: `New enquiry — ${service}`,
    text: `New enquiry via ${site.name}\n\nName: ${data.name}\nEmail: ${data.email}\nService: ${data.service}\n\n${data.message}`,
    html: `<div style="max-width:560px;margin:auto">
      <p style="font:600 13px/1 -apple-system,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">New enquiry · ${site.name}</p>
      <table style="margin-top:12px;border-collapse:collapse;width:100%">
        ${row("Name", name)}
        ${row("Email", `<a href="mailto:${email}" style="color:#1e293b">${email}</a>`)}
        ${row("Service", service)}
        ${row("Message", message)}
      </table>
    </div>`,
  });
  if (error) throw new Error(error.message || "Email send failed");

  // Auto-reply — never fail the submission if this errors.
  try {
    await resend.emails.send({
      from,
      to: data.email,
      subject: `Thanks for reaching out to ${site.name}`,
      text: `Hi ${data.name},\n\nThanks for getting in touch with ${site.name} — we've got your message and a real human will reply within one business day.\n\n— The ${site.name} studio`,
      html: `<div style="max-width:520px;margin:auto;font:15px/1.6 -apple-system,sans-serif;color:#1e293b">
        <p>Hi ${name},</p>
        <p>Thanks for getting in touch with <strong>${site.name}</strong> — we've got your message and a real human will reply within one business day.</p>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">— The ${site.name} studio · ${esc(
          site.address.line2
        )}</p>
      </div>`,
    });
  } catch {
    // ignore auto-reply failures
  }
}

/**
 * Tells the studio about a job application (app/api/apply/route.ts).
 *
 * Returns false — without throwing — when Resend isn't configured: the
 * application is still recorded in the inbox, so the applicant sees success.
 * Throws if Resend is configured but the send fails (the route treats that as
 * "not emailed", and still succeeds if the inbox write did).
 *
 * `replyTo` is the applicant, so "Reply" in the studio's mail client answers
 * them. Every applicant-supplied value is escaped in the HTML part; links are
 * listed as TEXT, never as <a href> — they were validated as https:// on the
 * way in, but an email is not the place to make a stranger's URL one click away.
 * No auto-reply to the applicant: a form anyone can POST to shouldn't be a way
 * to make us email arbitrary addresses.
 */
export async function sendApplicationEmail(data: {
  jobTitle: string;
  application: Pick<ApplyInput, "name" | "email" | "phone" | "links" | "message">;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.CONTACT_TO_EMAIL || site.email;
  // Unquoted on purpose — see sendContactEmail.
  const from =
    process.env.CONTACT_FROM_EMAIL || `R Ally's Tech <onboarding@resend.dev>`;
  const resend = new Resend(apiKey);

  const a = data.application;
  const links = a.links ?? [];
  // subject lines can't carry newlines; strip any control characters too
  const role = data.jobTitle.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 120);

  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: a.email,
    subject: `New application — ${role}`,
    text: [
      `New application via ${site.name}`,
      "",
      `Role: ${role}`,
      `Name: ${a.name}`,
      `Email: ${a.email}`,
      a.phone ? `Phone: ${a.phone}` : null,
      links.length ? `Links:\n${links.join("\n")}` : null,
      "",
      a.message,
    ]
      .filter((l) => l !== null)
      .join("\n"),
    html: `<div style="max-width:560px;margin:auto">
      <p style="font:600 13px/1 -apple-system,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">New application · ${site.name}</p>
      <table style="margin-top:12px;border-collapse:collapse;width:100%">
        ${row("Role", esc(role))}
        ${row("Name", esc(a.name))}
        ${row("Email", `<a href="mailto:${esc(a.email)}" style="color:#1e293b">${esc(a.email)}</a>`)}
        ${a.phone ? row("Phone", esc(a.phone)) : ""}
        ${links.length ? row("Links", links.map((l) => esc(l)).join("<br>")) : ""}
        ${row("Cover note", esc(a.message).replace(/\n/g, "<br>"))}
      </table>
    </div>`,
  });
  if (error) throw new Error(error.message || "Email send failed");
  return true;
}
