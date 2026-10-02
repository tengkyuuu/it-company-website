import "server-only";

import { cache } from "react";
import {
  getJobs,
  getPosts,
  getProducts,
  getProjects,
  getServices,
  getSiteContent,
  getTeam,
} from "@/lib/cms";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localizePath } from "@/lib/i18n/paths";
import { clip, joinKeywords, type SearchEntry, type SearchType } from "@/lib/search-score";

/**
 * The Cmd+K search index, built on the server per locale from the SAME sources
 * the pages render from (lib/cms.ts → Supabase with static fallbacks), so an
 * edit in /admin changes what search finds on the next render — and the live
 * updates layer (components/LiveUpdates) re-fetches it with the page.
 *
 * It rides in the RSC payload of EVERY public page (the [lang] layout passes it
 * to SiteChrome), so it is deliberately small: titles, one clipped snippet and
 * a capped keyword string per entry — never bodies. Static content (23
 * entries) measured ~4.7 KB en / ~5.0 KB fil raw, ~1.7 KB gzipped;
 * tests/search-score.test.ts fails if it bloats past 10 KB.
 *
 * Never throws: every cms.ts getter already fails fast and falls back, and the
 * whole build is wrapped so a surprise yields an empty index (the palette then
 * just says "no results") rather than a broken layout.
 *
 * Product / job / post detail routes are assumed at /products/[slug],
 * /careers/[slug] and /blog/[slug].
 */

const SNIPPET_MAX = 110;
const KEYWORDS_MAX = 160;

/** Caps per type — a long blog archive must not grow every page's payload. */
const CAP = { project: 40, product: 30, job: 30, post: 40, team: 40 } as const;

export const buildSearchIndex = cache(async (lang: Locale): Promise<SearchEntry[]> => {
  try {
    return await build(lang);
  } catch {
    return [];
  }
});

async function build(lang: Locale): Promise<SearchEntry[]> {
  const { t } = getDictionary(lang);
  const en = getDictionary(defaultLocale);
  const href = (path: string) => localizePath(lang, path);

  const [projects, services, team, products, jobs, posts, content] = await Promise.all([
    getProjects(),
    getServices(),
    getTeam(),
    getProducts(),
    getJobs(),
    getPosts(),
    getSiteContent(),
  ]);

  // "project" / "proyekto" finds every project, etc. — the type's name in both
  // the page's language and English, appended to each entry's keywords.
  const groupWords: Record<SearchType, string> = {
    page: `${t("search.groups.page")} ${en.t("search.groups.page")}`,
    project: `${t("search.groups.project")} ${en.t("search.groups.project")}`,
    service: `${t("search.groups.service")} ${en.t("search.groups.service")}`,
    product: `${t("search.groups.product")} ${en.t("search.groups.product")}`,
    job: `${t("search.groups.job")} ${en.t("search.groups.job")} job hiring`,
    post: `${t("search.groups.post")} ${en.t("search.groups.post")} article`,
    team: `${t("search.groups.team")} ${en.t("search.groups.team")} people`,
  };

  const entry = (
    type: SearchType,
    id: string,
    title: string,
    snippet: string | undefined,
    keywords: (string | undefined | null | false)[],
    path: string
  ): SearchEntry => ({
    id: `${type}-${id}`,
    type,
    title: title.trim(),
    snippet: clip(snippet, SNIPPET_MAX),
    keywords: joinKeywords([...keywords, groupWords[type]], KEYWORDS_MAX),
    href: href(path),
  });

  const out: SearchEntry[] = [];

  /* ---- pages (first, so they win ties and form the idle list) ---------- */
  out.push(
    entry(
      "page",
      "home",
      t("nav.home"),
      t("hero.eyebrow"),
      [en.t("nav.home"), content.name, content.tagline, "start landing"],
      "/"
    ),
    entry(
      "page",
      "services",
      t("nav.services"),
      `${t("services.titleLine1")} ${t("services.titleLine2")} ${t("services.titleAccent")}`,
      [en.t("nav.services"), "offerings what we do", ...services.map((s) => s.title)],
      "/services"
    ),
    entry(
      "page",
      "projects",
      t("nav.projects"),
      `${t("projects.titleLead")} ${t("projects.titleAccent")}`,
      [en.t("nav.projects"), "work portfolio case studies", ...projects.map((p) => p.name)],
      "/projects"
    ),
    entry(
      "page",
      "about",
      t("nav.about"),
      `${t("about.titleLine1")} ${t("about.titleLine2")} ${t("about.titleAccent")}`,
      [en.t("nav.about"), "team values story people studio"],
      "/about"
    ),
    entry(
      "page",
      "location",
      t("nav.location"),
      `${content.address.line1}, ${content.address.line2}`,
      [
        en.t("nav.location"),
        "contact email phone map address directions hours Dipolog Zamboanga",
        content.email,
        content.phone,
      ],
      "/location"
    )
  );

  // CMS sections get a page entry only when something is published behind
  // them — the same rule as the nav (getPublishedSections), derived from the
  // lists we already have instead of three more queries.
  // Snippets list what's there (names / role titles / post titles).
  if (products.length) {
    out.push(
      entry(
        "page",
        "products",
        t("nav.products"),
        products.map((p) => p.name).join(" · "),
        [en.t("nav.products"), "apps tools"],
        "/products"
      )
    );
  }
  if (jobs.length) {
    out.push(
      entry(
        "page",
        "careers",
        t("nav.careers"),
        jobs.map((j) => j.title).join(" · "),
        [en.t("nav.careers"), "jobs hiring apply openings work with us"],
        "/careers"
      )
    );
  }
  if (posts.length) {
    out.push(
      entry(
        "page",
        "blog",
        t("nav.blog"),
        posts.map((p) => p.title).join(" · "),
        [en.t("nav.blog"), "posts articles news"],
        "/blog"
      )
    );
  }

  /* ---- content, in the order the site lists it ------------------------- */
  for (const p of projects.slice(0, CAP.project)) {
    out.push(
      entry(
        "project",
        p.slug,
        p.name,
        p.summary,
        [p.category, p.client, p.industry, ...(p.tags ?? []), ...(p.stack ?? []), ...(p.services ?? [])],
        `/projects/${p.slug}`
      )
    );
  }

  for (const s of services) {
    out.push(entry("service", s.slug, s.title, s.blurb, s.deliverables, "/services"));
  }

  for (const p of products.slice(0, CAP.product)) {
    out.push(
      entry("product", p.slug, p.name, p.tagline || p.summary, [p.status, ...p.features.slice(0, 6)], `/products/${p.slug}`)
    );
  }

  for (const j of jobs.slice(0, CAP.job)) {
    out.push(
      entry(
        "job",
        j.slug,
        j.title,
        j.summary,
        [j.department, j.location, j.employmentType, j.workplace],
        `/careers/${j.slug}`
      )
    );
  }

  for (const p of posts.slice(0, CAP.post)) {
    out.push(entry("post", p.slug, p.title, p.excerpt, [...p.tags, p.author], `/blog/${p.slug}`));
  }

  team.slice(0, CAP.team).forEach((m, i) => {
    out.push(entry("team", String(i), m.name, m.role, [], "/about"));
  });

  return out;
}
