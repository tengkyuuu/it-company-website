import type { Metadata } from "next";
import Link from "next/link";
import Section, { SectionHeader } from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import EmptyState from "@/components/catalog/EmptyState";
import { Badge, ProductCta, Shot } from "@/components/catalog/parts";
import { pad2 } from "@/components/catalog/format";
import { getProducts, type Product } from "@/lib/cms";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

/** Features shown on a sheet; the rest are on the product page. */
const SHEET_FEATURES = 5;

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  const { t } = getDictionary(lang);
  const products = await getProducts();
  return {
    title: t("products.metaTitle"),
    description: t("products.metaDescription"),
    // an empty shelf still renders for old links, but isn't worth indexing
    ...(products.length ? {} : { robots: { index: false, follow: true } }),
    ...localeMetadata(lang, "/products"),
  };
}

/**
 * Products index — large stacked "product sheets". Each product is one
 * enclosed sheet, like a printed spec sheet: a mono header strip (number,
 * status), name + tagline + CTAs beside a numbered feature list, and the
 * screenshot on its own paper plate at the foot, at native aspect.
 * Deliberately unlike the Projects index (open, alternating rows), the
 * landing WorkGallery (pinned horizontal) and ProcessDeck (sticky stack).
 */
export default async function ProductsPage({ params }: LangParams) {
  const lang = await pageLocale(params);
  const dict = getDictionary(lang);
  const { t } = dict;
  const products = await getProducts();
  const n = products.length;

  return (
    <>
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <SectionHeader
          as="h1"
          eyebrow={t("products.eyebrow")}
          title={
            <>
              {t("products.titleLead")}{" "}
              <span className="text-accent">{t("products.titleAccent")}</span>
            </>
          }
          intro={t("products.intro")}
        />
        {n > 0 && (
          <Reveal delay={0.1} className="mt-8 flex items-center gap-5">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/40">
              {n === 1
                ? t("products.countOne", { count: pad2(n) })
                : t("products.countMany", { count: pad2(n) })}
            </span>
            <span className="h-px flex-1 bg-mist/70" aria-hidden />
            <KeySwitch size={44} tint="mint" />
          </Reveal>
        )}
      </Section>

      {n === 0 ? (
        <Section className="pt-14 md:pt-20">
          <EmptyState
            title={t("products.emptyTitle")}
            body={t("products.emptyBody")}
            cta={t("products.emptyCta")}
            href={localizePath(lang, "/location")}
            tint="mint"
          />
        </Section>
      ) : (
        <>
          <Section className="pt-14 md:pt-20">
            <div className="space-y-10 md:space-y-16">
              {products.map((p, i) => (
                <ProductSheet key={p.slug} product={p} index={i} total={n} lang={lang} dict={dict} />
              ))}
            </div>
          </Section>

          <Section className="pt-28 md:pt-36">
            <Reveal className="flex flex-col items-start justify-between gap-8 border-t border-mist/70 pt-14 md:flex-row md:items-center">
              <div>
                <h2 className="max-w-xl text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  {t("products.closingTitle")}
                </h2>
                <p className="mt-3 max-w-md text-pretty leading-relaxed text-ink/60">
                  {t("products.closingBody")}
                </p>
              </div>
              <Button href={localizePath(lang, "/location")} arrow>
                {t("products.closingCta")}
              </Button>
            </Reveal>
          </Section>
        </>
      )}
    </>
  );
}

function ProductSheet({
  product: p,
  index,
  total,
  lang,
  dict,
}: {
  product: Product;
  index: number;
  total: number;
  lang: Locale;
  dict: Dictionary;
}) {
  const { t } = dict;
  const href = localizePath(lang, `/products/${p.slug}`);
  const shown = p.features.slice(0, SHEET_FEATURES);
  const more = p.features.length - shown.length;

  return (
    // vertical reveal only — the sheet is full-width on mobile
    <Reveal
      as="article"
      className="overflow-hidden rounded-[2rem] border border-mist/70 bg-surface shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)]"
    >
      {/* header strip — the "spec sheet" line */}
      <div className="flex items-center gap-4 border-b border-mist/70 px-6 py-4 md:px-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
          {t("products.sheetNo", { n: pad2(index + 1) })}
          <span className="text-ink/30"> / {pad2(total)}</span>
        </span>
        {p.status && <Badge>{p.status}</Badge>}
        {p.features.length > 0 && (
          <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.2em] text-slatey sm:inline">
            {t("products.featureCount", { count: pad2(p.features.length) })}
          </span>
        )}
      </div>

      <div className="grid gap-10 px-6 py-10 md:grid-cols-12 md:gap-14 md:px-10 md:py-14">
        <div className={shown.length ? "md:col-span-7" : "md:col-span-12"}>
          <h2 className="text-balance font-display text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
            <Link href={href} className="transition-colors duration-300 hover:text-accent">
              {p.name}
            </Link>
          </h2>
          {p.tagline && (
            <p className="mt-5 max-w-xl text-balance text-xl leading-snug text-ink/75 md:text-2xl">
              {p.tagline}
            </p>
          )}
          {p.summary && (
            <p className="mt-5 max-w-xl text-pretty leading-relaxed text-ink/60">{p.summary}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {p.cta && (
              <ProductCta cta={p.cta} lang={lang} newTabLabel={t("footer.opensInNewTab")} />
            )}
            <Button href={href} variant={p.cta ? "ghost" : "outline"} arrow>
              {t("products.details")}
            </Button>
          </div>
        </div>

        {shown.length > 0 && (
          <div className="md:col-span-5">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
              {t("products.features")}
            </h3>
            <ol className="mt-4 divide-y divide-mist/70 border-y border-mist/70">
              {shown.map((f, j) => (
                <li key={`${j}-${f}`} className="flex gap-4 py-3.5 text-[15px] leading-relaxed text-ink/75">
                  <span aria-hidden className="pt-1 font-mono text-[10px] tracking-widest text-slatey">
                    {pad2(j + 1)}
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ol>
            {more > 0 && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-slatey">
                <Link href={href} className="transition-colors hover:text-ink">
                  {t("products.moreFeatures", { count: more })}
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      {/* the plate — screenshot at native aspect, never upscaled or cropped */}
      {p.image && (
        <Link
          href={href}
          aria-label={t("products.detailLabel", { name: p.name })}
          className="group block border-t border-mist/70 bg-paper/70 px-5 py-8 md:px-12 md:py-14"
        >
          <Shot
            src={p.image}
            alt={t("products.imageAlt", { name: p.name })}
            eager={index === 0}
            className="max-h-[560px] rounded-xl border border-mist/70 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1"
          />
        </Link>
      )}
    </Reveal>
  );
}
