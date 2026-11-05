import Link from "next/link";
import { Eyebrow } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import Parallax from "@/components/fx/Parallax";
import Photo from "@/components/landing/Photo";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localizePath } from "@/lib/i18n/paths";
import type { Locale } from "@/lib/i18n/config";
import { studioPhotos } from "@/lib/photo-slots";
import { countWord } from "@/lib/count-word";

/**
 * "The studio" — the About page's one-paragraph taste on Home, set as an
 * asymmetric editorial spread (after spykercars.com's "Pure Passion"): copy top
 * left, a tall photo on the right that starts lower, a wide one under the copy,
 * the two drifting at different speeds. Facts only: the team count comes from
 * the roster, and the rest is PRODUCT.md's positioning. Long-form copy stays
 * English in both locales; eyebrow and link are chrome.
 */
export default function StudioIntro({ lang, teamSize }: { lang: Locale; teamSize: number }) {
  const { t } = getDictionary(lang);
  const people = countWord(teamSize);

  return (
    <section className="mx-auto max-w-6xl px-6 py-32 md:py-44">
      <div className="grid gap-14 md:grid-cols-12 md:gap-x-8 md:gap-y-0">
        <Reveal className="md:col-span-7">
          <Eyebrow>{t("home.studioEyebrow")}</Eyebrow>
          <h2 className="mt-6 text-balance font-display text-[clamp(2.25rem,4.4vw,4rem)] font-medium leading-[1.02] tracking-[-0.045em]">
            {people ? `${people} people.` : "A small team."} Design and engineering, one team.
          </h2>
          <p className="mt-8 max-w-md text-pretty text-lg leading-relaxed text-ink/65">
            MykTech() is a small studio in Dipolog City. The people who scope your project are the
            people who design and build it.
          </p>
          <Link
            href={localizePath(lang, "/about")}
            className="group mt-10 inline-flex items-center gap-2 text-base font-medium text-ink"
          >
            <span className="border-b border-ink/30 pb-0.5 transition-colors group-hover:border-ink">
              {t("home.studioLink")}
            </span>
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </Reveal>

        {/* tall photo: right, starting lower than the copy */}
        <div className="md:col-span-5 md:col-start-8 md:row-span-2 md:mt-40">
          <Parallax distance={56}>
            <Photo slot={studioPhotos.tall} sizes="(min-width: 768px) 40vw, 90vw" />
          </Parallax>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-slatey">
            Web, mobile, cloud, design, AI and consulting, from one team that stays with the project
            from the first call to launch.
          </p>
        </div>

        {/* wide photo: under the copy, drifting slower */}
        <div className="md:col-span-6 md:mt-24">
          <Parallax distance={24}>
            <Photo slot={studioPhotos.wide} sizes="(min-width: 768px) 48vw, 90vw" />
          </Parallax>
        </div>
      </div>
    </section>
  );
}
