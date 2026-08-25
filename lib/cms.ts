import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured, type ProjectRow, type SiteSettingsRow } from "@/lib/supabase/types";
import { projects as staticProjects, type Project } from "@/lib/work";
import { site as staticSite, socials as staticSocials } from "@/lib/site";

/**
 * The public site's content source.
 *
 * Everything degrades to the checked-in static data in lib/work.ts + lib/site.ts
 * when Supabase isn't configured (or is unreachable), so the marketing site keeps
 * building and rendering with no database at all — the admin panel is additive,
 * not a hard dependency. That also means local dev needs no setup.
 */

function rowToProject(r: ProjectRow): Project {
  const dots = (r.dots?.length === 3 ? r.dots : ["#94a3b8", "#cbd5e1", "#1e293b"]) as [
    string,
    string,
    string,
  ];
  return {
    slug: r.slug,
    name: r.name,
    category: r.category,
    url: r.url,
    liveUrl: r.live_url ?? undefined,
    year: r.year,
    summary: r.summary,
    description: r.description,
    highlights: r.highlights ?? [],
    img: r.img ?? "/work/famecrm-landing.webp",
    img2: r.img2 ?? undefined,
    tags: r.tags ?? [],
    dots,
  };
}

export async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return staticProjects;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data?.length) return staticProjects;
    return (data as ProjectRow[]).map(rowToProject);
  } catch {
    return staticProjects;
  }
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const all = await getProjects();
  return all.find((p) => p.slug === slug);
}

export async function getProjectNeighbours(slug: string) {
  const all = await getProjects();
  const i = all.findIndex((p) => p.slug === slug);
  if (i < 0) return { prev: undefined, next: undefined };
  return {
    prev: all[(i - 1 + all.length) % all.length],
    next: all[(i + 1) % all.length],
  };
}

export type SiteContent = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: { line1: string; line2: string };
  hours: string;
  availability: string;
  available: boolean;
  socials: { label: string; href: string }[];
};

const staticContent: SiteContent = {
  name: staticSite.name,
  tagline: staticSite.tagline,
  email: staticSite.email,
  phone: staticSite.phone,
  address: { line1: staticSite.address.line1, line2: staticSite.address.line2 },
  hours: staticSite.hours,
  availability: "Taking on new projects",
  available: true,
  socials: staticSocials,
};

export async function getSiteContent(): Promise<SiteContent> {
  if (!isSupabaseConfigured()) return staticContent;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error || !data) return staticContent;

    const s = data as SiteSettingsRow;
    // fall back field-by-field: a blank cell in the panel shouldn't blank the site
    return {
      name: s.brand_name || staticContent.name,
      tagline: s.tagline || staticContent.tagline,
      email: s.email || staticContent.email,
      phone: s.phone || staticContent.phone,
      address: {
        line1: s.address_line1 || staticContent.address.line1,
        line2: s.address_line2 || staticContent.address.line2,
      },
      hours: s.hours || staticContent.hours,
      availability: s.availability || staticContent.availability,
      available: s.available,
      socials: Array.isArray(s.socials) && s.socials.length ? s.socials : staticContent.socials,
    };
  } catch {
    return staticContent;
  }
}
