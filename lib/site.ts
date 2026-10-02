export const site = {
  // Casing is deliberate and fixed — lowercase "myk", capital "T", trailing "()".
  name: "R Ally's Tech",
  tagline: "Software, designed with intent.",
  // Canonical production URL (used for metadata, sitemap, JSON-LD). Update when
  // the custom domain is live; override with NEXT_PUBLIC_SITE_URL if needed.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://mykt.studio",
  email: "hello@mykt.studio",
  phone: "+63 65 212 3344",
  address: {
    line1: "2F Sunrise Center, Rizal Avenue",
    line2: "Estaka, Dipolog City",
    region: "Zamboanga del Norte, Philippines 7100",
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

export const socials = [
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "Dribbble", href: "https://dribbble.com" },
  { label: "GitHub", href: "https://github.com" },
];
