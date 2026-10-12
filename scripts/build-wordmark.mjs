/**
 * Builds the "R Ally's Tech" logo as OUTLINED SVG PATHS.
 *
 *   node scripts/build-wordmark.mjs
 *
 * The lockup (the house mark shared with the Rally's sister brands, with the
 * descriptor swapped to TECH):
 *
 *        ██▀▀█▄
 *        ██▄▄█▀  ✦  A L L Y ’ S        one oversized serif R, a four-point
 *        ██ ▀█▄     ─── T E C H ───    spark, the name in tracked serif caps,
 *                                      the descriptor in tracked sans beneath
 *
 * Why outlines instead of live web text: the site paints the mark through a CSS
 * mask in three places (Logo, the footer's gradient fill, and the Preloader's
 * light-sweep, which is clipped to the letterforms), and the spark and the R's
 * hairline are drawn shapes, not glyphs. Converting everything to one path at
 * build time keeps all of that intact, costs the visitor zero font downloads,
 * and scales to any size.
 *
 * Outputs (all consumed as CSS masks or re-coloured, so only alpha matters):
 *   public/brand/wordmark.svg          filled silhouette of the full lockup
 *   public/brand/wordmark-outline.svg  same paths, stroked only — a real ring
 *   public/brand/monogram.svg          just the R + spark, tightly cropped — the
 *                                      source for the favicon / PWA icons
 *                                      (scripts/build-icons.mjs) and offline.html
 *
 * Needs `npm install --no-save opentype.js` (deliberately not a dependency —
 * it is build-time only and would otherwise bloat the Vercel install).
 *
 * TO RESTYLE: edit the constants below. Every family must exist on Google
 * Fonts. Re-run, paste the printed aspect ratio into `aspect-ratio` in
 * globals.css (.wm/.wm-outline and .pl-stage), then run build-icons.mjs.
 */
import opentype from "opentype.js";
import { writeFileSync } from "node:fs";

/* ---------------------------------------------------------------------------
   The design. Everything is in units of the R's cap height (= CAP), with the
   R's baseline at y = 0 and y growing DOWNWARD, so the proportions read
   straight off the artwork.
--------------------------------------------------------------------------- */
const CAP = 1000;

/** The oversized initial. */
const INITIAL = { char: "R", family: "Cinzel", weight: 500 };

/** Thickness of the hairline flick in the R's crook (0 = leave it out). */
const HAIRLINE = 0.016 * CAP;

/** The four-point spark between the R and the name. */
const SPARK = {
  /** gap between the R's bowl and the spark's left tip */
  gap: 0.05 * CAP,
  /** centre height above the R's baseline */
  rise: 0.43 * CAP,
  /** half-height / half-width — slightly taller than wide, as drawn */
  ry: 0.26 * CAP,
  rx: 0.215 * CAP,
  /** how far the concave sides are pulled toward the centre (0 = a diamond) */
  pinch: 0.9,
};

/** The name, in tracked serif caps, sitting just above the R's baseline. */
const WORD = {
  text: "ALLY’S",
  family: "Cinzel",
  weight: 500,
  cap: 0.46 * CAP,
  /** extra space between letters */
  tracking: 0.07 * CAP,
  /** baseline above the R's */
  rise: 0.11 * CAP,
  /** gap between the spark's right tip and the first letter */
  gap: 0.09 * CAP,
};

/** The descriptor: tracked sans caps centred under the name, with a hairline
 *  rule running out to each edge of it. (The sister marks letterspace a long
 *  descriptor across the full width; four letters stretched that far stop
 *  reading as a word, so the rules carry the width instead.) */
const SUB = {
  text: "TECH",
  family: "Geist",
  weight: 500,
  cap: 0.165 * CAP,
  /** extra space between letters */
  tracking: 0.115 * CAP,
  /** clear space between the name's baseline and the descriptor's cap line */
  drop: 0.115 * CAP,
  /** the rules: thickness, and the gap between a rule and the word */
  rule: 0.014 * CAP,
  ruleGap: 0.13 * CAP,
};

