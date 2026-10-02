/**
 * Re-encodes the showreel frame sequence in public/brand/reel/.
 *
 *   node scripts/build-reel.mjs [--stride 2] [--width 1280] [--quality 70]
 *
 * The sequence is scrubbed frame-by-frame onto a canvas by VideoReveal, which
 * means every frame we keep is held as a *decoded* bitmap for as long as the
 * page lives. That makes frame COUNT a memory decision, not just a bandwidth
 * one: the original 160 frames at 1600x1200 had a ceiling of
 *   160 x 1600 x 1200 x 4 bytes = ~1.14 GB
 * of bitmap, which is what drove the heap to ~87 MB on a throttled CPU and made
 * the landing page feel heavy. 80 frames at 1280x960 is ~0.37 GB and 2.14 MB on
 * the wire, down from 7.07 MB.
 *
 * Needs `npm install --no-save sharp` if it isn't already present (it is, as a
 * transitive dep of the image pipeline). Reads the CURRENT contents of the reel
 * folder, so running it twice re-encodes the already-reduced set — check the
 * printed source count before trusting a second run.
 *
 * ⚠️ Keep FRAME_COUNT / FRAME_W / FRAME_H in components/landing/VideoReveal.tsx
 * in sync with what this prints.
 */
import sharp from "sharp";
import { readdirSync, mkdirSync, renameSync, rmSync, statSync, existsSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};

const SRC = "public/brand/reel";
const TMP = "public/brand/reel__new";
const OLD = "public/brand/reel__old";

const STRIDE = arg("stride", 2);
const W = arg("width", 1280);
const H = arg("height", Math.round((W * 3) / 4)); // frames are 4:3
const Q = arg("quality", 70);

const src = readdirSync(SRC).filter((f) => /^f-\d+\.webp$/.test(f)).sort();
if (!src.length) {
  console.error(`No f-###.webp frames in ${SRC}`);
  process.exit(1);
}

const before = src.reduce((a, f) => a + statSync(`${SRC}/${f}`).size, 0);
console.log(`source: ${src.length} frames, ${(before / 1048576).toFixed(2)} MB`);
console.log(`target: every ${STRIDE}th frame @ ${W}x${H} q${Q}`);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let n = 0;
let bytes = 0;
for (let i = 0; i < src.length; i += STRIDE) {
  n++;
  const out = `${TMP}/f-${String(n).padStart(3, "0")}.webp`;
  await sharp(`${SRC}/${src[i]}`)
    .resize(W, H, { fit: "cover" })
    .webp({ quality: Q, effort: 5 })
    .toFile(out);
  bytes += statSync(out).size;
}

// swap without deleting anything outright — the previous set is parked next to
// it so a bad encode is one rename away from being undone
rmSync(OLD, { recursive: true, force: true });
renameSync(SRC, OLD);
renameSync(TMP, SRC);

console.log(`\nwrote ${n} frames -> ${SRC}`);
console.log(`  ${(before / 1048576).toFixed(2)} MB  ->  ${(bytes / 1048576).toFixed(2)} MB  (${(100 - (bytes / before) * 100).toFixed(0)}% smaller)`);
console.log(`  avg frame ${(bytes / n / 1024).toFixed(0)} KB`);
console.log(`  decoded bitmap ceiling ~${((n * W * H * 4) / 1073741824).toFixed(2)} GB`);
console.log(`\nprevious frames parked at ${OLD} — delete when happy.`);
console.log(`Now set in components/landing/VideoReveal.tsx:`);
console.log(`  FRAME_COUNT = ${n};  FRAME_W = ${W};  FRAME_H = ${H};`);
if (existsSync(OLD)) console.log(`(and remember ${OLD} is NOT gitignored)`);
