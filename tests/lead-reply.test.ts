import { describe, expect, it } from "vitest";
import {
  MAILTO_MAX,
  MAX_REPLY_BODY,
  buildReplyHtml,
  buildReplyText,
  cleanSubject,
  escapeHtml,
  greeting,
  mailtoHref,
  quoteOriginal,
  replySubject,
  sendFailureMessage,
  validateReplyBody,
} from "@/lib/lead-reply";

/**
 * Replies from /admin/inbox: what the email says, that nothing a visitor
 * typed can become markup in it, and the mailto fallback for when Resend's
 * sandbox refuses to deliver.
 */

const SITE = "R Ally's Tech";

describe("subject", () => {
  it("names what's being answered", () => {
    expect(replySubject("contact", { siteName: SITE })).toBe("Re: your enquiry to R Ally's Tech");
    expect(replySubject("application", { siteName: SITE, jobTitle: "Frontend Developer" })).toBe(
      "Re: your application — Frontend Developer"
    );
    expect(replySubject("application", { siteName: SITE, jobTitle: null })).toBe(
      "Re: your application to R Ally's Tech"
    );
  });

  it("can't carry a header injection (newlines / control characters)", () => {
    const s = replySubject("application", {
      siteName: SITE,
      jobTitle: "Dev\r\nBcc: everyone@example.test\u0000",
    });
    expect(s).not.toMatch(/[\r\n\u0000]/);
    expect(cleanSubject("a\n\n  b\tc")).toBe("a b c");
    expect(cleanSubject("x".repeat(500)).length).toBe(180);
  });
});

describe("body validation", () => {
  it("trims, normalises newlines, drops control characters but keeps tabs/newlines", () => {
    const r = validateReplyBody("  Hi,\r\n\r\nThanks\u0007 for\twriting.  ");
    expect(r).toEqual({ ok: true, body: "Hi,\n\nThanks for\twriting." });
  });

  it("refuses empty and over-long replies", () => {
    expect(validateReplyBody("   ").ok).toBe(false);
    expect(validateReplyBody(undefined).ok).toBe(false);
    expect(validateReplyBody(42).ok).toBe(false);
    expect(validateReplyBody("x".repeat(MAX_REPLY_BODY)).ok).toBe(true);
    expect(validateReplyBody("x".repeat(MAX_REPLY_BODY + 1)).ok).toBe(false);
  });

  it("starts the composer with a greeting", () => {
    expect(greeting("Maria Santos")).toBe("Hi Maria,\n\n");
    expect(greeting(null)).toBe("Hi,\n\n");
  });
});

describe("the email", () => {
  const input = {
    body: "Hi Maria,\n\nYes — we build apps.\nLet's talk.",
    staffName: "Jhade Banquiao",
    siteName: SITE,
    recipientName: "Maria",
    original: "Can you build an app?\nThanks",
    originalDate: "Oct 3, 2026",
  };

  it("plain text: reply, first-name signature, the original quoted", () => {
    const text = buildReplyText(input);
    expect(text).toContain("Yes — we build apps.\nLet's talk.");
    expect(text).toContain("— Jhade\nR Ally's Tech");
    expect(text).toContain("On Oct 3, 2026, Maria wrote:\n> Can you build an app?\n> Thanks");
  });

  it("HTML: paragraphs and line breaks, everything a person typed escaped", () => {
    const html = buildReplyHtml({
      ...input,
      body: `<script>alert(1)</script>\n\n"quoted" & <b>bold</b>`,
      recipientName: `<img src=x onerror=alert(1)>`,
      original: `</blockquote><a href="javascript:alert(1)">x</a>`,
      staffName: `<i>Eve</i> Smith`,
    });
    expect(html).not.toMatch(/<script|<img|<a href|<b>|<i>/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;/blockquote&gt;");
    expect(html).toContain("— &lt;i&gt;Eve&lt;/i&gt;");
    // exactly one real blockquote, ours
    expect(html.match(/<blockquote/g)).toHaveLength(1);
  });

  it("HTML keeps the structure of the reply", () => {
    const html = buildReplyHtml(input);
    expect(html).toContain('<p style="margin:0 0 14px">Hi Maria,</p>');
    expect(html).toContain("Yes — we build apps.<br>Let&#39;s talk.");
    expect(html).toContain("R Ally&#39;s Tech");
  });

  it("quotes at most 12 lines of the original", () => {
    const q = quoteOriginal(Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n"));
    expect(q.split("\n")).toHaveLength(13);
    expect(q.endsWith("> …")).toBe(true);
    expect(quoteOriginal("")).toBe("");
    expect(quoteOriginal(null)).toBe("");
  });

  it("escapeHtml covers the five specials", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("mailto fallback", () => {
  it("prefills recipient, subject and body, all encoded", () => {
    const href = mailtoHref({ to: "maria@example.test", subject: "Re: your enquiry", body: "a & b?\n#c" });
    expect(href).toBe(
      "mailto:maria@example.test?subject=Re%3A%20your%20enquiry&body=a%20%26%20b%3F%0A%23c"
    );
  });

  it("text can't break out of its parameter", () => {
    const href = mailtoHref({ to: "m@example.test", subject: "x&cc=evil@example.test", body: "y&bcc=evil@example.test" });
    const url = new URL(href);
    expect([...url.searchParams.keys()]).toEqual(["subject", "body"]);
  });

  it("an odd recipient is left blank rather than smuggling parameters", () => {
    expect(mailtoHref({ to: "a@b.test?cc=evil@x.test", subject: "s", body: "b" })).toMatch(/^mailto:\?subject=/);
  });

  it("stays under the mail-client limit, shortening with a visible marker", () => {
    const body = "Lorem ipsum dolor sit amet. ".repeat(400);
    const href = mailtoHref({ to: "m@example.test", subject: "Re: x", body });
    expect(href.length).toBeLessThanOrEqual(MAILTO_MAX);
    expect(decodeURIComponent(href.split("&body=")[1])).toMatch(/shortened — paste the rest from “Copy reply”\]$/);
  });

  it("never splits an emoji in half", () => {
    const body = "😀".repeat(2000);
    const href = mailtoHref({ to: "m@example.test", subject: "😀".repeat(200), body });
    expect(() => decodeURIComponent(href)).not.toThrow();
  });

  it("survives malformed text (a lone surrogate) instead of throwing", () => {
    expect(() => mailtoHref({ to: "m@example.test", subject: "a\uD800b", body: "x\uDC00y" })).not.toThrow();
  });
});

describe("failure wording — the real reason, plainly", () => {
  it("names the sandbox", () => {
    expect(sendFailureMessage({ message: "x", sandbox: true, configured: true })).toMatch(/test mode/);
  });
  it("names a missing key", () => {
    expect(sendFailureMessage({ message: "x", sandbox: false, configured: false })).toMatch(/RESEND_API_KEY/);
  });
  it("passes anything else through", () => {
    expect(sendFailureMessage({ message: "Invalid `to` field", sandbox: false, configured: true })).toBe(
      "Not sent — Resend said: Invalid `to` field"
    );
  });
});
