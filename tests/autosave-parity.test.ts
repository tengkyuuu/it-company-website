import { describe, expect, it } from "vitest";
import {
  NEVER_AUTOSAVE,
  SAVE_UNITS,
  formToFields,
  type AutosaveEntity,
  type AutosaveFields,
} from "@/app/admin/_lib/autosave";
import {
  NEEDS_SHOT,
  autosavePatch,
  parseForm,
  stampPublishedAt,
} from "@/app/admin/_lib/schemas";

/**
 * The explicit Save (server actions) and autosave (the Route Handler) must
 * write IDENTICAL column values for the same form state — otherwise a field
 * would save one way when you click Save and another way when you pause
 * typing, and the next load would show the difference. Both go through
 * app/admin/_lib/schemas.ts; this pins that the autosave path (form → wire
 * fields → FormData → parser → per-unit pick) loses nothing on the way.
 */

type Entry = [name: string, value: string];
const fdOf = (entries: Entry[]) => {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
};

const SHOT = "https://abc.supabase.co/storage/v1/object/public/work/shot-a1b2.webp";
const SHOT2 = "https://abc.supabase.co/storage/v1/object/public/work/shot-c3d4.webp";
const META: Entry[] = [
  ["id", "7f1d3c2a-1111-4222-8333-944455556666"],
  ["updated_at", "2026-10-02T06:41:07.123456+00:00"],
];

/** What each editor really submits — repeated names, blank rows and all. */
const FORMS: Record<AutosaveEntity, Entry[]> = {
  projects: [
    ["name", "FameCRM"],
    ["slug", "famecrm"],
    ["category", "CRM Platform"],
    ["year", "’25"],
    ["url", "famecrm.app"],
    ["live_url", ""],
    ["summary", "  The agency operating system.  "],
    ["description", "Two sentences.\nAnother line."],
    ["client", "Fame Agency"],
    ["industry", "Creator marketing"],
    ["timeline", "12 weeks"],
    ["services", "Web Development"],
    ["services", "UI/UX Design"],
    ["services_other", "Brand refresh\nWeb Development"],
    ["team", "James Calunsag"],
    ["team", "Haron Diniay"],
    ["challenge", "Spreadsheets everywhere."],
    ["approach", "One source of truth."],
    ["outcome", "Shipped in 12 weeks."],
    ["result_value", "3×"],
    ["result_label", "faster onboarding"],
    ["result_value", ""],
    ["result_label", ""],
    ["tags", "Web App, SaaS\nDashboard"],
    ["highlights", "Creator dashboard, with filters\nUsage metering"],
    ["stack", "Next.js, Supabase"],
    ["img", SHOT],
    ["img2", ""],
    ["gallery_src", SHOT2],
    ["gallery_caption", "Weekly view"],
    ["gallery_kind", "desktop"],
    ["gallery_src", SHOT],
    ["gallery_caption", ""],
    ["gallery_kind", "mobile"],
    ["testimonial_quote", "They listened."],
    ["testimonial_author", "Ana Reyes"],
    ["testimonial_role", "Founder"],
    ["dot1", "#7c5cff"],
    ["dot2", "#4F46E5"],
    ["dot3", "#15131f"],
    ["published", "on"],
    ["sort_order", "3"],
    ...META,
  ],
  site_settings: [
    ["brand_name", "R Ally's Tech"],
    ["tagline", "Software, designed with intent."],
    ["email", "hello@mykt.studio"],
    ["phone", "+63 900 000 0000"],
    ["address_line1", "Dipolog City"],
    ["address_line2", "Zamboanga del Norte"],
    ["hours", "Mon–Fri · 9:00–18:00 PHT"],
    ["availability", "Taking on new projects"],
    ["available", "on"],
    ["social_label", "LinkedIn"],
    ["social_href", "https://linkedin.com/company/x"],
    ["social_label", ""],
    ["social_href", ""],
    ["social_label", "Email"],
    ["social_href", "mailto:hello@mykt.studio"],
    ["id", "1"],
    ["updated_at", "2026-10-02T06:41:07.000123+00:00"],
  ],
  services: [
    ["title", "Web Development"],
    ["slug", "web-development"],
    ["blurb", "Fast, accessible sites."],
    ["detail", "The longer paragraph."],
    ["deliverables", "Next.js / React\nHeadless CMS, Design systems"],
    ["icon", "web"],
    ["sort_order", "0"],
    ["published", "on"],
    ...META,
  ],
  team_members: [
    ["name", "James Calunsag"],
    ["role", "Frontend"],
    ["initials", "jc"],
    ["sort_order", "1"],
    ["published", "on"],
    ...META,
  ],
  products: [
    ["name", "Ledger"],
    ["slug", "ledger"],
    ["tagline", "Books, balanced."],
    ["status", "Beta"],
    ["summary", "Accounting for studios."],
    ["description", "Para one.\n\nPara two."],
    ["features", "Invoices, quotes\nTime tracking"],
    ["cta_label", "Try it free"],
    ["cta_url", "/contact"],
    ["image", SHOT],
    ["gallery_src", SHOT2],
    ["gallery_caption", "Dashboard"],
    ["gallery_kind", "desktop"],
    ["sort_order", "2"],
    ...META,
  ],
  jobs: [
    ["title", "Frontend Developer"],
    ["slug", "frontend-developer"],
    ["department", "Engineering"],
    ["location", "Dipolog City"],
    ["employment_type", "full-time"],
    ["workplace", "hybrid"],
    ["summary", "Build the studio's interfaces."],
    ["description", "The team, the work."],
    ["responsibilities", "Ship features, with care\nReview code"],
    ["requirements", "React\nTypeScript"],
    ["published", "on"],
    ["closes_at", "2026-12-31"],
    ["sort_order", "0"],
    ...META,
  ],
  posts: [
    ["title", "Why we design in the browser"],
    ["slug", "why-we-design-in-the-browser"],
    ["excerpt", "Short version."],
    ["body", "## Heading\n\n    indented code\n- list\n\n\n  "],
    ["cover_image", SHOT],
    ["author_name", "James Calunsag"],
    ["tags", "Design, Engineering"],
    ["published", "on"],
    ["published_at", "2024-05-01"],
    ...META,
  ],
};

