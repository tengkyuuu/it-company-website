import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import {
  isSupabaseConfigured,
  type EmploymentType,
  type GalleryShot,
  type JobRow,
  type PostRow,
  type ProductRow,
  type ProjectRow,
  type ServiceRow,
  type SiteSettingsRow,
  type TeamMemberRow,
  type Workplace,
} from "@/lib/supabase/types";
// plain modules (no secrets, no "use client") — the same rules the panel saves with
import { imagePath, isCtaUrl } from "@/app/admin/_lib/validators";
import { manilaDate } from "@/app/admin/_lib/catalog";
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

/** jsonb is only as well-formed as whoever wrote it — keep the usable entries. */
function cleanGallery(gallery: unknown): GalleryShot[] {
  if (!Array.isArray(gallery)) return [];
  return gallery
    .filter((g): g is GalleryShot => Boolean(g) && typeof g.src === "string" && Boolean(g.src))
    .map((g) => ({ ...g, kind: g.kind === "mobile" ? "mobile" : "desktop" }));
}

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
    gallery: cleanGallery(r.gallery),
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

/* ===========================================================================
   Products, careers and the blog.

   Same fail-fast reads as everything above, with ONE deliberate difference:
   the fallback is EMPTY. There is no checked-in list of products, open roles
   or posts, and inventing one would put made-up offerings, jobs or articles on
   the site under our name. A missing config, an unreachable database and an
   empty table all mean the same thing here — nothing to show yet — so pages
   render an empty state (or 404 a detail), and getPublishedSections() keeps
   the nav/footer link hidden until there is something behind it.
   =========================================================================== */

export type Product = {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  description: string;
  features: string[];
  /** main image; undefined when there is none (or the stored value isn't a safe src) */
  image?: string;
  /** extra screens, same shape as a project's gallery */
  gallery: GalleryShot[];
  /** free-text badge ("Beta", "Coming soon"); undefined = no badge */
  status?: string;
  /**
   * The button — present only when BOTH a label and a safe link are set
   * (https:// or an internal /path; re-checked here, the column has no CHECK).
   * `external` = an https link, i.e. open it in a new tab.
   */
  cta?: { label: string; href: string; external: boolean };
  /** ISO timestamp — for the sitemap's lastModified */
  updatedAt: string;
};

export type Job = {
  /** the apply form needs it: applications are stored as leads with job_id */
  id: string;
  slug: string;
  title: string;
  department?: string;
  location?: string;
  employmentType: EmploymentType;
  workplace: Workplace;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  /** last day applications are accepted, 'YYYY-MM-DD' (inclusive); undefined = open-ended */
  closesAt?: string;
  /**
   * closesAt is before today in Manila. getJobs() leaves closed roles out;
   * getJobBySlug() still returns them so a stale link can say "this role has
   * closed" instead of 404ing — and the apply form must not be offered.
   */
  closed: boolean;
  updatedAt: string;
};

/** A post as the index needs it — everything but the body. */
export type PostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  tags: string[];
  /** byline; undefined = none */
  author?: string;
  /** ISO timestamp. The database stamps it on first publish, so it's always set for a live post. */
  publishedAt: string;
  updatedAt: string;
};

export type Post = PostSummary & {
  /** markdown — render it on the server */
  body: string;
};

export type PublishedSections = { products: boolean; careers: boolean; blog: boolean };

/**
 * Today's date on the studio's calendar ('YYYY-MM-DD', Asia/Manila) — not the
 * server's: Vercel runs in UTC, which is still "yesterday" until 08:00 PHT.
 */
export function manilaToday(now: Date = new Date()): string {
  return manilaDate(now.toISOString());
}

/** A role is closed once its last day (closes_at, inclusive) is behind us in Manila. */
export function isJobClosed(closesAt: string | null | undefined, today: string = manilaToday()) {
  const day = closesAt?.slice(0, 10) ?? "";
  // a malformed value can't be compared — treat it as open-ended rather than
  // silently hiding a role someone published
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today;
}

const EMPLOYMENT_TYPES: EmploymentType[] = ["full-time", "part-time", "contract", "internship"];
const WORKPLACES: Workplace[] = ["onsite", "hybrid", "remote"];

/** An <img src> we're willing to render — the same rule the panel enforces on save. */
const safeImage = (v: string | null | undefined) =>
  v && imagePath.safeParse(v).success ? v : undefined;

function rowToProduct(r: ProductRow): Product {
  const label = r.cta_label?.trim() ?? "";
  const href = r.cta_url?.trim() ?? "";
  return {
    slug: r.slug,
    name: r.name,
    tagline: r.tagline ?? "",
    summary: r.summary ?? "",
    description: r.description ?? "",
    features: r.features ?? [],
    image: safeImage(r.image),
    gallery: cleanGallery(r.gallery).filter((g) => safeImage(g.src)),
    status: r.status?.trim() || undefined,
    cta:
      label && href && isCtaUrl(href)
        ? { label, href, external: !href.startsWith("/") }
        : undefined,
    updatedAt: r.updated_at,
  };
}

