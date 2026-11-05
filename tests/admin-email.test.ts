import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The panel emails (lib/admin-email.ts). They speak for the studio, so no
 * email address may appear in them — not the person who sent the invite or
 * reset (the owner's address used to be printed three times in an invite),
 * and not the recipient's. Also checks the animated header points at a file
 * that exists. EMAIL_PREVIEW_DIR=<dir> writes the rendered HTML for a look.
 */
const sent: { subject: string; html: string; text: string }[] = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: { subject: string; html: string; text: string }) => {
        sent.push(m);
        return { data: { id: "test" }, error: null };
      },
    };
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const ADDRESS = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const OWNER = "owner.person@example.com";
const TO = "new.teammate@example.com";

beforeAll(async () => {
  process.env.RESEND_API_KEY = "re_test";
  const m = await import("@/lib/admin-email");
  await m.sendInviteEmail({
    to: TO,
    inviteeName: "Haron Diniay",
    link: "https://example.com/admin/auth/confirm?t=abc",
    expiresIn: "7 days",
  });
  await m.sendPasswordResetEmail({
    to: TO,
    name: null,
    link: "https://example.com/admin/auth/confirm?t=def",
    expiresIn: "1 hour",
    byOwner: true,
  });
  await m.sendPasswordResetEmail({
    to: TO,
    name: "Haron",
    link: "https://example.com/admin/auth/confirm?t=ghi",
    expiresIn: "1 hour",
  });
  const dir = process.env.EMAIL_PREVIEW_DIR;
  if (dir) sent.forEach((e, i) => writeFileSync(path.join(dir, `email-${i}.html`), e.html));
});

describe("panel emails", () => {
  it("never print an email address (sender's or recipient's)", () => {
    expect(sent).toHaveLength(3);
    for (const e of sent) {
      for (const part of [e.subject, e.html, e.text]) {
        expect(part).not.toMatch(ADDRESS);
        expect(part).not.toContain(OWNER);
        expect(part).not.toContain(TO);
      }
    }
  });

  it("use the animated header, and the file exists", () => {
    for (const e of sent) {
      const src = e.html.match(/<img src="([^"]+)"/)?.[1] ?? "";
      expect(new URL(src).pathname).toBe("/brand/email/header.gif");
      expect(existsSync(path.join(process.cwd(), "public/brand/email/header.gif"))).toBe(true);
    }
  });

  it("keep the entrance animation optional (reduced motion off, nothing starts hidden inline)", () => {
    for (const e of sent) {
      expect(e.html).toContain("prefers-reduced-motion:reduce");
      expect(e.html).not.toMatch(/style="[^"]*opacity:0[^"]*"[^>]*class="mk-/);
    }
  });
});
