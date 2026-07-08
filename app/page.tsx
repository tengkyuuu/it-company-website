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

export const metadata: Metadata = {
  title: { absolute: "MYKTECH — Software, designed with intent" },
  description:
    "MYKTECH is an IT studio in Dipolog City crafting web, mobile, and cloud products — with the eye of a design house.",
  alternates: { canonical: "/" },
};

export default function Home() {
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
      <ServicesGalaxy />

      {/* Selected Work — pinned horizontal gallery with parallax plates */}
      <div className="pt-24 md:pt-32">
        <WorkGallery />
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
