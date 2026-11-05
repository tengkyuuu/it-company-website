// Generates the favicon and the PWA icons from the brand monogram.
//
//   node scripts/build-icons.mjs
//
// The Ignition emblem (public/brand/monogram.svg, built by
// scripts/build-brand.mjs) in flat brand
// paper with a flat gold spark on near-black. The full lockup is ~5:1 and
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

const BG = "#0c0a09"; // the Preloader's splash colour
const ACCENT = "#D4AF37";

// The monogram is one <path> in a viewBox cropped to its ink (plus a hair of
// padding), so the viewBox IS the bounding box to centre by.
const svg = await readFile(path.join(root, "public", "brand", "monogram.svg"), "utf8");
const d = svg.match(/\sd="([^"]+)"/)?.[1];
const sparkD = [...svg.matchAll(/\sd="([^"]+)"/g)][1]?.[1];
const microSvg = await readFile(path.join(root, "public", "brand", "monogram-micro.svg"), "utf8");
const microD = microSvg.match(/\sd="([^"]+)"/)?.[1];
const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
if (!d || vb?.length !== 4) throw new Error("public/brand/monogram.svg: no path / viewBox");
const box = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };

/** A 512×512 icon with the mark `markWidth` px wide (it is wider than tall),
 *  centred. */
function iconSvg({ markWidth, rounded, micro = false }) {
  const s = markWidth / box.w;
  const tx = (512 - box.w * s) / 2 - box.x * s;
  const ty = (512 - box.h * s) / 2 - box.y * s;
  const tile = rounded
    ? `<rect width="512" height="512" rx="112" fill="${BG}"/>`
    : `<rect width="512" height="512" fill="${BG}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${tile}
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})">
    <path fill="${micro ? ACCENT : '#FAFAF9'}" fill-rule="evenodd" d="${micro ? microD : d}"/>
    ${micro ? '' : `<path fill="${ACCENT}" d="${sparkD}"/>`}
  </g>
</svg>`;
}

// Multi-size PNG-compressed ICO, supported by current browsers and Windows.
const sizes = [16, 32, 48];
const buffers = await Promise.all(sizes.map(size => sharp(Buffer.from(iconSvg({ markWidth: 390, rounded: false, micro: true }))).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
buffers.forEach((buffer, i) => {
  const at = 6 + i * 16;
  header[at] = sizes[i]; header[at + 1] = sizes[i];
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(buffer.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += buffer.length;
});
const ico = Buffer.concat([header, ...buffers]);
await writeFile(path.join(root, 'app/favicon.ico'), ico);
await writeFile(path.join(root, 'public/brand/myktech/favicon.ico'), ico);

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
  const kitIcons = path.join(root, 'public/brand/myktech/app-icons');
  await mkdir(kitIcons, { recursive: true });
  await writeFile(path.join(kitIcons, path.basename(file)), png);
  console.log(
    `${path.relative(root, file).replaceAll("\\", "/")}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`
  );
}
