"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import ScrollProgress from "@/components/ScrollProgress";
import SmoothScroll from "@/components/fx/SmoothScroll";
import AmbientBackground from "@/components/fx/AmbientBackground";
import Cursor from "@/components/fx/Cursor";
import Preloader from "@/components/fx/Preloader";
import ScrollFX from "@/components/fx/ScrollFX";

/**
 * Wraps the marketing pages in the site's full chrome — ambient background,
 * preloader, custom cursor, Lenis smooth scroll, nav, footer, grain.
 *
 * The admin panel deliberately gets none of it: a CMS wants native scrolling, a
 * real cursor and no first-load counter. Gating here (rather than moving every
 * marketing route into a `(site)` route group) keeps the change small — the root
 * layout still owns <html>, the fonts and the theme, which admin does share.
 *
 * `footer` arrives as a prop rather than an import: Footer is an async server
 * component (it reads the CMS), and a client component can't import one — it can
 * only receive it already-rendered.
 */
export default function SiteChrome({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) return <>{children}</>;

  return (
    <>
      <AmbientBackground />
      <Preloader />
      <Cursor />
      <ScrollProgress />
      <SmoothScroll>
        <Nav />
        <main>{children}</main>
        {footer}
      </SmoothScroll>
      <ScrollFX />
      {/* filmic grain over the whole page (under nav/cursor) */}
      <div className="grain pointer-events-none fixed inset-0 z-40" aria-hidden />
    </>
  );
}