function rowToJob(r: JobRow, today: string): Job {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    department: r.department?.trim() || undefined,
    location: r.location?.trim() || undefined,
    // CHECK constraints guarantee these today; don't let a future value crash a page
    employmentType: EMPLOYMENT_TYPES.includes(r.employment_type) ? r.employment_type : "full-time",
    workplace: WORKPLACES.includes(r.workplace) ? r.workplace : "onsite",
    summary: r.summary ?? "",
    description: r.description ?? "",
    responsibilities: r.responsibilities ?? [],
    requirements: r.requirements ?? [],
    closesAt: r.closes_at?.slice(0, 10) || undefined,
    closed: isJobClosed(r.closes_at, today),
    updatedAt: r.updated_at,
  };
}

/** The index never needs the body — it can be long, and there are many posts. */
const POST_SUMMARY_COLUMNS =
  "slug, title, excerpt, cover_image, tags, author_name, published_at, created_at, updated_at";

type PostSummaryRow = Pick<
  PostRow,
  | "slug"
  | "title"
  | "excerpt"
  | "cover_image"
  | "tags"
  | "author_name"
  | "published_at"
  | "created_at"
  | "updated_at"
>;

function rowToPostSummary(r: PostSummaryRow): PostSummary {
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? "",
    coverImage: safeImage(r.cover_image),
    tags: r.tags ?? [],
    author: r.author_name?.trim() || undefined,
    // stamped by the DB on first publish; created_at only covers a row written
    // around the trigger (e.g. a restore with triggers disabled)
    publishedAt: r.published_at ?? r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Published products, in the panel's order. Empty when there are none (or no database). */
export const getProducts = cache(async (): Promise<Product[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await createPublicClient()
      .from("products")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(deadline())
      .retry(false);
    if (error || !data) return [];
    return (data as ProductRow[]).map(rowToProduct);
  } catch {
    return [];
  }
});

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug);
}

/** Published roles that are still open, in the panel's order. */
export const getJobs = cache(async (): Promise<Job[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await createPublicClient()
      .from("jobs")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(deadline())
      .retry(false);
    if (error || !data) return [];
    const today = manilaToday();
    return (data as JobRow[]).map((r) => rowToJob(r, today)).filter((j) => !j.closed);
  } catch {
    return [];
  }
});

/**
 * One published role by slug — INCLUDING a closed one (check `closed`), so an
 * old link can explain itself. Undefined only when it's unpublished or gone.
 */
export const getJobBySlug = cache(async (slug: string): Promise<Job | undefined> => {
  if (!isSupabaseConfigured() || !slug) return undefined;
  try {
    const { data, error } = await createPublicClient()
      .from("jobs")
      .select("*")
      .eq("published", true)
      .eq("slug", slug)
      .abortSignal(deadline()) // before .maybeSingle(), which drops the transform methods
      .retry(false)
      .maybeSingle();
    if (error || !data) return undefined;
    return rowToJob(data as JobRow, manilaToday());
  } catch {
    return undefined;
  }
});

/** Published posts, newest first (no bodies — see getPostBySlug). */
export const getPosts = cache(async (): Promise<PostSummary[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await createPublicClient()
      .from("posts")
      .select(POST_SUMMARY_COLUMNS)
      .eq("published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .abortSignal(deadline())
      .retry(false);
    if (error || !data) return [];
    return (data as unknown as PostSummaryRow[]).map(rowToPostSummary);
  } catch {
    return [];
  }
});

export const getPostBySlug = cache(async (slug: string): Promise<Post | undefined> => {
  if (!isSupabaseConfigured() || !slug) return undefined;
  try {
    const { data, error } = await createPublicClient()
      .from("posts")
      .select("*")
      .eq("published", true)
      .eq("slug", slug)
      .abortSignal(deadline())
      .retry(false)
      .maybeSingle();
    if (error || !data) return undefined;
    const row = data as PostRow;
    return { ...rowToPostSummary(row), body: row.body ?? "" };
  } catch {
    return undefined;
  }
});

/**
 * Which of the three sections have anything to show — for the nav and footer,
 * so a link appears only once something is published behind it. One tiny
 * query per table, in parallel, each failing on its own to `false`: a missing
 * table or a paused database hides a link, never breaks the chrome.
 */
export const getPublishedSections = cache(async (): Promise<PublishedSections> => {
  if (!isSupabaseConfigured()) return { products: false, careers: false, blog: false };

  const supabase = createPublicClient();

  const anyPublished = async (table: "products" | "posts") => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .eq("published", true)
        .limit(1)
        .abortSignal(deadline())
        .retry(false);
      return !error && Boolean(data?.length);
    } catch {
      return false;
    }
  };

  // Careers counts only roles getJobs() would list. Ordered so the top row is
  // an open-ended role (NULLS FIRST) if there is one, else the latest closing
  // date — so a single row answers "is anything still open?".
  const anyOpenJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("closes_at")
        .eq("published", true)
        .order("closes_at", { ascending: false, nullsFirst: true })
        .limit(1)
        .abortSignal(deadline())
        .retry(false);
      if (error || !data?.length) return false;
      return !isJobClosed((data[0] as Pick<JobRow, "closes_at">).closes_at);
    } catch {
      return false;
    }
  };

  const [products, careers, blog] = await Promise.all([
    anyPublished("products"),
    anyOpenJob(),
    anyPublished("posts"),
  ]);
  return { products, careers, blog };
});
