import type { Metadata } from "next";
import Section from "@/components/Section";
import TestsPanel from "@/components/status/TestsPanel";
import LighthousePanel from "@/components/status/LighthousePanel";
import { HealthMark } from "@/components/status/parts";
import { getStatusSnapshot } from "@/lib/status";
import { overallHealth } from "@/lib/status-schema";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

// ISR: re-rendered at least hourly (so "stale" is judged against a recent
// clock), and on demand by /api/status/ingest the moment CI posts a report.
export const revalidate = 3600;

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  const { t } = getDictionary(lang);
  return {
    title: t("status.metaTitle"),
    description: t("status.metaDescription"),
    ...localeMetadata(lang, "/status"),
  };
}

/**
 * /status — a quiet instrument panel: what CI last reported about the site's
 * test suite and Lighthouse scores, exactly as reported. Structurally its own
 * thing: a bezel-style health mark beside the title, then two enclosed
 * "faceplates" of tabular readings and gauges separated by hairlines. No
 * client JS and no motion beyond the site-wide scroll reveal.
 *
 * Nothing is invented: no fallback data, no averages, no percentages that
 * would need rounding. With nothing reported (or no database) each panel
 * says so.
 */
export default async function StatusPage({ params }: LangParams) {
  const lang = await pageLocale(params);
  const { t } = getDictionary(lang);
  const snapshot = await getStatusSnapshot();
  const now = Date.now();
  const health = overallHealth(snapshot.tests, now);

  const verdict = {
    passing: t("status.healthPassing"),
    failing: t("status.healthFailing"),
    stale: t("status.healthStale"),
    unknown: t("status.healthUnknown"),
  }[health];

  return (
    <>
      <Section className="pt-36 md:pt-44">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey">
              <span className="h-px w-6 bg-slatey" aria-hidden />
              {t("status.eyebrow")}
            </p>
            <h1 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              {t("status.title")}
            </h1>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-ink/60">{t("status.intro")}</p>
          </div>
          <HealthMark health={health} label={t("status.healthLabel")} verdict={verdict} />
        </div>
      </Section>

      {snapshot.source === "unavailable" && (
        <Section className="pt-12">
          <p
            role="note"
            className="rounded-2xl border border-dashed border-slatey px-5 py-4 text-sm leading-relaxed text-ink/75"
          >
            {t("status.unavailable")}
          </p>
        </Section>
      )}

      <Section className="pt-14 md:pt-20">
        <TestsPanel lang={lang} entry={snapshot.tests} now={now} />
      </Section>

      <Section className="pt-8 md:pt-10">
        <LighthousePanel lang={lang} entry={snapshot.lighthouse} now={now} />
      </Section>

      <Section className="pt-10">
        <p className="max-w-3xl font-mono text-xs leading-relaxed text-slatey">{t("status.footnote")}</p>
      </Section>
    </>
  );
}
