import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Syne } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteAnalytics from "@/components/SiteAnalytics";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ThemeScript from "@/components/theme/ThemeScript";
import "@/app/globals.css";

// Brand / display typeface (free look-alike for "Inline" by Letters from Sweden)
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

/**
 * The <html>/<body> boilerplate shared by the site's TWO root layouts —
 * app/[lang]/layout.tsx (public, en|fil) and app/admin/layout.tsx (English).
 * There is no app/layout.tsx any more: the public site needs `<html lang>` per
 * locale, which only a layout under [lang] can know. Everything both trees must
 * agree on lives here so they can't drift: fonts, global CSS, the pre-paint
 * theme script, the theme context, analytics.
 *
 * - ThemeScript stays first in <head>: it stamps data-theme before any paint.
 * - suppressHydrationWarning: data-theme is written by that script, not React.
 * - SiteAnalytics drops /admin events itself.
 */
export default function DocumentShell({
  lang,
  head,
  children,
}: {
  lang: string;
  /** extra <head> children (preloads), after the theme script */
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${syne.variable}`}
    >
      <head>
        <ThemeScript />
        {head}
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <SiteAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
