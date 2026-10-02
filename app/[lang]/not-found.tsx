"use client";

import Button from "@/components/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * The branded 404 for every public URL, in the visitor's language.
 *
 * A client component because not-found files receive no params: the locale
 * comes from the I18nProvider that SiteChrome renders in the [lang] layout,
 * which wraps this boundary. Reached by:
 *  - notFound() in a page (unknown project slug, junk [lang]);
 *  - app/[lang]/[...missing] — every unmatched public URL, since middleware
 *    rewrites them all to /en/… or leaves them under /fil/….
 */
export default function NotFound() {
  const { t, href } = useI18n();
  return (
    <section className="relative flex min-h-[82svh] flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slatey">
        {t("notFound.eyebrow")}
      </span>
      <h1 className="mt-6 font-display text-6xl font-semibold tracking-tight md:text-8xl">
        {t("notFound.titleLead")} <span className="text-accent">{t("notFound.titleAccent")}</span>
      </h1>
      <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-ink/60">
        {t("notFound.body")}
      </p>
      <div className="mt-9">
        <Button href={href("/")} arrow>
          {t("notFound.cta")}
        </Button>
      </div>
    </section>
  );
}
