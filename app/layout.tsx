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
import SiteChrome from "@/components/SiteChrome";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ThemeScript from "@/components/theme/ThemeScript";
import { site, socials } from "@/lib/site";

const description =
  "mykTech() is an IT studio in Dipolog City building web, mobile, and cloud products. We make software and innovate — with taste.";

export const metadata: Metadata = {
  title: {
    default: "mykTech() — Software, designed with intent",
    template: "%s · mykTech()",
  },
  description,
  metadataBase: new URL(site.url),
  alternates: { canonical: "/" },
  openGraph: {
    title: "mykTech() — Software, designed with intent",
    description,
    url: site.url,
    siteName: "mykTech()",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mykTech() — Software, designed with intent",
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
    // data-theme is written by ThemeScript before hydration
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${syne.variable}`}
    >
      <head>
        <ThemeScript />
        {/* the wordmark masks drive the preloader's first frame — fetch them
            with the document so the opening sequence never starts empty */}
        <link rel="preload" as="image" href="/brand/wordmark.png" />
        <link rel="preload" as="image" href="/brand/wordmark-outline.png" />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          {/* marketing chrome; skipped entirely on /admin */}
          <SiteChrome footer={<Footer />}>{children}</SiteChrome>
        </ThemeProvider>
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
