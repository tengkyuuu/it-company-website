import type { Metadata } from "next";
import Link from "next/link";
import Section, { SectionHeader } from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import EmptyState from "@/components/catalog/EmptyState";
import { formatDay, jobLabels, pad2 } from "@/components/catalog/format";
import { getJobs } from "@/lib/cms";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

export const dynamicParams = false;
// Roles close by the calendar (closes_at, Asia/Manila) — not by an edit that
// would trigger revalidatePath — so re-render at least hourly.
export const revalidate = 3600;

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  const { t } = getDictionary(lang);
  const jobs = await getJobs();
  return {
    title: t("careers.metaTitle"),
    description: t("careers.metaDescription"),
    ...(jobs.length ? {} : { robots: { index: false, follow: true } }),
    ...localeMetadata(lang, "/careers"),
  };
}

/**
 * Careers — a scannable roles TABLE: column heads, one hairline row per role
 * (title · team · location · type · workplace) and a travelling arrow. Built
 * for the eye to run down a column, unlike About's roster (hover-orb list) or
 * the Projects index (editorial rows). On mobile each row folds into the title
 * plus one line of facts.
 */
export default async function CareersPage({ params }: LangParams) {
  const lang = await pageLocale(params);
  const { t } = getDictionary(lang);
  const jobs = await getJobs();
  const labels = jobLabels(t);
  const n = jobs.length;

  return (
    <>
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <SectionHeader
          as="h1"
          eyebrow={t("careers.eyebrow")}
          title={
            <>
              {t("careers.titleLead")}{" "}
              <span className="text-accent">{t("careers.titleAccent")}</span>
            </>
          }
          intro={t("careers.intro")}
        />
        {n > 0 && (
          <Reveal delay={0.1} className="mt-8 flex items-center gap-5">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/40">
              {n === 1
                ? t("careers.countOne", { count: pad2(n) })
                : t("careers.countMany", { count: pad2(n) })}
            </span>
            <span className="h-px flex-1 bg-mist/70" aria-hidden />
            <KeySwitch size={44} tint="gold" />
          </Reveal>
        )}
      </Section>

      {n === 0 ? (
        <Section className="pt-14 md:pt-20">
          <EmptyState
            title={t("careers.emptyTitle")}
            body={t("careers.emptyBody")}
            cta={t("careers.emptyCta")}
            href={localizePath(lang, "/location")}
            tint="gold"
          />
        </Section>
      ) : (
        <>
          <Section className="pt-14 md:pt-20">
            <Reveal>
              {/* column heads (desktop) — the rows below line up under them */}
              <div
                aria-hidden
                className="hidden grid-cols-12 gap-6 border-b border-ink/15 pb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-slatey md:grid"
              >
                <span className="col-span-4">{t("careers.colRole")}</span>
                <span className="col-span-2">{t("careers.colTeam")}</span>
                <span className="col-span-2">{t("careers.colLocation")}</span>
                <span className="col-span-2">{t("careers.colType")}</span>
                <span className="col-span-2">{t("careers.colWorkplace")}</span>
              </div>
              <ul className="border-t border-mist/70 md:border-t-0">
                {jobs.map((j) => {
                  const facts = [
                    j.department,
                    j.location,
                    labels.type[j.employmentType],
                    labels.workplace[j.workplace],
                  ].filter(Boolean);
                  return (
                    <li key={j.slug}>
                      {/* no aria-label: the row's own text (title + facts) is
                          the most useful accessible name */}
                      <Link
                        href={localizePath(lang, `/careers/${j.slug}`)}
                        className="group relative grid grid-cols-12 items-baseline gap-x-6 gap-y-2 border-b border-mist/70 py-7 pr-10 md:py-8"
                      >
                        <span className="col-span-12 md:col-span-4">
                          <span className="block text-balance font-display text-2xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-accent md:text-[1.7rem]">
                            {j.title}
                          </span>
                          {j.closesAt && (
                            <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-slatey">
                              {t("careers.closesOn", { date: formatDay(j.closesAt, lang) })}
                            </span>
                          )}
                        </span>
                        {/* mobile: one line of facts */}
                        <span className="col-span-12 text-sm text-ink/60 md:hidden">
                          {facts.join(" · ")}
                        </span>
                        {/* desktop: one fact per column */}
                        <Cell>{j.department}</Cell>
                        <Cell>{j.location}</Cell>
                        <Cell>{labels.type[j.employmentType]}</Cell>
                        <Cell>{labels.workplace[j.workplace]}</Cell>
                        <span
                          aria-hidden
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-xl text-ink/35 transition-[transform,color] duration-300 group-hover:translate-x-1 group-hover:text-ink"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          </Section>

          {/* speculative applications */}
          <Section className="pt-24 md:pt-32">
            <Reveal className="grid items-end gap-8 rounded-[2rem] border border-mist/70 bg-surface px-7 py-12 md:grid-cols-12 md:px-12 md:py-14">
              <div className="md:col-span-8">
                <h2 className="text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  {t("careers.speculativeTitle")}
                </h2>
                <p className="mt-3 max-w-lg text-pretty leading-relaxed text-ink/60">
                  {t("careers.speculativeBody")}
                </p>
              </div>
              <div className="md:col-span-4 md:justify-self-end">
                <Button href={localizePath(lang, "/location")} arrow>
                  {t("careers.speculativeCta")}
                </Button>
              </div>
            </Reveal>
          </Section>
        </>
      )}
    </>
  );
}

function Cell({ children }: { children?: React.ReactNode }) {
  return (
    <span className="hidden text-sm text-ink/65 md:col-span-2 md:block">
      {children || <span className="text-ink/25">—</span>}
    </span>
  );
}
