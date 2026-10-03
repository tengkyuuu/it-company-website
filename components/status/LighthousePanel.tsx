import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import {
  FORM_FACTORS,
  ageInDays,
  commitUrl,
  isStale,
  type LighthousePage,
  type LighthouseReport,
  type StatusEntry,
} from "@/lib/status-schema";
import { formatCls, formatLcp, formatReported, formatTbt, shortSha } from "./format";
import { MetaList, OutLink, PanelTitle, ScoreGauge, StaleBadge } from "./parts";

/**
 * The Lighthouse faceplate: one strip per audited page, a row of four gauges
 * per form factor, the three key timings beside them. The GPU caveat sits at
 * the top of the panel, in the same type as the panel's facts — it is part of
 * the reading, not a footnote.
 */
export default function LighthousePanel({
  lang,
  entry,
  now,
}: {
  lang: Locale;
  entry: StatusEntry<LighthouseReport> | null;
  now: number;
}) {
  const { t } = getDictionary(lang);
  const r = entry?.report;
  const stale = entry ? isStale(entry.receivedAt, now) : false;

  return (
    <section
      aria-labelledby="status-lighthouse"
      data-animate
      className="overflow-hidden rounded-[1.75rem] border border-mist/70 bg-surface"
    >
      <div className="p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PanelTitle id="status-lighthouse" index="02">
            {t("status.lighthouseTitle")}
          </PanelTitle>
          {entry && stale && (
            <StaleBadge>{t("status.stale", { days: ageInDays(entry.receivedAt, now) })}</StaleBadge>
          )}
        </div>
        {/* the honest label — shown even before the first audit, so the
            first number anyone sees already carries its caveat */}
        <p className="mt-6 font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-ink">
          {r && r.gpu ? t("status.lighthouseLabelGpu") : t("status.lighthouseLabel")}
        </p>
        {!(r && r.gpu) && (
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-ink/60">
            {t("status.lighthouseNote")}
          </p>
        )}
      </div>

      {!entry || !r ? (
        <p className="border-t border-dashed border-mist px-6 py-10 text-pretty leading-relaxed text-ink/60 md:px-10">
          {t("status.lighthouseEmpty")}
        </p>
      ) : (
        <>
          <div className="divide-y divide-mist/60 border-t border-mist/60">
            {groupByPath(r.pages).map(({ path, rows }, i) => (
              <section
                key={path}
                aria-labelledby={`status-lh-${i}`}
                className="grid gap-6 px-6 py-8 md:grid-cols-[9rem_1fr] md:gap-10 md:px-10"
              >
                <h3
                  id={`status-lh-${i}`}
                  className="break-all font-mono text-xl tracking-tight text-ink md:pt-4 md:text-2xl"
                >
                  {path}
                </h3>
                <div className="space-y-8">
                  {rows.map((p) => (
                    <PageRow key={p.formFactor} lang={lang} page={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>

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
                  label: t("status.tool"),
                  value: `${t("status.version", { version: r.lighthouseVersion })} · ${
                    r.runs === 1 ? t("status.runsOne") : t("status.runsMany", { count: r.runs })
                  }`,
                },
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}

/** Pages in the order CI audited them; mobile before desktop within each. */
function groupByPath(pages: LighthousePage[]) {
  const order: string[] = [];
  const byPath = new Map<string, LighthousePage[]>();
  for (const p of pages) {
    if (!byPath.has(p.path)) {
      byPath.set(p.path, []);
      order.push(p.path);
    }
    byPath.get(p.path)!.push(p);
  }
  return order.map((path) => ({
    path,
    rows: byPath
      .get(path)!
      .sort((a, b) => FORM_FACTORS.indexOf(a.formFactor) - FORM_FACTORS.indexOf(b.formFactor)),
  }));
}

function PageRow({ lang, page }: { lang: Locale; page: LighthousePage }) {
  const { t } = getDictionary(lang);
  const ff = page.formFactor === "mobile" ? t("status.mobile") : t("status.desktop");
  const s = page.scores;
  const m = page.metrics;

  const gauges = [
    { label: t("status.performance"), score: s.performance },
    { label: t("status.accessibility"), score: s.accessibility },
    { label: t("status.bestPractices"), score: s.bestPractices },
    { label: t("status.seo"), score: s.seo },
  ];
  const metrics = [
    { abbr: t("status.lcp"), full: t("status.lcpFull"), value: m.lcpMs === null ? null : formatLcp(m.lcpMs) },
    { abbr: t("status.cls"), full: t("status.clsFull"), value: m.cls === null ? null : formatCls(m.cls) },
    { abbr: t("status.tbt"), full: t("status.tbtFull"), value: m.tbtMs === null ? null : formatTbt(m.tbtMs, lang) },
  ];

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[5.5rem_auto_1fr] lg:gap-8">
      <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slatey">{ff}</h4>
      {!page.ok ? (
        <p className="text-sm text-ink/60 lg:col-span-2">{t("status.auditFailed")}</p>
      ) : (
        <>
          {/* 2×2 on phones: four across leaves ~70px per label, and
              "ACCESSIBILITY" can't fit that at a readable size */}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 min-[420px]:grid-cols-4 min-[420px]:gap-2 sm:gap-6">
            {gauges.map((g) => (
              <ScoreGauge
                key={g.label}
                score={g.score}
                label={g.label}
                srText={
                  g.score === null
                    ? t("status.scoreMissing", { label: g.label })
                    : t("status.scoreOutOf", { label: g.label, score: g.score })
                }
              />
            ))}
          </ul>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs lg:justify-end">
            {metrics.map((x) => (
              <div key={x.abbr} className="flex items-baseline gap-2">
                <dt className="text-slatey">
                  <abbr title={x.full} className="no-underline">
                    {x.abbr}
                  </abbr>
                </dt>
                <dd className="tabular-nums text-ink">{x.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
