"use client";

import Nav from "@/components/Nav";
import ScrollProgress from "@/components/ScrollProgress";
import SmoothScroll from "@/components/fx/SmoothScroll";
import AmbientBackground from "@/components/fx/AmbientBackground";
import Preloader from "@/components/fx/Preloader";
import ScrollFX from "@/components/fx/ScrollFX";
import ChatWidget from "@/components/chat/ChatWidget";
import SearchLauncher from "@/components/search/SearchLauncher";
import LiveUpdates from "@/components/LiveUpdates";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import type { PublishedSections } from "@/lib/cms";
import type { Locale } from "@/lib/i18n/config";
import type { ClientMessages } from "@/lib/i18n/messages";
import type { SearchEntry } from "@/lib/search-score";

/**
 * Wraps the marketing pages in the site's full chrome — ambient background
 * (which also carries the grain), preloader, Lenis smooth scroll, nav, footer —
 * and the I18nProvider that gives every client component below it the page's
 * locale and its chrome strings.
 *
 * There is deliberately no custom cursor and no full-viewport overlay above the
 * content: a JS cursor always trails the OS one by a frame and stutters whenever
 * the main thread is busy, and a fixed layer over everything is re-composited on
 * every frame. Both were the lag visitors could feel.
 *
 * Only the public root layout (app/[lang]/layout.tsx) renders this. The admin
 * panel has its own root layout and never mounts it — a CMS wants native
 * scrolling and no opening sequence — so there is no pathname check here any
 * more.
 *
 * `footer` arrives as a prop rather than an import: Footer is an async server
 * component (it reads the CMS), and a client component can't import one — it can
 * only receive it already-rendered.
 *
 * `sections` (which CMS sections have published content → nav links) and
 * `searchIndex` (the Cmd+K index for this locale) are read by the [lang] layout
 * on the server and handed down; LiveUpdates' router.refresh() re-fetches both
 * along with the page.
 */
export default function SiteChrome({
  children,
  footer,
  lang,
  messages,
  sections,
  searchIndex,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  lang: Locale;
  messages: ClientMessages;
  sections: PublishedSections;
  searchIndex: SearchEntry[];
}) {
  return (
    <I18nProvider lang={lang} messages={messages}>
      <AmbientBackground />
      <Preloader />
      <ScrollProgress />
      <SmoothScroll>
        <Nav sections={sections} />
        <main>{children}</main>
        {footer}
      </SmoothScroll>
      <ScrollFX />
      {/* Outside <SmoothScroll> on purpose: they're position:fixed, and Lenis puts
          a transform on its wrapper, which would make `fixed` resolve against that
          wrapper instead of the viewport and they would scroll away. Both stay
          hidden until the opening sequence is done (whenReady). The palette's
          own code loads on first open; only its key listener is here. */}
      <ChatWidget />
      <SearchLauncher index={searchIndex} />
      <LiveUpdates />
    </I18nProvider>
  );
}
