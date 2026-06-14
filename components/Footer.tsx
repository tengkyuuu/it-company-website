import Link from "next/link";
import Button from "./Button";
import { Reveal } from "./Reveal";
import { nav, site, socials } from "@/lib/site";
import { services } from "@/lib/services";

export default function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-paper grain">
      {/* soft accent glow */}
      <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full opacity-40 aurora" />

      <div className="relative mx-auto max-w-6xl px-6 pt-20">
        {/* CTA band */}
        <Reveal className="flex flex-col items-start justify-between gap-8 border-b border-white/10 pb-14 md:flex-row md:items-end">
          <h2 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Let’s build something
            <br />
            worth <span className="text-accent">shipping.</span>
          </h2>
          <Button href="/location" arrow className="shrink-0">
            Start a project
          </Button>
        </Reveal>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="max-w-xs text-sm leading-relaxed text-paper/60">
              {site.name} is an IT studio building web, mobile, and cloud
              products — with the care of a design house.
            </p>
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-paper/40">
              {site.hours}
            </p>
          </div>

          <FooterCol title="Sitemap">
            {nav.map((n) => (
              <FooterLink key={n.href} href={n.href}>
                {n.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Services">
            {services.slice(0, 5).map((s) => (
              <FooterLink key={s.slug} href="/services">
                {s.title}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Say hello">
            <FooterLink href={`mailto:${site.email}`}>{site.email}</FooterLink>
            <FooterLink href={`tel:${site.phone.replace(/\s/g, "")}`}>
              {site.phone}
            </FooterLink>
            <p className="text-sm leading-relaxed text-paper/60">
              {site.address.line1}
              <br />
              {site.address.line2}
            </p>
          </FooterCol>
        </div>

        {/* Giant wordmark */}
        <div className="relative">
          <div
            aria-hidden
            className="select-none pt-6 text-center text-[22vw] font-bold leading-[0.8] tracking-tighter text-paper/[0.06] md:text-[16rem]"
          >
            MYK<span className="text-accent opacity-90">T</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-7 text-sm text-paper/50 md:flex-row">
          <p>
            © {2026} {site.name} Studio. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {socials.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="transition-colors hover:text-paper"
              >
                {s.label}
              </Link>
            ))}
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-paper/40">
            Designed in Dipolog ✦
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-xs uppercase tracking-widest text-paper/40">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center text-sm text-paper/75 transition-colors hover:text-paper"
    >
      <span className="relative">
        {children}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full" />
      </span>
    </Link>
  );
}
