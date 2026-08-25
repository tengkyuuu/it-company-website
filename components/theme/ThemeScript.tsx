import { THEME_KEY } from "@/lib/theme";

/**
 * Stamps <html data-theme> before first paint so the page never flashes the
 * wrong theme. Must stay in <head>, ahead of any styles that depend on it, and
 * must not be deferred. Falls back to the OS preference when nothing is stored.
 */
export default function ThemeScript() {
  const js = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
    THEME_KEY
  )});var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
