import type { Metadata } from "next";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import Button from "@/components/Button";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import ServiceIndex from "@/components/services/ServiceIndex";
import { getServices } from "@/lib/cms";
import ServicesGlyph from "@/components/services/ServicesGlyph";
import KeySwitch from "@/components/fx/KeySwitch";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  return {
    title: getDictionary(lang).t("meta.services"),
    description:
      "Web, mobile, cloud, AI, design and consulting — the full toolkit for building modern software at R Ally's Tech.",
    ...localeMetadata(lang, "/services"),
  };
}

export default async function ServicesPage({ params }: LangParams) {
  const lang = await pageLocale(params);
  const { t } = getDictionary(lang);
  const services = await getServices();

  // The card labels are translated; the descriptions are marketing copy and
  // stay English in both locales by design.
  const engagements = [
    { no: "01", title: t("services.engagementProject"), body: "Fixed scope, fixed timeline. Best for launches and rebuilds.", good: "a business replacing a spreadsheet or an old system, or a founder shipping a first version." },
    { no: "02", title: t("services.engagementRetainer"), body: "A dedicated slice of the studio, month to month.", good: "teams with a live product that need steady design and engineering every month, including teams abroad." },
    { no: "03", title: t("services.engagementSprint"), body: "A focused 2-week burst to validate, prototype, or unblock.", good: "testing an idea before committing a full budget, or getting a stuck project moving again." },
  ];
  return (
    <>
      {/* Header — display type + cycling 3D glyph */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
          <SectionHeader
            as="h1"
            eyebrow={t("services.eyebrow")}
            title={
              <>
                {t("services.titleLine1")}
                <br className="hidden md:block" /> {t("services.titleLine2")}{" "}
                <span className="text-accent">{t("services.titleAccent")}</span>
              </>
            }
            intro="Six core practices, one team. Mix and match — most clients start with one and grow into the rest."
          />
          <div className="hidden h-72 w-72 md:block lg:h-80 lg:w-80" aria-hidden>
            <ServicesGlyph icons={services.map((s) => s.icon)} />
          </div>
        </div>
      </Section>

      {/* Accordion index */}
      <Section className="pt-16 md:pt-24">
        <Reveal>
          <ServiceIndex services={services} />
        </Reveal>
      </Section>

      {/* Engagement models — #engagements is the target of Home's "Usually starts as" links */}
      <Section id="engagements" className="scroll-mt-28 pt-24 md:pt-32">
        <SectionHeader
          eyebrow={t("services.engagementsEyebrow")}
          title={t("services.engagementsTitle")}
          intro="However we engage, you get the same senior team and the same obsessive attention to craft."
        />
        <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
          {engagements.map((e) => (
            <RevealItem
              key={e.no}
              className="group rounded-3xl border border-mist/70 bg-surface p-8 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-40px_rgba(15,23,42,0.4)]"
            >
              <div className="flex items-center justify-between">
                <Eyebrow>{e.title}</Eyebrow>
                <span
                  aria-hidden
                  className="select-none font-display text-4xl font-bold leading-none text-stroke-soft transition-colors duration-300 group-hover:text-accent"
                >
                  {e.no}
                </span>
              </div>
              <p className="mt-6 text-lg leading-relaxed text-ink/70">{e.body}</p>
              <p className="mt-6 border-t border-mist pt-5 text-sm leading-relaxed text-ink/60">
                <span className="mr-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slatey">
                  {t("services.goodFor")}
                </span>
                {e.good}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>
    </>
  );
}
