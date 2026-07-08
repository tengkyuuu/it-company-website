import type { Metadata } from "next";
import Image from "next/image";
import Section, { SectionHeader } from "@/components/Section";
import Button from "@/components/Button";
import TeamRoster from "@/components/about/TeamRoster";
import KeySwitch from "@/components/fx/KeySwitch";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "MYKTECH is a small, senior IT studio in Dipolog City that builds software with the care of a design house.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    no: "01",
    title: "Craft over flash",
    body: "We’d rather ship one thing that feels right than ten that merely work. Details are the product.",
  },
  {
    no: "02",
    title: "Plain language",
    body: "No jargon walls, no status theatre. You always know where your project stands.",
  },
  {
    no: "03",
    title: "Small & senior",
    body: "You work directly with the people building your product — no hand-offs to a junior bench.",
  },
  {
    no: "04",
    title: "Built to last",
    body: "We optimise for the codebase you’ll still be glad you have in three years.",
  },
];

const marqueeWords = ["Design", "Engineering", "Dipolog City", "Since day one"];

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-2 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <div className="grid items-end gap-12 md:grid-cols-2">
          <SectionHeader
            eyebrow="About MYKT"
            title={
              <>
                A small studio that
                <br className="hidden md:block" /> sweats the{" "}
                <span className="text-accent">details.</span>
              </>
            }
          />
          <Reveal delay={0.1}>
            <p className="text-pretty text-lg leading-relaxed text-ink/60">
              We’re a tight team of designers and engineers in Dipolog City who got
              tired of software that felt like a chore. MYKT exists to prove
              that serious technology can also be warm, clear, and a little
              beautiful.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Outline type marquee — the editorial breath between sections */}
      <div
        className="mt-20 overflow-hidden border-y border-mist/60 py-5 md:py-7"
        aria-hidden
      >
        <div className="marquee-track flex w-max items-center whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center">
              {marqueeWords.map((w, i) => (
                <span key={`${dup}-${w}`} className="flex items-center">
                  <span
                    className={`px-6 font-display text-5xl font-bold tracking-tight md:text-7xl ${
                      i % 2 === 0 ? "text-stroke" : "text-ink"
                    }`}
                  >
                    {w}
                  </span>
                  <span className="text-accent text-3xl md:text-5xl">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Brand visual */}
      <Section className="pt-16 md:pt-24">
        <Reveal className="group overflow-hidden rounded-[2rem] border border-mist/70 bg-white">
          <Image
            src="/brand/card-mockup.png"
            alt="MYKT brand identity on business cards"
            width={1600}
            height={1200}
            className="h-auto w-full transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        </Reveal>
      </Section>

      {/* Values */}
      <Section className="pt-24 md:pt-32">
        <SectionHeader
          eyebrow="What we value"
          title="Four things we won’t compromise on."
        />
        <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2">
          {values.map((v) => (
            <RevealItem
              key={v.title}
              className="group relative overflow-hidden rounded-3xl border border-mist/70 bg-white p-8 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-40px_rgba(15,23,42,0.4)] md:p-10"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-6 select-none font-display text-[7rem] font-bold leading-none text-stroke-soft opacity-70 transition-colors duration-300 group-hover:text-accent md:text-[8rem]"
              >
                {v.no}
              </span>
              <div className="relative mt-16">
                <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {v.title}
                </h3>
                <p className="mt-3 max-w-sm leading-relaxed text-ink/60">{v.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* Team */}
      <Section className="pt-24 md:pt-32">
        <SectionHeader
          eyebrow="The people"
          title="Faces, not stock photos."
          intro="The same team that scopes your project is the one that builds it. Run your cursor down the roster."
        />
        <TeamRoster />

        <Reveal delay={0.1} className="mt-14 flex items-center justify-center gap-5">
          <Button href="/location" arrow>
            Work with us
          </Button>
          <KeySwitch size={50} tint="sky" className="hidden translate-x-6 sm:block" />
        </Reveal>
      </Section>
    </>
  );
}
