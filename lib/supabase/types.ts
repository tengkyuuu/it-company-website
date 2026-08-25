/** Shapes mirroring supabase/schema.sql. Hand-written (no codegen step). */

export type Role = "owner" | "admin" | "editor";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  created_at: string;
};

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  url: string;
  live_url: string | null;
  year: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  dots: string[];
  img: string | null;
  img2: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SocialLink = { label: string; href: string };

export type SiteSettingsRow = {
  id: number;
  brand_name: string;
  tagline: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  hours: string;
  availability: string;
  available: boolean;
  socials: SocialLink[];
  updated_at: string;
};

/** True when the Supabase env vars are present, i.e. the CMS is wired up. */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
