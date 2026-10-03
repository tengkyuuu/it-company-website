// Generates the PWA icons in public/icons/ from the brand wordmark.
//
//   node scripts/build-icons.mjs
//
// The mark is the wordmark's own "R" (Abril Fatface, already outlined by
// scripts/build-wordmark.mjs — so no font is needed here) in the accent
// gradient on the opening sequence's #111a24, i.e. "the logo's letter" — the
// one place CLAUDE.md reserves the gradient for. The full lockup is ~4.6:1 and
// unreadable at launcher sizes; one glyph isn't.
//
//   icon-192.png, icon-512.png   purpose "any": a rounded tile, transparent corners
//   maskable-512.png             purpose "maskable": full-bleed, the R inside the
//                                central 80% safe-zone circle, so any launcher
//                                mask (circle, squircle, teardrop) keeps it whole
//   apple-touch-icon.png (180)   iOS rounds its own corners, so full-bleed too
//
// Uses sharp, which Next.js already installs for image optimisation — no new
// dependency. Re-run after a rebrand (i.e. after build-wordmark.mjs) and commit
// the PNGs.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "icons");

const BG = "#111a24"; // the Preloader's splash colour
const ACCENT = ["#9D5A8F", "#B85C7A", "#E0A23A"]; // --accent-from / -mid / -to

// The wordmark is one <path>; each glyph is one subpath group separated by
// " M" (a glyph's own inner contours follow without a space). The first is R.
const svg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const d = svg.match(/\sd="([^"]+)"/)?.[1];
if (!d) throw new Error("public/brand/wordmark.svg: no path data found");
const glyphR = d.split(/\s(?=M)/)[0];

// bounding box of the glyph (all coordinates, control points included — they
// sit inside the hull of the curves here, so it is tight enough to centre by)
const nums = glyphR.match(/-?\d+(?:\.\d+)?/g).map(Number);
const xs = nums.filter((_, i) => i % 2 === 0);
const ys = nums.filter((_, i) => i % 2 === 1);
const box = {
  x: Math.min(...xs),
  y: Math.min(...ys),
  w: Math.max(...xs) - Math.min(...xs),
  h: Math.max(...ys) - Math.min(...ys),
};

/** A 512×512 icon with the R `glyphHeight` px tall, centred. */
function iconSvg({ glyphHeight, rounded }) {
  const s = glyphHeight / box.h;
  const tx = (512 - box.w * s) / 2 - box.x * s;
  const ty = (512 - box.h * s) / 2 - box.y * s;
  const tile = rounded
    ? `<rect width="512" height="512" rx="112" fill="${BG}"/>`
    : `<rect width="512" height="512" fill="${BG}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT[0]}"/>
      <stop offset="0.5" stop-color="${ACCENT[1]}"/>
      <stop offset="1" stop-color="${ACCENT[2]}"/>
    </linearGradient>
  </defs>
  ${tile}
  <path fill="url(#a)" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})" d="${glyphR}"/>
</svg>`;
}

// "any": the R fills ~58% of the tile's height
const anySvg = iconSvg({ glyphHeight: 300, rounded: true });
// maskable: the R's bounding box must fit the safe-zone circle (r = 0.4 × 512 =
// 204.8 px). At 260 px tall its half-diagonal is ~177 px.
const fullSvg = iconSvg({ glyphHeight: 260, rounded: false });

await mkdir(out, { recursive: true });
const jobs = [
  ["icon-192.png", anySvg, 192],
  ["icon-512.png", anySvg, 512],
  ["maskable-512.png", fullSvg, 512],
  ["apple-touch-icon.png", fullSvg, 180],
];
for (const [name, source, size] of jobs) {
  const png = await sharp(Buffer.from(source), { density: 288 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(out, name), png);
  console.log(`public/icons/${name}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
