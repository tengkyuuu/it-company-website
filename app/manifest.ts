import type { MetadataRoute } from "next";

/**
 * /manifest.webmanifest — makes the site installable. Shell-only PWA: the
 * service worker (public/sw.js, registered by components/pwa/) caches the
 * offline page, icons and immutable build assets, never pages or data.
 *
 * Launched from the home screen (display-mode: standalone) the opening
 * sequence is skipped — see ThemeScript and Preloader.
 *
 * Colours are the `paper` token (light): the default theme, and what the nav
 * bar is painted in. DocumentShell adds per-scheme theme-color metas, which
 * take over from theme_color once a page has loaded. Icons: scripts/build-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "R Ally's Tech",
    short_name: "R Ally's Tech",
    description:
      "R Ally's Tech is an IT studio in Dipolog City building web, mobile, and cloud products.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#F8FAFC",
    lang: "en",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
