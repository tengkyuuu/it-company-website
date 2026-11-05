import Link from "next/link";
import { Eyebrow } from "@/components/Section";
import { Reveal, RevealGroup, RevealItem } from "@/components/Reveal";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localizePath } from "@/lib/i18n/paths";
import type { Locale } from "@/lib/i18n/config";
import type { Project } from "@/lib/work";
import { countWord } from "@/lib/count-word";

/**
 * "Selected work" — Work's taste on Home, as type, not pictures: the project
 * screenshots have exactly two homes (the hero reel and /projects), so here it
 * is the names and the field each one is in, every row a link to its case
 * study. The proof is the range — five shipped platforms in five unrelated
 * fields — which reads at a glance as a list.
 *
 * Hover dims the other rows (CSS only: the list's :hover state) and slides the
 * arrow; nothing animates at rest.
 */
export default function WorkIndex({ lang, projects }: { lang: Locale; projects: Project[] }) {
  const { t } = getDictionary(lang);
  if (projects.length === 0) return null;
  const n = countWord(projects.length);

  return (
    <section className="mx-auto max-w-6xl px-6 py-32 md:py-44">
      <Reveal className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{t("home.workEyebrow")}</Eyebrow>
          <h2 className="mt-6 max-w-3xl text-balance font-display text-[clamp(2.5rem,5.4vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.045em]">
            {n ? `${n} platforms, ${n.toLowerCase()} different fields.` : "Platforms in very different fields."}
          </h2>
        </div>
        <Link
          href={localizePath(lang, "/projects")}
          className="group inline-flex shrink-0 items-center gap-2 text-base font-medium text-ink md:pb-3"
        >
          <span className="border-b border-ink/30 pb-0.5 transition-colors group-hover:border-ink">
            {t("home.workLink")}
          </span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </Reveal>

      <RevealGroup className="group/list mt-16 border-t border-ink md:mt-20">
        {projects.map((p) => (
          <RevealItem key={p.slug}>
            <Link
              href={localizePath(lang, `/projects/${p.slug}`)}
              aria-label={t("home.workOpen", { name: p.name })}
              className="group/row flex flex-col gap-2 border-b border-mist py-7 transition-opacity duration-500 focus:outline-none focus-visible:bg-ink/[0.03] group-hover/list:opacity-35 hover:!opacity-100 md:flex-row md:items-center md:gap-8 md:py-9"
            >
              <span className="font-display text-[clamp(2rem,4.6vw,3.75rem)] font-medium leading-none tracking-[-0.04em] md:flex-1">
                {p.name}
              </span>
              <span className="flex items-center justify-between gap-6 md:justify-end">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slatey">
                  {p.category}
                </span>
                <span
                  aria-hidden
                  className="text-xl text-ink transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/row:translate-x-2"
                >
                  →
                </span>
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