/** Ring thickness for the outline variant, in final viewBox units. */
const RING = 6;
/** Padding around the ink box so a stroke is never clipped by the viewBox. */
const PAD = 16;

/* ---------------------------------------------------------------------------
   Font fetching. The css2 endpoint hands back a TTF url for a plain UA; woff2
   would need extra decompression, and opentype.js reads TTF directly. Asking
   for one weight of a variable family returns a static instance.
--------------------------------------------------------------------------- */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const fontCache = new Map();

async function loadFont(family, weight = 400) {
  const key = `${family}:${weight}`;
  if (fontCache.has(key)) return fontCache.get(key);
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { "User-Agent": UA } }
  ).then((r) => {
    if (!r.ok) throw new Error(`Google Fonts returned ${r.status} for "${key}"`);
    return r.text();
  });

  const url = css.match(/url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`No TTF url in the css for "${key}"`);

  const buf = await fetch(url, { headers: { "User-Agent": UA } }).then((r) =>
    r.arrayBuffer()
  );
  const font = opentype.parse(buf);
  fontCache.set(key, font);
  return font;
}

/** A font's cap height in its own em units — measured off a flat-topped "H",
 *  because some display faces ship a zero/absent (or optimistic) sCapHeight. */
function capHeightOf(font) {
  const bb = font.charToGlyph("H")?.getBoundingBox?.();
  if (bb && bb.y2 > bb.y1) return bb.y2 - bb.y1;
  const declared = font.tables.os2?.sCapHeight;
  if (declared && declared > 0) return declared;
  return font.unitsPerEm * 0.7; // last resort
}

/** One glyph as { d, box }, scaled so the font's cap height = `cap`, with its
 *  INK starting at `x` and its baseline on `baseline`. */
function glyph(font, char, cap, x, baseline) {
  const size = (cap / capHeightOf(font)) * font.unitsPerEm;
  const probe = font.getPath(char, 0, 0, size).getBoundingBox();
  const path = font.getPath(char, x - probe.x1, baseline, size);
  if (!path.commands.length) throw new Error(`"${char}" is empty in this font`);
  return { d: toD(path.commands), box: path.getBoundingBox() };
}

const n = (v) => +v.toFixed(2);

/** Path commands → compact path data. Not opentype's own `toPathData()`: its
 *  rounding goes through a string, so a float-error coordinate like 1.1e-13
 *  (where ink lands exactly on x = 0) comes out as the literal text "NaN" and
 *  the renderer silently stops drawing at that point. */
function toD(commands) {
  return commands
    .map((c) => {
      if (c.type === "Z") return "Z";
      const pts = [];
      if (c.type === "C") pts.push(c.x1, c.y1, c.x2, c.y2);
      if (c.type === "Q") pts.push(c.x1, c.y1);
      pts.push(c.x, c.y);
      return c.type + pts.map(n).join(" ");
    })
    .join("");
}

/* ---------------------------------------------------------------------------
   Build. `parts` holds one entry per shape; the R, its hairline and the spark
   together are the monogram.
--------------------------------------------------------------------------- */
const parts = [];

// — the R ————————————————————————————————————————————————————————————————
const initialFont = await loadFont(INITIAL.family, INITIAL.weight);
const R = glyph(initialFont, INITIAL.char, CAP, 0, 0);
parts.push({ name: "R", ...R });

// The bowl's right edge, to hang the spark off: the widest ink in the R's
// upper half (below that the leg kicks out further).
function rightEdgeAbove(d, yLimit) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  let max = -Infinity;
  for (let i = 0; i < nums.length - 1; i += 2) {
    if (nums[i + 1] <= yLimit && nums[i] > max) max = nums[i];
  }
  return max;
}
const bowlRight = rightEdgeAbove(R.d, -0.55 * CAP);

