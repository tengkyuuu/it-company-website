import { describe, expect, it } from "vitest";
import { imagePath, isUrl } from "@/app/admin/_lib/validators";

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

describe("isUrl", () => {
  it("requires the protocol AND a parseable URL", () => {
    expect(isUrl("https://example.com", /^https:\/\//i)).toBe(true);
    expect(isUrl("http://example.com", /^https:\/\//i)).toBe(false);
    expect(isUrl("https://", /^https:\/\//i)).toBe(false);
    expect(isUrl("javascript:alert(1)", /^https?:\/\//i)).toBe(false);
  });
});
