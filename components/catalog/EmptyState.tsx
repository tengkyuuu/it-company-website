import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch, { type KeyTint } from "@/components/fx/KeySwitch";

/**
 * What /products, /careers and /blog show with nothing published. The page
 * still renders (someone may hold an old link, and the header keeps the
 * section's identity) — it's just `noindex` and out of the sitemap.
 *
 * Deliberately quiet: a dashed "placeholder" sheet with a ghosted 00, one
 * warm sentence and a way to reach a human. No illustration, no apology.
 */
export default function EmptyState({
  title,
  body,
  cta,
  href,
  tint = "plum",
}: {
  title: string;
  body: string;
  cta: string;
  /** already localized */
  href: string;
  tint?: KeyTint;
}) {
  return (
    <Reveal className="relative overflow-hidden rounded-[2rem] border border-dashed border-mist bg-surface/60 px-7 py-14 md:px-14 md:py-20">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3 -top-8 select-none font-display text-[9rem] font-bold leading-none text-stroke-soft md:-top-12 md:text-[14rem]"
      >
        00
      </span>
      <div className="relative max-w-xl">
        <h2 className="text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-ink/60">{body}</p>
        <div className="mt-9 flex items-center gap-5">
          <Button href={href} arrow>
            {cta}
          </Button>
          <KeySwitch size={46} tint={tint} className="hidden sm:block" />
        </div>
      </div>
    </Reveal>
  );
}
