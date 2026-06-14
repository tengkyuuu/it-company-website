import type { Metadata } from "next";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import ContactForm from "@/components/ContactForm";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { site, socials } from "@/lib/site";

export const metadata: Metadata = {
  title: "Location & Contact",
  description:
    "Find MYKT in Dipolog City, Zamboanga del Norte — or start a conversation with the studio.",
};

const details = [
  { label: "Studio", lines: [site.address.line1, site.address.line2, site.address.region] },
  { label: "Email", lines: [site.email] },
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
      </Section>

      {/* Contact grid */}
      <Section className="grid items-start gap-8 pt-16 md:grid-cols-2 md:pt-20">
        {/* Details + map */}
        <Reveal className="flex flex-col gap-8">
          <RevealGroup className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-mist/70 bg-mist/50">
            {details.map((d) => (
              <RevealItem key={d.label} className="bg-white p-6">
                <Eyebrow>{d.label}</Eyebrow>
                <div className="mt-3 space-y-0.5 text-ink/70">
                  {d.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </div>
              </RevealItem>
            ))}
          </RevealGroup>

          <div className="overflow-hidden rounded-3xl border border-mist/70">
            <iframe
              title="MYKT studio location — Dipolog City"
              src={mapSrc}
              loading="lazy"
              className="h-[320px] w-full grayscale-[0.2] md:h-[360px]"
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
