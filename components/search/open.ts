/**
 * Open the site search palette from anywhere (the Nav button, a 404 page, …).
 *
 * Deliberately a plain module — no "use client", no React, no imports — so it
 * costs nothing to import and can't drag the palette's code into a bundle. It
 * just dispatches a window event that the always-mounted key listener in
 * `components/search/SearchLauncher.tsx` handles (lazy-loading the palette on
 * first open).
 *
 *   import { openSearch } from "@/components/search/open";
 *   <button onClick={openSearch}>Search</button>
 */

export const OPEN_SEARCH_EVENT = "mykt:open-search";

export function openSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
