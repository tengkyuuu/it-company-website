import type { Metadata } from "next";
import Link from "next/link";
import Section, { SectionHeader } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import EmptyState from "@/components/catalog/EmptyState";
import { Shot } from "@/components/catalog/parts";
import { dateParts, formatDate, isoDay, pad2 } from "@/components/catalog/format";
import { getPostIndex, type PostIndexEntry } from "@/lib/cms";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  const { t } = getDictionary(lang);
  const posts = await getPostIndex();
  return {
    title: t("blog.metaTitle"),
    description: t("blog.metaDescription"),
    ...(posts.length ? {} : { robots: { index: false, follow: true } }),
    ...localeMetadata(lang, "/blog"),
  };
}

/**
 * Blog index — editorial: the latest post is FEATURED large (cover on a
 * paper plate, or — with no cover — its date set as a giant outlined
 * numeral), then the archive as a dated index: date column · title + excerpt
 * · reading time and tags. A magazine contents page, not another card grid.
 */
export default async function BlogPage({ params }: LangParams) {
  const lang = await pageLocale(params);
  const dict = getDictionary(lang);
  const { t } = dict;
  const posts = await getPostIndex();
  const [featured, ...rest] = posts;

  return (
    <>
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <SectionHeader
          as="h1"
          eyebrow={t("blog.eyebrow")}
          title={
            <>
              {t("blog.titleLead")} <span className="text-accent">{t("blog.titleAccent")}</span>
            </>
          }
          intro={t("blog.intro")}
        />
        {posts.length > 0 && (
          <Reveal delay={0.1} className="mt-8 flex items-center gap-5">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/40">
              {posts.length === 1
                ? t("blog.countOne", { count: pad2(posts.length) })
                : t("blog.countMany", { count: pad2(posts.length) })}
            </span>
            <span className="h-px flex-1 bg-mist/70" aria-hidden />
            <KeySwitch size={44} tint="sky" />
          </Reveal>
        )}
      </Section>

      {!featured ? (
        <Section className="pt-14 md:pt-20">
          <EmptyState
            title={t("blog.emptyTitle")}
            body={t("blog.emptyBody")}
            cta={t("blog.emptyCta")}
            href={localizePath(lang, "/location")}
            tint="sky"
          />
        </Section>
      ) : (
        <>
          <Section className="pt-14 md:pt-20">
            <Featured post={featured} lang={lang} dict={dict} />
          </Section>

          {rest.length > 0 && (
            <Section className="pt-24 md:pt-32">
              <Reveal>
                <h2 className="border-b border-ink/15 pb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
                  {t("blog.archive")}
                </h2>
              </Reveal>
              <ol>
                {rest.map((p) => (
                  <ArchiveRow key={p.slug} post={p} lang={lang} dict={dict} />
                ))}
              </ol>
            </Section>
          )}
        </>
      )}
    </>
  );
}

function Meta({ post, lang, dict: { t } }: { post: PostIndexEntry; lang: Locale; dict: Dictionary }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-slatey">
      <time dateTime={isoDay(post.publishedAt)}>{formatDate(post.publishedAt, lang)}</time>
      <span aria-hidden>·</span>
      <span>{t("blog.readingTime", { minutes: post.readingMinutes })}</span>
      {post.author && (
        <>
          <span aria-hidden>·</span>
          <span className="normal-case tracking-normal">{t("blog.by", { author: post.author })}</span>
        </>
      )}
    </p>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border border-mist/70 px-2.5 py-0.5 text-xs text-ink/55">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Featured({ post: p, lang, dict }: { post: PostIndexEntry; lang: Locale; dict: Dictionary }) {
  const { t } = dict;
  const href = localizePath(lang, `/blog/${p.slug}`);
  const { day, monthYear } = dateParts(p.publishedAt, lang);

  return (
    <Reveal as="article" className="group grid items-center gap-10 md:grid-cols-12 md:gap-14">
      {/* the plate: cover at native aspect, or the date as type */}
      <Link
        href={href}
        aria-label={t("blog.postLabel", { title: p.title })}
        className="block md:col-span-7"
      >
        {p.coverImage ? (
          <div className="rounded-[2rem] border border-mist/70 bg-surface p-4 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1.5 md:p-6">
            <Shot
              src={p.coverImage}
              alt={t("blog.coverAlt", { title: p.title })}
              eager
              className="max-h-[520px] rounded-2xl"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-[2rem] border border-mist/70 bg-surface p-7 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1.5 md:p-10"
          >
            <span className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              {monthYear}
              <span className="h-px flex-1 bg-mist/70" />
            </span>
            <span className="select-none self-end font-display text-[9rem] font-bold leading-[0.8] tracking-tight text-stroke sm:text-[12rem] md:text-[14rem]">
              {day}
            </span>
          </div>
        )}
      </Link>

      <div className="md:col-span-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">{t("blog.latest")}</p>
        <h2 className="mt-3 text-balance font-display text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
          <Link href={href} className="transition-colors duration-300 hover:text-accent">
            {p.title}
          </Link>
        </h2>
        {p.excerpt && (
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink/65">{p.excerpt}</p>
        )}
        <div className="mt-6 space-y-4">
          <Meta post={p} lang={lang} dict={dict} />
          <Tags tags={p.tags} />
        </div>
        <Link
          href={href}
          className="group/read mt-8 inline-flex items-center gap-2 text-sm font-medium text-ink"
        >
          <span className="relative">
            {t("blog.readPost")}
            <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ink transition-transform duration-300 group-hover/read:scale-x-100" />
          </span>
          <span aria-hidden className="transition-transform duration-300 group-hover/read:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </Reveal>
  );
}

function ArchiveRow({ post: p, lang, dict }: { post: PostIndexEntry; lang: Locale; dict: Dictionary }) {
  const { t } = dict;
  const href = localizePath(lang, `/blog/${p.slug}`);
  return (
    <li>
      <Reveal as="article" className="group grid gap-x-10 gap-y-3 border-b border-mist/70 py-9 md:grid-cols-12">
        <time
          dateTime={isoDay(p.publishedAt)}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-slatey md:col-span-2 md:pt-2"
        >
          {formatDate(p.publishedAt, lang)}
        </time>
        <div className="md:col-span-7">
          <h3 className="text-balance font-display text-2xl font-semibold tracking-tight md:text-3xl">
            <Link href={href} className="transition-colors duration-300 hover:text-accent">
              {p.title}
            </Link>
          </h3>
          {p.excerpt && <p className="mt-3 max-w-xl text-pretty leading-relaxed text-ink/60">{p.excerpt}</p>}
        </div>
        <div className="space-y-3 md:col-span-3 md:pt-2.5 md:text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slatey">
            {t("blog.readingTime", { minutes: p.readingMinutes })}
          </p>
          <div className="md:flex md:justify-end">
            <Tags tags={p.tags} />
          </div>
        </div>
      </Reveal>
    </li>
  );
}
