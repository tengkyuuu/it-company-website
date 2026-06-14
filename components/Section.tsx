import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-slatey">
      <span className="h-px w-6 bg-accent" />
      {children}
    </span>
  );
}

export default function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-6 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <Reveal
      className={`flex flex-col gap-4 ${
        align === "center" ? "items-center text-center" : "max-w-2xl"
      }`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {intro && (
        <p className="text-pretty text-lg leading-relaxed text-ink/60">
          {intro}
        </p>
      )}
    </Reveal>
  );
}
