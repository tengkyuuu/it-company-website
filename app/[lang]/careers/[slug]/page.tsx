import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Section, { Eyebrow } from "@/components/Section";
import Button from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import KeySwitch from "@/components/fx/KeySwitch";
import ApplyForm, { type ApplyStrings } from "@/components/catalog/ApplyForm";
import { BackLink, Badge } from "@/components/catalog/parts";
import { formatDay, jobLabels, paragraphs } from "@/components/catalog/format";
import { getJobBySlug, getJobs, getSiteContent, type Job } from "@/lib/cms";
import { isLocale, toLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { localeMetadata } from "@/lib/i18n/metadata";
import { localizePath } from "@/lib/i18n/paths";

type Params = { params: Promise<{ lang: string; slug: string }> };

// Open roles are prerendered in both languages. dynamicParams stays at its
// default (true) ON PURPOSE: a role published after the deploy — or a closed
// one behind an old link, which getJobs() leaves out — renders on demand.
export async function generateStaticParams() {
  const jobs = await getJobs();
  return jobs.map((j) => ({ slug: j.slug }));
}

// "Closed" is decided at render time (Asia/Manila calendar), so a prerendered
// role must re-render at least hourly or it would keep offering the form
// after its last day. /api/apply re-checks regardless.
export const revalidate = 3600;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = toLocale(rawLang);
  const job = await getJobBySlug(slug);
  if (!job) return { title: getDictionary(lang).t("job.notFound") };
  return {
    title: job.title,
    description: job.summary || undefined,
    // a closed role still explains itself to an old link, but isn't indexed
    ...(job.closed ? { robots: { index: false, follow: true } } : {}),
    ...localeMetadata(lang, `/careers/${job.slug}`, {
      title: job.title,
      description: job.summary || undefined,
    }),
  };
}

/**
 * A role: header with the facts rail (like a project's spec rail), then the
 * role as label-left / content-right beats, then the inline application form
 * (#apply). A closed role keeps its description — useful context for a stale
 * link — but the form is replaced by a "this role has closed" panel.
 */
