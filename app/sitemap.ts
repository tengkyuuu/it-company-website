import type { MetadataRoute } from "next";
import { nav } from "@/lib/site";
import { getJobs, getPosts, getProducts, getProjects } from "@/lib/cms";
import { locales } from "@/lib/i18n/config";
import { absoluteUrl, languageUrls } from "@/lib/i18n/metadata";

/**
 * Every public page in both locales — English at the unprefixed URL, Filipino
 * under /fil — each entry carrying the full hreflang set (en, fil, x-default)
 * so search engines pair the two versions.
 *
 * Products / Careers / Blog are listed only when they have something in them:
 * an empty index renders (old links still work) but is `noindex`, so listing
 * it here would contradict the page. Careers lists OPEN roles only — getJobs()
 * already drops closed ones, whose pages are noindex too.
 * Refreshed by the panel's revalidatePath("/sitemap.xml") on every save, and
 * hourly — roles close by the calendar (Asia/Manila), not by an edit.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = (
    path: string,
    priority: number,
    lastModified?: string
  ): MetadataRoute.Sitemap =>
    locales.map((lang) => ({
      url: absoluteUrl(lang, path),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "monthly",
      priority,
      alternates: { languages: languageUrls(path, true) },
    }));

  const [projects, products, jobs, posts] = await Promise.all([
    getProjects(),
    getProducts(),
    getJobs(),
    getPosts(),
  ]);

  // the always-on pages; the CMS sections are added below only when non-empty
  const pages = nav
    .filter((item) => !item.section)
    .flatMap((item) => entries(item.href, item.href === "/" ? 1 : 0.8));

  const projectPages = projects.flatMap((p) => entries(`/projects/${p.slug}`, 0.7));

  const productPages = products.length
    ? [
        ...entries("/products", 0.8),
        ...products.flatMap((p) => entries(`/products/${p.slug}`, 0.7, p.updatedAt)),
      ]
    : [];

  const jobPages = jobs.length
    ? [
        ...entries("/careers", 0.6),
        ...jobs.flatMap((j) => entries(`/careers/${j.slug}`, 0.5, j.updatedAt)),
      ]
    : [];

  const postPages = posts.length
    ? [
        ...entries("/blog", 0.7),
        ...posts.flatMap((p) => entries(`/blog/${p.slug}`, 0.6, p.updatedAt)),
      ]
    : [];

  return [...pages, ...projectPages, ...productPages, ...jobPages, ...postPages];
}
