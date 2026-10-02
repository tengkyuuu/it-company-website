import type { MetadataRoute } from "next";
import { nav } from "@/lib/site";
import { getProjects } from "@/lib/cms";
import { locales } from "@/lib/i18n/config";
import { absoluteUrl, languageUrls } from "@/lib/i18n/metadata";

/**
 * Every public page in both locales — English at the unprefixed URL, Filipino
 * under /fil — each entry carrying the full hreflang set (en, fil, x-default)
 * so search engines pair the two versions.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = (path: string, priority: number): MetadataRoute.Sitemap =>
    locales.map((lang) => ({
      url: absoluteUrl(lang, path),
      changeFrequency: "monthly",
      priority,
      alternates: { languages: languageUrls(path, true) },
    }));

  const pages = nav.flatMap((item) => entries(item.href, item.href === "/" ? 1 : 0.8));

  const projects = await getProjects();
  const projectPages = projects.flatMap((p) => entries(`/projects/${p.slug}`, 0.7));

  return [...pages, ...projectPages];
}
