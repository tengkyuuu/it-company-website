import type { CSSProperties } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import Parallax from "@/components/fx/Parallax";
import Photo from "@/components/landing/Photo";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localizePath } from "@/lib/i18n/paths";
import type { Locale } from "@/lib/i18n/config";
import { collagePhotos } from "@/lib/photo-slots";

/**
 * "Built in Dipolog" — About's "where we work" as a taste on Home, laid out
 * like spykercars.com's heritage collage: one centred message with photos
 * scattered around it at different sizes and depths. Nearer photos are larger,
 * fully opaque and drift further; farther ones are smaller, washed back
 * (opacity over the page colour, so it works in both themes) and drift less.
 *
 * Desktop (md+): an absolutely-positioned field whose height follows its width
 * (aspect ratio), so the percentages below hold at any width. The centre band
 * (x 33–67%, y 50–84%) is kept clear for the copy. Phones: the big photo, the
 * copy, then a three-up strip — no scatter, no drift.
 *
 * Copy is confirmed fact (docs/part-b-copy.md): clients abroad already, the
 * three languages, a reply within one business day.
 */
type Spot = { left: string; top: string; width: string; distance: number; far?: boolean };

// same order as collagePhotos
const SPOTS: Spot[] = [
  { left: "33%", top: "0%", width: "34%", distance: 36 }, // coast — the big one, above the copy
  { left: "3%", top: "10%", width: "15%", distance: 18, far: true },
  { left: "6%", top: "40%", width: "20%", distance: 70 },
  { left: "79%", top: "6%", width: "18%", distance: 22, far: true },
  { left: "72%", top: "44%", width: "13%", distance: 16, far: true },
  { left: "78%", top: "68%", width: "19%", distance: 64 },
  { left: "17%", top: "75%", width: "14%", distance: 20, far: true },
];

export default function DipologCollage({ lang }: { lang: Locale }) {
  const { t } = getDictionary(lang);

  const copy = (
    <>
      <Eyebrow>{t("home.dipologEyebrow")}</Eyebrow>
      <h2 className="mt-6 text-balance font-display text-[clamp(2.25rem,2.9vw,2.75rem)] font-medium leading-[1.04] tracking-[-0.04em]">
        Built in Dipolog. Working everywhere.
      </h2>
      <p className="mx-auto mt-6 max-w-sm text-pretty leading-relaxed text-ink/65">
        We work with local businesses and with teams abroad, in English, Filipino and Bisaya.
        Expect a reply within one business day.
      </p>
      <Link
        href={localizePath(lang, "/about")}
        className="group mt-8 inline-flex items-center gap-2 text-base font-medium text-ink"
      >
        <span className="border-b border-ink/30 pb-0.5 transition-colors group-hover:border-ink">
          {t("home.dipologLink")}
        </span>
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </>
  );

  return (
    <section className="overflow-hidden py-32 md:py-44">
      {/* phones */}
      <div className="px-6 md:hidden">
        <Photo slot={collagePhotos[0]} sizes="90vw" />
        <Reveal className="mt-14 text-center">{copy}</Reveal>
        <div className="mt-14 grid grid-cols-3 gap-3">
          {[collagePhotos[2], collagePhotos[3], collagePhotos[5]].map((slot) => (
            <Photo key={slot.src} slot={slot} sizes="30vw" className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      </div>

      {/* md and up: the scattered field */}
      <div className="relative mx-auto hidden aspect-[4/3] max-w-7xl px-6 md:block lg:aspect-[16/11]">
        {collagePhotos.map((slot, i) => {
          const s = SPOTS[i];
          const style: CSSProperties = { left: s.left, top: s.top, width: s.width };
          return (
            <Parallax
              key={slot.src}
              distance={s.distance}
              className={`absolute ${s.far ? "opacity-45" : ""}`}
              style={style}
            >
              <Photo slot={slot} sizes={`${parseInt(s.width, 10)}vw`} />
            </Parallax>
          );
        })}

        <Reveal className="absolute left-1/2 top-[52%] z-10 w-[38%] -translate-x-1/2 text-center">
          {copy}
        </Reveal>
      </div>
    </section>
  );
}
