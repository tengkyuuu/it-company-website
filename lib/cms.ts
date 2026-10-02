import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import {
  isSupabaseConfigured,
  type ProjectRow,
  type ServiceRow,
  type SiteSettingsRow,
  type TeamMemberRow,
} from "@/lib/supabase/types";
import { projects as staticProjects, type Project } from "@/lib/work";
import {
  services as staticServices,
  type IconName,
  type Service,
} from "@/lib/services";
import { team as staticTeam } from "@/lib/team";
import { site as staticSite, socials as staticSocials } from "@/lib/site";

/**
 * The public site's content source.
 *
 * Everything degrades to the checked-in static data in lib/work.ts + lib/site.ts
 * when Supabase isn't configured (or is unreachable), so the marketing site keeps
 * building and rendering with no database at all — the admin panel is additive,
 * not a hard dependency. That also means local dev needs no setup.
 *
 * Every read here FAILS FAST, because a fallback is only useful if it's quick:
 *  - `.retry(false)` — postgrest-js retries failed GETs 3x with 1s/2s/4s backoff,
 *    so an unreachable project cost ~7s *per query* before we fell back. The
 *    footer's two reads made every page render take ~14s.
 *  - `.abortSignal(timeout)` — a paused project can accept the connection and
 *    then never answer; without a deadline that hangs the render indefinitely.
 *  - `cache()` — dedupes within one render (the footer and the landing page both
 *    read services; a project page reads projects twice), so a slow database is
 *    paid for once, not per caller.
 */
const READ_TIMEOUT_MS = 3000;
const deadline = () => AbortSignal.timeout(READ_TIMEOUT_MS);

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
    client: r.client || undefined,
    industry: r.industry || undefined,
    timeline: r.timeline || undefined,
    services: r.services ?? [],
    team: r.team ?? [],
    stack: r.stack ?? [],
    challenge: r.challenge || undefined,
    approach: r.approach || undefined,
    outcome: r.outcome || undefined,
    // jsonb is only as well-formed as whoever wrote it — keep the usable entries
    results: Array.isArray(r.results)
      ? r.results.filter((x) => x && typeof x.value === "string" && x.value && typeof x.label === "string")
      : [],
    gallery: Array.isArray(r.gallery)
      ? r.gallery
          .filter((g) => g && typeof g.src === "string" && g.src)
          .map((g) => ({ ...g, kind: g.kind === "mobile" ? "mobile" : "desktop" }))
      : [],
    testimonial: r.testimonial_quote
      ? {
          quote: r.testimonial_quote,
          author: r.testimonial_author || "",
          role: r.testimonial_role || undefined,
        }
      : undefined,
  };
}

export const getProjects = cache(async (): Promise<Project[]> => {
  if (!isSupabaseConfigured()) return staticProjects;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(deadline())
      .retry(false);

    if (error || !data?.length) return staticProjects;
    return (data as ProjectRow[]).map(rowToProject);
  } catch {
    return staticProjects;
  }
});

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

/* ---------------------------------------------------------------------------
   Services — same contract as getProjects(): Supabase when configured, the
   checked-in lib/services.ts otherwise, and an empty table is treated as "not
   set up" rather than "no services", so the site can never render a blank
   Services section because someone hasn't imported them yet.
--------------------------------------------------------------------------- */
const ICONS: IconName[] = ["web", "app", "design", "cloud", "ai", "consult"];

function rowToService(r: ServiceRow): Service {
  return {
    slug: r.slug,
    title: r.title,
    blurb: r.blurb,
    detail: r.detail,
    deliverables: r.deliverables ?? [],
    // the column is free text; fall back rather than render a broken <Icon>
    icon: (ICONS as string[]).includes(r.icon) ? (r.icon as IconName) : "web",
  };
}

export const getServices = cache(async (): Promise<Service[]> => {
  if (!isSupabaseConfigured()) return staticServices;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(deadline())
      .retry(false);

    if (error || !data?.length) return staticServices;
    return (data as ServiceRow[]).map(rowToService);
  } catch {
    return staticServices;
  }
});

/* ---------------------------------------------------------------------------
   Public team roster (/about). NOT `profiles` — that's panel logins. See the
   note on team_members in supabase/schema.sql.
--------------------------------------------------------------------------- */
export type TeamMember = { name: string; role: string; initials: string };

/** "James Vincent Calunsag" -> "JC". Used when the column is left blank. */
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export const getTeam = cache(async (): Promise<TeamMember[]> => {
  if (!isSupabaseConfigured()) return staticTeam;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(deadline())
      .retry(false);

    if (error || !data?.length) return staticTeam;
    return (data as TeamMemberRow[]).map((m) => ({
      name: m.name,
      role: m.role,
      initials: m.initials?.trim() || deriveInitials(m.name),
    }));
  } catch {
    return staticTeam;
  }
});

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

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  if (!isSupabaseConfigured()) return staticContent;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .abortSignal(deadline()) // must precede .single(), which drops the transform methods
      .retry(false)
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
});
