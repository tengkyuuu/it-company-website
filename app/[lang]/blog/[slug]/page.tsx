import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import { BackLink, Shot } from "@/components/catalog/parts";
import { formatDate, isoDay } from "@/components/catalog/format";
import { getPostBySlug, getPosts } from "@/lib/cms";
import { isLocale, toLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";
import { Markdown, readingMinutes } from "@/lib/markdown";

type Params = { params: Promise<{ lang: string; slug: string }> };

/** Posts suggested under the article. */
const MORE = 2;

// Every published post, prerendered in both languages. dynamicParams stays at
// its default (true) ON PURPOSE: a post published after the deploy must render
// on demand — `false` would 404 it until the next build.
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = toLocale(rawLang);
  const post = await getPostBySlug(slug);
  if (!post) return { title: getDictionary(lang).t("post.notFound") };
  return {
    title: post.title,
    description: post.excerpt || undefined,
    ...localeMetadata(lang, `/blog/${post.slug}`, {
      type: "article",
      title: post.title,
      description: post.excerpt || undefined,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(post.author ? { authors: [post.author] } : {}),
      ...(post.tags.length ? { tags: post.tags } : {}),
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    }),
  };
}

/**
 * The article: a narrow, centred reading column. Header (tags, title,
 * standfirst, byline rule), the cover on a plate at native aspect, then the
 * body through lib/markdown.tsx into the `.prose-rt` typography scope — no raw
 * HTML, only https/mailto/internal links. Two more posts and a CTA close it.
 */
export default async function PostPage({ params }: Params) {
  const { lang: rawLang, slug } = await params;
  if (!isLocale(rawLang)) notFound();
  const lang: Locale = rawLang;
  const { t } = getDictionary(lang);
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const minutes = readingMinutes(post.body);
  const more = (await getPosts()).filter((p) => p.slug !== post.slug).slice(0, MORE);
  // "Updated" only when it means something — not for the save right after publishing
  const updated =
    isoDay(post.updatedAt) > isoDay(post.publishedAt) ? formatDate(post.updatedAt, lang) : "";

  return (
    <>
      <article>
        <Section className="relative overflow-hidden pt-36 md:pt-44">
          <div
            className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
            aria-hidden
          />
          <Reveal className="mx-auto max-w-3xl">
            <BackLink href={localizePath(lang, "/blog")}>{t("post.back")}</BackLink>
            {post.tags.length > 0 && (
              <ul aria-label={t("post.tags")} className="mt-10 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-mist/70 px-2.5 py-0.5 font-mono text-[11px] tracking-wide text-ink/60"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <h1
              className={`text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl ${
                post.tags.length ? "mt-5" : "mt-10"
              }`}
            >
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-6 text-pretty text-xl leading-relaxed text-ink/65 md:text-2xl md:leading-relaxed">
                {post.excerpt}
              </p>
            )}
            <p className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mist/70 pt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-slatey">
              {post.author && (
                <>
                  <span className="normal-case tracking-normal text-ink/70">
                    {t("blog.by", { author: post.author })}
                  </span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>
                <span className="sr-only">{t("post.published")} </span>
                <time dateTime={isoDay(post.publishedAt)}>{formatDate(post.publishedAt, lang)}</time>
              </span>
              <span aria-hidden>·</span>
              <span>{t("blog.readingTime", { minutes })}</span>
            </p>
          </Reveal>
        </Section>

        {post.coverImage && (
          <Section className="pt-12 md:pt-16">
            <Reveal className="mx-auto max-w-5xl rounded-[2rem] border border-mist/70 bg-surface p-4 md:p-6">
              <Shot
                src={post.coverImage}
                alt={t("blog.coverAlt", { title: post.title })}
                eager
                className="max-h-[640px] rounded-2xl"
              />
            </Reveal>
          </Section>
        )}

        <Section className="pt-14 md:pt-20">
          <Markdown source={post.body} lang={lang} className="mx-auto max-w-[68ch]" />
          {updated && (
            <p className="mx-auto mt-14 max-w-[68ch] border-t border-mist/70 pt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-slatey">
              {t("post.updated", { date: updated })}
            </p>
          )}
        </Section>
      </article>

      {more.length > 0 && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <h2 className="border-b border-ink/15 pb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
              {t("post.more")}
            </h2>
          </Reveal>
          <div className={`grid ${more.length > 1 ? "md:grid-cols-2" : ""}`}>
            {more.map((p, i) => (
              <Reveal key={p.slug} delay={i * 0.06}>
                <Link
                  href={localizePath(lang, `/blog/${p.slug}`)}
                  className={`group block border-b border-mist/70 py-8 ${
                    i === 1 ? "md:border-l md:pl-10" : "md:pr-10"
                  }`}
                >
                  <time
                    dateTime={isoDay(p.publishedAt)}
                    className="font-mono text-[11px] uppercase tracking-[0.16em] text-slatey"
                  >
                    {formatDate(p.publishedAt, lang)}
                  </time>
                  <p className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-accent">
                    {p.title}
                  </p>
                  {p.excerpt && <p className="mt-2 line-clamp-2 text-ink/55">{p.excerpt}</p>}
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      <Section className="pt-24 md:pt-32">
        <Reveal className="flex flex-col items-start justify-between gap-8 border-t border-mist/70 pt-14 md:flex-row md:items-center">
          <h2 className="max-w-xl text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t("post.closingTitle")}
          </h2>
          <div className="flex shrink-0 items-center gap-5">
            <KeySwitch size={50} tint="sky" className="hidden sm:block" />
            <Button href={localizePath(lang, "/location")} arrow>
              {t("post.closingCta")}
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
