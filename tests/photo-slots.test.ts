import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { allPhotoSlots } from "@/lib/photo-slots";
import { countWord } from "@/lib/count-word";

/**
 * The home page's photo slots (lib/photo-slots.ts). These guard the swap-in:
 * a slot pointing at a missing file (or one OneDrive removed) renders a broken
 * image, and a wrong width/height reserves the wrong space and shifts layout.
 */
describe("photo slots", () => {
  it.each(allPhotoSlots.map((s) => [s.src, s] as const))("%s exists with its declared size", async (_src, slot) => {
    const file = path.join(process.cwd(), "public", slot.src);
    expect(existsSync(file)).toBe(true);
    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([slot.width, slot.height]);
  });

  it("marks stand-ins as temporary, and only stand-ins live in /placeholder", () => {
    for (const slot of allPhotoSlots) {
      expect(slot.temporary).toBe(slot.src.startsWith("/placeholder/"));
      expect(slot.alt.trim()).not.toBe("");
      expect(slot.wanted.trim()).not.toBe("");
    }
  });

  it("uses each file once", () => {
    const srcs = allPhotoSlots.map((s) => s.src);
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});

describe("countWord", () => {
  it("spells 2–12 and refuses the rest", () => {
    expect(countWord(5)).toBe("Five");
    expect(countWord(7)).toBe("Seven");
    expect(countWord(12)).toBe("Twelve");
    expect(countWord(1)).toBeNull();
    expect(countWord(13)).toBeNull();
    expect(countWord(2.5)).toBeNull();
  });
});
