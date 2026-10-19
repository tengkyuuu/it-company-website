/**
 * The canonical origin (metadata, canonicals, sitemap, JSON-LD, OG URLs).
 *
 * There is no custom domain yet, so this must NOT be a hardcoded one: it used
 * to fall back to the old mykt.studio, a domain nobody owns, which told search
 * engines every page lived somewhere that doesn't resolve. Order:
 *   1. NEXT_PUBLIC_SITE_URL — set it once a real domain is live
 *   2. the Vercel project's production domain (*.vercel.app). Vercel provides
 *      it to every build; the NEXT_PUBLIC_ copy is what client bundles see
 *   3. localhost, for local builds
 */
function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const site = {
  name: "R Ally's Tech",
  tagline: "Software, designed with intent.",
  url: siteUrl(),
  // Public contact details. Empty = not shown anywhere (footer, /location,
  // JSON-LD, the chat assistant): there is no domain, so no company mailbox,
  // and the scaffold's phone number and street address were placeholders.
  // Enquiries arrive through the contact form (CONTACT_TO_EMAIL, server-only).
  // Fill these in — or in the admin's Site settings, once the CMS is on — when
  // real ones exist.
  email: "",
  phone: "",
  address: {
    line1: "Dipolog City",
    line2: "Zamboanga del Norte, Philippines",
  },
  // approximate geo for LocalBusiness structured data (Dipolog City)
  geo: { lat: 8.5889, lng: 123.4167 },
  hours: "Mon–Fri · 9:00–18:00 PHT",
};

/** The CMS-driven sections — linked only while something is published in them. */
export type NavSection = "products" | "careers" | "blog";

export type NavItem = {
  label: string;
  href: string;
  /**
   * Set → the item is shown only while that section has published content
   * (lib/cms getPublishedSections). Unset → always shown.
   */
  section?: NavSection;
};

export const nav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Products", href: "/products", section: "products" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog", section: "blog" },
  { label: "Careers", href: "/careers", section: "careers" },
  { label: "Location", href: "/location" },
];

/**
 * The nav items to render, given which sections have anything published.
 * No `sections` (e.g. no database) → the always-on items only, so a link
 * never leads to an empty page. Neutral module: used by the client Nav and
 * the server Footer. (The sitemap lists the sections from their own content,
 * so it can add every slug too.)
 */
export function visibleNav(
  sections?: Partial<Record<NavSection, boolean>> | null
): NavItem[] {
  return nav.filter((item) => !item.section || Boolean(sections?.[item.section]));
}

/**
 * Social profiles. Empty until the studio has real ones — these used to point at
 * the networks' home pages (https://linkedin.com …), which looked like links to
 * our profiles and weren't. Every renderer hides the row when this is empty.
 */
export const socials: { label: string; href: string }[] = [];