const allInputs = (entity: AutosaveEntity) => SAVE_UNITS[entity].flatMap((u) => [...u.inputs]);
const allColumns = (entity: AutosaveEntity) => SAVE_UNITS[entity].flatMap((u) => [...u.columns]);

/** What the route supplies from the stored row: here, the same form state. */
const contextOf = (entity: AutosaveEntity, fd: FormData): AutosaveFields =>
  entity === "projects" ? { published: fd.get("published") === "on" ? "on" : [] } : {};

describe("explicit Save and autosave write the same values", () => {
  for (const entity of Object.keys(FORMS) as AutosaveEntity[]) {
    it(`${entity}: every autosavable column matches the explicit Save's value`, () => {
      const fd = fdOf(FORMS[entity]);

      const explicit = parseForm(entity, fd);
      expect(explicit.fieldErrors).toEqual({});
      expect(explicit.message).toBeNull();

      // every autosavable input "dirty" at once — the widest an autosave gets
      const fields = formToFields(fd, allInputs(entity));
      const auto = autosavePatch(entity, fields, contextOf(entity, fd));

      expect(auto.fieldErrors).toEqual({});
      expect(Object.keys(auto.patch).sort()).toEqual([...new Set(allColumns(entity))].sort());
      expect(auto.saved.sort()).toEqual(allInputs(entity).sort());
      for (const [column, value] of Object.entries(auto.patch)) {
        expect(value, `${entity}.${column}`).toEqual(explicit.values[column]);
      }
      for (const never of NEVER_AUTOSAVE) expect(auto.patch).not.toHaveProperty(never);
    });
  }

  it("the explicit Save still normalises like it always has", () => {
    const p = parseForm("projects", fdOf(FORMS.projects)).values;
    expect(p).toMatchObject({
      slug: "famecrm",
      summary: "The agency operating system.",
      live_url: null,
      img2: null,
      published: true,
      sort_order: 3,
      dots: ["#7c5cff", "#4F46E5", "#15131f"],
      services: ["Web Development", "UI/UX Design", "Brand refresh"],
      team: ["James Calunsag", "Haron Diniay"],
      results: [{ value: "3×", label: "faster onboarding" }],
      tags: ["Web App", "SaaS", "Dashboard"],
      highlights: ["Creator dashboard, with filters", "Usage metering"],
      gallery: [
        { src: SHOT2, caption: "Weekly view", kind: "desktop" },
        { src: SHOT, caption: "", kind: "mobile" },
      ],
    });
    expect(parseForm("team_members", fdOf(FORMS.team_members)).values).toMatchObject({ initials: "JC" });
    expect(parseForm("site_settings", fdOf(FORMS.site_settings)).values.socials).toEqual([
      { label: "LinkedIn", href: "https://linkedin.com/company/x" },
      { label: "Email", href: "mailto:hello@mykt.studio" },
    ]);
    // markdown keeps its indentation; only trailing whitespace goes
    expect(parseForm("posts", fdOf(FORMS.posts)).values.body).toBe(
      "## Heading\n\n    indented code\n- list"
    );
  });
});

