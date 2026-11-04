import Link from "next/link";
import { Eyebrow } from "@/components/Section";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localizePath } from "@/lib/i18n/paths";
import type { Locale } from "@/lib/i18n/config";

/**
 * "Who we build for": the three audiences in PRODUCT.md, each answered in one
 * honest paragraph and pointed at the engagement model that usually fits.
 * Editorial columns on hairlines, deliberately unlike the keycap macropad and the
 * process deck around it. Copy approved 2026-11-04 (docs/part-b-copy.md); body
 * text is long-form marketing copy, so it stays English in both locales.
 */
export default function Audiences({ lang }: { lang: Locale }) {
  const { t } = getDictionary(lang);
  const services = localizePath(lang, "/services");

  const audiences = [
    {
      no: "01",
      title: t("home.audienceLocal"),
      body: "Your first proper website, an ordering or booking system, or the internal tool that finally replaces the spreadsheet. We’re in Dipolog City, and we can meet in person by arrangement.",
      starts: [t("services.engagementProject")],
    },
    {
      no: "02",
      title: t("home.audienceAbroad"),
      body: "A senior team on Philippine time that designs and builds end to end. You talk to the engineers, not an account manager — and you see the build every week, not at the end.",
      starts: [t("services.engagementRetainer")],
    },
    {
      no: "03",
      title: t("home.audienceFounders"),
      body: "Turn the idea into a first version real people can use. We scope it tight, design the parts that matter, ship it, then learn from what users actually do.",
      starts: [t("services.engagementSprint"), t("services.engagementProject")],
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <Reveal>
        <Eyebrow>{t("home.audienceEyebrow")}</Eyebrow>
        <h2 className="mt-5 max-w-2xl text-balance font-display text-4xl font-medium tracking-[-0.035em] md:text-5xl">
          {t("home.audienceTitle")}
        </h2>
      </Reveal>

      <RevealGroup className="mt-14 grid border-t border-ink md:grid-cols-3">
        {audiences.map((a, i) => (
          <RevealItem
            key={a.no}
            className={`flex flex-col pt-8 pb-10 md:pb-0 md:pr-10 ${
              i > 0 ? "border-t border-mist md:border-t-0 md:border-l md:pl-10" : ""
            }`}
          >
            <span className="font-mono text-xs text-slatey">{a.no}</span>
            <h3 className="mt-3 font-display text-2xl font-medium tracking-tight">{a.title}</h3>
            <p className="mt-4 text-pretty leading-relaxed text-ink/70">{a.body}</p>
            <Link
              href={`${services}#engagements`}
              className="group mt-auto inline-flex items-baseline gap-2 pt-8 text-sm"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slatey">
                {t("home.startsAs")}
              </span>
              <span className="font-medium text-ink underline decoration-mist underline-offset-4 transition-colors group-hover:decoration-ink">
                {a.starts.join(" → ")}
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
