import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { heroShots, heroSrc } from "@/lib/hero-shots";
import { projects } from "@/lib/work";

// The hero's curved reel loads these hero-sized copies (scripts/build-hero-shots.mjs).
// A missing one is a silent blank tile — OneDrive has eaten files in public/work before.
describe("hero shots", () => {
  it("maps /work/x.png to its hero-sized webp, and leaves other URLs alone", () => {
    expect(heroSrc("/work/rallys-equities.png")).toBe("/work/hero/rallys-equities.webp");
    expect(heroSrc("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("every static project screenshot has its derivative on disk", () => {
    for (const s of heroShots(projects)) {
      if (!s.src.startsWith("/work/")) continue;
      expect(existsSync(join(process.cwd(), "public", s.src)), s.src).toBe(true);
    }
  });

  it("interleaves projects so neighbouring tiles differ", () => {
    const shots = heroShots(projects);
    expect(shots.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < shots.length; i++) expect(shots[i].alt).not.toBe(shots[i - 1].alt);
  });
});
