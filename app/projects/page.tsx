import type { Metadata } from "next";
import Link from "next/link";
import Section, { SectionHeader } from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import LivePreview from "@/components/projects/LivePreview";
import { getProjects } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Real products mykTech() has shipped — CRM, healthcare, structural monitoring, fintech and ordering platforms, with a live preview of each.",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <>
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <SectionHeader
          eyebrow="Projects"
          title={
            <>
              Real products, in real hands —{" "}
              <span className="text-accent">see them running.</span>
            </>
          }
          intro="Five platforms across CRM, healthcare, structural monitoring, fintech and retail. Every one of them shipped; every one of them is previewable below."
        />
        <Reveal delay={0.1} className="mt-8 flex items-center gap-5">
          <span className="font-mono text-xs uppercase tracking-widest text-ink/40">
            {String(projects.length).padStart(2, "0")} projects
          </span>
          <span className="h-px flex-1 bg-mist/70" aria-hidden />
          <KeySwitch size={44} tint="gold" />
        </Reveal>
      </Section>

      {/* alternating feature rows — deliberately not another card grid */}
      <div className="mt-20 space-y-28 md:mt-28 md:space-y-40">
        {projects.map((p, i) => {
          const flip = i % 2 === 1;
          return (
            <Section key={p.slug}>
              <article className="group grid items-center gap-10 md:grid-cols-12 md:gap-14">
                {/* preview — vertical reveal only: a horizontal offset would
                    push a full-width mobile column past the viewport */}
                <Reveal
                  className={`md:col-span-7 ${
                    flip ? "md:order-2 md:col-start-6" : ""
                  }`}
                >
                  <Link
                    href={`/projects/${p.slug}`}
                    aria-label={`${p.name} — project detail`}
                    data-cursor
                    className="block transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5"
                  >
                    <LivePreview project={p} priority={i === 0} />
                  </Link>
                </Reveal>

                {/* copy */}
                <Reveal
                  delay={0.08}
                  className={`md:col-span-5 ${flip ? "md:order-1 md:row-start-1" : ""}`}
                >
                  <span
                    aria-hidden
                    className="select-none font-display text-5xl font-bold leading-none text-stroke-soft md:text-6xl"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-slatey">
                    <span className="flex items-center gap-1" aria-hidden>
                      {p.dots.map((c, j) => (
                        <span
                          key={j}
                          style={{ background: c }}
                          className="h-2 w-2 rounded-full ring-1 ring-ink/10"
                        />
                      ))}
                    </span>
                    {p.category} · {p.year}
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                    <Link
                      href={`/projects/${p.slug}`}
                      className="transition-colors duration-300 hover:text-accent"
                    >
                      {p.name}
                    </Link>
                  </h2>
                  <p className="mt-4 text-pretty leading-relaxed text-ink/65">
                    {p.summary}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-mist/70 px-2.5 py-0.5 text-xs text-ink/55"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <Button href={`/projects/${p.slug}`} variant="outline" arrow>
                      View project
                    </Button>
                    {p.liveUrl && (
                      <a
                        href={p.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/live inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-ink"
                      >
                        <span className="relative">
                          {p.url}
                          <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover/live:w-full" />
                        </span>
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                  </div>
                </Reveal>
              </article>
            </Section>
          );
        })}
      </div>

      <Section className="pt-32 md:pt-40">
        <Reveal className="flex flex-col items-start justify-between gap-8 border-t border-mist/70 pt-14 md:flex-row md:items-center">
          <div>
            <h2 className="max-w-xl text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Yours could be next on this page.
            </h2>
            <p className="mt-3 max-w-md text-pretty leading-relaxed text-ink/60">
              Tell us what you’re building and we’ll tell you how we’d ship it.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <KeySwitch size={50} tint="plum" className="hidden sm:block" />
            <Button href="/location" arrow>
              Start a project
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
