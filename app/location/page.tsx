import type { Metadata } from "next";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import ContactForm from "@/components/ContactForm";
import LocalTime from "@/components/fx/LocalTime";
import KeySwitch from "@/components/fx/KeySwitch";
import { Reveal } from "@/components/Reveal";
import { site, socials } from "@/lib/site";

export const metadata: Metadata = {
  title: "Location & Contact",
  description:
    "Find MYKTECH in Dipolog City, Zamboanga del Norte — or start a conversation with the studio.",
  alternates: { canonical: "/location" },
};

const details = [
  { label: "Studio", lines: [site.address.line1, site.address.line2, site.address.region] },
  { label: "Phone", lines: [site.phone] },
  { label: "Hours", lines: [site.hours] },
];

const mapSrc =
  "https://maps.google.com/maps?q=Dipolog+City+Zamboanga+del+Norte&t=m&z=14&output=embed";

export default function LocationPage() {
  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-2 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <SectionHeader
          eyebrow="Location & Contact"
          title={
            <>
              Let’s talk about
              <br className="hidden md:block" /> what you’re{" "}
              <span className="text-accent">building.</span>
            </>
          }
          intro="Tell us a little about your project and we’ll get back within one business day. Or just drop by the studio — coffee’s on us."
        />

        {/* the typographic moment: one giant address */}
        <Reveal delay={0.1} className="relative mt-14 border-y border-mist/60 py-8 md:py-10">
          <KeySwitch
            size={68}
            tint="plum"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 lg:block"
          />
          <a
            href={`mailto:${site.email}`}
            className="group inline-flex max-w-full flex-wrap items-baseline gap-3"
            data-cursor
          >
            <span className="relative min-w-0 break-all font-display text-[clamp(1.9rem,5.8vw,4.75rem)] font-bold leading-none tracking-tight">
              {site.email}
              <span
                className="absolute -bottom-2 left-0 h-[3px] w-0 bg-accent transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-full"
                aria-hidden
              />
            </span>
            <span
              className="text-2xl text-ink/40 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-ink md:text-4xl"
              aria-hidden
            >
              ↗
            </span>
          </a>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.25em] text-slatey">
            Studio time now · <LocalTime />
          </p>
        </Reveal>
      </Section>

      {/* Contact grid */}
      <Section className="grid items-start gap-10 pt-16 md:grid-cols-2 md:pt-20">
        {/* Details + map */}
        <Reveal className="flex flex-col gap-10">
          <div className="border-y border-mist/70">
            {details.map((d, i) => (
              <div
                key={d.label}
                className={`grid grid-cols-[7rem_1fr] gap-6 py-6 ${
                  i > 0 ? "border-t border-mist/70" : ""
                }`}
              >
                <Eyebrow>{d.label}</Eyebrow>
                <div className="space-y-0.5 text-ink/70">
                  {d.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="group overflow-hidden rounded-[2rem] border border-mist/70">
            <iframe
              title="MYKT studio location — Dipolog City"
              src={mapSrc}
              loading="lazy"
              className="h-[320px] w-full grayscale-[0.55] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015] group-hover:grayscale-0 md:h-[380px]"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-slatey">
              Follow along
            </span>
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.label} (opens in a new tab)`}
                className="group inline-flex items-center text-sm text-ink/70 transition-colors hover:text-ink"
              >
                <span className="relative">
                  {s.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full" />
                </span>
              </a>
            ))}
          </div>
        </Reveal>

        {/* Form */}
        <Reveal delay={0.1}>
          <ContactForm />
        </Reveal>
      </Section>
    </>
  );
}
