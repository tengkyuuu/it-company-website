import { describe, expect, it } from "vitest";
import { ctaUrl, imagePath, isCtaUrl, isUrl } from "@/app/admin/_lib/validators";

/**
 * Every screenshot the panel stores ends up as an <img src> on the public
 * site, written by any staff account. The validator is the only thing between
 * that form field and the page, so pin what it must refuse.
 */
const accepts = (v: string) => imagePath.safeParse(v).success;

describe("imagePath (admin screenshot validator)", () => {
  it.each([
    ["", "empty = no screenshot"],
    ["/work/x.webp", "a file under public/"],
    ["/work/famecrm-landing.webp", "a real static path"],
    ["https://abc.supabase.co/storage/v1/object/public/work/shot.png", "a Storage upload"],
    ["https://cdn.example.com/a/b.png?v=2", "an https URL with a query"],
  ])("accepts %j (%s)", (value) => {
    expect(accepts(value)).toBe(true);
  });

  it.each([
    ["data:image/png;base64,iVBORw0KGgo=", "inline base64 — bloats rows and bypasses Storage"],
    ["data:image/svg+xml,<svg onload=alert(1)>", "inline SVG"],
    ["javascript:alert(1)", "script URL"],
    ["JavaScript:alert(1)", "script URL, mixed case"],
    ["//evil.example/x.png", "protocol-relative — loads from any host"],
    ["/\\evil.example/x.png", "backslash protocol-relative — the URL parser reads \\ as /"],
    ["ftp://example.com/x.png", "non-http scheme"],
    ["work/x.webp", "relative path — resolves differently per page"],
    ["/work/my shot.png", "whitespace"],
    ["https://", "scheme with no host"],
    ["/" + "a".repeat(600), "over the length cap"],
  ])("rejects %j (%s)", (value) => {
    expect(accepts(value)).toBe(false);
  });

  it("really is the backslash form that browsers resolve off-site", () => {
    // documents WHY the case above matters, independent of the validator
    expect(new URL("/\\evil.example/x.png", "https://rallys.tech/projects/x").host).toBe(
      "evil.example"
    );
  });
});

/**
 * A product's CTA becomes an <a href> on the public site. Unlike an <img src>,
 * a link RUNS what it points at when clicked, so the bar is higher: https or a
 * path on this site, nothing else.
 */
describe("ctaUrl (product call-to-action link)", () => {
  const cta = (v: string) => ctaUrl.safeParse(v).success;

  it.each([
    ["", "empty = no button"],
    ["/contact", "an internal page"],
    ["/blog/launch-notes#pricing", "an internal page with a hash"],
    ["/products/x?ref=hero", "an internal page with a query"],
    ["https://app.example.com/signup", "an external https app"],
    ["HTTPS://Example.com", "scheme case doesn't matter"],
  ])("accepts %j (%s)", (value) => {
    expect(cta(value)).toBe(true);
    if (value) expect(isCtaUrl(value)).toBe(true);
  });

  it.each([
    ["javascript:alert(1)", "script URL"],
    [" javascript:alert(1)", "script URL behind a space"],
    ["JaVaScRiPt:alert(1)", "script URL, mixed case"],
    ["data:text/html,<script>alert(1)</script>", "inline document"],
    ["vbscript:msgbox(1)", "legacy script scheme"],
    ["http://example.com", "plain http — a downgrade"],
    ["//evil.example/x", "protocol-relative — leaves the site"],
    ["/\\evil.example/x", "backslash protocol-relative"],
    ["mailto:hello@example.com", "not a page (use the contact page instead)"],
    ["contact", "relative path — resolves differently per page"],
    ["https://", "scheme with no host"],
    ["https://example.com/a b", "whitespace"],
    ["/" + "a".repeat(600), "over the length cap"],
  ])("rejects %j (%s)", (value) => {
    expect(cta(value)).toBe(false);
  });
});

describe("isUrl", () => {
  it("requires the protocol AND a parseable URL", () => {
    expect(isUrl("https://example.com", /^https:\/\//i)).toBe(true);
    expect(isUrl("http://example.com", /^https:\/\//i)).toBe(false);
    expect(isUrl("https://", /^https:\/\//i)).toBe(false);
    expect(isUrl("javascript:alert(1)", /^https?:\/\//i)).toBe(false);
  });
});