// — the hairline —————————————————————————————————————————————————————————
// The calligraphic flick in the R's crook: a tapered sliver from the foot of
// the stem up into the leg. Both ends are buried in the R's own ink, so it
// reads as part of the letter. Coordinates are fractions of the R, so they
// only hold for INITIAL's typeface — re-place it if that changes.
if (HAIRLINE) {
  const [x0, y0] = [0.2 * CAP, -0.055 * CAP]; // inside the stem, near the foot
  const [x1, y1] = [0.535 * CAP, -0.235 * CAP]; // inside the leg
  const [cx, cy] = [0.41 * CAP, -0.075 * CAP]; // the belly of the curve
  const t = HAIRLINE; // thickness at the belly
  parts.push({
    name: "hair",
    // Out along the upper edge, back along the lower: the same winding as the
    // font's own contours. Drawn the other way round, nonzero fill cancels
    // where the sliver overlaps the R and punches a notch through the leg.
    d:
      `M${n(x0)} ${n(y0)}Q${n(cx - t * 0.35)} ${n(cy - t * 0.65)} ${n(x1)} ${n(y1)}` +
      `Q${n(cx + t * 0.35)} ${n(cy + t * 0.65)} ${n(x0)} ${n(y0)}Z`,
    box: { x1: x0, x2: x1, y1, y2: y0 },
  });
}

// — the spark ————————————————————————————————————————————————————————————
// Four tips joined by curves pulled toward the centre — the concave diamond.
const sx = bowlRight + SPARK.gap + SPARK.rx;
const sy = -SPARK.rise;
const kx = SPARK.rx * (1 - SPARK.pinch);
const ky = SPARK.ry * (1 - SPARK.pinch);
const spark = {
  name: "spark",
  d:
    `M${n(sx)} ${n(sy - SPARK.ry)}` +
    `Q${n(sx + kx)} ${n(sy - ky)} ${n(sx + SPARK.rx)} ${n(sy)}` +
    `Q${n(sx + kx)} ${n(sy + ky)} ${n(sx)} ${n(sy + SPARK.ry)}` +
    `Q${n(sx - kx)} ${n(sy + ky)} ${n(sx - SPARK.rx)} ${n(sy)}` +
    `Q${n(sx - kx)} ${n(sy - ky)} ${n(sx)} ${n(sy - SPARK.ry)}Z`,
  box: { x1: sx - SPARK.rx, x2: sx + SPARK.rx, y1: sy - SPARK.ry, y2: sy + SPARK.ry },
};
parts.push(spark);

// — the name —————————————————————————————————————————————————————————————
// Letters abut by ink box + tracking (not advance widths): at this tracking the
// font's own sidebearings only make the spacing uneven around A, L and Y.
const wordFont = await loadFont(WORD.family, WORD.weight);
const wordStart = Math.max(spark.box.x2, R.box.x2) + WORD.gap;
let cursor = wordStart;
const letters = [];
for (const char of WORD.text) {
  const g = glyph(wordFont, char, WORD.cap, cursor, -WORD.rise);
  letters.push({ name: char, ...g });
  cursor = g.box.x2 + WORD.tracking;
}
parts.push(...letters);
const wordLeft = letters[0].box.x1;
const wordRight = letters.at(-1).box.x2;

// — the descriptor ———————————————————————————————————————————————————————
// Centred under the name; a rule fills the space out to each of its edges.
const subFont = await loadFont(SUB.family, SUB.weight);
const subBaseline = -WORD.rise + SUB.drop + SUB.cap;
const subInk = [...SUB.text].map((c) => {
  const b = glyph(subFont, c, SUB.cap, 0, 0).box;
  return b.x2 - b.x1;
});
const subWidth =
  subInk.reduce((a, b) => a + b, 0) + SUB.tracking * (SUB.text.length - 1);
