"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";

type Project = {
  name: string;
  category: string;
  url: string;
  year: string;
  img: string;
  tags: string[];
  dots: [string, string, string]; // the project's 3 signature colors
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
    dots: ["#7c5cff", "#4f46e5", "#15131f"],
  },
  {
    name: "PhysioPano",
    category: "Healthcare Platform",
    url: "physiopano.com",
    year: "’25",
    img: "/work/physiopano-admin-landing.webp",
    tags: ["Web", "Admin", "Health"],
    dots: ["#22c55e", "#10b981", "#0b1f16"],
  },
  {
    name: "SHM",
    category: "Management Platform",
    url: "shm.app",
    year: "’24",
    img: "/work/shm-landing.webp",
    tags: ["Web App", "Dashboard"],
    dots: ["#3b82f6", "#60a5fa", "#0f1b2e"],
  },
  {
    name: "Rally’s Equities",
    category: "Fintech · Equities",
    url: "rallys-equities.com",
    year: "’24",
    img: "/work/rallys-equities.png",
    tags: ["Web", "Finance", "Charts"],
    dots: ["#16a34a", "#eab308", "#0f1a14"],
  },
  {
    name: "Coffee Shop",
    category: "Ordering Experience",
    url: "coffee.shop",
    year: "’24",
    img: "/work/coffee-shop.png",
    tags: ["Web", "Ordering", "UX"],
    dots: ["#b45309", "#f59e0b", "#3b2417"],
    wide: true,
  },
];

export default function SelectedWork() {
  return (
    <div className="mt-14 grid gap-6 md:grid-cols-2">
      {projects.map((p) => (
        <div
          key={p.name}
          data-animate
          className={`[perspective:1100px] ${p.wide ? "md:col-span-2" : ""}`}
        >
          <WorkCard project={p} />
        </div>
      ))}
    </div>
  );
}

function WorkCard({ project }: { project: Project }) {
  const card = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-6px)`;
  };
  const onLeave = () => {
    if (card.current) card.current.style.transform = "";
  };

  return (
    <div
      ref={card}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="group relative rounded-2xl border border-mist/70 bg-white shadow-[0_10px_40px_-28px_rgba(15,23,42,0.5)] transition-[transform,box-shadow] duration-300 ease-out [transform-style:preserve-3d] will-change-transform hover:shadow-[0_40px_90px_-40px_rgba(15,23,42,0.55)]"
    >
      <Link
        href="/services"
        className="absolute inset-0 z-30"
        aria-label={project.name}
        data-cursor
      />

      {/* accent glow on hover */}
      <div className="pointer-events-none absolute -inset-1.5 -z-10 rounded-[1.75rem] bg-accent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25" />

      {/* browser chrome */}
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-mist/60 bg-gradient-to-b from-white to-paper/70 px-4 py-3">
        <span className="flex items-center gap-1.5">
          {project.dots.map((c, i) => (
            <span
              key={i}
              style={{ background: c }}
              className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_8px_rgba(0,0,0,0.15)]"
            />
          ))}
        </span>
        <span className="ml-3 flex flex-1 items-center justify-center gap-1.5 truncate rounded-md border border-mist/50 bg-paper px-3 py-1 font-mono text-[11px] text-slatey">
          <LockIcon />
          {project.url}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="ml-2 text-slatey"
          aria-hidden
        >
          <path
            d="M4 12a8 8 0 1 1 2.3 5.6M4 12V8m0 4h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* full website preview — aspect matches the capture, so nothing is cut */}
      <div className="relative aspect-[1536/743] overflow-hidden">
        <Image
          src={project.img}
          alt={`${project.name} — ${project.category}`}
          fill
          quality={90}
          sizes={
            project.wide
              ? "(max-width: 768px) 100vw, 1100px"
              : "(max-width: 768px) 100vw, 600px"
          }
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
        {/* glare sweep on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-full" />
      </div>

      {/* footer */}
      <div className="flex items-end justify-between gap-4 rounded-b-2xl p-5 md:p-6">
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
          <span className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            ↗
          </span>
        </span>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" opacity="0.7" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}
