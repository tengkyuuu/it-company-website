import type { Metadata } from "next";
import Image from "next/image";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import Button from "@/components/Button";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "MYKT is a small, senior IT studio in Dipolog City that builds software with the care of a design house.",
};

const values = [
  {
    title: "Craft over flash",
    body: "We’d rather ship one thing that feels right than ten that merely work. Details are the product.",
  },
  {
    title: "Plain language",
    body: "No jargon walls, no status theatre. You always know where your project stands.",
  },
  {
    title: "Small & senior",
    body: "You work directly with the people building your product — no hand-offs to a junior bench.",
  },
  {
    title: "Built to last",
    body: "We optimise for the codebase you’ll still be glad you have in three years.",
  },
];

const team = [
  { name: "Jhade Japhet Banquiao", role: "Project Lead", initials: "JB" },
  { name: "James Vincent Calunsag", role: "Frontend Developer", initials: "JC" },
  { name: "Haron Ian Diniay", role: "Backend Developer", initials: "HD" },
  { name: "Ralph Wyndril Andilab", role: "Mobile Developer", initials: "RA" },
  { name: "Sean Myk Daniel Jacinto", role: "AI Automation Specialist", initials: "SJ" },
  { name: "Hasnain Fayyaz", role: "Head of Marketing", initials: "HF" },
];

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

      {/* Brand visual + story */}
      <Section className="pt-16 md:pt-24">
        <Reveal className="overflow-hidden rounded-[2rem] border border-mist/70 bg-white">
          <Image
            src="/brand/card-mockup.png"
            alt="MYKT brand identity on business cards"
            width={1600}
            height={1200}
            className="h-auto w-full"
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
              className="group rounded-2xl border border-mist/70 bg-white p-8"
            >
              <div className="flex items-start gap-4">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    {v.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-ink/60">{v.body}</p>
                </div>
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
          intro="The same team that scopes your project is the one that builds it."
        />
        <RevealGroup className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {team.map((m) => (
            <RevealItem
              key={m.name}
              className="group rounded-2xl border border-mist/70 bg-white p-6 text-center transition-shadow duration-300 hover:shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-paper text-2xl font-semibold tracking-tight ring-1 ring-mist transition-transform duration-300 group-hover:scale-105">
                <span className="text-accent">{m.initials}</span>
              </div>
              <p className="mt-4 font-semibold tracking-tight">{m.name}</p>
              <p className="font-mono text-xs uppercase tracking-widest text-slatey">
                {m.role}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1} className="mt-14 flex justify-center">
          <Button href="/location" arrow>
            Work with us
          </Button>
        </Reveal>
      </Section>
    </>
  );
}
