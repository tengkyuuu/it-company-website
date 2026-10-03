import type { Metadata } from "next";
import DocumentShell from "@/components/DocumentShell";
import SiteChrome from "@/components/SiteChrome";
import Footer from "@/components/Footer";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import { getPublishedSections } from "@/lib/cms";
import { buildSearchIndex } from "@/lib/search";
import { locales } from "@/lib/i18n/config";
import { getClientMessages, getDictionary } from "@/lib/i18n/dictionary";
import { openGraphFor, TWITTER_IMAGE } from "@/lib/i18n/metadata";
import { toLocale } from "@/lib/i18n/params";
import { site, socials } from "@/lib/site";

/**
 * Root layout of the PUBLIC site, for both locales. (The admin panel has its own
 * root layout; both share components/DocumentShell.)
 *
 * English is served at the unprefixed URLs and Filipino under /fil —
 * middleware.ts rewrites `/projects` → `/en/projects` internally — so every page
 * below is prerendered once per locale and the right language is in the HTML
 * from the first byte.
 */

// Both locales are prerendered; child pages inherit these params.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// Re-render every public page at least hourly, even with no admin edit. Admin
// saves already revalidatePath() what they touch, but two things here depend on
// the CLOCK, not on an edit: a job's "closed" status and the Careers nav link
// are decided at render time in Asia/Manila (lib/cms.ts → isJobClosed), so a
// role whose last day passes overnight must drop off the nav, the search index
// and /careers without anyone touching the panel. Still static (ISR): nothing
// under this layout reads cookies() or headers(). A page may set a LOWER value.
export const revalidate = 3600;

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

// Long-form description stays English in both locales (marketing copy is out of
// the i18n scope — see lib/i18n/messages/en/site.ts).
const description =
  "R Ally's Tech is an IT studio in Dipolog City building web, mobile, and cloud products. We make software and innovate — with taste.";

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  const title = getDictionary(lang).t("meta.siteTitle");
  return {
    title: { default: title, template: "%s · R Ally's Tech" },
    description,
    metadataBase: new URL(site.url),
    openGraph: openGraphFor(lang, "/", { title, description }),
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.name,
  url: site.url,
  email: site.email,
  telephone: site.phone,
  image: `${site.url}/opengraph-image`,
  logo: `${site.url}/icon.png`,
  description,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address.line1,
    addressLocality: "Dipolog City",
    addressRegion: "Zamboanga del Norte",
    postalCode: "7100",
    addressCountry: "PH",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: site.geo.lat,
    longitude: site.geo.lng,
  },
  openingHours: "Mo-Fr 09:00-18:00",
  areaServed: "Philippines",
  sameAs: socials.map((s) => s.href),
};

export default async function LangLayout({ children, params }: Props) {
  // A junk [lang] (only reachable via paths middleware skips) renders as English
  // here; the page itself 404s via pageLocale(), inside this layout, so the
  // visitor still gets the branded 404.
  const lang = toLocale((await params).lang);

  // Nav links for the CMS sections + this locale's search index. Both are
  // fail-fast and never throw (cms.ts falls back; buildSearchIndex → []), and
  // cache()d, so the pages' own reads of the same data are deduped.
  const [sections, searchIndex] = await Promise.all([
    getPublishedSections(),
    buildSearchIndex(lang),
  ]);

  return (
    <DocumentShell
      lang={lang}
      head={
        // the wordmark masks drive the preloader's first frame — fetch them with
        // the document so the opening sequence never starts empty. CSS masks are
        // CORS-mode fetches, so the preload must be too or it won't be reused.
        <>
          <link rel="preload" as="image" href="/brand/wordmark.svg" crossOrigin="anonymous" />
          <link
            rel="preload"
            as="image"
            href="/brand/wordmark-outline.svg"
            crossOrigin="anonymous"
          />
        </>
      }
    >
      <SiteChrome
        lang={lang}
        messages={getClientMessages(lang)}
        footer={<Footer lang={lang} />}
        sections={sections}
        searchIndex={searchIndex}
      >
        {children}
      </SiteChrome>
      {/* PWA: registers public/sw.js after the opening sequence, production only */}
      <ServiceWorkerRegistrar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </DocumentShell>
  );
}
