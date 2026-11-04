import type { Metadata } from "next";
import Section, { SectionHeader, Eyebrow } from "@/components/Section";
import ContactForm from "@/components/ContactForm";
import LocalTime from "@/components/fx/LocalTime";
import { Reveal } from "@/components/Reveal";
import { site, socials } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { pageLocale, toLocale, type LangParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: LangParams): Promise<Metadata> {
  const lang = toLocale((await params).lang);
  return {
    title: getDictionary(lang).t("meta.location"),
    description:
      "Start a project with MykTech — an IT studio in Dipolog City, Zamboanga del Norte, working with clients in the Philippines and abroad.",
    ...localeMetadata(lang, "/contact"),
  };
}

const mapSrc =
  "https://maps.google.com/maps?q=Dipolog+City+Zamboanga+del+Norte&t=m&z=14&output=embed";

export default async function ContactPage({ params }: LangParams) {
  const lang = await pageLocale(params);
  const { t } = getDictionary(lang);

  // phone and email are optional — lib/site.ts ships neither (no domain yet)
  const details = [
    { label: t("location.studio"), lines: [site.address.line1, site.address.line2] },
    ...(site.phone ? [{ label: t("location.phone"), lines: [site.phone] }] : []),
    { label: t("location.hours"), lines: [site.hours] },
  ];

  return (
    <>
      {/* Form first: the header sits beside it, so the form is above the fold.
          #contact is the target for footer/CTA links; scroll-mt clears the nav. */}
      <Section className="grid items-start gap-12 pt-36 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:pt-44">
        <div className="md:sticky md:top-32">
          <SectionHeader
            as="h1"
            eyebrow={t("location.eyebrow")}
            title={
              <>
                {t("location.titleLine1")} {t("location.titleLine2")}{" "}
                <span className="text-accent">{t("location.titleAccent")}</span>
              </>
            }
            intro="Tell us a little about your project and we’ll get back within one business day."
          />
          {site.email && (
            <a
              href={`mailto:${site.email}`}
              className="mt-8 inline-block break-all text-lg text-ink underline decoration-mist underline-offset-4 transition-colors hover:decoration-ink"
            >
              {site.email}
            </a>
          )}
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.25em] text-slatey">
            {t("location.localTime")} · <LocalTime />
          </p>

          {/* What happens next — read before sending (confirmed 2026-11-04) */}
          <div className="mt-12 border-t border-mist pt-8">
            <Eyebrow>{t("location.nextEyebrow")}</Eyebrow>
            <ol className="mt-6 space-y-6">
              {[
                { title: t("location.nextRead"), body: "A person on the team reads every message and replies within one business day." },
                { title: t("location.nextCall"), body: "We ask about your users, your deadline and what “done” looks like. No preparation needed." },
                { title: t("location.nextProposal"), body: "Scope and timeline in plain language. We agree the price once the scope is settled, so the quote matches the work." },
              ].map((step, i) => (
                <li key={i} className="grid grid-cols-[2.25rem_1fr] gap-3">
                  <span className="font-mono text-sm text-slatey">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium text-ink">{step.title}</p>
                    <p className="mt-1 text-pretty leading-relaxed text-ink/65">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div id="contact" className="scroll-mt-28">
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </Section>

      {/* Details + map — supporting facts, below the form */}
      <Section className="grid items-start gap-10 pt-24 md:grid-cols-2 md:pt-32">
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

          {socials.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-slatey">
                {t("location.follow")}
              </span>
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.label} ${t("footer.opensInNewTab")}`}
                  className="text-sm text-ink/70 underline decoration-transparent underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delay={0.1} className="overflow-hidden rounded-[2rem] border border-mist/70">
          <iframe
            title={t("location.mapTitle")}
            src={mapSrc}
            loading="lazy"
            className="h-[300px] w-full grayscale md:h-[340px]"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </Reveal>
      </Section>
    </>
  );
}
