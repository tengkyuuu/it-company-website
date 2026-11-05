import { projects as staticProjects } from "@/lib/work";

/**
 * Rows for importing the built-in projects (lib/work.ts) into `projects`,
 * skipping slugs already there and appending after the current sort order.
 * Pure, so tests/import-projects.test.ts can insert exactly these rows into the
 * real schema.
 *
 * Every row carries EVERY key with a real value. In a bulk insert PostgREST
 * sets a key that another row has but this one lacks to NULL, not to the
 * column default, and the case-study columns are NOT NULL (default '' / '{}' /
 * '[]'). Leaving optional keys out of some rows failed the whole import with
 * 23502 ("A required field is missing.") the first time projects with
 * different optional fields were imported together (2026-11-06).
 */
export function staticProjectRows(existing: { slug: string; sort_order: number | null }[]) {
  const have = new Set(existing.map((r) => r.slug));
  const start = existing.reduce((m, r) => Math.max(m, (r.sort_order ?? 0) + 1), 0);
  return staticProjects
    .filter((p) => !have.has(p.slug))
    .map((p, i) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      url: p.url,
      live_url: p.liveUrl ?? null,
      year: p.year,
      summary: p.summary,
      description: p.description,
      highlights: p.highlights,
      tags: p.tags,
      dots: [...p.dots],
      img: p.img,
      img2: p.img2 ?? null,
      published: true,
      sort_order: start + i,
      client: p.client ?? "",
      industry: p.industry ?? "",
      timeline: p.timeline ?? "",
      services: p.services ?? [],
      team: p.team ?? [],
      stack: p.stack ?? [],
      challenge: p.challenge ?? "",
      approach: p.approach ?? "",
      outcome: p.outcome ?? "",
      results: p.results ?? [],
      gallery: p.gallery ?? [],
      testimonial_quote: p.testimonial?.quote ?? "",
      testimonial_author: p.testimonial?.author ?? "",
      testimonial_role: p.testimonial?.role ?? "",
    }));
}
