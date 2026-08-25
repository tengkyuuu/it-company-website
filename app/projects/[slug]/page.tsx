import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import LivePreview from "@/components/projects/LivePreview";
import { getProjectBySlug, getProjectNeighbours, getProjects } from "@/lib/cms";
import { site } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) return { title: "Project not found" };
  return {
    title: p.name,
    description: p.summary,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: {
      title: `${p.name} — ${p.category}`,
      description: p.summary,
      url: `${site.url}/projects/${p.slug}`,
      type: "article",
      images: [{ url: p.img }],
    },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) notFound();

  const { prev, next } = await getProjectNeighbours(p.slug);
  const shots = [p.img, p.img2].filter(Boolean) as string[];

  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <Reveal>
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey transition-colors hover:text-ink"
          >
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            >
              ←
            </span>
            All projects
          </Link>
        </Reveal>

        <div className="mt-8 grid gap-10 md:grid-cols-12 md:gap-14">
          <Reveal className="md:col-span-7">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-slatey">
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
            <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight md:text-6xl">
              {p.name}
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink/65">
              {p.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {p.liveUrl ? (
                <Button href={p.liveUrl} arrow>
                  Open live site
                </Button>
              ) : (
                <Button href="/location" arrow>
                  Ask about this build
                </Button>
              )}
              <KeySwitch size={46} tint="sky" className="hidden sm:block" />
            </div>
          </Reveal>

          {/* detail rail */}
          <Reveal delay={0.1} className="md:col-span-5 md:col-start-9">
            <dl className="divide-y divide-mist/70 border-y border-mist/70">
              <Row label="Category" value={p.category} />
              <Row label="Year" value={p.year.replace("’", "20")} />
              <Row
                label="Site"
                value={
                  p.liveUrl ? (
                    <a
                      href={p.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-accent"
                    >
                      {p.url} <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className="text-ink/45">{p.url}</span>
                  )
                }
              />
              <Row label="Scope" value={p.tags.join(", ")} />
            </dl>
            <ul className="mt-7 space-y-2.5">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm leading-relaxed text-ink/65">
                  <span aria-hidden className="mt-2 h-1 w-3 shrink-0 bg-accent" />
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* Live preview */}
      <Section className="pt-20 md:pt-28">
        <Reveal>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {p.liveUrl ? "Live preview" : "Preview"}
            </h2>
            <p className="max-w-xs text-right font-mono text-[11px] uppercase leading-relaxed tracking-widest text-ink/40">
              {p.liveUrl
                ? "Rendered at desktop width · click Interact to explore"
                : "Captured from the shipped build"}
            </p>
          </div>
          <LivePreview project={p} priority />
        </Reveal>
      </Section>

      {/* Screens */}
      {shots.length > 1 && (
        <Section className="pt-24 md:pt-32">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Screens
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {shots.map((src, i) => (
              <Reveal key={src} delay={i * 0.08}>
                {/* native aspect, contained — these sources are only ~1536px wide */}
                <figure className="overflow-hidden rounded-2xl border border-mist/70 bg-surface">
                  <div className="relative aspect-[1536/743]">
                    <Image
                      src={src}
                      alt={`${p.name} — screen ${i + 1}`}
                      fill
                      quality={90}
                      sizes="(max-width: 768px) 100vw, 48vw"
                      className="object-cover object-top"
                    />
                  </div>
                </figure>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Prev / next */}
      <Section className="pt-24 md:pt-32">
        <div className="grid gap-4 border-t border-mist/70 pt-10 sm:grid-cols-2">
          {prev && <Neighbour project={prev} dir="prev" />}
          {next && <Neighbour project={next} dir="next" />}
        </div>
      </Section>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-slatey">
        {label}
      </dt>
      <dd className="text-right text-sm text-ink/75">{value}</dd>
    </div>
  );
}

function Neighbour({
  project,
  dir,
}: {
  project: { slug: string; name: string; category: string };
  dir: "prev" | "next";
}) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      data-cursor
      className={`group rounded-2xl border border-mist/70 bg-surface p-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-mist ${
        dir === "next" ? "sm:text-right" : ""
      }`}
    >
      <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
        {dir === "prev" ? "← Previous" : "Next →"}
      </span>
      <p className="mt-2 font-display text-xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-accent">
        {project.name}
      </p>
      <p className="mt-1 text-sm text-ink/50">{project.category}</p>
    </Link>
  );
}
