import { THEME_KEY } from "@/lib/theme";
import { DISPLAY_SCRIPT } from "@/components/pwa/display-mode";

/**
 * Stamps <html data-theme> before first paint so the page never flashes the
 * wrong theme. Must stay in <head>, ahead of any styles that depend on it, and
 * must not be deferred. Falls back to the OS preference when nothing is stored.
 *
 * Also stamps <html data-display="standalone"> when launched as the installed
 * app, so the opening sequence is hidden before it can paint (see
 * components/pwa/display-mode.ts). Separate try blocks: one failing must not
 * skip the other.
 *
 * Inline on purpose — the CSP allows 'unsafe-inline' scripts precisely so this
 * can run without a nonce (lib/security-headers.mjs explains why).
 */
export default function ThemeScript() {
  const js = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
    THEME_KEY
  )});var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}${DISPLAY_SCRIPT}})();`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
