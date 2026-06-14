import Hero from "@/components/hero/Hero";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import VelocityMarquee from "@/components/landing/VelocityMarquee";
import ServicesPinned from "@/components/landing/ServicesPinned";
import VideoReveal from "@/components/landing/VideoReveal";
import StatsCounter from "@/components/landing/StatsCounter";
import ProcessTimeline from "@/components/landing/ProcessTimeline";
import SelectedWork from "@/components/SelectedWork";
import Testimonials from "@/components/Testimonials";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";

const clients = [
  "Northwind",
  "Lumio",
  "Atlas Pay",
  "Verda",
  "Hapinoy",
  "Cebu Air",
  "Kalibrr",
  "Brightspot",
];

export default function Home() {
  return (
    <>
      <Hero />

      <VelocityMarquee items={clients} />

      {/* Showreel — scroll-driven expand + scrub */}
      <VideoReveal />

      {/* Services — horizontal pinned scroll */}
      <ServicesPinned />

      {/* Selected Work */}
      <Section className="pt-24 md:pt-32">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader
            eyebrow="Selected work"
            title={
              <>
                A few things we’re
                <br className="hidden sm:block" /> proud to have shipped.
              </>
            }
            intro="Real products, in real hands — across fintech, retail, and beyond."
          />
          <Reveal delay={0.1}>
            <Button href="/location" variant="outline" arrow>
              Start a project
            </Button>
          </Reveal>
        </div>

        <SelectedWork />
      </Section>

      {/* Testimonials */}
      <Section className="pt-28 md:pt-36">
        <Reveal className="mb-4 flex justify-center">
          <Eyebrow>What clients say</Eyebrow>
        </Reveal>
        <Testimonials />
      </Section>

      {/* Stats — count up on scroll */}
      <Section className="pt-24 md:pt-32">
        <StatsCounter />
      </Section>

      {/* Process — draw-line timeline */}
      <Section className="pt-24 md:pt-32">
        <SectionHeader
          eyebrow="How we work"
          title="A calm, predictable way to ship."
          intro="No mystery, no theatrics. Four steps, weekly check-ins, and a build you can see from day one."
        />
        <ProcessTimeline />
      </Section>

      {/* Belief band */}
      <Section className="pt-24 md:pt-32">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-paper grain md:px-16 md:py-24">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 opacity-50 aurora" />
          <div className="relative">
            <Eyebrow>Our belief</Eyebrow>
            <p className="mt-6 max-w-3xl text-balance text-3xl font-medium leading-snug tracking-tight md:text-4xl">
              Good software shouldn’t announce itself. It should feel{" "}
              <span className="text-accent">obvious</span> — like it was always
              meant to work this way.
            </p>
            <p className="mt-8 font-mono text-xs uppercase tracking-widest text-paper/50">
              — The MYKT studio
            </p>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