export default async function JobPage({ params }: Params) {
  const { lang: rawLang, slug } = await params;
  if (!isLocale(rawLang)) notFound();
  const lang: Locale = rawLang;
  const dict = getDictionary(lang);
  const { t } = dict;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const labels = jobLabels(t);
  const closesLabel = job.closesAt ? formatDay(job.closesAt, lang) : "";
  const about = paragraphs(job.description);

  const beats = [
    about.length ? { label: t("job.about"), body: <Prose paras={about} /> } : null,
    job.responsibilities.length
      ? { label: t("job.responsibilities"), body: <Bullets items={job.responsibilities} /> }
      : null,
    job.requirements.length
      ? { label: t("job.requirements"), body: <Bullets items={job.requirements} /> }
      : null,
  ].filter((b): b is { label: string; body: React.JSX.Element } => b !== null);

  return (
    <>
      {/* Header */}
      <Section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          className="pointer-events-none absolute -right-10 -top-4 h-72 w-72 opacity-40 aurora"
          aria-hidden
        />
        <Reveal>
          <BackLink href={localizePath(lang, "/careers")}>{t("job.back")}</BackLink>
        </Reveal>

        <div className="mt-8 grid gap-12 md:grid-cols-12 md:gap-14">
          <Reveal className="md:col-span-7">
            <p className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-slatey">
              {[job.department, job.location].filter(Boolean).join(" · ") || t("careers.eyebrow")}
              {job.closed && <Badge>{t("job.closedBadge")}</Badge>}
            </p>
            <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              {job.title}
            </h1>
            {job.summary && (
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ink/65">
                {job.summary}
              </p>
            )}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {job.closed ? (
                <Button href={localizePath(lang, "/careers")} arrow>
                  {t("job.closedCta")}
                </Button>
              ) : (
                <Button href="#apply" arrow>
                  {t("job.applyNow")}
                </Button>
              )}
              <KeySwitch size={46} tint="gold" className="hidden sm:block" />
            </div>
          </Reveal>

          {/* facts rail */}
          <Reveal delay={0.1} className="md:col-span-5 md:col-start-8">
            <dl className="divide-y divide-mist/70 border-y border-mist/70">
              {job.department && <Row label={t("job.team")} value={job.department} />}
              {job.location && <Row label={t("job.location")} value={job.location} />}
              <Row label={t("job.type")} value={labels.type[job.employmentType]} />
              <Row label={t("job.workplace")} value={labels.workplace[job.workplace]} />
              <Row
                label={t("job.closes")}
                value={
                  job.closed ? (
                    <span className="text-ink/45 line-through decoration-mist">{closesLabel}</span>
                  ) : (
                    closesLabel || t("job.openEnded")
                  )
                }
              />
            </dl>
          </Reveal>
        </div>
      </Section>

      {/* The role — label left, content right */}
      {beats.length > 0 && (
        <Section className="pt-20 md:pt-28">
          <div className="divide-y divide-mist/70 border-y border-mist/70">
            {beats.map((b, i) => (
              <Reveal key={b.label} className="grid gap-4 py-10 md:grid-cols-12 md:gap-14">
                <div className="md:col-span-4">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slatey">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mt-2 font-display text-xl font-semibold tracking-tight md:text-2xl">
                    {b.label}
                  </h2>
                </div>
                <div className="md:col-span-8">{b.body}</div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* Apply — or the closed state */}
      <Section id="apply" className="scroll-mt-24 pt-24 md:pt-32">
        {job.closed ? (
          <ClosedPanel lang={lang} dict={dict} closesLabel={closesLabel} />
        ) : (
          <div className="grid gap-12 md:grid-cols-12 md:gap-14">
            <Reveal className="md:col-span-5">
              <Eyebrow>{t("apply.eyebrow")}</Eyebrow>
              <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {t("apply.title")}
              </h2>
              <p className="mt-4 max-w-sm text-pretty text-lg leading-relaxed text-ink/60">
                {t("apply.intro")}
              </p>
              <p className="mt-6 flex max-w-sm gap-3 border-t border-mist/70 pt-5 text-sm leading-relaxed text-ink/55">
                <span aria-hidden className="mt-0.5 font-mono text-slatey">
                  ↗
                </span>
                {t("apply.noUploads")}
              </p>
            </Reveal>
            <Reveal delay={0.08} className="md:col-span-7">
              <ApplyForm jobId={job.id} strings={await applyStrings(dict, job)} />
            </Reveal>
          </div>
        )}
      </Section>
    </>
  );
}

/** Every string the client form needs, rendered here in the page's language. */
async function applyStrings({ t }: Dictionary, job: Job): Promise<ApplyStrings> {
  const { email } = await getSiteContent();
  return {
    name: t("apply.name"),
    namePlaceholder: t("apply.namePlaceholder"),
    email: t("apply.email"),
    emailPlaceholder: t("apply.emailPlaceholder"),
    phone: t("apply.phone"),
    optional: t("apply.optional"),
    phonePlaceholder: t("apply.phonePlaceholder"),
    links: t("apply.links"),
    linksHint: t("apply.linksHint"),
    linksPlaceholder: t("apply.linksPlaceholder"),
    message: t("apply.message"),
    messagePlaceholder: t("apply.messagePlaceholder"),
    submit: t("apply.submit"),
    sending: t("apply.sending"),
    privacy: t("apply.privacy"),
    successTitle: t("apply.successTitle"),
    successBody: t("apply.successBody", { role: job.title }),
    fields: {
      name: t("apply.errName"),
      email: t("apply.errEmail"),
      phone: t("apply.errPhone"),
      links: t("apply.errLinks"),
      message: t("apply.errMessage"),
    },
    codes: {
      request: t("apply.errRequest"),
      rate: t("apply.errRate"),
      busy: t("apply.errBusy", { email }),
      closed: t("apply.errClosed"),
      server: t("apply.errServer", { email }),
    },
    network: t("apply.errNetwork", { email }),
  };
}

function ClosedPanel({
  lang,
  dict: { t },
  closesLabel,
}: {
  lang: Locale;
  dict: Dictionary;
  closesLabel: string;
}) {
  return (
    <Reveal className="relative overflow-hidden rounded-[2rem] border border-dashed border-mist bg-surface/60 px-7 py-14 md:px-14 md:py-20">
      <div className="max-w-xl">
        <Badge>{t("job.closedBadge")}</Badge>
        <h2 className="mt-5 text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {t("job.closedTitle")}
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-ink/60">
          {closesLabel && <>{t("job.closedOn", { date: closesLabel })} </>}
          {t("job.closedBody")}
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Button href={localizePath(lang, "/careers")} arrow>
            {t("job.closedCta")}
          </Button>
          <Button href={localizePath(lang, "/location")} variant="outline">
            {t("job.closedContact")}
          </Button>
        </div>
      </div>
    </Reveal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3.5">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-slatey">{label}</dt>
      <dd className="text-right text-sm text-ink/75">{value}</dd>
    </div>
  );
}

function Prose({ paras }: { paras: string[] }) {
  return (
    <div className="space-y-4">
      {paras.map((p, i) => (
        <p key={i} className="max-w-2xl text-pretty text-lg leading-relaxed text-ink/70">
          {p}
        </p>
      ))}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="max-w-2xl space-y-3">
      {items.map((item, i) => (
        <li key={`${i}-${item}`} className="flex gap-4 text-lg leading-relaxed text-ink/70">
          <span aria-hidden className="mt-[0.8em] h-px w-4 shrink-0 bg-ink/40" />
          {item}
        </li>
      ))}
    </ul>
  );
}