const subLeft = (wordLeft + wordRight - subWidth) / 2;
const subLetters = [];
cursor = subLeft;
[...SUB.text].forEach((char, i) => {
  subLetters.push({ name: char, ...glyph(subFont, char, SUB.cap, cursor, subBaseline) });
  cursor += subInk[i] + SUB.tracking;
});

const ruleY = subBaseline - SUB.cap / 2 - SUB.rule / 2;
const rule = (x1, x2) => ({
  name: "rule",
  d: `M${n(x1)} ${n(ruleY)}L${n(x2)} ${n(ruleY)}L${n(x2)} ${n(ruleY + SUB.rule)}L${n(x1)} ${n(ruleY + SUB.rule)}Z`,
  box: { x1, x2, y1: ruleY, y2: ruleY + SUB.rule },
});
parts.push(
  rule(wordLeft, subLeft - SUB.ruleGap),
  ...subLetters,
  rule(subLeft + subWidth + SUB.ruleGap, wordRight)
);

/* ---------------------------------------------------------------------------
   Write
--------------------------------------------------------------------------- */
function compose(shapes) {
  const minX = Math.min(...shapes.map((p) => p.box.x1));
  const maxX = Math.max(...shapes.map((p) => p.box.x2));
  const minY = Math.min(...shapes.map((p) => p.box.y1));
  const maxY = Math.max(...shapes.map((p) => p.box.y2));
  const x = Math.floor(minX - PAD);
  const y = Math.floor(minY - PAD);
  const w = Math.ceil(maxX + PAD) - x;
  const h = Math.ceil(maxY + PAD) - y;
  return { viewBox: `${x} ${y} ${w} ${h}`, w, h, d: shapes.map((p) => p.d).join(" ") };
}

const svg = ({ viewBox, w, h }, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">${inner}</svg>\n`;

const full = compose(parts);
writeFileSync(
  "public/brand/wordmark.svg",
  svg(full, `<path d="${full.d}" fill="#000" fill-rule="nonzero"/>`)
);
// The ring is the stroke with the filled silhouette knocked back out of it, so
// only the half that falls OUTSIDE the letters survives. A plain stroke won't
// do: these fonts build a glyph from overlapping contours (the R's stem and
// bowl are separate pieces), and stroking them draws every internal seam.
const [vx, vy] = full.viewBox.split(" ");
const frame = `x="${vx}" y="${vy}" width="${full.w}" height="${full.h}"`;
writeFileSync(
  "public/brand/wordmark-outline.svg",
  svg(
    full,
    `<mask id="o" maskUnits="userSpaceOnUse" ${frame}>` +
      `<rect ${frame} fill="#fff"/><path d="${full.d}" fill="#000" fill-rule="nonzero"/></mask>` +
      `<path d="${full.d}" fill="none" stroke="#000" stroke-width="${RING * 2}" stroke-linejoin="round" mask="url(#o)"/>`
  )
);

const mono = compose(parts.filter((p) => ["R", "hair", "spark"].includes(p.name)));
writeFileSync(
  "public/brand/monogram.svg",
  svg(mono, `<path d="${mono.d}" fill="#000" fill-rule="nonzero"/>`)
);

console.log("wrote public/brand/wordmark.svg + wordmark-outline.svg + monogram.svg");
console.log(`viewBox      : ${full.viewBox}`);
console.log(`aspect-ratio : ${full.w} / ${full.h}   (${(full.w / full.h).toFixed(4)})`);
console.log(`monogram     : ${mono.viewBox}   (${(mono.w / mono.h).toFixed(4)})`);
console.log(`path length  : ${full.d.length} chars`);
console.log("\nshape   x1     x2     y1     y2");
for (const p of parts) {
  const b = p.box;
  console.log(
    `  ${p.name.padEnd(6)}${[b.x1, b.x2, b.y1, b.y2].map((v) => String(Math.round(v)).padStart(6)).join(" ")}`
  );
}
