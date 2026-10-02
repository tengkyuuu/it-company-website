"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import ScrollProgress from "@/components/ScrollProgress";
import SmoothScroll from "@/components/fx/SmoothScroll";
import AmbientBackground from "@/components/fx/AmbientBackground";
import Preloader from "@/components/fx/Preloader";
import ScrollFX from "@/components/fx/ScrollFX";
import ChatWidget from "@/components/chat/ChatWidget";

/**
 * Wraps the marketing pages in the site's full chrome — ambient background
 * (which also carries the grain), preloader, Lenis smooth scroll, nav, footer.
 *
 * There is deliberately no custom cursor and no full-viewport overlay above the
 * content: a JS cursor always trails the OS one by a frame and stutters whenever
 * the main thread is busy, and a fixed layer over everything is re-composited on
 * every frame. Both were the lag visitors could feel.
 *
 * The admin panel deliberately gets none of it: a CMS wants native scrolling and
 * no first-load counter. Gating here (rather than moving every
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
      <ScrollProgress />
      <SmoothScroll>
        <Nav />
        <main>{children}</main>
        {footer}
      </SmoothScroll>
      <ScrollFX />
      {/* Outside <SmoothScroll> on purpose: it's position:fixed, and Lenis puts a
          transform on its wrapper, which would make `fixed` resolve against that
          wrapper instead of the viewport and the launcher would scroll away. */}
      <ChatWidget />
    </>
  );
}
