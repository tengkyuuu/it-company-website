/**
 * Builds the "R Ally's Tech" wordmark as OUTLINED SVG PATHS.
 *
 *   node scripts/build-wordmark.mjs
 *
 * Why outlines instead of live web text: the brand is a ransom-note lockup —
 * every glyph in a different typeface. Setting that as text would mean shipping
 * ~10 font families to every visitor, and it would break the three places the
 * site paints the mark through a CSS mask (Logo, the footer's gradient fill,
 * and the Preloader's light-sweep clip, which is clipped to the letterforms).
 * Converting each glyph to a path once, at build time, keeps all of that intact,
 * costs the visitor zero font downloads, and — unlike the old raster mark —
 * scales to any size, so the ~820px blur cap goes away.
 *
 * Outputs (both consumed as CSS masks, so only their alpha matters):
 *   public/brand/wordmark.svg          filled silhouette
 *   public/brand/wordmark-outline.svg  same paths, stroked only — a real ring
 *
 * Needs `npm install --no-save opentype.js` (deliberately not a dependency —
 * it is build-time only and would otherwise bloat the Vercel install).
 *
 * TO RESTYLE: edit LOCKUP below. Each entry is one glyph and its typeface.
 * Every family must exist on Google Fonts. Re-run, then check the printed
 * aspect ratio against `aspect-ratio` in globals.css (.wm/.wm-outline).
 */
import opentype from "opentype.js";
import { writeFileSync } from "node:fs";

/* ---------------------------------------------------------------------------
   The lockup. One entry per glyph, in order. `gap` (px, pre-scale) adds space
   BEFORE that glyph — used for the word breaks and optical kerning.
--------------------------------------------------------------------------- */
const LOCKUP = [
  { char: "R", family: "Abril Fatface" },      // fat high-contrast display serif
  { char: "A", family: "Bebas Neue", gap: 150 }, // tall condensed sans (word break)
  { char: "l", family: "Courier Prime" },       // typewriter mono
  { char: "l", family: "Playfair Display" },    // elegant serif — the two l's differ
  { char: "y", family: "Pacifico" },            // script, with a descender
  { char: "'", family: "Playfair Display" },    // punctuation reads best as serif
  { char: "s", family: "Righteous" },           // geometric display
  { char: "T", family: "Archivo Black", gap: 150 }, // heavy grotesque (word break)
  { char: "e", family: "Caveat" },              // handwriting
  { char: "c", family: "Zilla Slab" },          // slab serif
  { char: "h", family: "Lobster" },             // bold script
];

/** Every glyph is scaled so its font's CAP HEIGHT equals this. Keeps wildly
 *  different faces optically consistent instead of one dwarfing the next. */
const TARGET_CAP = 700;
/** Default space between glyph ink boxes (pre-scale units). */
const TRACKING = 34;
/** Ring thickness for the outline variant, in final viewBox units. */
const STROKE = 14;
/** Padding around the ink box so a stroke is never clipped by the viewBox. */
const PAD = 20;

/* ---------------------------------------------------------------------------
   Font fetching. The css2 endpoint hands back a TTF url for a plain UA; woff2
   would need extra decompression, and opentype.js reads TTF directly.
--------------------------------------------------------------------------- */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const fontCache = new Map();

async function loadFont(family) {
  if (fontCache.has(family)) return fontCache.get(family);
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}`,
    { headers: { "User-Agent": UA } }
  ).then((r) => {
    if (!r.ok) throw new Error(`Google Fonts returned ${r.status} for "${family}"`);
    return r.text();
  });

  const url = css.match(/url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`No TTF url in the css for "${family}"`);

  const buf = await fetch(url, { headers: { "User-Agent": UA } }).then((r) =>
    r.arrayBuffer()
  );
  const font = opentype.parse(buf);
  fontCache.set(family, font);
  return font;
}

/** A font's cap height in its own em units — from OS/2 when present, else the
 *  measured height of "H" (some display faces ship a zero/absent sCapHeight). */
function capHeightOf(font) {
  const declared = font.tables.os2?.sCapHeight;
  if (declared && declared > 0) return declared;
  const h = font.charToGlyph("H");
  const bb = h?.getBoundingBox?.();
  if (bb && bb.y2 > bb.y1) return bb.y2 - bb.y1;
  return font.unitsPerEm * 0.7; // last resort
}

/* ---------------------------------------------------------------------------
   Build
--------------------------------------------------------------------------- */
const placed = [];
let cursor = 0;

for (const entry of LOCKUP) {
  const font = await loadFont(entry.family);
  const scale = TARGET_CAP / capHeightOf(font);
  // getPath at the font's own em size, then scale — so hinting/units cancel out
  const path = font.getPath(entry.char, 0, 0, font.unitsPerEm);
  const cmds = path.commands;
  if (!cmds.length) throw new Error(`"${entry.char}" is empty in ${entry.family}`);

  // apply the cap-height scale; note getPath's y already grows DOWNWARD
  for (const c of cmds) {
    for (const k of ["x", "y", "x1", "y1", "x2", "y2"]) {
      if (c[k] !== undefined) c[k] *= scale;
    }
  }

  const bb = path.getBoundingBox();
  cursor += entry.gap ?? (placed.length ? TRACKING : 0);
  // shift so this glyph's ink starts exactly at the cursor
  const dx = cursor - bb.x1;
  for (const c of cmds) {
    if (c.x !== undefined) c.x += dx;
    if (c.x1 !== undefined) c.x1 += dx;
    if (c.x2 !== undefined) c.x2 += dx;
  }

  placed.push({ ...entry, path, box: { ...bb, x1: bb.x1 + dx, x2: bb.x2 + dx } });
  cursor = bb.x2 + dx;
}

// overall ink box across every glyph
const minX = Math.min(...placed.map((p) => p.box.x1));
const maxX = Math.max(...placed.map((p) => p.box.x2));
const minY = Math.min(...placed.map((p) => p.box.y1));
const maxY = Math.max(...placed.map((p) => p.box.y2));

// normalise so the viewBox starts at 0,0 with PAD breathing room
const offX = PAD - minX;
const offY = PAD - minY;
const w = Math.ceil(maxX - minX + PAD * 2);
const h = Math.ceil(maxY - minY + PAD * 2);

const d = placed
  .map((p) => {
    for (const c of p.path.commands) {
      for (const k of ["x", "x1", "x2"]) if (c[k] !== undefined) c[k] += offX;
      for (const k of ["y", "y1", "y2"]) if (c[k] !== undefined) c[k] += offY;
    }
    return p.path.toPathData(3);
  })
  .join(" ");

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>\n`;

writeFileSync(
  "public/brand/wordmark.svg",
  svg(`<path d="${d}" fill="#000" fill-rule="nonzero"/>`)
);
writeFileSync(
  "public/brand/wordmark-outline.svg",
  svg(
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${STROKE}" stroke-linejoin="round"/>`
  )
);

console.log("wrote public/brand/wordmark.svg + wordmark-outline.svg");
console.log(`viewBox      : 0 0 ${w} ${h}`);
console.log(`aspect-ratio : ${w} / ${h}   (${(w / h).toFixed(4)})`);
console.log(`path length  : ${d.length} chars`);
console.log("\nglyph        family                 ink width");
for (const p of placed) {
  console.log(
    `  ${p.char.padEnd(4)}       ${p.family.padEnd(20)}  ${Math.round(p.box.x2 - p.box.x1)}`
  );
}
