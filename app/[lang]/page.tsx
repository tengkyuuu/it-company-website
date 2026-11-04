import type { Metadata } from "next";
import Hero from "@/components/hero/Hero";
import { heroShots } from "@/lib/hero-shots";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import TechMarquee from "@/components/landing/TechMarquee";
import ServicesGalaxy from "@/components/landing/ServicesGalaxy";
import Audiences from "@/components/landing/Audiences";
import ProcessDeck from "@/components/landing/ProcessDeck";
import BeliefScrub from "@/components/landing/BeliefScrub";
import { Reveal } from "@/components/Reveal";
import { getProjects, getServices } from "@/lib/cms";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  return {
    title: { absolute: getDictionary(lang).t("meta.siteTitle") },
    description:
      "R Ally's Tech is an IT studio in Dipolog City crafting web, mobile, and cloud products — with the eye of a design house.",
    ...localeMetadata(lang, "/"),
  };
}

export default async function Home({ params }: LangParams) {
  const lang = await pageLocale(params);
  const { t } = getDictionary(lang);
  const [projects, services] = await Promise.all([getProjects(), getServices()]);

  return (
    <>
      {/* hero — curved reel of our real project screenshots */}
      <Hero shots={heroShots(projects)} />

      {/* Our stack */}
      <div className="border-y border-mist/60">
        <Reveal className="mx-auto flex max-w-6xl justify-center px-6 pt-7">
          <Eyebrow>{t("home.stackEyebrow")}</Eyebrow>
        </Reveal>
        <TechMarquee />
      </div>

      {/* Who we build for — the three audiences, each pointed at an engagement model */}
      <Audiences lang={lang} />

      {/* Services — keycap macropad + one line per service (detail lives on /services) */}
      <ServicesGalaxy services={services} />

      {/* Process — sticky card deck */}
      <Section className="pt-24 md:pt-32">
        <SectionHeader
          eyebrow={t("home.processEyebrow")}
          title={t("home.processTitle")}
          intro="No mystery, no theatrics. Four steps, weekly check-ins, and a build you can see from day one."
        />
        <ProcessDeck />
      </Section>

      {/* Belief band — words ink in as you scroll */}
      <Section className="pt-24 md:pt-32">
        <BeliefScrub />
      </Section>
    </>
  );
}
