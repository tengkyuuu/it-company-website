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
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import SmoothScroll from "@/components/fx/SmoothScroll";
import AmbientBackground from "@/components/fx/AmbientBackground";
import Cursor from "@/components/fx/Cursor";
import Preloader from "@/components/fx/Preloader";
import ScrollFX from "@/components/fx/ScrollFX";

export const metadata: Metadata = {
  title: {
    default: "MYKTECH — Software, designed with intent",
    template: "%s · MYKTECH",
  },
  description:
    "MYKTECH is an IT studio building web, mobile, and cloud products. We make software and innovate — with taste.",
  metadataBase: new URL("https://mykt.studio"),
  openGraph: {
    title: "MYKTECH — Software, designed with intent",
    description:
      "Web, mobile, cloud, AI and design — built by a team that sweats the details.",
    type: "website",
  },
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
      </body>
    </html>
  );
}
