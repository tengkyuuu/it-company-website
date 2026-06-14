import type { Metadata } from "next";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import Icon from "@/components/Icon";
import Button from "@/components/Button";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { services } from "@/lib/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web, mobile, cloud, AI, design and consulting — the full toolkit for building modern software at MYKT.",
};

const engagements = [
  { title: "Project", body: "Fixed scope, fixed timeline. Best for launches and rebuilds." },
  { title: "Retainer", body: "A dedicated slice of the studio, month to month." },
  { title: "Sprint", body: "A focused 2-week burst to validate, prototype, or unblock." },
];

export default function ServicesPage() {
  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-2 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <SectionHeader
          eyebrow="Services"
          title={
            <>
              Everything it takes to go from
              <br className="hidden md:block" /> idea to{" "}
              <span className="text-accent">in production.</span>
            </>
          }
          intro="Six core practices, one team. Mix and match — most clients start with one and grow into the rest."
        />
      </Section>

      {/* Detailed list */}
      <Section className="pt-16 md:pt-24">
        <div className="flex flex-col gap-px overflow-hidden rounded-3xl border border-mist/70 bg-mist/50">
          {services.map((s, i) => (
            <Reveal key={s.slug} direction="up" delay={(i % 2) * 0.05}>
              <article className="group grid items-start gap-6 bg-paper p-8 transition-colors duration-300 hover:bg-white md:grid-cols-[auto_1fr_auto] md:gap-10 md:p-10">
                <div className="flex items-center gap-5">
                  <span className="font-mono text-sm text-slatey">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-mist/70 bg-white text-ink transition-colors duration-300 group-hover:border-transparent group-hover:bg-ink group-hover:text-paper">
                    <Icon name={s.icon} className="h-7 w-7" />
                  </div>
                </div>

                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {s.title}
                  </h2>
                  <p className="mt-2 text-pretty leading-relaxed text-ink/60">
                    {s.detail}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {s.deliverables.map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-mist/70 bg-white px-3 py-1 text-xs text-ink/60"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="hidden md:block">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-mist/70 text-ink/40 transition-all duration-300 group-hover:border-transparent group-hover:bg-accent group-hover:text-ink">
                    →
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Engagement models */}
      <Section className="pt-24 md:pt-32">
        <SectionHeader
          eyebrow="Ways to work together"
          title="Pick the shape that fits."
          intro="However we engage, you get the same senior team and the same obsessive attention to craft."
        />
        <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
          {engagements.map((e) => (
            <RevealItem
              key={e.title}
              className="rounded-2xl border border-mist/70 bg-white p-8"
            >
              <Eyebrow>{e.title}</Eyebrow>
              <p className="mt-5 text-lg leading-relaxed text-ink/70">
                {e.body}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1} className="mt-12 flex justify-center">
          <Button href="/location" arrow>
            Tell us about your project
          </Button>
        </Reveal>
      </Section>
    </>
  );
}
