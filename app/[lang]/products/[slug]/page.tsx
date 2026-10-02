import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import { BackLink, Badge, ProductCta, Shot } from "@/components/catalog/parts";
import { pad2, paragraphs } from "@/components/catalog/format";
import { getProductBySlug, getProducts } from "@/lib/cms";
import { isLocale, toLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";

type Params = { params: Promise<{ lang: string; slug: string }> };

// Every published product, prerendered in both languages (the [lang] layout
// supplies the locales). dynamicParams stays at its default (true) ON PURPOSE:
// a product published after the deploy must render on demand — `false` would
// 404 it until the next build. The panel's revalidatePath refreshes these.
export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = toLocale(rawLang);
  const p = await getProductBySlug(slug);
  if (!p) return { title: getDictionary(lang).t("product.notFound") };
  const description = p.tagline || p.summary || undefined;
  return {
    title: p.name,
    description,
    ...localeMetadata(lang, `/products/${p.slug}`, {
      title: p.tagline ? `${p.name} — ${p.tagline}` : p.name,
      description,
      ...(p.image ? { images: [{ url: p.image }] } : {}),
    }),
  };
}

/**
 * Product detail — the sheet, opened out: name and story on the left, the
 * full feature list as a numbered rail on the right, then the main screen on
 * a paper plate and the gallery in the same visual language as a project's
 * Screens grid (browser-width shots in a two-up grid, phone shots in frames).
 * Every section renders only when it has content.
 */
export default async function ProductPage({ params }: Params) {
  const { lang: rawLang, slug } = await params;
  if (!isLocale(rawLang)) notFound();
  const lang: Locale = rawLang;
  const { t } = getDictionary(lang);
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const others = (await getProducts()).filter((x) => x.slug !== p.slug);
  const desktopShots = p.gallery.filter((g) => g.kind === "desktop");
  const mobileShots = p.gallery.filter((g) => g.kind === "mobile");
  const story = paragraphs(p.description);
  const askLabel = t("product.ask", { name: p.name });

  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <Reveal>
          <BackLink href={localizePath(lang, "/products")}>{t("product.back")}</BackLink>
        </Reveal>

        <div className="mt-8 grid gap-12 md:grid-cols-12 md:gap-14">
          <Reveal className={p.features.length ? "md:col-span-7" : "md:col-span-9"}>
            <p className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-slatey">
              {t("product.eyebrow")}
              {p.status && <Badge>{p.status}</Badge>}
            </p>
            <h1 className="mt-4 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              {p.name}
            </h1>
            {p.tagline && (
              <p className="mt-6 max-w-xl text-balance text-xl leading-snug text-ink/75 md:text-2xl">
                {p.tagline}
              </p>
            )}
            {(story.length ? story : p.summary ? [p.summary] : []).map((para, i) => (
              <p
                key={i}
                className={`max-w-xl text-pretty text-lg leading-relaxed text-ink/65 ${i === 0 ? "mt-6" : "mt-4"}`}
              >
                {para}
              </p>
            ))}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {p.cta && <ProductCta cta={p.cta} lang={lang} newTabLabel={t("footer.opensInNewTab")} />}
              <Button href={localizePath(lang, "/location")} variant={p.cta ? "outline" : "solid"} arrow>
                {askLabel}
              </Button>
              <KeySwitch size={46} tint="mint" className="hidden sm:block" />
            </div>
          </Reveal>

          {/* feature rail */}
          {p.features.length > 0 && (
            <Reveal delay={0.1} className="md:col-span-5 md:col-start-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
                {t("product.features")}
              </h2>
              <ol className="mt-4 divide-y divide-mist/70 border-y border-mist/70">
                {p.features.map((f, j) => (
                  <li key={`${j}-${f}`} className="flex gap-4 py-3.5 text-[15px] leading-relaxed text-ink/75">
                    <span aria-hidden className="pt-1 font-mono text-[10px] tracking-widest text-slatey">
                      {pad2(j + 1)}
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ol>
            </Reveal>
          )}
        </div>
      </Section>

      {/* Main screen — on its plate, at native aspect */}
      {p.image && (
        <Section className="pt-20 md:pt-28">
          <Reveal>
            <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {t("product.preview")}
            </h2>
            <div className="rounded-[2rem] border border-mist/70 bg-surface px-4 py-8 md:px-12 md:py-14">
              <Shot
                src={p.image}
                alt={t("products.imageAlt", { name: p.name })}
                eager
                className="max-h-[720px] rounded-xl border border-mist/70 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)]"
              />
            </div>
          </Reveal>
        </Section>
      )}

      {/* Screens */}
      {(desktopShots.length > 0 || mobileShots.length > 0) && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {t("product.screens")}
            </h2>
          </Reveal>
          {desktopShots.length > 0 && (
            <div className={`mt-8 grid gap-6 ${desktopShots.length > 1 ? "md:grid-cols-2" : ""}`}>
              {desktopShots.map((s, i) => (
                <Reveal key={`${i}-${s.src}`} delay={(i % 2) * 0.08}>
                  <figure className="overflow-hidden rounded-2xl border border-mist/70 bg-surface">
                    <div className="flex items-center justify-center bg-paper/60 p-3 md:p-4">
                      <Shot
                        src={s.src}
                        alt={s.caption || t("product.screenAlt", { name: p.name, n: i + 1 })}
                        className="rounded-lg"
                      />
                    </div>
                    {s.caption && (
                      <figcaption className="border-t border-mist/70 px-4 py-3 text-sm text-ink/55">
                        {s.caption}
                      </figcaption>
                    )}
                  </figure>
                </Reveal>
              ))}
            </div>
          )}
          {mobileShots.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-6">
              {mobileShots.map((s, i) => (
                <Reveal key={`${i}-${s.src}`} delay={(i % 4) * 0.06}>
                  <figure className="w-[160px] sm:w-[200px]">
                    {/* phone frame — the shot is contained, never cropped */}
                    <div className="flex aspect-[9/19.5] items-center justify-center overflow-hidden rounded-[1.75rem] border border-mist/70 bg-surface p-1.5">
                      <Shot
                        src={s.src}
                        alt={s.caption || t("product.mobileScreenAlt", { name: p.name, n: i + 1 })}
                        className="max-h-full rounded-[1.4rem]"
                      />
                    </div>
                    {s.caption && (
                      <figcaption className="mt-3 text-sm leading-snug text-ink/55">{s.caption}</figcaption>
                    )}
                  </figure>
                </Reveal>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* More products */}
      {others.length > 0 && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <h2 className="border-b border-mist/70 pb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
              {t("product.more")}
            </h2>
          </Reveal>
          <ul>
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  href={localizePath(lang, `/products/${o.slug}`)}
                  className="group flex items-baseline justify-between gap-6 border-b border-mist/70 py-6"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-2xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-accent md:text-3xl">
                      {o.name}
                    </span>
                    {o.tagline && <span className="mt-1 block text-ink/55">{o.tagline}</span>}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-xl text-ink/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
