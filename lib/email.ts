import { Resend } from "resend";
import { site } from "@/lib/site";
import type { ContactInput } from "@/lib/contact-schema";

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
  // The display name is QUOTED on purpose: "()" are comment delimiters in an
  // RFC 5322 address, so an unquoted mykTech() would be parsed as the name
  // "mykTech" plus an empty comment — and the parens would vanish in clients.
  const from =
    process.env.CONTACT_FROM_EMAIL || `"mykTech()" <onboarding@resend.dev>`;
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
