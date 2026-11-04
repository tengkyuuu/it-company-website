// Hero-sized copies of the project screenshots: public/work/hero/<name>.webp
// The hero's curved reel pre-fetches every tile, and the sources include 500–800 KB
// PNGs, so it gets ~1000px WebP derivatives instead (~30–70 KB each; tiles render
// ≈ 240px tall, so 1000px wide is still 2x). Re-run after adding a screenshot:
//   node scripts/build-hero-shots.mjs
// sharp ships with Next, so this needs nothing extra.
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, parse } from "node:path";

const SRC = "public/work";
const OUT = join(SRC, "hero");
const W = 1000;
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const f of readdirSync(SRC)) {
  const p = join(SRC, f);
  if (!statSync(p).isFile() || !/\.(png|webp|jpe?g)$/i.test(f)) continue;
  const out = join(OUT, parse(f).name + ".webp");
  await sharp(p).resize({ width: W, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
  const kb = statSync(out).size / 1024;
  total += kb;
  console.log(`${f.padEnd(34)} → ${kb.toFixed(0)} KB`);
}
console.log(`total ${(total / 1024).toFixed(2)} MB`);