describe("autosave applies only what parsed — one bad field doesn't block the others", () => {
  it("writes the good fields and reports the bad one", () => {
    const auto = autosavePatch("projects", { name: "Renamed", live_url: "http://insecure.example" });
    expect(auto.patch).toEqual({ name: "Renamed" });
    expect(auto.saved).toEqual(["name"]);
    expect(auto.fieldErrors).toEqual({ live_url: "Live URL must be a full https:// address" });
  });

  it("refuses to clear a PUBLISHED project's screenshot, using the stored row as context", () => {
    const published = autosavePatch("projects", { img: "" }, { published: "on" });
    expect(published.patch).toEqual({});
    expect(published.fieldErrors).toEqual({ img: NEEDS_SHOT });

    const draft = autosavePatch("projects", { img: "" }, { published: [] });
    expect(draft.patch).toEqual({ img: null });
  });

  it("keeps a testimonial quote off the site until it has an author (the pair saves together)", () => {
    const auto = autosavePatch("projects", { testimonial_quote: "Great work", testimonial_author: "" });
    expect(auto.patch).toEqual({});
    expect(Object.keys(auto.fieldErrors)).toEqual(["testimonial_author"]);
  });

  it("holds back half a call-to-action, writes the rest", () => {
    const auto = autosavePatch("products", { name: "Ledger 2", cta_label: "", cta_url: "/contact" });
    expect(auto.patch).toEqual({ name: "Ledger 2" });
    expect(Object.keys(auto.fieldErrors)).toEqual(["cta_label"]);
  });

  it("ignores a repeating group that arrived incomplete (it would parse as wiped rows)", () => {
    const auto = autosavePatch("projects", { gallery_src: [SHOT], name: "x" });
    expect(auto.patch).toEqual({ name: "x" });
    expect(auto.saved).toEqual(["name"]);
  });

  it("an emptied repeating group is a real value — every row removed means []", () => {
    const auto = autosavePatch("projects", { result_value: [], result_label: [] });
    expect(auto.patch).toEqual({ results: [] });
  });

  it("never writes slug, published or sort_order, even when they're sent", () => {
    const auto = autosavePatch("services", {
      slug: "half-typ",
      published: [],
      sort_order: "0",
      title: "Web",
    });
    expect(auto.patch).toEqual({ title: "Web" });
    expect(auto.saved).toEqual(["title"]);
  });

  it("a social link error lands under its row and holds back the socials unit", () => {
    const auto = autosavePatch("site_settings", {
      social_label: ["LinkedIn", ""],
      social_href: ["https://linkedin.com/x", "https://x.com/y"],
      tagline: "New",
    });
    expect(auto.patch).toEqual({ tagline: "New" });
    expect(auto.fieldErrors).toEqual({ social_1: "Social link 2 has a URL but no label." });
  });
});

describe("explicit Save messages are unchanged", () => {
  it("a single problem is the banner, keyed to its field", () => {
    const fd = fdOf(FORMS.projects.map(([k, v]) => [k, k === "img" ? "" : v] as Entry));
    const parsed = parseForm("projects", fd);
    expect(parsed.message).toBe(NEEDS_SHOT);
    expect(parsed.fieldErrors).toEqual({ img: NEEDS_SHOT });
  });

  it("several problems are counted", () => {
    const parsed = parseForm("team_members", fdOf([["name", ""], ["initials", "J.C."]]));
    expect(parsed.message).toBe("Please fix the 2 highlighted fields.");
    expect(parsed.fieldErrors).toEqual({ name: "Name is required", initials: "Letters and numbers only" });
  });
});

describe("stampPublishedAt (post dates, both paths)", () => {
  it("keeps an exact timestamp that already falls on the chosen Manila day", () => {
    const keep = "2024-05-01T03:17:42.123456+00:00"; // 11:17 in Manila, same day
    expect(stampPublishedAt("2024-05-01", keep)).toBe(keep);
  });
  it("moves to Manila midnight when the day changes, and blank lets the database stamp it", () => {
    expect(stampPublishedAt("2024-05-02", "2024-05-01T03:17:42+00:00")).toBe("2024-05-02T00:00:00+08:00");
    expect(stampPublishedAt("", "2024-05-01T03:17:42+00:00")).toBeNull();
  });
});
