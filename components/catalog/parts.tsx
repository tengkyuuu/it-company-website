import type { ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { Locale } from "@/lib/i18n/config";
import { localizePath } from "@/lib/i18n/paths";

/**
 * Small server-rendered pieces shared by the Products / Careers / Blog pages.
 * Tokens only (bg-surface, text-ink, border-mist…), so dark mode is free.
 */

/** A neutral mono pill — a product's free-text status ("Beta"), a closed role. */
export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-mist/80 bg-ink/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-ink/70 ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink/35" />
      {children}
    </span>
  );
}

/** "← All products" — the back link that heads every detail page. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey transition-colors hover:text-ink"
    >
      <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-0.5">
        ←
      </span>
      {children}
    </Link>
  );
}

/**
 * A product's own call to action. Internal links get the site's magnetic
 * <Button>; an https link (another site) is a plain anchor in the same solid
 * style that opens in a new tab — Button has no target, and a stranger's
 * domain shouldn't replace the page the visitor was reading.
 */
export function ProductCta({
  cta,
  lang,
  newTabLabel,
}: {
  cta: { label: string; href: string; external: boolean };
  lang: Locale;
  /** screen-reader suffix, e.g. "(opens in a new tab)" */
  newTabLabel: string;
}) {
  if (!cta.external) {
    return (
      <Button href={localizePath(lang, cta.href)} arrow>
        {cta.label}
      </Button>
    );
  }
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium tracking-tight text-paper transition-[transform,background-color] duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <span className="absolute inset-0 rounded-full bg-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative z-10 inline-flex items-center gap-2">
        {cta.label}
        <span aria-hidden>↗</span>
        <span className="sr-only">{newTabLabel}</span>
      </span>
    </a>
  );
}

/**
 * A screenshot shown at its NATIVE aspect and never larger than its own pixels:
 * `w-auto h-auto max-w-full` lets the browser size it from the file, so a
 * ~1536px capture is never upscaled into blur and never cover-cropped (see the
 * screenshot rule in CLAUDE.md). A plain <img>, not next/image: these come
 * from the panel and may live on any https host, which next/image's
 * remotePatterns would refuse.
 */
export function Shot({
  src,
  alt,
  eager = false,
  className = "",
}: {
  src: string;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      className={`mx-auto block h-auto w-auto max-w-full ${className}`}
    />
  );
}
