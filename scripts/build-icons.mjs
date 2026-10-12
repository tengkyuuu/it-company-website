// Generates the favicon and the PWA icons from the brand monogram.
//
//   node scripts/build-icons.mjs
//
// The mark is the logo's own R + spark (public/brand/monogram.svg, outlined by
// scripts/build-wordmark.mjs — so no font is needed here) in the accent
// gradient on the opening sequence's #111a24, i.e. "the logo's letter" — the
// one place CLAUDE.md reserves the gradient for. The full lockup is ~3:1 and
// unreadable at launcher sizes; the monogram isn't.
//
//   app/icon.png (512)           the favicon, and the JSON-LD `logo`: rounded tile
//   icon-192.png, icon-512.png   purpose "any": a rounded tile, transparent corners
//   maskable-512.png             purpose "maskable": full-bleed, the mark inside
//                                the central 80% safe-zone circle, so any launcher
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

// The monogram is one <path> in a viewBox cropped to its ink (plus a hair of
// padding), so the viewBox IS the bounding box to centre by.
const svg = await readFile(path.join(root, "public", "brand", "monogram.svg"), "utf8");
const d = svg.match(/\sd="([^"]+)"/)?.[1];
const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
if (!d || vb?.length !== 4) throw new Error("public/brand/monogram.svg: no path / viewBox");
const box = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };

/** A 512×512 icon with the mark `markWidth` px wide (it is wider than tall),
 *  centred. */
function iconSvg({ markWidth, rounded }) {
  const s = markWidth / box.w;
  const tx = (512 - box.w * s) / 2 - box.x * s;
  const ty = (512 - box.h * s) / 2 - box.y * s;
  const tile = rounded
    ? `<rect width="512" height="512" rx="112" fill="${BG}"/>`
    : `<rect width="512" height="512" fill="${BG}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="a" gradientUnits="userSpaceOnUse" x1="96" y1="96" x2="416" y2="416">
      <stop offset="0" stop-color="${ACCENT[0]}"/>
      <stop offset="0.5" stop-color="${ACCENT[1]}"/>
      <stop offset="1" stop-color="${ACCENT[2]}"/>
    </linearGradient>
  </defs>
  ${tile}
  <path fill="url(#a)" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})" d="${d}"/>
</svg>`;
}

// "any": the mark fills ~66% of the tile's width
const anySvg = iconSvg({ markWidth: 340, rounded: true });
// maskable: the mark's bounding box must fit the safe-zone circle (r = 0.4 × 512
// = 204.8 px). At 290 px wide it is ~243 px tall — a half-diagonal of ~189 px.
const fullSvg = iconSvg({ markWidth: 290, rounded: false });

await mkdir(out, { recursive: true });
const jobs = [
  [path.join(root, "app", "icon.png"), anySvg, 512],
  [path.join(out, "icon-192.png"), anySvg, 192],
  [path.join(out, "icon-512.png"), anySvg, 512],
  [path.join(out, "maskable-512.png"), fullSvg, 512],
  [path.join(out, "apple-touch-icon.png"), fullSvg, 180],
];
for (const [file, source, size] of jobs) {
  const png = await sharp(Buffer.from(source), { density: 288 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(file, png);
  console.log(
    `${path.relative(root, file).replaceAll("\\", "/")}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`
  );
}
