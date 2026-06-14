"use client";

import Image from "next/image";
import Link from "next/link";

type Project = {
  name: string;
  category: string;
  url: string;
  year: string;
  img: string;
  tags: string[];
  wide?: boolean;
};

const projects: Project[] = [
  {
    name: "FameCRM",
    category: "CRM Platform",
    url: "famecrm.app",
    year: "’25",
    img: "/work/famecrm-landing.webp",
    tags: ["Web App", "SaaS", "Dashboard"],
  },
  {
    name: "PhysioPano",
    category: "Healthcare Platform",
    url: "physiopano.com",
    year: "’25",
    img: "/work/physiopano-admin-landing.webp",
    tags: ["Web", "Admin", "Health"],
  },
  {
    name: "SHM",
    category: "Management Platform",
    url: "shm.app",
    year: "’24",
    img: "/work/shm-landing.webp",
    tags: ["Web App", "Dashboard"],
  },
  {
    name: "Rally’s Equities",
    category: "Fintech · Equities",
    url: "rallys-equities.com",
    year: "’24",
    img: "/work/rallys-equities.png",
    tags: ["Web", "Finance", "Charts"],
  },
  {
    name: "Coffee Shop",
    category: "Ordering Experience",
    url: "coffee.shop",
    year: "’24",
    img: "/work/coffee-shop.png",
    tags: ["Web", "Ordering", "UX"],
    wide: true,
  },
];

export default function SelectedWork() {
  return (
    <div className="mt-14 grid gap-6 md:grid-cols-2">
      {projects.map((p) => (
        <div key={p.name} data-animate className={p.wide ? "md:col-span-2" : ""}>
          <WorkCard project={p} />
        </div>
      ))}
    </div>
  );
}

function WorkCard({ project }: { project: Project }) {
  return (
    <article className="work-card group relative overflow-hidden rounded-2xl border border-mist/70 bg-white shadow-[0_10px_40px_-26px_rgba(15,23,42,0.45)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_34px_80px_-34px_rgba(15,23,42,0.5)]">
      <Link
        href="/services"
        className="absolute inset-0 z-20"
        aria-label={project.name}
        data-cursor
      />

      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-mist/60 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-mist transition-colors duration-300 group-hover:bg-accent-from" />
        <span className="h-2.5 w-2.5 rounded-full bg-mist transition-colors duration-300 group-hover:bg-accent-mid" />
        <span className="h-2.5 w-2.5 rounded-full bg-mist transition-colors duration-300 group-hover:bg-accent-to" />
        <span className="ml-3 flex-1 truncate rounded-md bg-paper px-3 py-1 text-center font-mono text-[11px] text-slatey">
          {project.url}
        </span>
      </div>

      {/* screenshot window — slow pan reveals the whole page on hover */}
      <div
        className={`relative overflow-hidden bg-ink ${
          project.wide ? "aspect-[2.3/1]" : "aspect-[16/10]"
        }`}
      >
        <Image
          src={project.img}
          alt={`${project.name} — ${project.category}`}
          fill
          quality={92}
          sizes={
            project.wide
              ? "(max-width: 768px) 100vw, 1100px"
              : "(max-width: 768px) 100vw, 580px"
          }
          className="object-cover object-top transition-[object-position] duration-[4000ms] ease-linear group-hover:object-bottom"
        />
      </div>

      {/* footer */}
      <div className="flex items-end justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-slatey">
            {project.category} · {project.year}
          </p>
          <h3 className="mt-1.5 truncate text-xl font-semibold tracking-tight md:text-2xl">
            {project.name}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-mist/70 px-2.5 py-0.5 text-xs text-ink/55"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-mist/70 text-ink transition-all duration-300 group-hover:border-transparent group-hover:bg-accent group-hover:text-ink">
          ↗
        </span>
      </div>
    </article>
  );
}
