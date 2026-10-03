import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  ageInDays,
  commitUrl,
  isStale,
  testsPassed,
  type StatusEntry,
  type TestsReport,
} from "@/lib/status-schema";
import { formatCount, formatDurationSeconds, formatReported, shortSha } from "./format";
import { MetaList, OutLink, PanelTitle, StaleBadge, VerdictChip } from "./parts";

/**
 * The test-suite faceplate: a verdict chip, five big tabular readings, a
 * proportion strip (passed / failed / skipped — failed is hatched, so it
 * reads without colour), the failing names when there are any, and where the
 * numbers came from. Counts are exact; duration rounds up.
 */
export default function TestsPanel({
  lang,
  entry,
  now,
}: {
  lang: Locale;
  entry: StatusEntry<TestsReport> | null;
  now: number;
}) {
  const { t } = getDictionary(lang);

  return (
    <section
      aria-labelledby="status-tests"
      data-animate
      className="overflow-hidden rounded-[1.75rem] border border-mist/70 bg-surface"
    >
      {!entry ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 md:p-10">
            <PanelTitle id="status-tests" index="01">
              {t("status.testsTitle")}
            </PanelTitle>
          </div>
          <p className="border-t border-dashed border-mist px-6 py-10 text-pretty leading-relaxed text-ink/60 md:px-10">
            {t("status.testsEmpty")}
          </p>
        </>
      ) : (
        <Filled lang={lang} entry={entry} now={now} />
      )}
    </section>
  );
}

function Filled({ lang, entry, now }: { lang: Locale; entry: StatusEntry<TestsReport>; now: number }) {
  const { t } = getDictionary(lang);
  const r = entry.report;
  const tot = r.totals;
  const passing = testsPassed(r);
  const stale = isStale(entry.receivedAt, now);
  const more = r.failingTotal - r.failing.length;
  const pct = (n: number) => (tot.tests ? `${(n / tot.tests) * 100}%` : "0%");

  const readings: { label: string; value: string; unit?: string }[] = [
    { label: t("status.passed"), value: formatCount(tot.passed, lang) },
    { label: t("status.failed"), value: formatCount(tot.failed, lang) },
    { label: t("status.skipped"), value: formatCount(tot.skipped, lang) },
    { label: t("status.files"), value: formatCount(tot.files, lang) },
    {
      label: t("status.duration"),
      value: tot.durationMs === null ? "—" : formatDurationSeconds(tot.durationMs),
      unit: tot.durationMs === null ? undefined : "s",
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 md:p-10">
        <PanelTitle id="status-tests" index="01">
          {t("status.testsTitle")}
        </PanelTitle>
        <div className="flex flex-wrap items-center gap-3">
          {stale && (
            <StaleBadge>{t("status.stale", { days: ageInDays(entry.receivedAt, now) })}</StaleBadge>
          )}
          <VerdictChip passing={passing}>
            {passing ? t("status.testsPassing") : t("status.testsFailing")}
          </VerdictChip>
        </div>
      </div>

      <div className="border-t border-mist/60 px-6 py-10 md:px-10 md:py-12">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {readings.map((it) => (
            <div key={it.label} className="flex flex-col-reverse gap-2">
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-slatey">{it.label}</dt>
              <dd className="text-5xl font-semibold leading-none tracking-tight tabular-nums md:text-6xl">
                {it.value}
                {it.unit && (
                  <span className="ml-1.5 text-2xl font-medium text-slatey md:text-3xl">{it.unit}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* proportion strip — decoration; the sentence under it is the data */}
        <div className="mt-12 flex h-2 w-full overflow-hidden rounded-full bg-mist/50" aria-hidden>
          <span className="h-full bg-ink" style={{ width: pct(tot.passed) }} />
          <span
            className="h-full bg-[repeating-linear-gradient(135deg,var(--color-ink)_0_2px,transparent_2px_5px)]"
            style={{ width: pct(tot.failed) }}
          />
          <span className="h-full bg-mist" style={{ width: pct(tot.skipped) }} />
        </div>
        <p className="mt-4 font-mono text-xs text-ink/70">
          {t("status.testsSummary", {
            passed: formatCount(tot.passed, lang),
            total: formatCount(tot.tests, lang),
          })}
          {!passing && tot.failed === 0 && tot.failedFiles === 0 && <> · {t("status.runError")}</>}
        </p>
      </div>

      {r.failing.length > 0 && (
        <div className="border-t border-mist/60 px-6 py-8 md:px-10">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slatey">
            {t("status.failingTitle")}
          </h3>
          <ol className="mt-4 divide-y divide-mist/60 font-mono text-[13px] leading-relaxed">
            {r.failing.map((f, i) => (
              <li key={i} className="break-words py-2.5">
                <span className="text-slatey">{f.file}</span>
                <span aria-hidden className="px-2 text-slatey">
                  ›
                </span>
                <span className="text-ink">{f.name || t("status.fileFailed")}</span>
              </li>
            ))}
          </ol>
          {more > 0 && (
            <p className="mt-3 font-mono text-xs text-slatey">
              {t("status.moreFailing", { count: formatCount(more, lang) })}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-mist/60 px-6 py-6 md:px-10">
        <MetaList
          items={[
            { label: t("status.reported"), value: formatReported(entry.receivedAt, lang) },
            {
              label: t("status.commit"),
              value: (
                <OutLink
                  href={commitUrl(entry.commitSha)}
                  label={`${t("status.commitAria", { sha: shortSha(entry.commitSha) })} ${t("footer.opensInNewTab")}`}
                >
                  {shortSha(entry.commitSha)}
                </OutLink>
              ),
            },
            ...(entry.runUrl
              ? [
                  {
                    label: t("status.run"),
                    value: (
                      <OutLink href={entry.runUrl} label={`${t("status.viewRun")} ${t("footer.opensInNewTab")}`}>
                        {t("status.viewRun")}
                      </OutLink>
                    ),
                  },
                ]
              : []),
            {
              label: t("status.runner"),
              value: `Node ${r.runner.node} · Vitest ${r.runner.vitest} · ${r.runner.os}`,
            },
          ]}
        />
      </div>
    </>
  );
}
