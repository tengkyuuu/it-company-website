import Link from "next/link";
import Button from "./Button";
import KeySwitch from "./fx/KeySwitch";
import LocalTime from "./fx/LocalTime";
import BackToTop from "./fx/BackToTop";
import FooterWordmark from "./FooterWordmark";
import { Reveal } from "./Reveal";
import { nav } from "@/lib/site";
import { services } from "@/lib/services";
import { getSiteContent } from "@/lib/cms";

export default async function Footer() {
  // editable in the admin panel; falls back to lib/site.ts when there's no DB
  const site = await getSiteContent();
  const socials = site.socials;

  return (
    <footer className="band relative mt-24 overflow-hidden bg-ink text-paper grain">
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
          <div className="flex shrink-0 items-center gap-6">
            <KeySwitch size={54} tint="red" className="hidden sm:block" />
            <Button href="/location" arrow>
              Start a project
            </Button>
          </div>
        </Reveal>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-10 py-14 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="max-w-xs text-sm leading-relaxed text-paper/60">
              {site.name} is an IT studio building web, mobile, and cloud
              products — with the care of a design house.
            </p>
            {site.availability && (
              <p className="mt-5 inline-flex items-center gap-2.5 text-sm text-paper/75">
                <span className="relative flex h-2 w-2" aria-hidden>
                  {site.available && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-to opacity-70 motion-reduce:animate-none" />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      site.available ? "bg-accent-to" : "bg-paper/40"
                    }`}
                  />
                </span>
                {site.availability}
              </p>
            )}
            <p className="mt-3 font-mono text-xs uppercase tracking-widest text-paper/40">
              {site.hours} · <LocalTime />
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

        {/* Giant wordmark — inks in with the gradient under the cursor */}
        <div className="pt-6">
          <FooterWordmark />
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 py-8">
          <div className="flex flex-col items-center justify-between gap-6 text-sm text-paper/50 md:flex-row">
            <p>
              © {2026} {site.name} Studio. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {socials.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.label} (opens in a new tab)`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-paper/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:text-paper"
                >
                  {s.label}
                  <span
                    aria-hidden
                    className="inline-block text-paper/40 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  >
                    ↗
                  </span>
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-5">
              <p className="font-mono text-xs uppercase tracking-widest text-paper/40">
                Designed in Dipolog ✦
              </p>
              <BackToTop />
            </div>
          </div>
          <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-paper/35">
            Developed by <span className="text-paper/70">mykTech()</span> · for{" "}
            <span className="text-paper/70">mykTech()</span>
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
      className="group inline-flex w-fit items-center text-sm text-paper/75 transition-[color,transform] duration-300 hover:translate-x-0.5 hover:text-paper"
    >
      <span className="relative">
        {children}
        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full" />
      </span>
    </Link>
  );
}
