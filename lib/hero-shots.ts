import type { Project } from "@/lib/work";

export type HeroShot = { src: string; alt: string };

/** Captures whose shape is not the 2.07 browser window — stretched into a tile they distort. */
const SKIP = new Set(["/work/physiopano-app.webp"]);

/**
 * A full-size work screenshot maps to its hero-sized derivative (see
 * scripts/build-hero-shots.mjs). Anything else — a CMS upload on another host —
 * is used as is.
 */
export function heroSrc(src: string): string {
  const m = /^\/work\/([^/]+)\.(png|webp|jpe?g)$/i.exec(src);
  return m ? "/work/hero/" + m[1] + ".webp" : src;
}

/**
 * Screenshots for the hero's curved reel, interleaved so neighbouring tiles come
 * from different projects (A1 B1 C1 … then A2 B2 …). Real captures only.
 */
export function heroShots(
  projects: Pick<Project, "name" | "img" | "img2">[]
): HeroShot[] {
  const per = projects.map((p) =>
    [p.img, p.img2]
      .filter((s): s is string => !!s && !SKIP.has(s))
      .map((s) => ({ src: heroSrc(s), alt: p.name }))
  );
  const out: HeroShot[] = [];
  for (let i = 0; i < 2; i++) for (const shots of per) if (shots[i]) out.push(shots[i]);
  return out;
}
