import type { Metadata } from "next";
import Hero from "@/components/hero/Hero";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import TechMarquee from "@/components/landing/TechMarquee";
import VideoReveal from "@/components/landing/VideoReveal";
import ServicesGalaxy from "@/components/landing/ServicesGalaxy";
import WorkGallery from "@/components/landing/WorkGallery";
import ProcessDeck from "@/components/landing/ProcessDeck";
import BeliefScrub from "@/components/landing/BeliefScrub";
import { Reveal } from "@/components/Reveal";
import { getProjects, getServices } from "@/lib/cms";

export const metadata: Metadata = {
  title: { absolute: "R Ally's Tech — Software, designed with intent" },
  description:
    "R Ally's Tech is an IT studio in Dipolog City crafting web, mobile, and cloud products — with the eye of a design house.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [projects, services] = await Promise.all([getProjects(), getServices()]);

  return (
    <>
      {/* 3D constellation hero — scroll scatters the system */}
      <Hero />

      {/* Our stack */}
      <div className="border-y border-mist/60">
        <Reveal className="mx-auto flex max-w-6xl justify-center px-6 pt-7">
          <Eyebrow>The stack we build on</Eyebrow>
        </Reveal>
        <TechMarquee />
      </div>

      {/* Showreel — scroll-driven expand + scrub */}
      <VideoReveal />

      {/* Services — dark band, sticky morphing 3D glyph + scrolling index */}
      <ServicesGalaxy services={services} />

      {/* Selected Work — pinned horizontal gallery with parallax plates */}
      <div className="pt-24 md:pt-32">
        <WorkGallery projects={projects} />
      </div>

      {/* Process — sticky card deck */}
      <Section className="pt-24 md:pt-32">
        <SectionHeader
          eyebrow="How we work"
          title="A calm, predictable way to ship."
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
