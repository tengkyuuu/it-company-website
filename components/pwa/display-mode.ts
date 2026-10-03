/**
 * "Was this page launched as the installed app?" — decided once, before first
 * paint, by the blocking inline script in <head> (components/theme/ThemeScript),
 * and recorded as `data-display="standalone"` on <html>.
 *
 * Why it has to be that early: the opening sequence (fx/Preloader) is in the
 * SSR HTML and its CSS animation starts at first paint, so the only way to not
 * show it is a selector that matches before the body is painted —
 * `[data-display="standalone"] .pl { display: none }` in globals.css. Preloader
 * then reads the same attribute to hand over (markReady) immediately.
 *
 * A data attribute rather than a class: React renders <html className> itself
 * and owns that attribute; it never touches data-display.
 *
 * Plain module on purpose (no "use client"): ThemeScript is a server component,
 * and a value imported across the RSC boundary from a client module arrives as
 * a reference proxy, not the value (see lib/theme.ts).
 */
export const DISPLAY_ATTR = "data-display";
export const STANDALONE = "standalone";

/**
 * Installed-app launch: `display-mode: standalone` (Chromium, Firefox Android,
 * Safari 17+ desktop) or iOS Safari's own `navigator.standalone`.
 */
export const DISPLAY_SCRIPT = `try{if(window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true){document.documentElement.setAttribute(${JSON.stringify(
  DISPLAY_ATTR
)},${JSON.stringify(STANDALONE)});}}catch(e){}`;

/** Client-side read of what the head script decided. */
export function isStandaloneLaunch(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute(DISPLAY_ATTR) === STANDALONE;
}
