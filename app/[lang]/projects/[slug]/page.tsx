import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import LivePreview from "@/components/projects/LivePreview";
import { getProjectBySlug, getProjectNeighbours, getProjects } from "@/lib/cms";
import { isLocale, toLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";

type Params = { params: Promise<{ lang: string; slug: string }> };

// Called once per locale from the [lang] layout's params, so every project is
// prerendered in both languages. dynamicParams stays at its default (true) on
// purpose: a project published in the CMS after the deploy must still render
// on demand — `dynamicParams = false` here would 404 it until the next build.
export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = toLocale(rawLang);
  const p = await getProjectBySlug(slug);
  if (!p) return { title: getDictionary(lang).t("meta.projectNotFound") };
  return {
    title: p.name,
    description: p.summary,
    ...localeMetadata(lang, `/projects/${p.slug}`, {
      title: `${p.name} — ${p.category}`,
      description: p.summary,
      type: "article",
      images: [{ url: p.img }],
    }),
  };
}

export default async function ProjectPage({ params }: Params) {
  const { lang: rawLang, slug } = await params;
  if (!isLocale(rawLang)) notFound();
  const lang: Locale = rawLang;
  const { t } = getDictionary(lang);
  const p = await getProjectBySlug(slug);
  if (!p) notFound();

  const { prev, next } = await getProjectNeighbours(p.slug);
  // the main shot is already the big preview above, so "Screens" is everything
  // else: the secondary shot plus the gallery, desktop and mobile apart
  const desktopShots = [
    ...[p.img, p.img2].filter(Boolean).map((src) => ({ src: src as string, caption: "" })),
    ...(p.gallery ?? []).filter((g) => g.kind === "desktop").map((g) => ({ src: g.src, caption: g.caption ?? "" })),
  ];
  const mobileShots = (p.gallery ?? []).filter((g) => g.kind === "mobile");
  const story = [
    { label: t("project.challenge"), text: p.challenge },
    { label: t("project.approach"), text: p.approach },
    { label: t("project.outcome"), text: p.outcome },
  ].filter((b): b is { label: string; text: string } => Boolean(b.text));
  const results = p.results ?? [];

  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <Reveal>
          <Link
            href={localizePath(lang, "/projects")}
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey transition-colors hover:text-ink"
          >
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            >
              ←
            </span>
            {t("project.back")}
          </Link>
        </Reveal>

        <div className="mt-8 grid gap-10 md:grid-cols-12 md:gap-14">
          <Reveal className="md:col-span-7">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-slatey">
              <span className="flex items-center gap-1" aria-hidden>
                {p.dots.map((c, j) => (
                  <span
                    key={j}
                    style={{ background: c }}
                    className="h-2 w-2 rounded-full ring-1 ring-ink/10"
                  />
                ))}
              </span>
              {p.category} · {p.year}
            </p>
            <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight md:text-6xl">
              {p.name}
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink/65">
              {p.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {p.liveUrl ? (
                <Button href={p.liveUrl} arrow>
                  {t("project.openLive")}
                </Button>
              ) : (
                <Button href={localizePath(lang, "/location")} arrow>
                  {t("project.ask")}
                </Button>
              )}
              <KeySwitch size={46} tint="sky" className="hidden sm:block" />
            </div>
          </Reveal>

          {/* detail rail */}
          <Reveal delay={0.1} className="md:col-span-5 md:col-start-9">
            <dl className="divide-y divide-mist/70 border-y border-mist/70">
              {p.client && <Row label={t("project.client")} value={p.client} />}
              {p.industry && <Row label={t("project.industry")} value={p.industry} />}
              <Row label={t("project.category")} value={p.category} />
              <Row label={t("project.year")} value={p.year.replace("’", "20")} />
              {p.timeline && <Row label={t("project.timeline")} value={p.timeline} />}
              <Row
                label={t("project.site")}
                value={
                  p.liveUrl ? (
                    <a
                      href={p.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-accent"
                    >
                      {p.url} <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className="text-ink/45">{p.url}</span>
                  )
                }
              />
              {p.services?.length ? <Row label={t("project.services")} value={p.services.join(", ")} /> : null}
              <Row label={t("project.scope")} value={p.tags.join(", ")} />
              {p.team?.length ? <Row label={t("project.team")} value={p.team.join(", ")} /> : null}
            </dl>
            <ul className="mt-7 space-y-2.5">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm leading-relaxed text-ink/65">
                  <span aria-hidden className="mt-2 h-1 w-3 shrink-0 bg-accent" />
                  {h}
                </li>
              ))}
            </ul>
            {p.stack?.length ? (
              <ul className="mt-7 flex flex-wrap gap-2" aria-label={t("project.stack")}>
                {p.stack.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-mist/70 px-3 py-1 font-mono text-[11px] tracking-wide text-ink/60"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
          </Reveal>
        </div>
      </Section>

      {/* Live preview */}
      <Section className="pt-20 md:pt-28">
        <Reveal>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {p.liveUrl ? t("project.livePreview") : t("project.preview")}
            </h2>
            <p className="max-w-xs text-right font-mono text-[11px] uppercase leading-relaxed tracking-widest text-ink/40">
              {p.liveUrl
                ? t("project.liveCaption")
                : t("project.shotCaption")}
            </p>
          </div>
          <LivePreview project={p} priority />
        </Reveal>
      </Section>

      {/* The story — numbered beats, label left / prose right */}
      {story.length > 0 && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {t("project.story")}
            </h2>
          </Reveal>
          <div className="mt-8 divide-y divide-mist/70 border-y border-mist/70">
            {story.map((b, i) => (
              <Reveal key={b.label} className="grid gap-4 py-10 md:grid-cols-12 md:gap-14">
                <div className="md:col-span-4">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-display text-xl font-semibold tracking-tight md:text-2xl">
                    {b.label}
                  </h3>
                </div>
                <div className="space-y-4 md:col-span-8">
                  {paragraphs(b.text).map((para, j) => (
                    <p key={j} className="text-pretty text-lg leading-relaxed text-ink/70">
                      {para}
                    </p>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Results — only numbers the client recognises; never estimates */}
      {results.length > 0 && (
        <Section className="pt-20 md:pt-28">
          <Reveal>
            <h2 className="sr-only">{t("project.results")}</h2>
            <dl
              className={`grid gap-x-10 gap-y-10 ${
                results.length === 1
                  ? ""
                  : results.length === 3
                    ? "sm:grid-cols-3"
                    : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {results.map((r) => (
                <div key={`${r.value}-${r.label}`} className="border-t border-mist/70 pt-5">
                  <dt className="sr-only">{r.label}</dt>
                  <dd className="font-display text-5xl font-semibold tracking-tight md:text-6xl">
                    {r.value}
                  </dd>
                  <dd className="mt-2 text-sm leading-relaxed text-ink/55">{r.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </Section>
      )}

      {/* Testimonial — the client's own words */}
      {p.testimonial && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <figure className="max-w-4xl border-l border-mist/70 pl-6 md:pl-10">
              <blockquote className="text-balance font-display text-2xl font-semibold leading-snug tracking-tight md:text-4xl">
                <span aria-hidden className="text-slatey">“</span>
                {p.testimonial.quote}
                <span aria-hidden className="text-slatey">”</span>
              </blockquote>
              <figcaption className="mt-6 font-mono text-[11px] uppercase tracking-widest text-slatey">
                {p.testimonial.author}
                {p.testimonial.role && <span className="text-ink/40"> · {p.testimonial.role}</span>}
              </figcaption>
            </figure>
          </Reveal>
        </Section>
      )}

      {/* Screens */}
      {(desktopShots.length > 1 || mobileShots.length > 0) && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {t("project.screens")}
            </h2>
          </Reveal>
          {desktopShots.length > 1 && (
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {desktopShots.map((s, i) => (
                <Reveal key={`${i}-${s.src}`} delay={(i % 2) * 0.08}>
                  {/* contained at native aspect — sources are only ~1536px wide,
                      so never cover-crop or upscale them */}
                  <figure className="overflow-hidden rounded-2xl border border-mist/70 bg-surface">
                    <div className="relative aspect-[1536/743]">
                      <Image
                        src={s.src}
                        alt={s.caption || t("project.screenAlt", { name: p.name, n: i + 1 })}
                        fill
                        quality={90}
                        sizes="(max-width: 768px) 100vw, 48vw"
                        className="object-contain object-top"
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
                    <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1.75rem] border border-mist/70 bg-surface">
                      <Image
                        src={s.src}
                        alt={s.caption || t("project.mobileScreenAlt", { name: p.name, n: i + 1 })}
                        fill
                        quality={90}
                        sizes="200px"
                        className="object-contain"
                      />
                    </div>
                    {s.caption && (
                      <figcaption className="mt-3 text-sm leading-snug text-ink/55">
                        {s.caption}
                      </figcaption>
                    )}
                  </figure>
                </Reveal>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Prev / next */}
      <Section className="pt-24 md:pt-32">
        <div className="grid gap-4 border-t border-mist/70 pt-10 sm:grid-cols-2">
          {prev && <Neighbour project={prev} href={localizePath(lang, `/projects/${prev.slug}`)} label={t("project.prev")} dir="prev" />}
          {next && <Neighbour project={next} href={localizePath(lang, `/projects/${next.slug}`)} label={t("project.next")} dir="next" />}
        </div>
      </Section>
    </>
  );
}

/** Paragraphs are separated by a blank line in the admin textarea. */
function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-slatey">
        {label}
      </dt>
      <dd className="text-right text-sm text-ink/75">{value}</dd>
    </div>
  );
}

function Neighbour({
  project,
  href,
  label,
  dir,
}: {
  project: { slug: string; name: string; category: string };
  /** already localized */
  href: string;
  label: string;
  dir: "prev" | "next";
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border border-mist/70 bg-surface p-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-mist ${
        dir === "next" ? "sm:text-right" : ""
      }`}
    >
      <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
        {label}
      </span>
      <p className="mt-2 font-display text-xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-accent">
        {project.name}
      </p>
      <p className="mt-1 text-sm text-ink/50">{project.category}</p>
    </Link>
  );
}
