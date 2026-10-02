"use client";

import { usePathname } from "next/navigation";
import { localeNames, localeShort, locales } from "@/lib/i18n/config";
import { switchLocalePath } from "@/lib/i18n/paths";
import { useI18n } from "./I18nProvider";

/**
 * EN / FIL pill. Each option is a plain <a> to the same page in the other
 * language — a full navigation between two prerendered pages, so the new
 * <html lang>, metadata and server-rendered chrome all arrive fresh. There is
 * deliberately no client-side locale state.
 *
 * Same shell as ThemeToggle (h-9, rounded-full, thin mist border, faint ink
 * fill). `tone="band"` is for the always-dark footer, where the neutral ramp is
 * pinned light-on-dark.
 *
 * `usePathname()` is the internal /en/… path while the page is prerendered and
 * the public /… path in the browser; switchLocalePath() normalises both, so the
 * hrefs hydrate identically.
 */
export default function LanguageSwitcher({
  tone = "paper",
  className = "",
}: {
  tone?: "paper" | "band";
  className?: string;
}) {
  const { lang, t } = useI18n();
  const pathname = usePathname() ?? "/";

  const shell =
    tone === "band"
      ? "border-white/15 bg-white/[0.04]"
      : "border-mist/70 bg-ink/[0.04]";
  const idle =
    tone === "band"
      ? "text-paper/60 hover:text-paper"
      : "text-ink/60 hover:text-ink";
  const current = tone === "band" ? "bg-paper text-ink" : "bg-ink text-paper";
  const ring =
    tone === "band"
      ? "focus-visible:ring-offset-ink"
      : "focus-visible:ring-offset-paper";

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={`inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full border p-1 font-mono text-[11px] tracking-[0.12em] ${shell} ${className}`}
    >
      {locales.map((l) => {
        const cls = `flex h-7 items-center rounded-full px-2.5 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to focus-visible:ring-offset-2 ${ring}`;
        const label = (
          <>
            <span aria-hidden>{localeShort[l]}</span>
            <span className="sr-only">{localeNames[l]}</span>
          </>
        );
        return l === lang ? (
          <span key={l} lang={l} aria-current="true" className={`${cls} ${current}`}>
            {label}
          </span>
        ) : (
          <a
            key={l}
            href={switchLocalePath(pathname, l)}
            hrefLang={l}
            lang={l}
            title={t("lang.switchTo", { language: localeNames[l] })}
            className={`${cls} ${idle}`}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
