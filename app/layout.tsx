import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Syne } from "next/font/google";
import "./globals.css";

// Brand / display typeface (free look-alike for "Inline" by Letters from Sweden)
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import SmoothScroll from "@/components/fx/SmoothScroll";
import AmbientBackground from "@/components/fx/AmbientBackground";
import Cursor from "@/components/fx/Cursor";
import Preloader from "@/components/fx/Preloader";
import ScrollFX from "@/components/fx/ScrollFX";
import { site, socials } from "@/lib/site";

const description =
  "MYKTECH is an IT studio in Dipolog City building web, mobile, and cloud products. We make software and innovate — with taste.";

export const metadata: Metadata = {
  title: {
    default: "MYKTECH — Software, designed with intent",
    template: "%s · MYKTECH",
  },
  description,
  metadataBase: new URL(site.url),
  alternates: { canonical: "/" },
  openGraph: {
    title: "MYKTECH — Software, designed with intent",
    description,
    url: site.url,
    siteName: "MYKTECH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MYKTECH — Software, designed with intent",
    description,
  },
};

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${syne.variable}`}
    >
      <body className="min-h-screen antialiased">
        <AmbientBackground />
        <Preloader />
        <Cursor />
        <ScrollProgress />
        <SmoothScroll>
          <Nav />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
        <ScrollFX />
        {/* filmic grain over the whole page (under nav/cursor) */}
        <div className="grain pointer-events-none fixed inset-0 z-40" aria-hidden />
        <Analytics />
        <SpeedInsights />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
